import {spawn} from 'node:child_process';
import net from 'node:net';

// A port the OS has just confirmed free. Binding port 0 and reading the port back avoids a fixed number that another
// process may already hold.
export const freePort=()=>new Promise((resolve,reject)=>{const probe=net.createServer();probe.once('error',reject);probe.listen(0,'127.0.0.1',()=>{const {port}=probe.address();probe.close(()=>resolve(port));});});

const healthy=async origin=>{try{return (await fetch(origin+'/health')).ok;}catch{return false;}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// Starts server.js on a free port (or the given one) and resolves once this child has printed its own listen line and
// answers /health. The health check alone would also pass for whatever else holds the port, so the child's own log is
// required too. If the child exits first (for example, the port is already in use), this rejects at once with the port
// and the child's output rather than letting the caller time out later.
export async function startServer({env={},port}={}){
  port??=await freePort();
  const origin=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,['server.js'],{env:{...process.env,HOST:'127.0.0.1',PORT:String(port),WELCOME_SESSION_FILE:'',...env},stdio:['ignore','pipe','pipe']});
  let log='';const collect=chunk=>{log+=chunk;};
  child.stdout.on('data',collect);child.stderr.on('data',collect);
  const deadline=Date.now()+10000;
  const listenLine=`listening on ${origin}`;
  for(;;){
    if(child.exitCode!==null||child.signalCode!==null)throw new Error(`Server could not start on port ${port}: the process exited (code ${child.exitCode}, signal ${child.signalCode}). Output: ${log.trim()}`);
    if(log.includes(listenLine)&&await healthy(origin))return {child,origin,port};
    if(Date.now()>deadline){child.kill('SIGTERM');throw new Error(`Server on port ${port} did not report listening and answer /health within 10s. Output: ${log.trim()}`);}
    await sleep(100);
  }
}
