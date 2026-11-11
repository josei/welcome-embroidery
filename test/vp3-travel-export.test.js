import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,encode,importStitchLayer,initialDocument} from '../src/engine.js';
import {decodeEmbroidery} from '../src/readers.js';
import {pinnedMachineFixture} from './fixture-archive.js';

// A design with trims, jumps and colour blocks, imported from a VP3 file, must export to VP3 instead of being refused. Every written stitch lies on a
// planned line, and the colour-change count is the source's.

const colourChanges=cmds=>cmds.filter(s=>s.cmd==='color').length;
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

test('a plan with a stop is still refused, and the message names the stop', () => {
  const plan={errors:[],bounds:[0,0,10,0],count:3,stitches:[
    {x:0,y:0,cmd:'stitch',thread:'#ff0000'},{x:5,y:0,cmd:'stop',thread:'#ff0000'},{x:10,y:0,cmd:'stitch',thread:'#ff0000'},{x:10,y:0,cmd:'end',thread:'#ff0000'},
  ]};
  const doc={...initialDocument(),objects:[{kind:'stitch_layer',visible:true,x:0,y:0,w:10,h:0,threadOverrides:{},thread:'#ff0000',
    source:{format:'vp3',bounds:[0,0,10,0],defaultPlacement:{x:0,y:0,w:10,h:0},originalBytesBase64:null,defaultThread:'#ff0000'},
    stitches:plan.stitches,threads:{}}]};
  assert.throws(()=>encode(plan,'vp3','#ff0000',doc.hoop,doc),/stop commands/);
});
