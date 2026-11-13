import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {startServer} from './server-process.js';

test('a test server starts on a free port and answers from its own process',async()=>{
  const {child,origin}=await startServer();
  try{
    const health=await fetch(origin+'/health');
    assert.equal(health.status,200);
    assert.equal(child.exitCode,null);
  }finally{child.kill('SIGTERM');}
});

test('a port already held by another process fails fast and names the port',async()=>{
  const occupant=net.createServer();
  await new Promise(resolve=>occupant.listen(0,'127.0.0.1',resolve));
  const {port}=occupant.address();
  const started=Date.now();
  try{
    await assert.rejects(startServer({port}),err=>{
      assert.match(err.message,new RegExp(`port ${port}`));
      return true;
    });
    assert.ok(Date.now()-started<8000,'the failure should not wait for the health check timeout');
  }finally{
    await new Promise(resolve=>occupant.close(resolve));
  }
});
