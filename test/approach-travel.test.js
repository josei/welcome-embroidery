import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,initialDocument} from '../src/engine.js';
import {buildThreadPaths} from '../src/threadPaths.js';

const RED='#527461';

// A rectangle whose first stitch is well away from the hoop centre (0, 0).
function offsetPlan(){
  const doc=initialDocument();
  doc.objects=[{id:'r',name:'R',kind:'rect',x:30,y:20,w:20,h:10,thread:RED,stitch:'fill'}];
  return compile(doc);
}

test('the approach move from the hoop centre to the first stitch is drawn as travel', ()=>{
  const plan=offsetPlan();
  const first=plan.stitches.find(s=>s.cmd==='stitch');
  assert.ok(first,'the design has a stitch');
  assert.notEqual(plan.stitches[0].cmd,'stitch','the plan opens with a move, not a sewn stitch');
  const {travel}=buildThreadPaths(plan.stitches,plan.stitches.length,RED);
  assert.ok(travel.startsWith('M0,0L'),`travel starts at the hoop centre, got ${travel.slice(0,30)}`);
  const jump=plan.stitches[0];
  assert.ok(travel.startsWith(`M0,0L${jump.x},${jump.y}`),'first travel segment ends at the first move point');
});

test('the approach travel is not drawn as sewn thread', ()=>{
  const plan=offsetPlan();
  const {paths}=buildThreadPaths(plan.stitches,plan.stitches.length,RED);
  for(const d of paths.values())assert.ok(!d.startsWith('M0,0L'),'no sewn path starts at the origin');
  assert.ok(paths.size>0,'sewn thread is still drawn');
});

test('a plan that starts with a sewn stitch gets no line from the origin', ()=>{
  const stitches=[{x:5,y:5,cmd:'stitch',thread:RED},{x:6,y:5,cmd:'stitch',thread:RED}];
  const {travel,paths}=buildThreadPaths(stitches,2,RED);
  assert.equal(travel,'');
  assert.equal(paths.get(RED),'M5,5L6,5');
});
