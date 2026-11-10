import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,utimesSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {sweepExports,exportRetentionDays,DEFAULT_EXPORT_RETENTION_DAYS} from '../server-artifacts.js';

const DAY=24*60*60*1000;
const now=Date.parse('2026-11-10T12:00:00Z');
const backdate=(file,ms,base=Date.now())=>utimesSync(file,new Date(base-ms),new Date(base-ms));

test('sweep removes backdated export files and keeps fresh ones and saved documents', async () => {
 const dir=mkdtempSync(path.join(tmpdir(),'welcome-expiry-'));
 const names={old:`${crypto.randomUUID()}.jef`,fresh:`${crypto.randomUUID()}.svg`,oldDoc:`${crypto.randomUUID()}.welcome`,oldOther:'notes.txt'};
 for(const n of Object.values(names))writeFileSync(path.join(dir,n),'x');
 backdate(path.join(dir,names.old),8*DAY);
 backdate(path.join(dir,names.oldDoc),30*DAY);
 backdate(path.join(dir,names.oldOther),30*DAY);
 backdate(path.join(dir,names.fresh),6*DAY);
 const removed=await sweepExports(dir,{maxAgeMs:7*DAY,now});
 assert.deepEqual(removed,[names.old]);
 assert.equal(existsSync(path.join(dir,names.old)),false);
 assert.equal(existsSync(path.join(dir,names.fresh)),true);
 assert.equal(existsSync(path.join(dir,names.oldDoc)),true, 'saved documents are never swept');
 assert.equal(existsSync(path.join(dir,names.oldOther)),true, 'non-export names are never swept');
});

test('retention setting defaults to 7 days and accepts positive overrides only', () => {
 assert.equal(DEFAULT_EXPORT_RETENTION_DAYS,7);
 assert.equal(exportRetentionDays(undefined),7);
 assert.equal(exportRetentionDays(''),7);
 assert.equal(exportRetentionDays('0'),7);
 assert.equal(exportRetentionDays('-3'),7);
 assert.equal(exportRetentionDays('abc'),7);
 assert.equal(exportRetentionDays('2'),2);
 assert.equal(exportRetentionDays('0.5'),0.5);
});

test('server removes an expired export at startup and serves 404 for it', async () => {
 const port=8800+Math.floor(Math.random()*150);
 const dataDir=mkdtempSync(path.join(tmpdir(),'welcome-expiry-srv-'));
 const artifacts=path.join(dataDir,'artifacts');
 mkdirSync(artifacts,{recursive:true});
 const oldName=`${crypto.randomUUID()}.dst`,freshName=`${crypto.randomUUID()}.dst`,docName=`${crypto.randomUUID()}.welcome`;
 writeFileSync(path.join(artifacts,oldName),'old');
 writeFileSync(path.join(artifacts,freshName),'fresh');
 writeFileSync(path.join(artifacts,docName),'{}');
 backdate(path.join(artifacts,oldName),8*DAY);
 backdate(path.join(artifacts,docName),60*DAY);
 const child=spawn(process.execPath,['server.js'],{env:{...process.env,HOST:'127.0.0.1',PORT:String(port),WELCOME_SESSION_FILE:'',WELCOME_DATA_DIR:dataDir},stdio:'ignore'});
 try{
  let up=false;
  for(let i=0;i<100&&!up;i++){try{up=(await fetch(`http://127.0.0.1:${port}/health`)).ok;}catch{}if(!up)await new Promise(r=>setTimeout(r,100));}
  assert.ok(up,'server did not start');
  assert.equal((await fetch(`http://127.0.0.1:${port}/artifacts/${oldName}`)).status,404);
  assert.equal((await fetch(`http://127.0.0.1:${port}/artifacts/${freshName}`)).status,200);
  assert.equal((await fetch(`http://127.0.0.1:${port}/artifacts/${docName}`)).status,200);
 }finally{child.kill('SIGTERM');}
});
