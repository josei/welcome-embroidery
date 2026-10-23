import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {decodeEmbroidery} from '../src/readers.js';
import {compile,encode,importStitchLayer,initialDocument,applyOperations,validateDocument} from '../src/engine.js';
import {pinnedMachineFixture,readMachineFixtures} from './fixture-archive.js';

test('pinned JEF imports as preserved stitch data and exports the exact untouched source',()=>{
  const {fileName,bytes}=pinnedMachineFixture('jef'),decoded=decodeEmbroidery(bytes,'jef');
  const layer=importStitchLayer(bytes,'jef',{fileName}),doc=initialDocument();doc.objects=[layer];validateDocument(doc);
  assert.equal(layer.kind,'stitch_layer');assert.equal(layer.source.fileName,fileName);assert.deepEqual(layer.stitches,decoded.stitches);assert.deepEqual(layer.threads,decoded.threads);assert.deepEqual(layer.source.bounds,decoded.bounds);
  const plan=compile(doc);assert.equal(plan.count,decoded.stitches.filter(s=>s.cmd==='stitch').length);assert.deepEqual(plan.errors,[]);
  assert.deepEqual(encode(plan,'jef','#527461',doc.hoop,doc),bytes);
  const reopened=JSON.parse(JSON.stringify(doc));validateDocument(reopened);assert.deepEqual(reopened.objects[0].stitches,decoded.stitches);assert.equal(encode(compile(reopened),'jef','#527461',reopened.hoop,reopened).length,bytes.length);
});

test('stitch-layer transforms, thread replacement, hoop diagnostics and regenerated JEF preserve needle coordinates',()=>{
  const {bytes}=pinnedMachineFixture('jef'),doc=initialDocument(),layer=importStitchLayer(bytes,'jef');doc.objects=[layer];
  const before=structuredClone(layer.stitches),raw=layer.source.originalBytesBase64;
  applyOperations(doc,[{op:'transform',id:layer.id,x:layer.x+2,y:layer.y-1,rotation:2},{op:'set_object',id:layer.id,thread:'#aa5500'}]);
  assert.deepEqual(layer.stitches,before);assert.equal(layer.source.originalBytesBase64,raw);assert.ok(Object.keys(layer.threadOverrides).length>0);
  const plan=compile(doc);assert.deepEqual(plan.errors,[]);const output=encode(plan,'jef','#527461',doc.hoop,doc),decoded=decodeEmbroidery(output,'jef'),needle=decoded.stitches.filter(s=>s.cmd==='stitch'),planned=plan.stitches.filter(s=>s.cmd==='stitch');
  assert.equal(needle.length,planned.length);assert.deepEqual(needle.map(s=>[s.x,s.y]),planned.map(s=>[s.x,s.y]));
  applyOperations(doc,[{op:'transform',id:layer.id,x:200}]);assert.match(compile(doc).errors.join(' '),/exceeds the selected 110 mm hoop/);assert.throws(()=>encode(compile(doc),'jef','#527461',doc.hoop,doc),/exceeds the selected 110 mm hoop/);
});

test('same-count edits cannot pass through stale source bytes',()=>{
  const {bytes}=pinnedMachineFixture('jef'),doc=initialDocument(),layer=importStitchLayer(bytes,'jef');doc.objects=[layer];const first=layer.stitches.find(s=>s.cmd==='stitch');first.x+=1;
  const plan=compile(doc),output=encode(plan,'jef','#527461',doc.hoop,doc),decoded=decodeEmbroidery(output,'jef');assert.notDeepEqual(output,bytes);assert.equal(decoded.stitches.filter(s=>s.cmd==='stitch').length,plan.count);assert.deepEqual(decoded.stitches.filter(s=>s.cmd==='stitch').map(s=>[s.x,s.y]),plan.stitches.filter(s=>s.cmd==='stitch').map(s=>[s.x,s.y]));
});

