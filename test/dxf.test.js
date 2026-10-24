import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseDxf,dxfDocument} from '../src/dxf.js';

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
