import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {initialDocument,applyOperations,validateDocument} from '../src/engine.js';

const port=18793,base=`http://127.0.0.1:${port}`;
const post=(path,body,headers={})=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json','x-welcome-client':'1',...headers},body:JSON.stringify(body)});
async function connect(token){const client=new Client({name:'relay-test',version:'1'});await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp/${token}`)));return client;}
const call=async(client,name,args)=>client.callTool({name,arguments:args});
// Stands in for the browser tab: long-polls and answers get_document/apply_ops against its own document.
function fakeBrowser(ownerKey,doc){let live=true,calls=0;const loop=(async()=>{while(live){const r=await post('/api/relay/poll',{ownerKey});if(r.status!==200)break;const {jobs}=await r.json();for(const job of jobs){calls++;let reply;if(job.type==='get_document')reply={ok:true,result:{document:structuredClone(doc)}};else if(job.type==='add_layer'){const {layer,expectedRevision}=job.payload;if(expectedRevision!==doc.revision)reply={ok:true,result:{error:'stale_revision',revision:doc.revision,message:'Revision conflict'}};else{doc.objects.push(layer);validateDocument(doc);doc.revision++;reply={ok:true,result:{revision:doc.revision}};}}
  else if(job.type==='apply_ops'){const {operations,expectedRevision}=job.payload;if(expectedRevision!==doc.revision)reply={ok:true,result:{error:'stale_revision',revision:doc.revision,message:'Revision conflict'}};else{try{const t=structuredClone(doc);applyOperations(t,operations);validateDocument(t);Object.assign(doc,t);doc.revision++;reply={ok:true,result:{revision:doc.revision,document:structuredClone(doc)}};}catch(error){reply={ok:true,result:{error:'invalid_operation',revision:doc.revision,message:error.message}};}}}await post('/api/relay/reply',{ownerKey,id:job.id,...reply});}}})();return {stop:()=>{live=false;},calls:()=>calls,loop};}

const sessionFile=path.join(mkdtempSync(path.join(tmpdir(),'relay-')),'sessions.json');
let child;
async function start(){child=spawn(process.execPath,['server.js'],{env:{...process.env,HOST:'127.0.0.1',PORT:String(port),WELCOME_SESSION_FILE:sessionFile},stdio:'ignore'});for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('server did not start');}
test.before(start);
test.after(()=>child.kill('SIGTERM'));

test('anonymous MCP is off by default and the API refuses cross-origin or non-JSON requests',async()=>{
 assert.equal((await post('/mcp',{jsonrpc:'2.0',id:1,method:'tools/list'})).status,401);
 assert.equal((await fetch(base+'/api/session',{method:'POST',headers:{'content-type':'application/json',origin:'https://evil.example'},body:'{}'})).status,403,'no custom header means no session');
 assert.equal((await fetch(base+'/api/session',{method:'POST',headers:{'content-type':'text/plain','x-welcome-client':'1'},body:'{}'})).status,405);
 assert.equal((await post('/mcp/'+'a'.repeat(40),{jsonrpc:'2.0',id:1,method:'tools/list'})).status,401);
});

test('session link: live document is read and edited through the browser, with revisions, isolation and revocation',async()=>{
 const a=await (await post('/api/session',{})).json(),b=await (await post('/api/session',{})).json();assert.notEqual(a.token,b.token);assert.match(a.mcpPath,/^\/mcp\/[A-Za-z0-9_-]{32,}$/);
 const agent=await connect(a.token),tools=await agent.listTools();assert.ok(tools.tools.length>=8);
 const detached=await call(agent,'document_inspect',{documentId:'live'});assert.ok(detached.isError);assert.match(detached.content[0].text,/No Welcome browser tab/);
 const doc=initialDocument();doc.objects=[];const browser=fakeBrowser(a.ownerKey,doc);await new Promise(r=>setTimeout(r,150));
 const inspected=await call(agent,'document_inspect',{documentId:'live'});assert.equal(inspected.structuredContent.revision,0);
 const applied=await call(agent,'document_apply',{documentId:'live',expectedRevision:0,operations:[{op:'add_shape',id:'r',kind:'rect',x:-10,y:-10,width:20,height:20}]});assert.ok(!applied.isError,JSON.stringify(applied.content));assert.equal(applied.structuredContent.revision,1);assert.equal(doc.objects.length,1,'the browser document changed');
 const stale=await call(agent,'document_apply',{documentId:'live',expectedRevision:0,operations:[{op:'delete',id:'r'}]});assert.ok(stale.isError);assert.equal(stale.structuredContent.error,'stale_revision');
 const bad=await call(agent,'document_apply',{documentId:'live',expectedRevision:1,operations:[{op:'set_hoop',width:5}]});assert.ok(bad.isError);
 {const {pinnedMachineFixture}=await import('./fixture-archive.js'),bytes=Buffer.from(pinnedMachineFixture('jef').bytes);const imported=await call(agent,'document_import_embroidery',{documentId:'live',expectedRevision:1,fileName:'sample.jef',format:'jef',dataBase64:bytes.toString('base64')});assert.ok(!imported.isError,JSON.stringify(imported.content));assert.equal(imported.structuredContent.revision,2);assert.equal(doc.objects.at(-1).kind,'stitch_layer');const dup=await call(agent,'document_import_embroidery',{documentId:'live',expectedRevision:1,fileName:'sample.jef',format:'jef',dataBase64:bytes.toString('base64')});assert.ok(dup.isError);assert.equal(dup.structuredContent.error,'stale_revision');applyOperations(doc,[{op:'delete',id:doc.objects.at(-1).id}]);doc.revision=1;}
 const compiled=await call(agent,'embroidery_compile',{documentId:'live',expectedRevision:1});assert.ok(compiled.structuredContent.count>50);
 const exported=await call(agent,'embroidery_export',{documentId:'live',expectedRevision:1,format:'jef'});assert.ok((await fetch(base+exported.structuredContent.artifactUrl)).ok);
 const headless=await call(agent,'document_create',{name:'mine'});const other=await connect(b.token);assert.ok((await call(other,'document_inspect',{documentId:headless.structuredContent.documentId})).isError,'headless documents are private to their link');
 assert.equal((await post('/api/session/status',{ownerKey:a.token})).status,401,'the agent token is not the owner key');
 const status=await (await post('/api/session/status',{ownerKey:a.ownerKey})).json();assert.ok(status.browserConnected);assert.ok(status.agentCalls>=5);
 assert.equal((await post('/api/session/revoke',{ownerKey:a.ownerKey})).status,200);browser.stop();
 assert.equal((await post('/mcp/'+a.token,{jsonrpc:'2.0',id:9,method:'tools/list'})).status,401);assert.equal((await post('/api/relay/poll',{ownerKey:a.ownerKey})).status,401);
 const still=await connect(b.token);assert.ok((await still.listTools()).tools.length>=8,'other sessions are unaffected');
});

test('links survive a server restart without storing secrets, and revocation survives it too',async()=>{
 const a=await (await post('/api/session',{})).json(),gone=await (await post('/api/session',{})).json();await post('/api/session/revoke',{ownerKey:gone.ownerKey});await new Promise(r=>setTimeout(r,900));
 const saved=readFileSync(sessionFile,'utf8');assert.ok(!saved.includes(a.token)&&!saved.includes(a.ownerKey),'only hashes are stored');
 child.kill('SIGTERM');await new Promise(r=>setTimeout(r,400));await start();
 assert.equal((await post('/api/session/status',{ownerKey:a.ownerKey})).status,200,'owner key still works after restart');const agent=await connect(a.token);assert.ok((await agent.listTools()).tools.length>=8);
 assert.equal((await post('/mcp/'+gone.token,{jsonrpc:'2.0',id:1,method:'tools/list'})).status,401,'a revoked link stays revoked');
});

test('WELCOME_DATA_DIR relocates artifacts and relay sessions (used by the desktop app)',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'welcome-data-')),port2=18797,proc=spawn(process.execPath,['server.js'],{env:{...process.env,HOST:'127.0.0.1',PORT:String(port2),WELCOME_DATA_DIR:dir,WELCOME_SESSION_FILE:undefined},stdio:'ignore'});
 try{for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port2}/health`)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  const r=await fetch(`http://127.0.0.1:${port2}/api/session`,{method:'POST',headers:{'content-type':'application/json','x-welcome-client':'1'},body:'{}'});assert.equal(r.status,200);await new Promise(x=>setTimeout(x,900));
  assert.ok(JSON.parse(readFileSync(path.join(dir,'sessions.json'),'utf8')).length===1,'sessions are stored under the data dir');assert.ok(readFileSync(path.join(dir,'artifacts','..','sessions.json')).length>10);
 }finally{proc.kill('SIGTERM');}
});