test('pinned VP3 imports with retained source and its supported edited commands re-export with transformed coordinates',()=>{
  const {fileName,bytes}=pinnedMachineFixture('vp3'),decoded=decodeEmbroidery(bytes,'vp3'),doc=initialDocument(),layer=importStitchLayer(bytes,'vp3',{fileName});doc.objects=[layer];
  assert.deepEqual(layer.stitches,decoded.stitches);assert.deepEqual(compile(doc).errors,[]);assert.deepEqual(encode(compile(doc),'vp3','#527461',doc.hoop,doc),bytes);
  applyOperations(doc,[{op:'transform',id:layer.id,x:layer.x+1,y:layer.y-1,width:layer.w*.8,height:layer.h*.8,rotation:3}]);const plan=compile(doc);assert.deepEqual(plan.errors,[]);
  const output=encode(plan,'vp3','#527461',doc.hoop,doc),roundTrip=decodeEmbroidery(output,'vp3'),needle=roundTrip.stitches.filter(s=>s.cmd==='stitch');assert.equal(needle.length,plan.count);assert.deepEqual(needle.map(s=>[s.x,s.y]),plan.stitches.filter(s=>s.cmd==='stitch').map(s=>[s.x,s.y]));writeFileSync('/tmp/welcom-edited-import.vp3',output);writeFileSync('/tmp/welcom-edited-import-vp3-expected.json',JSON.stringify(plan.stitches.filter(s=>s.cmd==='stitch').map(s=>[s.x,s.y])));
});

test('VP3 color block at both zero axes nudges each origin axis without shifting needle coordinates',()=>{
  const plan={revision:0,errors:[],bounds:[0,0,6,6],count:4,stitches:[
    {x:5,y:5,cmd:'stitch',thread:'#527461'},
    {x:6,y:6,cmd:'stitch',thread:'#527461'},
    {x:0,y:0,cmd:'color',thread:'#d9897e'},
    {x:0,y:0,cmd:'stitch',thread:'#d9897e'},
    {x:1,y:1,cmd:'stitch',thread:'#d9897e'}
  ]};
  const output=encode(plan,'vp3','#527461'),expected=[[5,5],[6,6],[0,0],[1,1]];
  writeFileSync('/tmp/welcom-origin-zero-output.vp3',output);writeFileSync('/tmp/welcom-origin-zero-expected.json',JSON.stringify(expected));
});

test('mixed vector and two imported layers keep one terminal end and explicit color/travel continuity',()=>{
  const {bytes}=pinnedMachineFixture('jef'),doc=initialDocument(),first=importStitchLayer(bytes,'jef',{id:'layer-a',name:'First source'}),second=structuredClone(first);second.id='layer-b';second.name='Second source';doc.objects=[first,second,{id:'path-after',name:'Threaded path',kind:'path',x:0,y:0,w:0,h:0,points:[[0,0],[2,0]],thread:'#527461',stitch:'run'}];
  applyOperations(doc,[{op:'transform',id:'layer-b',x:5,y:5,width:45,height:45,rotation:3}]);const plan=compile(doc);assert.deepEqual(plan.errors,[]);assert.equal(plan.stitches.filter(s=>s.cmd==='end').length,1);assert.equal(plan.count,62);assert.ok(plan.stitches.some(s=>s.cmd==='color'));const output=encode(plan,'jef','#527461',doc.hoop,doc),decoded=decodeEmbroidery(output,'jef'),needle=plan.stitches.filter(s=>s.cmd==='stitch');assert.equal(decoded.stitches.filter(s=>s.cmd==='stitch').length,needle.length);assert.deepEqual(decoded.stitches.filter(s=>s.cmd==='stitch').map(s=>[s.x,s.y]),needle.map(s=>[s.x,s.y]));
  writeFileSync('/tmp/welcom-mixed-import.jef',output);writeFileSync('/tmp/welcom-mixed-import-expected.json',JSON.stringify(needle.map(s=>[s.x,s.y])));
});

test('malformed machine imports fail before changing project data and unsupported VP3 regeneration is explicit',()=>{
  assert.throws(()=>importStitchLayer(new Uint8Array([1,2,3]),'jef'),/Invalid embroidery file/);
  const [fileName,bytes]=[...readMachineFixtures()].find(([name])=>name.endsWith('/random1.vp3')),doc=initialDocument(),vp3Layer=importStitchLayer(bytes,'vp3',{fileName});doc.objects=[vp3Layer];applyOperations(doc,[{op:'transform',id:vp3Layer.id,x:vp3Layer.x+1}]);
  const plan=compile(doc);assert.throws(()=>encode(plan,'vp3','#527461',110,doc),/cannot preserve after edits/);
});

test('hoop bounds errors are returned for every editable and imported object kind',()=>{
  const variants=[
    {id:'r',kind:'rect',x:200,y:200,w:10,h:10,thread:'#527461',stitch:'fill'},
    {id:'e',kind:'ellipse',x:200,y:200,w:10,h:10,thread:'#527461',stitch:'fill'},
    {id:'p',kind:'path',x:200,y:200,w:0,h:0,points:[[200,200],[201,201]],thread:'#527461',stitch:'run'},
    {id:'t',kind:'text',text:'A',font:'welcom-mono/1',x:200,y:210,w:6,h:8,thread:'#527461',stitch:'run'}
  ];
  for(const object of variants){const doc=initialDocument();doc.objects=[object];assert.match(compile(doc).errors.join(' '),/exceeds the selected 110 mm hoop/,object.kind);}
  const doc=initialDocument(),machine=importStitchLayer(pinnedMachineFixture('jef').bytes,'jef');doc.objects=[machine];applyOperations(doc,[{op:'transform',id:machine.id,x:200}]);assert.match(compile(doc).errors.join(' '),/exceeds the selected 110 mm hoop/,'stitch_layer');
});

