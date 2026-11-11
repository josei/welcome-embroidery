import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,encode,initialDocument} from '../src/engine.js';
import {decodeEmbroidery} from '../src/readers.js';

// A non-jump move longer than 12.7 mm must never reach a PEC, PES, PES v6 or VP3 file: the writers split it.
// The injected move is 39 mm, the length the triage saw in design D7.

const LIMIT=12.7+1e-6;
const RED='#527461';

// A plan with one 39 mm stitch added after its first needle point, so the move is not a jump.
function planWithLongMove(){
  const doc=initialDocument();
  doc.objects=[{id:'r',name:'R',kind:'rect',x:-20,y:-10,w:40,h:20,thread:RED,stitch:'fill'}];
  const plan=compile(doc);
  const first=plan.stitches.findIndex(s=>s.cmd==='stitch');
  assert.ok(first>=0,'the test design has a stitch');
  const from=plan.stitches[first];
  const stitches=[...plan.stitches];
  stitches.splice(first+1,0,{x:from.x+39,y:from.y,cmd:'stitch',thread:from.thread});
  return {plan:{...plan,stitches},to:{x:from.x+39,y:from.y}};
}

// Largest distance between consecutive non-jump stitches of a decoded file, in mm.
function longestStitchMove(decoded){
  let prev=null,worst=0;
  for(const s of decoded.stitches){
    if(s.cmd==='stitch'&&prev)worst=Math.max(worst,Math.hypot(s.x-prev.x,s.y-prev.y));
    if(s.cmd!=='end')prev=s;
  }
  return worst;
}

const CASES=[
  {format:'pec',reader:'pec'},
  {format:'pes',reader:'pes'},
  {format:'pes6',reader:'pes'},
  {format:'vp3',reader:'vp3'},
];

for(const {format,reader} of CASES){
  test(`${format}: a 39 mm move is split into stitches of at most 12.7 mm`,()=>{
    const {plan,to}=planWithLongMove();
    const bytes=encode(plan,format,RED);
    const decoded=decodeEmbroidery(bytes,reader);
    assert.ok(longestStitchMove(decoded)<=LIMIT,`${format} longest move ${longestStitchMove(decoded)} mm`);
    // The split keeps the stitch's destination, so the decoded file reaches the injected point.
    assert.ok(decoded.stitches.some(s=>s.cmd==='stitch'&&Math.abs(s.x-to.x)<=0.11&&Math.abs(s.y-to.y)<=0.11),`${format} reaches the injected point`);
  });
}

test('jef still refuses a 39 mm move with a clear message',()=>{
  const {plan}=planWithLongMove();
  assert.throws(()=>encode(plan,'jef',RED),/JEF stitch delta exceeds 12\.7 mm/);
});

test('an imported stitch layer with a long move is re-encoded, not passed through',async()=>{
  const {hasLongStitch}=await import('../src/encoders.js');
  assert.equal(hasLongStitch([{x:0,y:0,cmd:'stitch'},{x:39,y:0,cmd:'stitch'}]),true);
  assert.equal(hasLongStitch([{x:0,y:0,cmd:'stitch'},{x:39,y:0,cmd:'jump'},{x:40,y:0,cmd:'stitch'}]),false);
  assert.equal(hasLongStitch([{x:0,y:0,cmd:'stitch'},{x:12,y:0,cmd:'stitch'}]),false);
});
