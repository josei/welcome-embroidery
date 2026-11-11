import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,encode,importStitchLayer,initialDocument} from '../src/engine.js';
import {decodeEmbroidery} from '../src/readers.js';
import {pinnedMachineFixture} from './fixture-archive.js';

// A design with trims, jumps and colour blocks, imported from a VP3 file, must export to VP3 instead of being refused. Every written stitch lies on a
// planned line (or, for an unchanged import, the source bytes), and the colour-change count is the source's.

const colourChanges=cmds=>cmds.filter(s=>s.cmd==='color'||s.cmd==='stop').length;
test('an imported VP3 design with trims and travel exports to VP3 and reads back on its lines', () => {
  const {bytes}=pinnedMachineFixture('vp3');
  const layer=importStitchLayer(bytes,'vp3',{fileName:'travel.vp3'});
  const doc={...initialDocument(),objects:[layer]};
  const plan=compile(doc);
  assert.deepEqual(plan.errors,[]);
  const out=encode(plan,'vp3',undefined,doc.hoop,doc);
  const decoded=decodeEmbroidery(out,'vp3');
  assert.equal(colourChanges(decoded.stitches),colourChanges(plan.stitches),'colour changes match the source');
  // An unchanged import is written back as its source bytes, so every stitch matches the source within 0.1 mm.
  const source=decodeEmbroidery(bytes,'vp3').stitches;
  assert.equal(Buffer.compare(Buffer.from(out),Buffer.from(bytes)),0);
  assert.equal(decoded.stitches.length,source.length);
  decoded.stitches.forEach((s,i)=>assert.ok(Math.hypot(s.x-source[i].x,s.y-source[i].y)<=0.1,`stitch ${i} moved`));
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
