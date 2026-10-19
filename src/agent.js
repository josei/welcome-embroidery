// Browser side of the agent relay: owns the session secrets, long-polls for jobs from the server and answers them
// against the open document. The owner key stays in this tab's sessionStorage; the link token is what agents get.
const KEY='welcome.agentSession';
const json=(body,signal)=>({method:'POST',headers:{'content-type':'application/json','x-welcome-client':'1'},body:JSON.stringify(body),signal,credentials:'same-origin',cache:'no-store'});

export function createAgentBridge({getDocument,applyRemote,addLayerRemote,getReference,onChange}){
  let session=null,running=false,abort=null,state={status:'idle',mcpUrl:null,agentLastSeen:null,agentCalls:0,message:''};
  try{session=JSON.parse(sessionStorage.getItem(KEY)||'null');}catch{}
  const set=patch=>{state={...state,...patch};onChange?.(state);};
  const url=()=>session?`${location.origin}/mcp/${session.token}`:null;
  async function create(){
    let response;try{response=await fetch('/api/session',json({}));}catch{set({status:'unavailable',message:'The Welcome server is not reachable.'});return false;}
    if(response.status===404||response.status===405){set({status:'unavailable',message:'This copy of Welcome is a static site without the agent relay. Run the Welcome server or the desktop app to connect an agent.'});return false;}
    const body=await response.json().catch(()=>({}));if(!response.ok){set({status:'error',message:body.error||'Could not create an agent link.'});return false;}
    session={token:body.token,ownerKey:body.ownerKey};try{sessionStorage.setItem(KEY,JSON.stringify(session));}catch{}return true;
  }
  async function handle(job){
    try{
      if(job.type==='get_document')return {ok:true,result:{document:getDocument()}};
      if(job.type==='get_reference')return {ok:true,result:await getReference(job.payload||{})};
      if(job.type==='apply_ops'){return {ok:true,result:applyRemote(job.payload.operations,job.payload.expectedRevision)};}
      if(job.type==='add_layer')return {ok:true,result:addLayerRemote(job.payload.layer,job.payload.expectedRevision)};
      return {ok:false,error:`Unknown job type ${job.type}.`};
    }catch(error){return {ok:false,error:error.message};}
  }
  async function loop(){
    if(running)return;running=true;let failures=0;
    while(running&&session){
      abort=new AbortController();
      try{
        const response=await fetch('/api/relay/poll',json({ownerKey:session.ownerKey},abort.signal));
        if(response.status===401){session=null;try{sessionStorage.removeItem(KEY);}catch{}set({status:'idle',mcpUrl:null,message:'The agent link ended (expired or revoked).'});break;}
        if(!response.ok)throw Error(`poll ${response.status}`);
        failures=0;const body=await response.json();
        const active=body.agentLastSeen&&Date.now()-body.agentLastSeen<120_000;
        set({status:active?'active':'waiting',mcpUrl:url(),agentLastSeen:body.agentLastSeen,agentCalls:body.agentCalls,message:''});
        for(const job of body.jobs||[]){const reply=await handle(job);await fetch('/api/relay/reply',json({ownerKey:session.ownerKey,id:job.id,...reply}));}
      }catch(error){if(!running||error.name==='AbortError')break;failures++;set({status:'error',message:'Lost connection to the Welcome server; retrying…'});await new Promise(r=>setTimeout(r,Math.min(15000,1000*2**failures)));}
    }
    running=false;
  }
  return {
    state:()=>state,
    hasSession:()=>Boolean(session),
    async start(){if(!session&&!(await create()))return false;set({status:'waiting',mcpUrl:url()});loop();return true;},
    resume(){if(session){set({status:'waiting',mcpUrl:url()});loop();}},
    async revoke({renew=true}={}){
      const old=session;running=false;abort?.abort();session=null;try{sessionStorage.removeItem(KEY);}catch{}
      if(old)await fetch('/api/session/revoke',json({ownerKey:old.ownerKey})).catch(()=>{});
      set({status:'idle',mcpUrl:null,agentLastSeen:null,agentCalls:0,message:'Link revoked. Anything still using it is now locked out.'});
      if(renew)return this.start();
    },
  };
}
