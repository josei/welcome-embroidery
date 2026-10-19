// Userless agent relay. A browser tab creates a session and gets two secrets: a link token that it hands to an agent
// (part of the MCP URL) and an owner key that never leaves the tab and is needed to poll, reply and revoke.
// Documents stay in the browser; the server only forwards jobs from the agent's MCP calls and the browser's replies
// over long-polling (works through plain HTTP proxies and Cloudflare quick tunnels, which cannot stream SSE).
import crypto from 'node:crypto';
import fs from 'node:fs';
const sha=s=>crypto.createHash('sha256').update(String(s)).digest('hex');
const secret=bytes=>crypto.randomBytes(bytes).toString('base64url');
export const TOKEN_PATTERN=/^[A-Za-z0-9_-]{32,64}$/;

export function createRelay({idleMs=12*3600_000,maxSessions=5000,pollMs=25_000,callMs=20_000,connectedMs=40_000,maxQueue=16,perIpPerHour=30,storePath=null,now=()=>Date.now()}={}){
  const byToken=new Map(),byOwner=new Map(),creations=new Map();
  // Optional persistence: only SHA-256 hashes and timestamps are written, so a server restart keeps links valid without storing secrets.
  let saveTimer=null;const fresh=(tokenHash,ownerHash,created,lastSeen,lastAgent)=>({tokenHash,ownerHash,created,lastSeen,lastAgent,agentCalls:0,queue:[],poller:null,pending:new Map(),docs:new Map()});
  const persist=()=>{if(!storePath||saveTimer)return;saveTimer=setTimeout(()=>{saveTimer=null;try{const rows=[...byToken.values()].map(s=>[s.tokenHash,s.ownerHash,s.created,Math.max(s.lastSeen,0),s.lastAgent]);fs.writeFileSync(storePath+'.tmp',JSON.stringify(rows),{mode:0o600});fs.renameSync(storePath+'.tmp',storePath);}catch(error){console.warn('Could not persist relay sessions:',error.message);}},500);saveTimer.unref?.();};
  if(storePath)try{for(const [t,o,c,ls,la] of JSON.parse(fs.readFileSync(storePath,'utf8'))){if(typeof t==='string'&&typeof o==='string'&&now()-Math.max(ls||0,la||0,c)<idleMs){const s=fresh(t,o,c,0,la);byToken.set(t,s);byOwner.set(o,s);}}}catch{}
  const view=s=>({browserConnected:now()-s.lastSeen<connectedMs,agentLastSeen:s.lastAgent,agentCalls:s.agentCalls,expiresInMs:Math.max(0,idleMs-(now()-Math.max(s.lastSeen,s.lastAgent||0)))});
  const flush=(s)=>{if(!s.poller)return;const {res,timer}=s.poller;clearTimeout(timer);s.poller=null;respond(res,200,{jobs:s.queue.splice(0),...view(s)});};
  function respond(res,status,body){if(res.writableEnded||res.destroyed)return;res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));}
  function drop(s,reason){byToken.delete(s.tokenHash);byOwner.delete(s.ownerHash);persist();for(const p of s.pending.values()){clearTimeout(p.timer);p.reject(Error(reason));}s.pending.clear();if(s.poller){clearTimeout(s.poller.timer);respond(s.poller.res,401,{error:reason});s.poller=null;}}
  const gc=setInterval(()=>{const t=now();for(const s of [...byToken.values()])if(t-Math.max(s.lastSeen,s.lastAgent||0,s.created)>idleMs)drop(s,'Session expired.');for(const [ip,list] of creations){const fresh=list.filter(x=>t-x<3600_000);if(fresh.length)creations.set(ip,fresh);else creations.delete(ip);}},60_000);gc.unref?.();
  return {
    size:()=>byToken.size,
    create(ip='unknown'){const t=now(),list=(creations.get(ip)||[]).filter(x=>t-x<3600_000);if(list.length>=perIpPerHour)throw Object.assign(Error('Too many agent links created from this address. Try again later.'),{status:429});if(byToken.size>=maxSessions)throw Object.assign(Error('The relay is at capacity. Try again later.'),{status:503});list.push(t);creations.set(ip,list);
      const token=secret(24),ownerKey=secret(24),s=fresh(sha(token),sha(ownerKey),t,0,null);byToken.set(s.tokenHash,s);byOwner.set(s.ownerHash,s);persist();return {token,ownerKey};},
    byToken:token=>TOKEN_PATTERN.test(String(token))?byToken.get(sha(token)):undefined,
    byOwner:ownerKey=>typeof ownerKey==='string'&&ownerKey.length>=16&&ownerKey.length<=80?byOwner.get(sha(ownerKey)):undefined,
    revoke(s){drop(s,'This agent link was revoked.');},
    touchAgent(s){s.lastAgent=now();s.agentCalls++;},
    status:view,
    poll(s,res){s.lastSeen=now();if(s.poller){clearTimeout(s.poller.timer);respond(s.poller.res,200,{jobs:[],...view(s)});s.poller=null;}
      if(s.queue.length){respond(res,200,{jobs:s.queue.splice(0),...view(s)});return;}
      const timer=setTimeout(()=>{if(s.poller?.res===res){s.poller=null;respond(res,200,{jobs:[],...view(s)});}},pollMs);s.poller={res,timer};res.on('close',()=>{if(s.poller?.res===res){clearTimeout(timer);s.poller=null;}});},
    reply(s,id,{ok,result,error}){const p=s.pending.get(id);if(!p)return false;s.pending.delete(id);clearTimeout(p.timer);if(ok)p.resolve(result);else p.reject(Error(String(error||'The browser rejected the request.').slice(0,500)));return true;},
    callBrowser(s,type,payload={}){if(!s.poller&&now()-s.lastSeen>connectedMs)return Promise.reject(Error('No Welcome browser tab is attached to this agent link. Open the Welcome editor with this session (Agent button) and keep it open, or use a headless documentId from document_create.'));
      if(s.queue.length>=maxQueue)return Promise.reject(Error('Too many pending requests for this browser tab.'));
      return new Promise((resolve,reject)=>{const id=secret(9),timer=setTimeout(()=>{s.pending.delete(id);reject(Error('The browser tab did not answer in time. Check that it is open and try again.'));},callMs);s.pending.set(id,{resolve,reject,timer});s.queue.push({id,type,payload});flush(s);});},
  };
}