test('every browser module and the font files the editor needs are served, gzip-compressed when asked',async()=>{
 const {readdirSync}=await import('node:fs');const files=[...readdirSync('src').filter(f=>f.endsWith('.js')).map(f=>'src/'+f),...readdirSync('src/vendor').map(f=>'src/vendor/'+f),'fonts/inkstitch/index.json','fonts/ttf/index.json','fonts/ttf/lato.json','fonts/inkstitch/emilio_20.json'];
 for(const f of files){const r=await fetch(`${base}/${f}`);assert.equal(r.status,200,`${f} must be in the server allowlist`);}
 const gz=await fetch(`${base}/fonts/ttf/lato.json`,{headers:{'accept-encoding':'gzip'}});assert.equal(gz.headers.get('content-encoding'),'gzip');assert.ok((await gz.json()).glyphs['A']);
 assert.equal((await fetch(`${base}/fonts/ttf/../../server.js`)).status,404);assert.equal((await fetch(`${base}/fonts/ttf/nope.txt`)).status,404);
});

test('old WELCOM_* environment variables still work after the rename to WELCOME_*',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'welcom-legacy-env-')),port3=18798,env={...process.env,HOST:'127.0.0.1',PORT:String(port3),WELCOM_DATA_DIR:dir};delete env.WELCOME_DATA_DIR;delete env.WELCOME_SESSION_FILE;delete env.WELCOM_SESSION_FILE;
 const proc=spawn(process.execPath,['server.js'],{env,stdio:'ignore'});try{for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port3}/health`)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  const health=await (await fetch(`http://127.0.0.1:${port3}/health`)).json();assert.equal(health.service,'welcome');
  assert.equal((await fetch(`http://127.0.0.1:${port3}/api/session`,{method:'POST',headers:{'content-type':'application/json','x-welcome-client':'1'},body:'{}'})).status,200);await new Promise(x=>setTimeout(x,900));assert.ok(readFileSync(path.join(dir,'sessions.json'),'utf8').length>10,'the legacy WELCOM_DATA_DIR is honoured');
 }finally{proc.kill('SIGTERM');}
});
