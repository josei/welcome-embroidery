import test from 'node:test';
import assert from 'node:assert/strict';
import {encode} from '../src/engine.js';
import {decodeEmbroidery} from '../src/readers.js';

// Colour changes and block starts must survive a write: the number of colour changes in a plan is the number the file carries, the first stitch of a
// block sits on the plan's path, and COL lists every colour the design names, including a colour whose block holds only jumps.

const A='#ed171f', B='#0b3d91', C='#2f7e20', D='#ffd911';
const needles=cmds=>cmds.filter(s=>s.cmd==='stitch').map(s=>[s.x,s.y]);
const colourChanges=cmds=>cmds.filter(s=>s.cmd==='color').length;

// A design that starts with a colour change before any stitch, then changes to B, C and D: four colour changes in all.
function leadingChangePlan(){
  return {errors:[],bounds:[0,0,15,5],count:4,stitches:[
    {x:0,y:0,cmd:'color',thread:A},
    {x:5,y:0,cmd:'stitch',thread:A},
    {x:5,y:0,cmd:'color',thread:B},
    {x:10,y:0,cmd:'stitch',thread:B},
    {x:10,y:0,cmd:'color',thread:C},
    {x:10,y:5,cmd:'stitch',thread:C},
    {x:10,y:5,cmd:'color',thread:D},
    {x:15,y:5,cmd:'stitch',thread:D},
    {x:15,y:5,cmd:'end',thread:D},
  ]};
}

test('VP3 keeps a colour change that comes before the first stitch', () => {
  const plan=leadingChangePlan();
  const decoded=decodeEmbroidery(encode(plan,'vp3',A),'vp3');
  assert.equal(colourChanges(decoded.stitches),colourChanges(plan.stitches),'colour changes survive the VP3 write');
  assert.deepEqual(needles(decoded.stitches),needles(plan.stitches),'needles stay on their planned points');
});

test('VP3 starts the first block on the first stitch, not on a line from the machine origin', () => {
  // The first stitch is 30 mm from the origin. Splitting it against the origin used to sew extra needles on the way from (0, 0), a line the plan never had.
  const plan={errors:[],bounds:[30,0,35,5],count:3,stitches:[
    {x:30,y:0,cmd:'stitch',thread:A},
    {x:30,y:5,cmd:'stitch',thread:A},
    {x:35,y:5,cmd:'stitch',thread:A},
  ]};
  const decoded=decodeEmbroidery(encode(plan,'vp3',A),'vp3');
  assert.deepEqual(needles(decoded.stitches),needles(plan.stitches));
});

test('a long move inside a colour block is still split, on its own line, in VP3', () => {
  // A 20 mm sewn move after a colour change must be split for VP3's 12.7 mm limit. Every split needle lies on the planned move.
  const plan={errors:[],bounds:[0,0,20,0],count:2,stitches:[
    {x:0,y:0,cmd:'stitch',thread:A},
    {x:0,y:0,cmd:'color',thread:B},
    {x:20,y:0,cmd:'stitch',thread:B},
  ]};
  const decoded=decodeEmbroidery(encode(plan,'vp3',A),'vp3');
  const last=decoded.stitches.filter(s=>s.cmd==='stitch').at(-1);
  assert.deepEqual([last.x,last.y],[20,0]);
  for(const s of decoded.stitches.filter(s=>s.cmd==='stitch'))assert.ok(Math.abs(s.y)<=1e-6&&s.x>=-0.1&&s.x<=20.1,`needle ${s.x},${s.y} is off the planned line`);
});

test('COL lists the colour of a block that holds only jumps before the first change', () => {
  // The block in colour A has no stitches: it is only jumps, then a change to B. A still belongs to the design's colours.
  const plan={errors:[],bounds:[0,0,5,0],count:1,stitches:[
    {x:0,y:0,cmd:'jump',thread:A},
    {x:5,y:0,cmd:'jump',thread:A},
    {x:5,y:0,cmd:'color',thread:B},
    {x:5,y:0,cmd:'stitch',thread:B},
    {x:5,y:0,cmd:'end',thread:B},
  ]};
  const decoded=decodeEmbroidery(encode(plan,'col',A),'col');
  assert.deepEqual(decoded.threads.map(t=>t.color),[A,B]);
});

test('COL writes all eight colours of a design, including an empty block', () => {
  const colours=['#111111','#222222','#333333','#444444','#555555','#666666','#777777','#888888'];
  const stitches=[];
  colours.forEach((c,i)=>{
    // Block 3 (index 2) has no stitches: it goes straight to the next colour change.
    if(i>0)stitches.push({x:i,y:0,cmd:'color',thread:c});
    if(i!==2)stitches.push({x:i,y:0,cmd:'stitch',thread:c});
  });
  stitches.push({x:9,y:0,cmd:'end',thread:colours.at(-1)});
  const decoded=decodeEmbroidery(encode({errors:[],bounds:[0,0,9,0],count:7,stitches},'col',A),'col');
  assert.deepEqual(decoded.threads.map(t=>t.color),colours);
});