test('bounded maximum-size stitch-layer projects serialize and reopen within the browser limit',()=>{
  const needleCount=249999,offset=124,source=Buffer.alloc(offset+needleCount*2+4);source.writeUInt32LE(offset,0);source.writeUInt32LE(1,24);source.writeUInt32LE(needleCount,28);source.writeUInt32LE(1,116);source.fill(0,offset,offset+needleCount*2);source[offset+needleCount*2]=0x80;source[offset+needleCount*2+1]=0x10;
  const doc=initialDocument();doc.objects=[importStitchLayer(new Uint8Array(source),'jef',{fileName:'bounded.jef'})];const serialized=JSON.stringify(doc);assert.equal(doc.objects[0].stitches.length,250000);assert.ok(Buffer.byteLength(serialized)<33_554_432);const reopened=JSON.parse(serialized);validateDocument(reopened);assert.equal(compile(reopened).count,needleCount);
});

test('a true JEF STOP imports, edits and re-exports as a stop with its own thread slot',()=>{
 const bytes=Buffer.from(readMachineFixtures().get([...readMachineFixtures().keys()].find(n=>n.endsWith('/random1-ew.jef'))));bytes.writeUInt32LE(0,120);
 const layer=importStitchLayer(new Uint8Array(bytes),'jef',{fileName:'stop.jef'});assert.equal(layer.stitches.filter(s=>s.cmd==='stop').length,1);
 const doc=initialDocument();doc.objects=[layer];validateDocument(doc);applyOperations(doc,[{op:'transform',id:layer.id,x:layer.x+1}]);
 const plan=compile(doc);assert.deepEqual(plan.errors,[]);assert.equal(plan.stitches.filter(s=>s.cmd==='stop').length,1);
 const out=encode(plan,'jef','#527461',doc.hoop,doc),back=decodeEmbroidery(out,'jef');assert.equal(back.stitches.filter(s=>s.cmd==='stop').length,1,'the stop survives a write/read round trip');
 assert.equal(back.stitches.filter(s=>s.cmd==='stitch').length,plan.stitches.filter(s=>s.cmd==='stitch').length);
});

test('pinned SEW imports with its thread-chart colours, exports the untouched source and re-encodes after a move',()=>{
  const {fileName,bytes}=pinnedMachineFixture('sew'),decoded=decodeEmbroidery(bytes,'sew'),doc=initialDocument(),layer=importStitchLayer(bytes,'sew',{fileName});doc.objects=[layer];
  assert.deepEqual(layer.stitches,decoded.stitches);
  assert.ok(decoded.threads.length>1&&decoded.threads.every(t=>/^#[0-9a-f]{6}$/i.test(t.color)),'every SEW colour resolves to a thread-chart colour');
  assert.deepEqual(compile(doc).errors,[]);assert.deepEqual(encode(compile(doc),'sew','#527461',doc.hoop,doc),bytes);
  applyOperations(doc,[{op:'transform',id:layer.id,x:layer.x+1,y:layer.y-1}]);const plan=compile(doc);assert.deepEqual(plan.errors,[]);
  const output=encode(plan,'sew','#527461',doc.hoop,doc),back=decodeEmbroidery(output,'sew'),tenths=s=>[Math.round(s.x*10),Math.round(s.y*10)];
  // Zero-length steps leave no SEW record, and moves longer than 12.7 mm are split into several, so every planned needle that moves must appear in order.
  const steps=plan.stitches.filter(s=>s.cmd!=='end'&&s.cmd!=='trim').map(s=>({cmd:s.cmd,p:tenths(s)})).filter((s,i,a)=>i===0||s.p[0]!==a[i-1].p[0]||s.p[1]!==a[i-1].p[1]);
  const want=steps.filter(s=>s.cmd==='stitch').map(s=>s.p),got=back.stitches.filter(s=>s.cmd==='stitch').map(tenths);let next=0;
  for(const [x,y] of got)if(next<want.length&&want[next][0]===x&&want[next][1]===y)next++;
  assert.equal(next,want.length,'every planned needle point is written, in order');
});
