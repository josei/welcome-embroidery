import {spawn,spawnSync} from 'node:child_process';
const port='18788',base=`http://127.0.0.1:${port}`;
const service=spawn(process.execPath,['server.js'],{env:{...process.env,HOST:'127.0.0.1',PORT:port,WELCOME_ANONYMOUS_MCP:'1',WELCOME_SESSION_FILE:''},stdio:'ignore'});
try{
 let ready=false;for(let i=0;i<100;i++){try{const r=await fetch(`${base}/health`);if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 if(!ready)throw Error('Local MCP test service did not become ready on 127.0.0.1:18788.');
 const result=spawnSync(process.execPath,['test/mcp-smoke.js'],{env:{...process.env,MCP_URL:`${base}/mcp`},stdio:'inherit'});if(result.status!==0)process.exitCode=result.status??1;
}finally{service.kill('SIGTERM');}
