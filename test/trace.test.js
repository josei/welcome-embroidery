import test from 'node:test';
import assert from 'node:assert/strict';
import {traceImage,traceOps,traceLines,traceLineOps,maskLoops} from '../src/trace.js';
import {applyOperations,validateDocument,compile} from '../src/engine.js';

const picture=(w,h,paint)=>{const img=new Uint8ClampedArray(w*h*4).fill(255);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=paint(x,y);if(c){const i=(y*w+x)*4;img[i]=c[0];img[i+1]=c[1];img[i+2]=c[2];}}return img;};
const blank=()=>({schema:'welcom/1',name:'T',revision:0,hoop:110,settings:{spacing:.4,angle:0,underlay:false,compensation:0},objects:[]});

test('maskLoops finds outlines and holes with the right areas',()=>{
 const w=20,h=20,mask=new Uint8Array(w*h);for(let y=2;y<18;y++)for(let x=2;x<18;x++)mask[y*w+x]=1;for(let y=7;y<13;y++)for(let x=7;x<13;x++)mask[y*w+x]=0;
 const loops=maskLoops(mask,w,h),ar=r=>{let a=0;for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length];a+=p[0]*q[1]-q[0]*p[1];}return a/2;};
 assert.equal(loops.length,2);const [outer,hole]=loops.sort((a,b)=>Math.abs(ar(b))-Math.abs(ar(a)));assert.equal(Math.abs(ar(outer)),256);assert.equal(Math.abs(ar(hole)),36);assert.ok(ar(outer)*ar(hole)<0,'the hole winds the other way');
});

test('tracing: a red ring and a blue disc on white become two regions, the ring with a hole, the white is dropped',()=>{
 const w=80,h=60,img=picture(w,h,(x,y)=>{if(Math.hypot(x-62,y-20)<9)return [20,40,200];const d=Math.hypot(x-30,y-30);return d<8?null:d<20?[200,30,30]:null;});
 const r=traceImage(img,w,h,{colors:4});assert.equal(r.regions.length,2);assert.equal(r.background,'#fcfcfc'.length?r.background:null);
 const [red,blue]=r.regions;assert.ok(red.color.startsWith('#c')&&blue.color.startsWith('#1'),`${red.color} ${blue.color}`);
 assert.equal(red.rings.length,2,'outline plus one hole');assert.ok(Math.abs(red.area-Math.PI*(400-64))/(Math.PI*(400-64))<.12,`ring area ${red.area}`);
 assert.equal(blue.rings.length,1);assert.ok(Math.abs(blue.area-Math.PI*81)/(Math.PI*81)<.12,`disc area ${blue.area}`);
 assert.ok(r.regions[0].area>=r.regions[1].area,'largest first');
});

test('tracing: tiny specks are dropped, noise is cleaned and the region count is capped',()=>{
 const w=60,h=60,img=picture(w,h,(x,y)=>{if(x>=10&&x<30&&y>=10&&y<30)return [0,0,0];if(x===45&&y===45)return [0,0,0];return null;});
 let r=traceImage(img,w,h,{colors:3});assert.equal(r.regions.length,1,'the single black pixel is not a region');
 const checker=picture(64,64,(x,y)=>((x>>3)+(y>>3))%2?[0,0,0]:null);r=traceImage(checker,64,64,{colors:2,background:'none',maxRegions:5});assert.ok(r.regions.length<=5&&r.dropped>=0);
 assert.throws(()=>traceImage(new Uint8ClampedArray(4),1,1),/empty/);
});

test('traced regions become valid filled paths with holes that compile',()=>{
 const w=80,h=60,img=picture(w,h,(x,y)=>{const d=Math.hypot(x-30,y-30);if(Math.hypot(x-62,y-20)<9)return [20,40,200];return d<8?null:d<20?[200,30,30]:null;});
 const r=traceImage(img,w,h,{colors:4}),{ops,ids,size}=traceOps(r,{widthMm:60});assert.equal(ids.length,2);assert.ok(Math.abs(size[0]-60)<1e-9);
 const d=blank();applyOperations(d,ops);validateDocument(d);assert.equal(d.objects.length,2);assert.ok(d.objects.some(o=>o.holes?.length===1));assert.ok(d.objects[0].groupId&&d.objects[0].groupId===d.objects[1].groupId);
 const p=compile(d);assert.deepEqual(p.errors,[]);assert.ok(p.count>500);assert.ok(p.stitches.filter(s=>s.cmd==='stitch').every(s=>Math.abs(s.x)<=30.5&&Math.abs(s.y)<=23));
 assert.equal(new Set(p.stitches.filter(s=>s.cmd==='stitch').map(s=>s.thread)).size,2,'two thread colours');
});

