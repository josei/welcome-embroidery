import test from 'node:test';
import assert from 'node:assert/strict';
import {createRelay} from '../server-relay.js';
import {agentStatusText} from '../src/agent.js';

const base={status:'waiting',mcpUrl:'https://x/mcp/t',agentLastSeen:null,agentCalls:0,message:''};

test('a fresh link reports its real remaining time, not zero, before the browser has polled',()=>{
  let clock=1_000_000;
  const relay=createRelay({idleMs:3_600_000,now:()=>clock});
  const session=relay.create();
  const s=relay.byOwner(session.ownerKey);
  assert.equal(relay.status(s).expiresInMs,3_600_000);
  clock+=600_000;
  assert.equal(relay.status(s).expiresInMs,3_000_000);
  clock+=3_000_000;
  assert.equal(relay.status(s).expiresInMs,0);
});

test('a revoke result is the whole status line, not prefixed by the waiting status',()=>{
  const message='Link revoked. Anything still using it is now locked out.';
  assert.equal(agentStatusText({...base,message}),message);
});

test('without a message the status text and request count are unchanged',()=>{
  assert.equal(agentStatusText(base),'Connected. Waiting for an agent to use the link.');
  assert.equal(agentStatusText({...base,status:'active',agentCalls:1}),'Agent active. 1 request so far.');
  assert.equal(agentStatusText({...base,status:'active',agentCalls:3}),'Agent active. 3 requests so far.');
  assert.equal(agentStatusText({...base,status:'idle'}),'Not connected.');
});
