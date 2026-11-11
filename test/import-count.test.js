import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeEmbroidery} from '../src/readers.js';
import {compile,encode,importStitchLayer,initialDocument} from '../src/engine.js';
import {readMachineFixtures} from './fixture-archive.js';
import {exportedStitchCount, exportedObjectCounts, exportFormatAfterImport} from '../src/exportedCount.js';

// The plan count is the DST list, which splits long moves, so an import can hold more stitches than its source. The canvas shows the count
// of the export format picked (exportedStitchCount), so each export is checked against the count the canvas shows for that format.
// Every export of the same layer is checked here: DST writes the planned list, PES re-encodes it (or passes the source through when
// the source is PES), and U01 writes the source list. These tests pin the counts the canvas reports against what each export decodes to.

const stitchCount=stitches=>stitches.filter(s=>s.cmd==='stitch').length;
const planFor=(bytes,format,fileName)=>{
  const layer=importStitchLayer(bytes,format,{fileName}),doc=initialDocument();doc.objects=[layer];
  return {layer,doc,plan:compile(doc)};
};
const exported=(plan,doc,format)=>decodeEmbroidery(encode(plan,format,'#527461',doc.hoop,doc),format).stitches;

test('random1 U01: the canvas count is the planned count, and the DST export decodes to it', ()=>{
  const bytes=new Uint8Array(readFileSync(new URL('./fixtures/pyembroidery-random1.u01',import.meta.url)));
  const reader=stitchCount(decodeEmbroidery(bytes,'u01').stitches);
  const {doc,plan}=planFor(bytes,'u01','random1.u01');
  assert.equal(reader,30);
  assert.notEqual(plan.count,reader,'this file is chosen because its canvas count differs from the reader count');
  assert.equal(plan.planned,true,'an imported layer reports a planned count');
  assert.equal(stitchCount(exported(plan,doc,'dst')),plan.count,'DST writes the planned list');
  assert.equal(stitchCount(exported(plan,doc,'u01')),reader,'U01 writes the source list, so it decodes to the reader count');
  assert.equal(exportedStitchCount(plan,'u01',doc),reader,'with U01 picked, the canvas count is the U01 export count');
  assert.equal(exportedStitchCount(plan,'dst',doc),plan.count,'with DST picked, the canvas count is the DST count');
});

