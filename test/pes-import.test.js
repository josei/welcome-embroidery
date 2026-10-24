import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {importStitchLayer,initialDocument,validateDocument,compile,encode} from '../src/engine.js';
import {withPesMetadata} from './pes-with-metadata.js';

const bytes=new Uint8Array(readFileSync(new URL('./fixtures/spiralbox-brother-v6.pes',import.meta.url)));
// A random sample with stitch steps of 50 to 80 mm: JEF cannot carry those.
const longSteps=new Uint8Array(readFileSync(new URL('./fixtures/brother-v6.pes',import.meta.url)));

test('a PES machine file imports as a stitch layer that validates, compiles and keeps its source bytes',()=>{
 const layer=importStitchLayer(bytes,'pes',{fileName:'spiralbox-brother-v6.pes'});
 assert.equal(layer.source.format,'pes');
 assert.ok(layer.stitches.some(s=>s.cmd==='stitch'),'the layer has needle stitches');
 const doc=initialDocument();doc.objects=[layer];validateDocument(doc);
 assert.deepEqual(compile(doc).errors,[]);
 assert.equal(Buffer.from(layer.source.originalBytesBase64,'base64').length,bytes.length,'the original PES bytes are kept');
});

test('a PES file whose PEC offset points past the end is refused, and a file without the PES signature is refused',()=>{
 const broken=new Uint8Array(bytes);new DataView(broken.buffer).setUint32(8,broken.length+10,true);
 assert.throws(()=>importStitchLayer(broken,'pes'),/outside the file/);
 const notPes=new Uint8Array(bytes);notPes.set(new TextEncoder().encode('#XES0001'),0);
 assert.throws(()=>importStitchLayer(notPes,'pes'),/signature/);
});

test('a PES layer exports to JEF when its steps fit, and a sample with steps over 12.7 mm is refused by JEF but exports to DST',()=>{
 const layer=importStitchLayer(bytes,'pes');const doc=initialDocument();doc.objects=[layer];validateDocument(doc);
 assert.ok(encode(compile(doc),'jef',{},doc).length>0,'the spiral design exports as JEF');
 const long=importStitchLayer(longSteps,'pes');const longDoc=initialDocument();longDoc.objects=[long];validateDocument(longDoc);
 const longPlan=compile(longDoc);
 assert.throws(()=>encode(longPlan,'jef',{},longDoc),/12\.7 mm/,'JEF refuses a step longer than 12.7 mm');
 assert.ok(encode(longPlan,'dst',{},longDoc).length>0,'DST splits the long steps into jumps');
});

test('PES header metadata names the layer and fills its source; a sample with empty fields has none; bad metadata is refused',()=>{
 const withName=withPesMetadata(bytes,{name:'Spiral box',author:'Jose Ignacio',comments:'Test note'});
 const layer=importStitchLayer(withName,'pes',{name:'Imported embroidery',fileName:'spiral.pes'});
 assert.equal(layer.name,'Spiral box','the file name becomes the layer name');
 assert.deepEqual(layer.source.metadata,{name:'Spiral box',author:'Jose Ignacio',comments:'Test note'});
 assert.equal(layer.stitches.length,importStitchLayer(bytes,'pes',{}).stitches.length,'the stitches are the same as the unnamed sample');
 const plain=importStitchLayer(bytes,'pes',{name:'Imported embroidery'});
 assert.equal(plain.name,'Imported embroidery');assert.equal(plain.source.metadata,undefined);
 const doc=initialDocument();doc.objects=[layer];validateDocument(doc);
 const bad=structuredClone(layer);bad.source.metadata={name:'x'.repeat(300)};doc.objects=[bad];
 assert.throws(()=>validateDocument(doc),/invalid file metadata/);
});
