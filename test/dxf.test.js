import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseDxf,dxfDocument,exportDxf} from '../src/dxf.js';
import {initialDocument,applyOperations} from '../src/engine.js';

const fixture=readFileSync(new URL('../fixtures/dxf/simple.dxf',import.meta.url),'utf8');
const ascii=(body)=>['0','SECTION','2','ENTITIES',...body,'0','ENDSEC','0','EOF'].join('\n')+'\n';

test('a LINE and a closed LWPOLYLINE become two paths with the right points, flipped to y-down and centred on the hoop',()=>{
 const {doc,skipped}=dxfDocument(fixture);
 assert.equal(doc.objects.length,2);
 const [line,shape]=doc.objects;
 // The LINE runs from (0,0) to (20,0) in DXF; the bounding box of all points is 0..20 by 0..30 (DXF), so the centre is (10,15). Flipped to y-down and centred, the line sits at y = +15 mm and its ends at x = -10 and +10.
 assert.deepEqual(line.points.map(([x,y])=>[+x.toFixed(3),+y.toFixed(3)]),[[-10,15],[10,15]]);
 assert.equal(line.closed,undefined,'a LINE is open');
 assert.equal(shape.closed,true,'a closed LWPOLYLINE stays closed');
 assert.equal(shape.points.length,4,'the closing vertex is not repeated');
 assert.deepEqual(skipped,{CIRCLE:1},'the CIRCLE is reported as skipped, not imported');
});

test('binary DXF is refused with a message, and a file with no line or polyline is refused',()=>{
 assert.throws(()=>dxfDocument('AutoCAD Binary DXF\r\n\x1a\x00'),/Binary DXF/);
 assert.throws(()=>dxfDocument(ascii(['0','CIRCLE','8','0','10','1','20','1','40','2'])),/no LINE or LWPOLYLINE/);
});

test('bulged polyline arcs are counted and sewn as straight segments, and a malformed group code is refused',()=>{
 const src=ascii(['0','LWPOLYLINE','90','2','70','0','10','0','20','0','42','0.5','10','10','20','0']);
 const r=parseDxf(src);
 assert.equal(r.bulged,1,'one polyline with a bulge is reported');
 assert.equal(r.paths[0].points.length,2);
 assert.throws(()=>parseDxf('0\nSECTION\nx\nENTITIES\n'),/group code/);
});

test('a closed rectangle exported as DXF reads back as a closed path of the same size, and an open line as a LINE',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:-20,y:-15,width:40,height:30,stitch:'fill'},{op:'add_path',id:'l',x:0,y:0,points:[[-30,0],[-10,0]],stitch:'run'}]);
 const {text,count,skipped}=exportDxf(doc);
 assert.match(text,/\nLWPOLYLINE\n/,'the rectangle is an LWPOLYLINE');assert.match(text,/\nLINE\n/,'the open line is a LINE');
 assert.equal(count,2);assert.deepEqual(skipped,{});
 const back=dxfDocument(text).doc.objects;
 const rect=back.find(o=>o.closed);assert.ok(rect,'the rectangle reads back closed');
 assert.equal(rect.points.length,4,'four corners, the closing vertex not repeated');
 const xs=rect.points.map(p=>p[0]),ys=rect.points.map(p=>p[1]);assert.ok(Math.abs((Math.max(...xs)-Math.min(...xs))-40)<1e-6&&Math.abs((Math.max(...ys)-Math.min(...ys))-30)<1e-6,'the rectangle keeps its 40 by 30 mm size');
 const line=back.find(o=>!o.closed);assert.equal(line.points.length,2);
 const len=Math.hypot(line.points[1][0]-line.points[0][0],line.points[1][1]-line.points[0][1]);assert.ok(Math.abs(len-20)<1e-6,'the line keeps its length');
});

test('a stitch layer has no outline, so the DXF export counts it as skipped',()=>{
 const doc=initialDocument();doc.objects=[];
 doc.objects.push({id:'s',name:'Stitches',kind:'stitch_layer',x:0,y:0,w:10,h:10,stitches:[],threads:[],source:{format:'jef',bounds:[0,0,10,10]}});
 const {text,count,skipped}=exportDxf(doc);
 assert.equal(count,0);assert.deepEqual(skipped,{stitch_layer:1});assert.match(text,/\nEOF\n$/);
});
