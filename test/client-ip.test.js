import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

// The per-IP link cap (30 per hour) must key on the socket unless WELCOME_TRUST_PROXY=1.
const start=async(port,extraEnv)=>{
 const child=spawn(process.execPath,['server.js'],{env:{...process.env,HOST:'127.0.0.1',PORT:String(port),WELCOME_SESSION_FILE:'',WELCOME_DATA_DIR:mkdtempSync(path.join(tmpdir(),'welcome-ip-')),...extraEnv},stdio:'ignore'});
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/health`)).ok)return child;}catch{}await new Promise(r=>setTimeout(r,100));}
 child.kill('SIGTERM');throw Error('server did not start');
};
const session=(port,headers={})=>fetch(`http://127.0.0.1:${port}/api/session`,{method:'POST',headers:{'content-type':'application/json','x-welcome-client':'1',...headers},body:'{}'});

test('by default the per-IP cap ignores client-supplied IP headers',async()=>{
 const port=18810,child=await start(port,{});
 try{
  let ok=0,limited=0;
  for(let i=0;i<40;i++){const r=await session(port,i%2?{'cf-connecting-ip':`203.0.113.${i}`}:{'x-forwarded-for':`198.51.100.${i}`});if(r.status===200)ok++;else if(r.status===429)limited++;}
  assert.equal(ok,30,'rotating headers must not raise the cap');
  assert.equal(limited,10);
 }finally{child.kill('SIGTERM');}
});

test('WELCOME_TRUST_PROXY=1 makes the header value the cap key',async()=>{
 const port=18811,child=await start(port,{WELCOME_TRUST_PROXY:'1'});
 try{
  let ok=0;
  for(let i=0;i<40;i++){if((await session(port,{'cf-connecting-ip':`203.0.113.${i}`})).status===200)ok++;}
  assert.equal(ok,40,'each distinct header address gets its own cap');
  let sameOk=0,sameLimited=0;
  for(let i=0;i<31;i++){const r=await session(port,{'cf-connecting-ip':'203.0.113.200'});if(r.status===200)sameOk++;else if(r.status===429)sameLimited++;}
  assert.equal(sameOk,30,'one header address is still capped at 30 per hour');
  assert.equal(sameLimited,1);
 }finally{child.kill('SIGTERM');}
});