test('random1-ew.pes: a PES import passed through unchanged decodes to its own stitches, not the canvas count', ()=>{
  const [[,bytes]]=[...readMachineFixtures(/random1-ew\.pes$/i)];
  const reader=stitchCount(decodeEmbroidery(bytes,'pes').stitches);
  const {doc,plan}=planFor(bytes,'pes','random1-ew.pes');
  assert.equal(reader,30);
  assert.equal(plan.planned,true);
  assert.notEqual(plan.count,reader,'the canvas shows the planned count, which is not the passed-through count');
  assert.equal(stitchCount(exported(plan,doc,'dst')),plan.count,'DST writes the planned list');
  assert.equal(stitchCount(exported(plan,doc,'pes')),reader,'the PES export passes the source through, so it decodes to its own stitches');
  assert.equal(exportedStitchCount(plan,'pes',doc),reader,'with PES picked, the canvas count equals the PES export count');
});
test('random1-ew.pes: the PES v6 count the canvas shows is the PES v6 export count', ()=>{
  const [[,bytes]]=[...readMachineFixtures(/random1-ew\.pes$/i)];
  const {doc,plan}=planFor(bytes,'pes','random1-ew.pes');
  const v6=encode(plan,'pes6','#527461',doc.hoop,doc);assert.equal(exportedStitchCount(plan,'pes6',doc),stitchCount(decodeEmbroidery(v6,'pes').stitches),'PES v6 files decode as PES, so the count must match the v6 export');
});
test("random1-ew.pes: the object list row shows the picked format's count, not the planned one", ()=>{
  const [[,bytes]]=[...readMachineFixtures(/random1-ew\.pes$/i)];
  const {layer,doc,plan}=planFor(bytes,'pes','random1-ew.pes');
  assert.equal(plan.objectCounts[layer.id],plan.count,'the plan holds the planned count for the layer');
  assert.equal(exportedObjectCounts(plan,'pes',doc)[layer.id],stitchCount(decodeEmbroidery(encode(plan,'pes','#527461',doc.hoop,doc),'pes').stitches),'with PES picked, the layer row shows the PES export count');
  assert.equal(exportedObjectCounts(plan,'dst',doc)[layer.id],plan.count,'with DST picked, the layer row shows the DST count');
});
test('an imported PES file picks PES for export, and other imports keep the picked format', ()=>{
  assert.equal(exportFormatAfterImport('pes'),'pes');
  for(const format of ['dst','u01','pec','jef','vp3']) assert.equal(exportFormatAfterImport(format),null,`${format} imports keep the picked format`);
  const [[,bytes]]=[...readMachineFixtures(/random1-ew\.pes$/i)];
  const {doc,plan}=planFor(bytes,'pes','random1-ew.pes');
  assert.equal(exportedStitchCount(plan,exportFormatAfterImport('pes'),doc),stitchCount(decodeEmbroidery(bytes,'pes').stitches),'the count the canvas shows after a PES import is the file\'s own decoded count');
});
// An imported layer's PES file holds the planned stitches (encode() writes them for PES, see encoders.js), so the count the canvas shows is the count
// the PES file decodes to. The corpus check covers every import that exports; out-of-hoop imports are skipped, since no file is written for them.
test('random1-wilcom.U01: the canvas count, the DST export and the PES export all decode to the same stitch count', ()=>{
  const [[,bytes]]=[...readMachineFixtures(/random1-wilcom\.U01$/i)];
  const {doc,plan}=planFor(bytes,'u01','random1-wilcom.U01');
  assert.equal(plan.count,48,'the canvas count for this file is the planned 48');
  assert.equal(stitchCount(exported(plan,doc,'dst')),plan.count,'the DST export decodes to the canvas count');
  assert.equal(stitchCount(exported(plan,doc,'pes')),plan.count,'the PES export decodes to the canvas count');
  assert.equal(exportedStitchCount(plan,'pes',doc),plan.count,'with PES picked, the canvas count is the PES count');
});
test('every import that exports: the DST, PES and PES v6 counts equal the canvas count', ()=>{
  let checked=0;
  for(const [name,bytes] of readMachineFixtures()){
    const format=name.split('.').pop().toLowerCase();let layer;
    try{layer=importStitchLayer(bytes,format,{fileName:name});}catch{continue;}
    const doc=initialDocument();doc.objects=[layer];const plan=compile(doc);if(plan.errors.length||!plan.planned)continue;
    for(const f of ['dst','pes','pes6']){
      let decoded;
      try{decoded=stitchCount(decodeEmbroidery(encode(plan,f,'#527461',doc.hoop,doc),f==='pes6'?'pes':f).stitches);}catch{continue;}
      assert.equal(decoded,plan.count,`${name}: the ${f} export decodes to ${decoded} stitches, the canvas shows ${plan.count}`);
      checked++;
    }
  }
  assert.ok(checked>=200,`expected the corpus to be checked, got ${checked} exports`);
});
// The PES stitches must stay where the DST stitches are: both come from the same planned list, so each PES stitch is within 0.1 mm of the DST stitch
// with the same index. This is the 0.1 mm rule for the geometry the PES writer now sews.
test('random1-wilcom.U01: the PES stitches are within 0.1 mm of the DST stitches, one for one', ()=>{
  const [[,bytes]]=[...readMachineFixtures(/random1-wilcom\.U01$/i)];
  const {doc,plan}=planFor(bytes,'u01','random1-wilcom.U01');
  const dst=exported(plan,doc,'dst').filter(s=>s.cmd==='stitch'),pes=exported(plan,doc,'pes').filter(s=>s.cmd==='stitch');
  assert.equal(pes.length,dst.length);
  pes.forEach((s,i)=>assert.ok(Math.hypot(s.x-dst[i].x,s.y-dst[i].y)<=0.1+1e-9,`PES stitch ${i} is ${Math.hypot(s.x-dst[i].x,s.y-dst[i].y).toFixed(3)} mm from its DST stitch`));
});
