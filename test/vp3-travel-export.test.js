import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,encode,importStitchLayer,initialDocument} from '../src/engine.js';
import {decodeEmbroidery} from '../src/readers.js';
import {pinnedMachineFixture} from './fixture-archive.js';

// A design with trims, jumps and colour blocks, imported from a VP3 file, must export to VP3 instead of being refused. Every written stitch lies on a
// planned line, and the colour-change count is the source's.

const colourChanges=cmds=>cmds.filter(s=>s.cmd==='color'||s.cmd==='stop').length;
const distToSegment=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy;const t=len2?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len2)):0;
  return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));};
function sourceLines(stitches){
  const segs=[];let prev=null;
  for(const s of stitches){if(prev&&s.cmd!=='end'&&s.cmd!=='color'&&prev.cmd!=='end')segs.push([prev,s]);if(s.cmd!=='end')prev=s;}
  return segs;
}

test('an imported VP3 design with trims and travel exports to VP3 and reads back on its lines', () => {
  const {bytes}=pinnedMachineFixture('vp3');
  const layer=importStitchLayer(bytes,'vp3',{fileName:'travel.vp3'});
  const doc={...initialDocument(),objects:[layer]};
  const plan=compile(doc);
  assert.deepEqual(plan.errors,[]);
  const out=encode(plan,'vp3',undefined,doc.hoop,doc);
  const decoded=decodeEmbroidery(out,'vp3');
  assert.equal(colourChanges(decoded.stitches),colourChanges(plan.stitches),'colour changes match the source');
  const segs=sourceLines(plan.stitches);
  for(const s of decoded.stitches.filter(s=>s.cmd==='stitch')){
    const near=Math.min(...segs.map(([a,b])=>distToSegment(s,a,b)));
    assert.ok(near<=0.1,`stitch ${s.x},${s.y} is ${near} mm from every source line`);
  }
});

test('an imported layer with a stop exports to VP3, the stop written as a colour change', () => {
  // A stop has no VP3 command, so it becomes a colour block. The reader gives back one colour change per stop, and the sewn needles stay on the planned line.
  const stitches=[
    {x:0,y:0,cmd:'stitch',thread:'#ff0000'},{x:5,y:0,cmd:'stop',thread:'#ff0000'},{x:5,y:0,cmd:'stitch',thread:'#ff0000'},{x:10,y:0,cmd:'stitch',thread:'#ff0000'},
    {x:10,y:0,cmd:'end',thread:'#ff0000'},
  ];
  const plan={errors:[],bounds:[0,0,10,0],count:4,stitches};
  const doc={...initialDocument(),objects:[{kind:'stitch_layer',visible:true,x:0,y:0,w:10,h:0,threadOverrides:{},thread:'#ff0000',
    source:{format:'vp3',bounds:[0,0,10,0],defaultPlacement:{x:0,y:0,w:10,h:0},originalBytesBase64:null,defaultThread:'#ff0000'},
    stitches,threads:[{color:'#ff0000'}]}]};
  const decoded=decodeEmbroidery(encode(plan,'vp3','#ff0000',doc.hoop,doc),'vp3');
  assert.equal(colourChanges(decoded.stitches),1,'the one stop reads back as one colour change');
  const needlesOut=decoded.stitches.filter(s=>s.cmd==='stitch').map(s=>[s.x,s.y]);
  assert.deepEqual(needlesOut.at(-1),[10,0]);
  for(const [x,y] of needlesOut)assert.ok(Math.abs(y)<=1e-6&&x>=-0.1&&x<=10.1,`needle ${x},${y} is off the planned line`);
});

test('a stop with no stitches before it, as the first command, still reads back as one change', () => {
  const stitches=[
    {x:0,y:0,cmd:'stop',thread:'#ff0000'},{x:0,y:0,cmd:'stitch',thread:'#ff0000'},{x:5,y:0,cmd:'stitch',thread:'#ff0000'},{x:5,y:0,cmd:'end',thread:'#ff0000'},
  ];
  const plan={errors:[],bounds:[0,0,5,0],count:3,stitches};
  const doc={...initialDocument(),objects:[{kind:'stitch_layer',visible:true,x:0,y:0,w:5,h:0,threadOverrides:{},thread:'#ff0000',
    source:{format:'vp3',bounds:[0,0,5,0],defaultPlacement:{x:0,y:0,w:5,h:0},originalBytesBase64:null,defaultThread:'#ff0000'},stitches,threads:[{color:'#ff0000'}]}]};
  const decoded=decodeEmbroidery(encode(plan,'vp3','#ff0000',doc.hoop,doc),'vp3');
  assert.equal(colourChanges(decoded.stitches),1);
});