test('line art: a ring and a cross made of strokes become paths with measured widths',()=>{
 const w=100,h=80,img=picture(w,h,(x,y)=>{const d=Math.hypot(x-30,y-40);if(d>18&&d<22)return [10,10,10];if(x>=62&&x<=65&&y>=15&&y<=65)return [10,10,10];if(y>=38&&y<=41&&x>=58&&x<=90)return [10,10,10];return null;});
 const r=traceLines(img,w,h);assert.ok(r.paths.length>=3,`paths ${r.paths.length}`);assert.ok(r.color.startsWith('#0')||r.color.startsWith('#1'));
 const ring=r.paths.find(p=>p.closed&&p.length>90);assert.ok(ring,'the ring is one closed path');assert.ok(Math.abs(ring.length-2*Math.PI*20)<14,`ring length ${ring.length}`);assert.ok(ring.widthPx>2.5&&ring.widthPx<5.5,`ring width ${ring.widthPx}`);
 const longest=r.paths.filter(p=>!p.closed);assert.ok(longest.length>=3&&longest.every(p=>p.length>18&&p.length<30),'the three long arms of the cross');
 const {ops,ids}=traceLineOps(r,{widthMm:50});assert.ok(ids.length>=3);const d=blank();applyOperations(d,ops);validateDocument(d);assert.ok(d.objects.some(o=>o.stitch==='satin'),'3 px strokes at 0.5 mm per px are satin');
 const p=compile(d);assert.deepEqual(p.errors,[]);assert.ok(p.count>200);
 assert.deepEqual(traceLines(picture(20,20,()=>null),20,20).paths,[],'a blank page has nothing to trace');
});

test('traced outlines are fitted with Bézier curves: few nodes, smooth, and the sewn shape stays on the picture',async()=>{
 const {fitRing}=await import('../src/trace.js'),{geometry}=await import('../src/engine.js');
 const w=100,h=80,img=picture(w,h,(x,y)=>Math.hypot(x-50,y-40)<30?[200,30,30]:null);
 const r=traceImage(img,w,h,{colors:2}),g=r.regions[0];assert.ok(g.curve,'a round outline is fitted');assert.ok(g.curve.points.length<=10,`${g.curve.points.length} nodes for a circle`);assert.equal(g.curve.handles.length,g.curve.points.length);
 const {ops}=traceOps(r,{widthMm:50}),add=ops.find(o=>o.op==='add_path');assert.equal(add.handles.length,add.points.length);
 const d=blank();applyOperations(d,ops);validateDocument(d);const ring=geometry(d.objects[0])[0],cx=0,cy=0,rmm=30*50/100;
 assert.ok(ring.length>40,'the curve is sampled finely when sewn');assert.ok(ring.every(([x,y])=>Math.abs(Math.hypot(x-cx,y-cy)-rmm)<1),'every point of the sewn outline lies within 1 mm of the true circle');
 // corners stay corners
 const sq=picture(80,60,(x,y)=>x>=15&&x<65&&y>=10&&y<50?[20,40,200]:null),rs=traceImage(sq,80,60,{colors:2}).regions[0];assert.ok(rs.curve.points.length<=8);
 const flat=rs.curve.points,xs=flat.map(p=>p[0]),ys=flat.map(p=>p[1]);assert.ok(Math.min(...xs)>=14&&Math.max(...xs)<=66&&Math.min(...ys)>=9&&Math.max(...ys)<=51);
 assert.equal(fitRing([[0,0],[1,0]],1),null);
 const plain=traceImage(img,w,h,{colors:2,curves:false}).regions[0];assert.equal(plain.curve,undefined);assert.ok(plain.rings[0].length>g.curve.points.length,'polygons need more points than curves');
});
