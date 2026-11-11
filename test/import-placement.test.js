import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeEmbroidery} from '../src/readers.js';
import {compile,encode,importStitchLayer,initialDocument} from '../src/engine.js';
import {importMidpoint} from '../src/stitchImport.js';
import {readMachineFixtures} from './fixture-archive.js';

// Imported points are placed at centre + (source - midpoint). The default placement puts the source midpoint at the origin, so a
// midpoint that is off the 0.1 mm grid (here -0.55) used to shift every point off the grid, and the compiler's rounding then moved
// it by up to 0.07 mm. These tests pin the fix: default-placed points land on the grid, and every source point reads back from DST
// within 0.1 mm of an output point.

const machineFixture=(suffix)=>[...readMachineFixtures()].find(([name])=>name.endsWith(suffix));
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const onGrid=v=>Math.abs(v*10-Math.round(v*10))<1e-9;

// The placed position of a source point, as the compiler computes it for an unrotated, unscaled, default-placed stitch layer.
function placedSource(layer,s){
  const [mx,my]=importMidpoint(layer.source.bounds),cx=layer.x+layer.w/2,cy=layer.y+layer.h/2;
  return [cx+(s.x-mx),cy+(s.y-my)];
}

test('the import midpoint is the source midpoint rounded to the 0.1 mm grid, and never negative zero',()=>{
  const [mx0,my0]=importMidpoint([-47.9,-50,46.8,46.9]);
  assert.ok(onGrid(mx0)&&Math.abs(mx0-(-0.55))<=0.05+1e-9,"midpoint on the grid, within 0.05 mm of the true midpoint");
  assert.ok(onGrid(my0)&&Math.abs(my0-(-1.55))<=0.05+1e-9);
  assert.deepEqual(importMidpoint([-1,-1,1,1]),[0,0]);
  const [mx,my]=importMidpoint([-0.04,-0.04,0.02,0.02]);assert.ok(Object.is(mx,0)&&Object.is(my,0),'-0 would be written as a different value from 0');
});

test('random1.jef: a default-placed import keeps every source point on the 0.1 mm grid',()=>{
  const [fileName,bytes]=machineFixture('/random1.jef'),decoded=decodeEmbroidery(bytes,'jef'),layer=importStitchLayer(bytes,'jef',{fileName});
  const doc=initialDocument();doc.objects=[layer];assert.deepEqual(compile(doc).errors,[]);
  for(const s of decoded.stitches.filter(st=>st.cmd==='stitch')){const [x,y]=placedSource(layer,s);
    assert.ok(onGrid(x)&&onGrid(y),`source point ${s.x},${s.y} is placed at ${x},${y}, off the grid`);}
});

test('random1.jef: the DST export reads back every source point within 0.1 mm',()=>{
  const [fileName,bytes]=machineFixture('/random1.jef'),decoded=decodeEmbroidery(bytes,'jef'),layer=importStitchLayer(bytes,'jef',{fileName});
  const doc=initialDocument();doc.objects=[layer];const plan=compile(doc),back=decodeEmbroidery(encode(plan,'dst','#527461',doc.hoop,doc),'dst').stitches.filter(s=>s.cmd==='stitch').map(s=>[s.x,s.y]);
  for(const s of decoded.stitches.filter(st=>st.cmd==='stitch')){const p=placedSource(layer,s);
    const nearest=Math.min(...back.map(q=>dist(q,p)));assert.ok(nearest<=0.1+1e-9,`source point ${s.x},${s.y} is ${nearest.toFixed(3)} mm from the nearest output point`);}
});

