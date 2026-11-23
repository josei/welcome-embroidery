import test from 'node:test';
import assert from 'node:assert/strict';
import {agentReachNote, bindScope, pageBindScope} from '../src/agentReach.js';

test('a server bound to loopback is local-only', () => {
  assert.equal(bindScope('127.0.0.1'), 'loopback');
  assert.equal(bindScope('localhost'), 'loopback');
  assert.equal(bindScope('::1'), 'loopback');
  assert.equal(bindScope('[::1]'), 'loopback');
  assert.equal(bindScope(), 'loopback');
});

test('a server bound to any other address can be reached from other machines', () => {
  assert.equal(bindScope('0.0.0.0'), 'wide');
  assert.equal(bindScope('::'), 'wide');
  assert.equal(bindScope('192.168.1.20'), 'wide');
});

test('the local sentence says the link works only on this computer', () => {
  assert.match(agentReachNote('loopback'), /only with an MCP client running on this computer/);
  assert.doesNotMatch(agentReachNote('loopback'), /other machines/);
});

test('the wide sentence says the link reaches other machines and that the design goes to any agent', () => {
  const note = agentReachNote('wide');
  assert.match(note, /reached from other machines/);
  assert.match(note, /any agent that connects/);
});

test('the page reads the bind mark, and treats a page without it as loopback', () => {
  const doc = (content) => ({querySelector: () => (content === undefined ? null : {getAttribute: () => content})});
  assert.equal(pageBindScope(doc('wide')), 'wide');
  assert.equal(pageBindScope(doc('loopback')), 'loopback');
  assert.equal(pageBindScope(doc(undefined)), 'loopback');
});
