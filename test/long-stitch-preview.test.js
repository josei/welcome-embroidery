import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,encode,initialDocument,makeStitchLayer,validateDocument} from '../src/engine.js';
import {decodeEmbroidery} from '../src/readers.js';

// An imported long-stitch design exported to DST must sew the stitches the preview draws. The DST record limit is 12.1 mm, so a move between 12.1 and
// 12.7 mm used to be split by the DST writer only, and the preview showed one line for it. The plan now carries the split, so the preview and every writer agree.

const RED='#527461';
const WRITER_PLAN_LIMIT=12.1+1e-6;

// Three needles: a 13 mm move along x, a 20 mm diagonal (16 mm by 12 mm), and a 9 mm move that must stay whole.
const SOURCE=[
  {x:0,y:0,cmd:'stitch',thread:0},
  {x:13,y:0,cmd:'stitch',thread:0},
  {x:29,y:12,cmd:'stitch',thread:0},
  {x:38,y:12,cmd:'stitch',thread:0},
  {x:38,y:12,cmd:'end',thread:0},
];

function importedDocument(){
  const decoded={stitches:SOURCE,threads:[{index:0,color:RED}],bounds:[0,0,38,12]};
  const doc=initialDocument();
  doc.objects=[makeStitchLayer(decoded,'exp',{fileName:'long.exp'})];
  validateDocument(doc);
  return doc;
}

const needles=stitches=>stitches.filter(s=>s.cmd==='stitch');

// Distance from p to the segment a-b, in mm.
function distanceToSegment(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy;
  const t=len2?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len2)):0;
  return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
}

// The sewn lines the preview draws: each needle joined to the one before it.
function previewLines(plan){
  const lines=[];
  for(let i=1;i<plan.stitches.length;i++)if(plan.stitches[i].cmd==='stitch')lines.push([plan.stitches[i-1],plan.stitches[i]]);
  return lines;
}

test('an imported long-stitch design has no preview move longer than the DST record limit',()=>{
  const plan=compile(importedDocument());
  assert.deepEqual(plan.errors,[]);
  let prev=null,worst=0;
  for(const s of plan.stitches){
    if(s.cmd==='stitch'&&prev)worst=Math.max(worst,Math.hypot(s.x-prev.x,s.y-prev.y));
    if(s.cmd!=='end')prev=s;
  }
  assert.ok(worst<=WRITER_PLAN_LIMIT,`longest preview move ${worst} mm`);
});

test('the DST export sews the same number of stitches as the preview, on the preview lines',()=>{
  const doc=importedDocument();
  const plan=compile(doc);
  const bytes=encode(plan,'dst',RED,doc.hoop,doc);
  const sewn=needles(decodeEmbroidery(bytes,'dst').stitches);
  assert.equal(sewn.length,needles(plan.stitches).length,'DST stitch count matches the preview');
  const lines=previewLines(plan);
  for(const s of sewn)assert.ok(lines.some(l=>distanceToSegment(s,l[0],l[1])<=0.1+1e-6),`DST point ${s.x},${s.y} is off the preview`);
});

test('the JEF export sews the same number of stitches as the preview',()=>{
  const doc=importedDocument();
  const plan=compile(doc);
  const sewn=needles(decodeEmbroidery(encode(plan,'jef',RED,doc.hoop,doc),'jef').stitches);
  assert.equal(sewn.length,needles(plan.stitches).length,'JEF stitch count matches the preview');
});

test('a long-stitch import exported to DST ends on the same needle as the preview',()=>{
  const doc=importedDocument();
  const plan=compile(doc);
  const sewn=needles(decodeEmbroidery(encode(plan,'dst',RED,doc.hoop,doc),'dst').stitches);
  const want=needles(plan.stitches).at(-1);
  const last=sewn.at(-1);
  assert.ok(Math.abs(last.x-want.x)<=0.11&&Math.abs(last.y-want.y)<=0.11,`last DST needle ${last.x},${last.y} vs preview ${want.x},${want.y}`);
});