test('every machine sample imports and reads back from DST within 0.1 mm of each source point',()=>{
  let checked=0;
  for(const [name,bytes] of readMachineFixtures()){
    const format=name.split('.').pop().toLowerCase();let decoded,layer;
    try{decoded=decodeEmbroidery(bytes,format);layer=importStitchLayer(bytes,format,{fileName:name});}catch{continue;}
    const source=decoded.stitches.filter(s=>s.cmd==='stitch');if(!source.length)continue;
    const doc=initialDocument();doc.objects=[layer];const plan=compile(doc);if(plan.errors.length)continue;
    const back=decodeEmbroidery(encode(plan,'dst','#527461',doc.hoop,doc),'dst').stitches.filter(s=>s.cmd==='stitch').map(s=>[s.x,s.y]);
    checked++;
    for(const s of source){const p=placedSource(layer,s);
      assert.ok(Math.min(...back.map(q=>dist(q,p)))<=0.1+1e-9,`${name}: source point ${s.x},${s.y} has no output point within 0.1 mm`);}
  }
  assert.ok(checked>100,`expected the machine samples to be checked, got ${checked}`);
});

// random1's source bounds have a midpoint half a step off the grid, so the placement rounds it toward zero. Its drawn points are then the
// source points themselves, and a file in its own format passes through as its source bytes. Each writer's own read-back must still
// match the placed points within 0.1 mm, so this covers the writer for each format random1 ships in.
test('random1 in its own format reads back within 0.1 mm of its placed points',()=>{
  for(const suffix of ['/random1-me.exp','/random1-me.vp3','/random1-me.TBF','/random1-me.jef']){
    const [name,bytes]=machineFixture(suffix),format=name.split('.').pop().toLowerCase();
    const decoded=decodeEmbroidery(bytes,format),layer=importStitchLayer(bytes,format,{fileName:name});
    const doc=initialDocument();doc.objects=[layer];const plan=compile(doc);assert.deepEqual(plan.errors,[]);
    const back=decodeEmbroidery(encode(plan,format,'#527461',doc.hoop,doc),format).stitches.filter(s=>s.cmd==='stitch').map(s=>[s.x,s.y]);
    for(const s of decoded.stitches.filter(st=>st.cmd==='stitch')){const p=placedSource(layer,s);
      assert.ok(Math.min(...back.map(q=>dist(q,p)))<=0.1+1e-9,`${name}: source point ${s.x},${s.y} has no output point within 0.1 mm`);}
  }
});

// Non-DST writers take the placement from before the 0.1 mm fix (the source's exact midpoint), so their bytes stay as they were.
// random1-wilcom-b.BRO has an off-grid midpoint; its writer stitches must be the exact-midpoint placement, and the DST plan the rounded one.
test('non-DST writers keep the exact-midpoint placement, and DST keeps the 0.1 mm grid placement',()=>{
  const [name,bytes]=machineFixture('/random1-wilcom-b.BRO'),decoded=decodeEmbroidery(bytes,'bro'),layer=importStitchLayer(bytes,'bro',{fileName:name});
  const b=layer.source.bounds;assert.ok(Math.abs(importMidpoint(b)[0]-(b[0]+b[2])/2)>1e-9,'the fixture midpoint is off the grid');
  const doc=initialDocument();doc.objects=[layer];const plan=compile(doc);
  const cx=layer.x+layer.w/2,cy=layer.y+layer.h/2,sx=layer.w/(b[2]-b[0]),sy=layer.h/(b[3]-b[1]);
  const exact=decoded.stitches.filter(s=>s.cmd==='stitch').map(s=>[Math.round((cx+(s.x-(b[0]+b[2])/2)*sx)*10)/10+0,Math.round((cy+(s.y-(b[1]+b[3])/2)*sy)*10)/10+0]);
  const writerNeedles=plan.writer.stitches.filter(s=>s.cmd==='stitch').map(s=>[s.x,s.y]);
  assert.equal(writerNeedles.length,exact.length);
  for(const [x,y] of exact.slice(0,50))assert.ok(writerNeedles.some(([wx,wy])=>Math.abs(wx-x)<1e-9&&Math.abs(wy-y)<1e-9),`writer point ${x},${y} is not the legacy placement`);
  assert.notDeepEqual(plan.stitches.filter(s=>s.cmd==='stitch').map(s=>[s.x,s.y]).slice(0,5),writerNeedles.slice(0,5),'DST plan is placed on the grid, not the writer placement');
});
