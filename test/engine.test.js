import test from 'node:test';
import assert from 'node:assert/strict';
import neonGlyphs from '../fonts/neon_blinking/glyphs.json' with {type:'json'};
import {pinnedMachineFixture} from './fixture-archive.js';
import {bundledFontUsage,blockSeconds,blockTimeLabel,initialDocument,compile,encode,applyOperations,geometry,objectBounds,validateDocument,jefWarnings,exportSvg,exportPrintTemplate,exportAppliqueTemplates,isClosedShape,HOOP_PRESETS,batchDocuments,customFontUsage,hoopSize,importStitchLayer,measureText,threadPlan,sewingSeconds,sewingWorksheet,designWarnings,TIP_CATEGORIES,visibleTips,measureBetween,nearestStockThread,parseThreadStock,svgPathFill,parseSvgPath,cornerRadii} from '../src/engine.js';

test('browser and MCP semantic operations share editable document behavior',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_shape',id:'box',kind:'rect',x:0,y:0,width:10,height:8,thread:'#527461'}, {op:'set_settings',spacing:.6,underlay:false}]);
 applyOperations(doc,[{op:'transform',id:'box',x:3,width:12,rotation:30},{op:'duplicate',id:'box',newId:'box-copy',dx:2,dy:3},{op:'set_object',id:'box-copy',stitch:'run'}]);
 assert.deepEqual(doc.objects.map(o=>[o.id,o.x,o.y,o.w,o.h,o.stitch,o.rotation||0]),[['box',3,0,12,8,'fill',30],['box-copy',5,3,12,8,'run',30]]);
 assert.notDeepEqual(compile({...initialDocument(),objects:[doc.objects[0]]}).stitches,compile({...initialDocument(),objects:[{...doc.objects[0],rotation:0}]}).stitches);
 assert.equal(doc.settings.spacing,.6);assert.equal(doc.settings.underlay,false);
 applyOperations(doc,[{op:'delete',id:'box-copy'}]);assert.deepEqual(doc.objects.map(o=>o.id),['box']);
 const path={schema:'welcome/1',name:'Path',revision:0,hoop:110,settings:{spacing:.4,angle:32,underlay:false,compensation:0},objects:[{id:'p',name:'P',kind:'path',x:0,y:0,w:0,h:0,points:[[0,0],[1,1]],thread:'#527461',stitch:'run'}]};applyOperations(path,[{op:'set_path_point',id:'p',index:1,x:4,y:5}]);assert.deepEqual(path.objects[0].points,[[0,0],[4,5]]);assert.throws(()=>applyOperations(path,[{op:'set_path_point',id:'p',index:5,x:1,y:1}]),/Unknown path point/);
});

test('starter badge compiles deterministically and settings affect stitches',()=>{
 const doc=initialDocument(),base=compile(doc),same=compile(doc);
 assert.deepEqual(same,base);assert.ok(base.count>100);assert.deepEqual(base.errors,[]);
 const dense=structuredClone(doc);dense.settings.spacing=.3;
 assert.notEqual(compile(dense).count,base.count);
 const noUnderlay=structuredClone(doc);noUnderlay.settings.underlay=false;
 assert.notEqual(compile(noUnderlay).count,base.count);
});
test('document validation rejects unsupported schemas and out-of-hoop output',()=>{
 assert.throws(()=>compile({schema:'old',objects:[]}),/Invalid Welcome project/);
 const d=initialDocument();d.objects=[{id:'huge',kind:'rect',stitch:'fill',thread:'#112233',x:-70,y:-1,w:140,h:2}];
 assert.match(compile(d).errors[0],/selected 110 mm hoop/);
 assert.throws(()=>encode(compile(d),'jef','#112233'),/selected 110 mm hoop/);
});
test('JEF and VP3 files are deterministic and carry real format signatures',()=>{
 const p=compile(initialDocument()),jef=encode(p,'jef','#527461'),vp3=encode(p,'vp3','#527461');
 assert.deepEqual(encode(p,'jef','#527461'),jef);assert.deepEqual(encode(p,'vp3','#527461'),vp3);
 // offset to the stitch data must equal 116 + 8 bytes per thread-change block (the JEF header's own declared thread count,
 // field 24) -- not simply the count of distinct thread colours, since a colour sewn in two separate passes (e.g. a fill and
 // its border, revisited later by another object) produces more blocks than unique colours.
 assert.equal(new DataView(jef.buffer).getUint32(0,true),116+new DataView(jef.buffer).getUint32(24,true)*8);
 assert.equal(new TextDecoder().decode(vp3.slice(0,5)),'%vsm%');
 assert.ok(jef.byteLength>1000);assert.ok(vp3.byteLength>500);
});

test('first needle position is reached by a jump and degenerate segments are removed',()=>{
 const d=initialDocument();d.objects=[{id:'offset',kind:'path',x:35,y:30,w:5,h:0,points:[[35,30],[40,30]],thread:'#527461',stitch:'run'}];
 const p=compile(d),needle=p.stitches.filter(s=>s.cmd==='stitch');
 assert.equal(p.stitches[0].cmd,'jump');assert.deepEqual(needle.slice(0,2).map(s=>[s.x,s.y]),[[35,30],[37.5,30]]);assert.equal(needle.at(-1).x,40);
 const degenerate=structuredClone(d);degenerate.objects[0].points=[[35,30],[35,30],[40,30]];
 const zeroes=compile(degenerate).stitches.filter((s,i,a)=>s.cmd==='stitch'&&i&&a[i-1].cmd==='stitch'&&s.x===a[i-1].x&&s.y===a[i-1].y);
 assert.equal(zeroes.length,0);
});

test('project validation rejects unsafe fields and unsupported machine requests',()=>{
 const d=initialDocument();d.objects=[{id:'same',kind:'rect',name:'A',x:0,y:0,w:1,h:1,thread:'#112233',stitch:'fill'},{id:'same',kind:'triangle',name:'B',x:0,y:0,w:1,h:1,thread:'red',stitch:'fill'}];
 assert.throws(()=>compile(d),/unique nonempty strings/);
 const unknown=initialDocument();unknown.objects[0].kind='triangle';assert.throws(()=>compile(unknown),/unsupported kind/);
 const extreme=initialDocument();extreme.objects[0].x=1e100;assert.throws(()=>compile(extreme),/invalid coordinates/);
 assert.throws(()=>encode(compile(initialDocument()),'emb'),/Unsupported machine format/);
});

test('Ink/Stitch Néon blinking uses bundled licensed embroidery paths with explicit scale and character limits',()=>{
 const d=initialDocument();d.objects=[{id:'neon',name:'Néon',kind:'text',text:'WELCOME 12!',font:'neon-blinking/1',x:-20,y:10,w:40,h:20,thread:'#527461',stitch:'run'}];
 const lines=geometry(d.objects[0]);assert.ok(lines.length>=8);assert.ok(lines.every(line=>line.length>2));
 const p=compile(d);assert.ok(p.count>100);assert.deepEqual(p.errors,[]);assert.ok(p.bounds[0]>=-55&&p.bounds[2]<=55);
 assert.equal(neonGlyphs.sourceCommit,'c7e3a05c3d6f5c77b881c50f257851af9a8e9cb8');assert.equal(neonGlyphs.variant,'plain-running-centerline');assert.ok(p.count>=930&&p.count<=950,`about 940 stitches, got ${p.count}`);assert.ok(Math.abs(p.bounds[3]-13.6)<.4&&Math.abs(p.bounds[0]+19.6)<.2,'bounds stay near the original');assert.ok(Object.values(neonGlyphs.glyphs).flatMap(g=>g.paths).every(path=>path.stroke_method==='running_stitch'&&path.bean_stitch_repeats&&path.running_stitch_length_mm));
 const tooSmall=structuredClone(d);tooSmall.objects[0].h=19;assert.throws(()=>compile(tooSmall),/20–60 mm/);
 const unsupported=structuredClone(d);unsupported.objects[0].text='WELCOME @';assert.throws(()=>compile(unsupported),/Néon blinking supports/);
});

test('vector editing: closed filled smooth paths, point insert/delete, border, align and distribute',()=>{
 const doc={schema:'welcome/1',name:'Vec',revision:0,hoop:110,settings:{spacing:.4,angle:32,underlay:true,compensation:0},objects:[]};
 applyOperations(doc,[{op:'add_path',id:'tri',x:0,y:0,points:[[-10,-10],[10,-10],[0,10]],closed:true,stitch:'fill',border:true},{op:'add_shape',id:'a',kind:'rect',x:-40,y:-30,width:10,height:10},{op:'add_shape',id:'b',kind:'rect',x:-10,y:20,width:10,height:10},{op:'add_shape',id:'c',kind:'rect',x:30,y:0,width:10,height:10}]);
 validateDocument(doc);const plan=compile(doc);assert.ok(plan.count>200,'closed path fill stitches rows');
 const borderless=structuredClone(doc);borderless.objects[0].border=false;assert.ok(plan.count>compile(borderless).count,'border adds running stitches');
 applyOperations(doc,[{op:'align',ids:['a','b','c'],edge:'left'}]);assert.deepEqual(doc.objects.slice(1).map(o=>o.x),[-40,-40,-40]);
 applyOperations(doc,[{op:'align',ids:['a','b','c'],edge:'vcenter'}]);assert.equal(new Set(doc.objects.slice(1).map(o=>o.y)).size,1);
 const row=structuredClone(doc);applyOperations(row,[{op:'transform',id:'a',x:-40},{op:'transform',id:'b',x:-10},{op:'transform',id:'c',x:30},{op:'distribute',ids:['a','b','c'],axis:'horizontal'}]);assert.equal(row.objects[2].x,-5);
 applyOperations(doc,[{op:'align',ids:['tri'],edge:'right',to:'hoop'}]);assert.equal(objectBounds(doc.objects[0])[2],55);
 applyOperations(doc,[{op:'insert_path_point',id:'tri',index:1,x:0,y:-14},{op:'set_path',id:'tri',smooth:true}]);assert.equal(doc.objects[0].points.length,4);assert.ok(geometry(doc.objects[0])[0].length>20);validateDocument(doc);
 applyOperations(doc,[{op:'delete_path_point',id:'tri',index:1}]);assert.equal(doc.objects[0].points.length,3);
 assert.throws(()=>{applyOperations(doc,[{op:'set_path',id:'tri',closed:false},{op:'set_object',id:'tri',stitch:'fill'}]);validateDocument(doc);},/closed/);
 assert.throws(()=>applyOperations(doc,[{op:'distribute',ids:['a','b'],axis:'horizontal'}]),/three/);
});

test('Bézier node handles shape the outline, travel with nodes, and survive insert/delete/transform',()=>{
 const doc={schema:'welcome/1',name:'B',revision:0,hoop:110,settings:{spacing:.4,angle:32,underlay:false,compensation:0},objects:[]};
 applyOperations(doc,[{op:'add_path',id:'p',x:0,y:0,points:[[-20,0],[0,0],[20,0]]},{op:'set_path_node_type',id:'p',index:1,type:'smooth'}]);
 assert.ok(doc.objects[0].handles[1]);applyOperations(doc,[{op:'set_path_handle',id:'p',index:1,which:'out',x:10,y:15}]);
 assert.deepEqual(doc.objects[0].handles[1].i,[-10,-15]);const bulge=geometry(doc.objects[0])[0];assert.ok(bulge.length>8&&bulge.some(([,y])=>Math.abs(y)>1),'curve leaves the straight line');validateDocument(doc);
 applyOperations(doc,[{op:'set_path_point',id:'p',index:1,x:2,y:3}]);assert.deepEqual(doc.objects[0].handles[1].o,[12,18]);
 applyOperations(doc,[{op:'transform',id:'p',x:5}]);assert.equal(doc.objects[0].handles[1].o[0],37);
 applyOperations(doc,[{op:'insert_path_point',id:'p',index:1,x:0,y:0}]);assert.equal(doc.objects[0].handles.length,4);validateDocument(doc);
 applyOperations(doc,[{op:'set_path_node_type',id:'p',index:2,type:'corner'}]);assert.equal(doc.objects[0].handles,undefined);
 assert.throws(()=>applyOperations(doc,[{op:'set_path_handle',id:'p',index:0,which:'out',x:0,y:0}]),/no handles/);
});

test('groups: group/ungroup ops, duplicates leave groups, validation',()=>{
 const doc={schema:'welcome/1',name:'G',revision:0,hoop:110,settings:{spacing:.4,angle:32,underlay:false,compensation:0},objects:[]};
 applyOperations(doc,[{op:'add_shape',id:'a',kind:'rect',x:0,y:0,width:5,height:5},{op:'add_shape',id:'b',kind:'rect',x:10,y:0,width:5,height:5},{op:'add_shape',id:'c',kind:'rect',x:20,y:0,width:5,height:5},{op:'group',ids:['a','b'],groupId:'g1'}]);
 validateDocument(doc);assert.equal(doc.objects[1].groupId,'g1');applyOperations(doc,[{op:'duplicate',id:'a',newId:'a2'}]);assert.equal(doc.objects.at(-1).groupId,undefined);
 applyOperations(doc,[{op:'ungroup',ids:['b']}]);assert.ok(doc.objects.every(o=>!o.groupId));assert.throws(()=>applyOperations(doc,[{op:'group',ids:['a']}]),/two/);
});

test('custom rectangular hoops: set_hoop, bounds diagnostics, align to hoop, JEF header from design size',()=>{
 const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'set_hoop',width:80,height:50},{op:'set_settings',compensation:0},{op:'add_shape',id:'r',kind:'rect',x:-35,y:-10,width:30,height:20}]);validateDocument(doc);assert.equal(doc.hoopH,50);
 assert.deepEqual(compile(doc).errors,[]);applyOperations(doc,[{op:'transform',id:'r',y:-30}]);assert.match(compile(doc).errors[0],/selected 80 × 50 mm hoop/);
 applyOperations(doc,[{op:'transform',id:'r',y:-10},{op:'align',ids:['r'],edge:'bottom',to:'hoop'}]);assert.equal(objectBounds(doc.objects[0])[3],25);assert.deepEqual(compile(doc).errors,[]);
 assert.ok(encode(compile(doc),'jef','#527461',80,doc).length>100);assert.ok(encode(compile(doc),'vp3','#527461',80,doc).length>100);
 applyOperations(doc,[{op:'set_hoop',width:200}]);assert.equal(doc.hoopH,undefined);{const jef=encode(compile(doc),'jef','#527461',200,doc);assert.equal(new DataView(jef.buffer).getUint32(32,true),1,'30 x 20 mm design uses the pyembroidery 50x50 hoop code');}assert.ok(encode(compile(doc),'vp3','#527461',200,doc).length>100);
 assert.throws(()=>applyOperations(doc,[{op:'set_hoop',width:5}]),/between 10 and 400/);
});

test('JEF warns beyond the largest hoop code but does not block',()=>{
 assert.deepEqual(jefWarnings({bounds:[0,0,150,150]},'jef'),[]);assert.match(jefWarnings({bounds:[0,0,210,50]},'jef')[0],/largest JEF hoop code/);assert.deepEqual(jefWarnings({bounds:[0,0,300,300]},'vp3'),[]);
});

test('satin columns: zigzag across rails, honors width and spacing, underlay, bounds and export',()=>{
 const doc={schema:'welcome/1',name:'S',revision:0,hoop:110,settings:{spacing:.4,angle:32,underlay:false,compensation:0},objects:[]};
 applyOperations(doc,[{op:'add_path',id:'s',x:0,y:0,points:[[-20,0],[20,0]],stitch:'satin',satinWidth:4,thread:'#d9897e'}]);validateDocument(doc);
 const plan=compile(doc),needles=plan.stitches.filter(s=>s.cmd==='stitch');assert.ok(needles.length>=95&&needles.length<=110,`about 40 mm / 0.4 mm crossings, got ${needles.length}`);
 assert.ok(needles.every(n=>Math.abs(Math.abs(n.y)-2)<.11),'every needle sits on one of the rails at y = ±2');assert.ok(needles.slice(1).every((n,i)=>Math.sign(n.y)!==Math.sign(needles[i].y)),'rails alternate');
 assert.ok(plan.bounds[1]<=-1.9&&plan.bounds[3]>=1.9);
 const wide=structuredClone(doc);wide.objects[0].satinWidth=8;assert.ok(compile(wide).bounds[3]>=3.9);
 const withUnderlay=structuredClone(doc);withUnderlay.settings.underlay=true;assert.ok(compile(withUnderlay).count>plan.count,'center-run underlay adds stitches');
 const curved=structuredClone(doc);applyOperations(curved,[{op:'add_path',id:'c',x:0,y:0,points:[[-20,10],[0,0],[20,10]],stitch:'satin',satinWidth:3,smooth:true}]);assert.ok(compile(curved).count>plan.count);
 assert.ok(encode(plan,'jef','#d9897e',110,doc).length>200);assert.ok(encode(plan,'vp3','#d9897e',110,doc).length>200);
 assert.throws(()=>{const bad=structuredClone(doc);bad.objects[0].satinWidth=30;validateDocument(bad);},/0.5–12/);
 assert.throws(()=>{const bad=structuredClone(doc);bad.objects[0]={...bad.objects[0],kind:'rect',w:5,h:5};validateDocument(bad);},/satin/);
});

test('holes and subtract: even-odd fill skips holes; ties add lock stitches that stay on the design',()=>{
 const doc={schema:'welcome/1',name:'H',revision:0,hoop:110,settings:{spacing:.4,angle:0,underlay:false,compensation:0},objects:[]};
 applyOperations(doc,[{op:'add_shape',id:'base',kind:'rect',x:-20,y:-20,width:40,height:40},{op:'add_shape',id:'cut',kind:'ellipse',x:-8,y:-8,width:16,height:16},{op:'subtract',targetId:'base',cutterId:'cut'}]);
 validateDocument(doc);assert.equal(doc.objects.length,1);assert.equal(doc.objects[0].kind,'path');assert.equal(doc.objects[0].holes.length,1);
 const plan=compile(doc),needles=plan.stitches.filter(s=>s.cmd==='stitch'),inside=needles.filter(n=>Math.hypot(n.x,n.y)<7.5);assert.equal(inside.length,0,'no needles inside the hole');
 const solid=structuredClone(doc);delete solid.objects[0].holes;assert.ok(compile(solid).count>plan.count,'a hole removes stitches');
 const moved=structuredClone(doc);applyOperations(moved,[{op:'transform',id:'base',x:-10}]);assert.ok(moved.objects[0].holes[0].every(([x])=>x>-2),'holes move with their shape');
 assert.throws(()=>applyOperations(structuredClone(doc),[{op:'add_hole',id:'base',points:[[0,0],[1,1]]}]),/3–200/);
 const run=structuredClone(doc);run.objects=[];run.settings.underlay=false;applyOperations(run,[{op:'add_path',id:'a',x:0,y:0,points:[[-30,0],[-10,0]]},{op:'add_path',id:'b',x:0,y:0,points:[[10,0],[30,0]]}]);
 const plain=compile(run);run.settings.ties=true;validateDocument(run);const tied=compile(run);assert.ok(tied.count>=plain.count+16,`two blocks gain tie-in and tie-off, ${plain.count} → ${tied.count}`);assert.ok(tied.stitches.every(s=>s.x>=-30.01&&s.x<=30.01));
 assert.ok(encode(tied,'jef','#527461',110,run).length>200);
});


test('trims: long jumps are preceded by a thread cut when enabled, and both writers accept them',()=>{
 const doc={schema:'welcome/1',name:'Tr',revision:0,hoop:110,settings:{spacing:.4,angle:0,underlay:false,compensation:0},objects:[]};
 applyOperations(doc,[{op:'add_path',id:'a',x:0,y:0,points:[[-30,0],[-10,0]]},{op:'add_path',id:'b',x:0,y:0,points:[[10,0],[30,0]]},{op:'add_path',id:'c',x:0,y:0,points:[[10,2],[12,2]],thread:'#d9897e'}]);
 const plain=compile(doc);assert.equal(plain.stitches.filter(s=>s.cmd==='trim').length,0);
 doc.settings.trims=true;validateDocument(doc);const cut=compile(doc),trims=cut.stitches.map((s,i)=>[s,i]).filter(([s])=>s.cmd==='trim');assert.ok(trims.length>=1,'a 20 mm gap is cut');
 for(const [s,i] of trims){assert.equal(cut.stitches[i+1].cmd,'jump','a jump follows every trim');assert.deepEqual([s.x,s.y],[cut.stitches[i-1].x,cut.stitches[i-1].y],'the cut happens where the last needle stopped');}
 assert.ok(encode(cut,'jef','#527461',110,doc).length>100);assert.ok(encode(cut,'vp3','#527461',110,doc).length>100);
 const tiny=structuredClone(doc);tiny.objects=[doc.objects[0],{...structuredClone(doc.objects[1]),points:[[-8,0],[-4,0]]}];assert.equal(compile(tiny).stitches.filter(s=>s.cmd==='trim').length,0,'short hops are not cut');
});

test('booleans: union, intersect, subtract, xor on overlapping shapes, with correct area and ids',()=>{
 const area=o=>{const r=geometry(o)[0];let a=0;for(let i=1;i<r.length;i++)a+=r[i-1][0]*r[i][1]-r[i][0]*r[i-1][1];return Math.abs(a/2)-(o.holes||[]).reduce((n,h)=>{let b=0;for(let i=0;i<h.length;i++){const p=h[i],q=h[(i+1)%h.length];b+=p[0]*q[1]-q[0]*p[1];}return n+Math.abs(b/2);},0);};
 const make=()=>{const d={schema:'welcome/1',name:'B',revision:0,hoop:110,settings:{spacing:.4,angle:0,underlay:false,compensation:0},objects:[]};applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:0,y:0,width:20,height:20,thread:'#d9897e'},{op:'add_shape',id:'b',kind:'rect',x:10,y:10,width:20,height:20,thread:'#527461'}]);return d;};
 let d=make();applyOperations(d,[{op:'boolean',mode:'union',ids:['a','b']}]);validateDocument(d);assert.equal(d.objects.length,1);assert.equal(d.objects[0].id,'a');assert.equal(d.objects[0].thread,'#d9897e');assert.ok(Math.abs(area(d.objects[0])-700)<.01,'400+400-100');
 d=make();applyOperations(d,[{op:'boolean',mode:'intersect',ids:['a','b']}]);assert.ok(Math.abs(area(d.objects[0])-100)<.01);
 d=make();applyOperations(d,[{op:'boolean',mode:'subtract',ids:['a','b']}]);assert.ok(Math.abs(area(d.objects[0])-300)<.01,'a notch is cut from a corner, not a hole');assert.equal(d.objects[0].holes,undefined);
 d=make();applyOperations(d,[{op:'boolean',mode:'xor',ids:['a','b']}]);assert.equal(d.objects.length,2,'xor of overlapping squares leaves two L-shaped pieces');assert.ok(d.objects.every(o=>Math.abs(area(o)-300)<.01));validateDocument(d);
 d=make();applyOperations(d,[{op:'add_shape',id:'far',kind:'rect',x:50,y:50,width:5,height:5},{op:'boolean',mode:'union',ids:['a','far']}]);assert.equal(d.objects.length,3,'disjoint union keeps two pieces');
 d=make();assert.throws(()=>applyOperations(d,[{op:'add_shape',id:'far',kind:'rect',x:50,y:50,width:5,height:5},{op:'boolean',mode:'intersect',ids:['a','far']}]),/do not overlap/);
 assert.throws(()=>applyOperations(make(),[{op:'boolean',mode:'union',ids:['a']}]),/at least two/);
 d=make();applyOperations(d,[{op:'add_text',id:'t',text:'HI',x:0,y:0,height:8},{op:'transform',id:'a',rotation:30}]);assert.throws(()=>applyOperations(d,[{op:'boolean',mode:'union',ids:['a','t']}]),/closed shapes/);applyOperations(d,[{op:'boolean',mode:'union',ids:['a','b']}]);assert.equal(d.objects.find(o=>o.id==='a').rotation,undefined,'rotation is baked into the result geometry');
 d=make();applyOperations(d,[{op:'boolean',mode:'union',ids:['a','b']}]);assert.ok(compile(d).count>100);
});

test('text on path: glyphs follow an angled line and a circle, move with their text, detach, validate and compile',()=>{
 const d={schema:'welcome/1',name:'TP',revision:0,hoop:110,settings:{spacing:.4,angle:0,underlay:false,compensation:0},objects:[]};
 applyOperations(d,[{op:'add_path',id:'diag',x:0,y:0,points:[[0,0],[40,40]]},{op:'add_text',id:'t',text:'HI',x:0,y:0,height:8},{op:'text_on_path',textId:'t',pathId:'diag'}]);validateDocument(d);
 const nx=Math.SQRT1_2,ny=-Math.SQRT1_2,tx=Math.SQRT1_2,ty=Math.SQRT1_2,pts=geometry(d.objects[1]).flat();
 assert.ok(pts.every(([x,y])=>{const up=x*nx+y*ny,along=x*tx+y*ty;return up>-.02&&up<8.02&&along>-.5;}),'glyph points sit 0–8 mm above the diagonal baseline');
 assert.ok(pts.some(([x,y])=>x*nx+y*ny>6),'tall strokes rise to the full height');
 const e=structuredClone(d);applyOperations(e,[{op:'transform',id:'t',x:10,y:5}]);const moved=geometry(e.objects[1]).flat();assert.ok(Math.abs(moved[0][0]-pts[0][0]-10)<1e-6&&Math.abs(moved[0][1]-pts[0][1]-5)<1e-6,'attached text moves rigidly');
 applyOperations(e,[{op:'duplicate',id:'t',newId:'t2',dx:20,dy:0}]);assert.ok(Math.abs(geometry(e.objects.at(-1)).flat()[0][0]-pts[0][0]-30)<1e-6,'duplicates carry their attachment');validateDocument(e);
 const circle=structuredClone(d);circle.objects=[];
 const ring=Array.from({length:48},(_,k)=>[+(20*Math.cos(k/48*Math.PI*2)).toFixed(3),+(20*Math.sin(k/48*Math.PI*2)).toFixed(3)]);applyOperations(circle,[{op:'add_path',id:'ring',x:0,y:0,points:ring,closed:true,stitch:'run'},{op:'add_text',id:'tx',text:'WELCOME',x:-20,y:0,height:6},{op:'text_on_path',textId:'tx',pathId:'ring',offset:5}]);validateDocument(circle);
 const rs=geometry(circle.objects.find(o=>o.id==='tx')).flat().map(([x,y])=>Math.hypot(x,y));assert.ok(rs.every(r=>r>19.5&&r<26.5),'closed path: lettering stays in the ring band');
 assert.ok(compile(circle).count>100);assert.ok(encode(compile(circle),'jef','#527461',110,circle).length>200);
 applyOperations(d,[{op:'text_off_path',textId:'t'}]);assert.equal(d.objects[1].along,undefined);assert.throws(()=>applyOperations(d,[{op:'text_on_path',textId:'diag',pathId:'diag'}]),/Unknown lettering/);
 assert.throws(()=>{const bad=structuredClone(circle);bad.objects.find(o=>o.id==='tx').along.points=[[0,0]];validateDocument(bad);},/text-on-path/);
});

test('DST export: header, balanced-ternary records, trims, colour changes and end decode back to the plan',()=>{
 const d={schema:'welcome/1',name:'Dst test',revision:0,hoop:110,settings:{spacing:.4,angle:0,underlay:false,compensation:0,trims:true},objects:[]};
 applyOperations(d,[{op:'add_path',id:'a',x:0,y:0,points:[[-30,0],[-10,0]],thread:'#527461'},{op:'add_path',id:'b',x:0,y:0,points:[[20,10],[40,10]],thread:'#d9897e'},{op:'add_path',id:'c',x:0,y:0,points:[[-40,-30],[-20,-10]],stitch:'satin',satinWidth:12,thread:'#d3ad61'}]);
 const plan=compile(d),bytes=encode(plan,'dst','#527461',110,d);assert.equal(bytes.length%3,512%3);const head=Buffer.from(bytes.subarray(0,512)).toString('latin1');
 assert.match(head,/^LA:Dst test        \rST:\s*\d+\rCO:\s*2\r\+X:/);assert.equal(bytes[511],0x20);assert.ok(head.includes('\x1a'));
 // independent decoder of the 3-byte records
 const ax=(b0,b1,b2)=>({x:(b0&1?1:0)-(b0&2?1:0)+3*((b1&1?1:0)-(b1&2?1:0))+9*((b0&4?1:0)-(b0&8?1:0))+27*((b1&4?1:0)-(b1&8?1:0))+81*((b2&4?1:0)-(b2&8?1:0)),y:-((b0&128?1:0)-(b0&64?1:0)+3*((b1&128?1:0)-(b1&64?1:0))+9*((b0&32?1:0)-(b0&16?1:0))+27*((b1&32?1:0)-(b1&16?1:0))+81*((b2&32?1:0)-(b2&16?1:0)))});
 let x=0,y=0,colors=0,trimJumps=0,maxRec=0,ended=false;const needles=[];for(let i=512;i<bytes.length;i+=3){const [b0,b1,b2]=bytes.subarray(i,i+3);if(b2===0xF3){ended=true;break;}if(b2===0xC3){colors++;continue;}const m=ax(b0,b1,b2);maxRec=Math.max(maxRec,Math.abs(m.x),Math.abs(m.y));x+=m.x;y+=m.y;if(!(b2&0x80))needles.push([x,y]);else if(Math.abs(m.x)<=4&&Math.abs(m.y)<=4)trimJumps++;}
 assert.ok(ended,'ends with 0xF3');assert.equal(colors,2);assert.ok(trimJumps>=3,'trims are written as small alternating jumps');
 const expected=plan.stitches.filter(s=>s.cmd==='stitch').map(s=>[Math.round(s.x*10),Math.round(s.y*10)]);assert.deepEqual(needles,expected,'every needle position survives DST encoding');
 assert.ok(maxRec<=121&&maxRec>=100,`largest record ${maxRec} stays within the DST limit (12 mm satin spans use most of it)`);
});

const blank=()=>({schema:'welcome/1',name:'I',revision:0,hoop:110,settings:{spacing:.4,angle:0,underlay:false,compensation:0},objects:[]});
const polyArea=pts=>{let a=0;for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length];a+=p[0]*q[1]-q[0]*p[1];}return Math.abs(a/2);};

test('offset grows and shrinks closed shapes; stroke_to_shape outlines a path',()=>{
 let d=blank();applyOperations(d,[{op:'add_shape',id:'r',kind:'rect',x:0,y:0,width:20,height:20}]);
 applyOperations(d,[{op:'offset',id:'r',distance:2}]);validateDocument(d);let b=objectBounds(d.objects[0]);assert.ok(Math.abs(b[0]+2)<.05&&Math.abs(b[2]-22)<.05&&Math.abs(b[3]-22)<.05,'outset by 2 mm on every side');
 assert.ok(polyArea(d.objects[0].points)>20*20+4*20*2&&polyArea(d.objects[0].points)<24*24,'rounded corners: bigger than the sides, smaller than the square');
 d=blank();applyOperations(d,[{op:'add_shape',id:'r',kind:'rect',x:0,y:0,width:20,height:20},{op:'offset',id:'r',distance:-3}]);b=objectBounds(d.objects[0]);assert.ok(Math.abs(b[0]-3)<.05&&Math.abs(b[2]-17)<.05,'inset by 3 mm');assert.ok(Math.abs(polyArea(d.objects[0].points)-14*14)<.5);
 assert.throws(()=>applyOperations(d,[{op:'offset',id:'r',distance:-20}]),/removes the whole shape/);assert.throws(()=>applyOperations(d,[{op:'offset',id:'r',distance:0}]),/non-zero/);
 d=blank();applyOperations(d,[{op:'add_shape',id:'r',kind:'rect',x:0,y:0,width:30,height:30},{op:'add_shape',id:'c',kind:'ellipse',x:10,y:10,width:10,height:10},{op:'subtract',targetId:'r',cutterId:'c'},{op:'offset',id:'r',distance:1}]);assert.equal(d.objects[0].holes.length,1);const hb=d.objects[0].holes[0].map(p=>Math.hypot(p[0]-15,p[1]-15));assert.ok(Math.max(...hb)<4.1,'outset shrinks the hole');validateDocument(d);
 d=blank();applyOperations(d,[{op:'add_path',id:'p',x:0,y:0,points:[[0,0],[30,0]]},{op:'stroke_to_shape',id:'p',width:4}]);validateDocument(d);b=objectBounds(d.objects[0]);assert.ok(Math.abs(b[1]+2)<.05&&Math.abs(b[3]-2)<.05&&Math.abs(b[0]+2)<.05&&Math.abs(b[2]-32)<.05,'4 mm wide band with round caps');assert.equal(d.objects[0].stitch,'fill');assert.ok(compile(d).count>100,'the band fills with stitches');
 assert.throws(()=>applyOperations(blank(),[{op:'offset',id:'nope',distance:1}]),/Unknown object/);
});

test('arrays: linear, radial and along-path copies keep geometry and rotate about the right centre',()=>{
 let d=blank();applyOperations(d,[{op:'add_shape',id:'s',kind:'rect',x:0,y:0,width:10,height:4},{op:'array',id:'s',mode:'linear',count:4,dx:15,dy:5}]);validateDocument(d);assert.equal(d.objects.length,4);assert.deepEqual(d.objects.map(o=>[o.x,o.y]),[[0,0],[15,5],[30,10],[45,15]]);assert.ok(d.objects.every((o,i)=>i===0||o.id!==d.objects[0].id));
 d=blank();applyOperations(d,[{op:'add_shape',id:'s',kind:'rect',x:18,y:-2,width:4,height:4},{op:'array',id:'s',mode:'radial',count:4,cx:0,cy:0}]);validateDocument(d);assert.equal(d.objects.length,4);
 const centers=d.objects.map(o=>{const b=objectBounds(o);return [(b[0]+b[2])/2,(b[1]+b[3])/2];});assert.ok(centers.every(c=>Math.abs(Math.hypot(c[0],c[1])-20)<.01),'all copies stay on the radius-20 circle');
 assert.ok(Math.abs(centers[1][0])<.01&&Math.abs(centers[1][1]-20)<.01,'second copy is 90° around (y grows downward)');assert.equal(d.objects[1].rotation,90);
 const half=blank();applyOperations(half,[{op:'add_shape',id:'s',kind:'rect',x:18,y:-2,width:4,height:4},{op:'array',id:'s',mode:'radial',count:3,cx:0,cy:0,angle:180}]);const last=objectBounds(half.objects[2]);assert.ok(Math.abs((last[0]+last[2])/2+20)<.01,'a 180° arc ends opposite the start');
 d=blank();applyOperations(d,[{op:'add_path',id:'line',x:0,y:0,points:[[0,0],[40,0]]},{op:'add_shape',id:'m',kind:'rect',x:0,y:0,width:2,height:6},{op:'array',id:'m',mode:'along',pathId:'line',count:5}]);validateDocument(d);const marks=d.objects.filter(o=>o.id!=='line');assert.equal(marks.length,5);
 assert.deepEqual(marks.map(o=>Math.round(objectBounds(o)[0]+1)),[0,10,20,30,40].map(v=>v),'five motifs spread evenly along the line');
 assert.throws(()=>applyOperations(blank(),[{op:'add_shape',id:'s',kind:'rect',x:0,y:0,width:1,height:1},{op:'array',id:'s',mode:'linear',count:1,dx:1,dy:0}]),/2–60/);assert.throws(()=>applyOperations(blank(),[{op:'add_shape',id:'s',kind:'rect',x:0,y:0,width:1,height:1},{op:'array',id:'s',mode:'linear',count:3}]),/dx\/dy/);
 const t=blank();applyOperations(t,[{op:'add_text',id:'w',text:'HI',x:0,y:10,height:8},{op:'array',id:'w',mode:'linear',count:2,dx:0,dy:12}]);validateDocument(t);assert.ok(compile(t).count>20);
});

test('node tools: reverse, simplify, split and join',()=>{
 let d=blank();applyOperations(d,[{op:'add_path',id:'p',x:0,y:0,points:[[0,0],[5,0],[10,0],[15,0.05],[20,0]]},{op:'simplify_path',id:'p',tolerance:.2}]);assert.deepEqual(d.objects[0].points,[[0,0],[20,0]],'collinear nodes are dropped');
 applyOperations(d,[{op:'reverse_path',id:'p'}]);assert.deepEqual(d.objects[0].points,[[20,0],[0,0]]);
 d=blank();applyOperations(d,[{op:'add_path',id:'p',x:0,y:0,points:[[0,0],[10,5],[20,0],[30,5]],smooth:false},{op:'split_path',id:'p',index:2}]);validateDocument(d);assert.equal(d.objects.length,2);assert.deepEqual(d.objects[0].points,[[0,0],[10,5],[20,0]]);assert.deepEqual(d.objects[1].points,[[20,0],[30,5]]);
 applyOperations(d,[{op:'join_paths',ids:[d.objects[0].id,d.objects[1].id]}]);validateDocument(d);assert.equal(d.objects.length,1);assert.deepEqual(d.objects[0].points,[[0,0],[10,5],[20,0],[30,5]],'the shared endpoint is merged');
 d=blank();applyOperations(d,[{op:'add_path',id:'a',x:0,y:0,points:[[0,0],[10,0]]},{op:'add_path',id:'b',x:0,y:0,points:[[30,0],[20,0]]},{op:'join_paths',ids:['a','b']}]);assert.deepEqual(d.objects[0].points,[[0,0],[10,0],[20,0],[30,0]],'the nearer end is chosen and reversed as needed');
 d=blank();applyOperations(d,[{op:'add_path',id:'sq',x:0,y:0,points:[[0,0],[10,0],[10,10],[0,10]],closed:true,stitch:'fill'},{op:'split_path',id:'sq',index:2}]);validateDocument(d);assert.equal(d.objects[0].closed,false);assert.deepEqual(d.objects[0].points[0],[10,10]);assert.deepEqual(d.objects[0].points.at(-1),[10,10]);
 assert.throws(()=>applyOperations(blank(),[{op:'add_path',id:'p',x:0,y:0,points:[[0,0],[1,0]]},{op:'split_path',id:'p',index:0}]),/interior/);
 const handled=blank();applyOperations(handled,[{op:'add_path',id:'p',x:0,y:0,points:[[0,0],[10,0],[20,0]]},{op:'set_path_node_type',id:'p',index:1,type:'smooth'},{op:'set_path_handle',id:'p',index:1,which:'out',x:14,y:4},{op:'reverse_path',id:'p'}]);validateDocument(handled);assert.deepEqual(handled.objects[0].handles[1].i,[14,4],'handles swap when a path is reversed');
});

test('sewing order and per-object fill settings',()=>{
 let d=blank();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:0,y:0,width:5,height:5,thread:'#d9897e'},{op:'add_shape',id:'b',kind:'rect',x:10,y:0,width:5,height:5,thread:'#527461'},{op:'add_shape',id:'c',kind:'rect',x:20,y:0,width:5,height:5,thread:'#d9897e'},{op:'add_shape',id:'e',kind:'rect',x:30,y:0,width:5,height:5,thread:'#527461'}]);
 const ids=()=>d.objects.map(o=>o.id).join('');applyOperations(d,[{op:'reorder',id:'a',to:'front'}]);assert.equal(ids(),'bcea');applyOperations(d,[{op:'reorder',id:'a',to:'backward'}]);assert.equal(ids(),'bcae');applyOperations(d,[{op:'reorder',id:'e',to:'back'},{op:'reorder',id:'b',to:'forward'}]);assert.equal(ids(),'ecba');assert.throws(()=>applyOperations(d,[{op:'reorder',id:'a',to:'sideways'}]),/Unknown reorder/);assert.equal(ids(),'ecba','a failed reorder keeps the order');
 d=blank();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:0,y:0,width:5,height:5,thread:'#d9897e'},{op:'add_shape',id:'b',kind:'rect',x:10,y:0,width:5,height:5,thread:'#527461'},{op:'add_shape',id:'c',kind:'rect',x:20,y:0,width:5,height:5,thread:'#d9897e'}]);
 const before=compile(d).stitches.filter(s=>s.cmd==='color').length;applyOperations(d,[{op:'sort_by_color'}]);assert.equal(d.objects.map(o=>o.id).join(''),'acb');assert.ok(compile(d).stitches.filter(s=>s.cmd==='color').length<before,'fewer colour changes after sorting');
 const f=blank();applyOperations(f,[{op:'add_shape',id:'r',kind:'rect',x:0,y:0,width:20,height:20}]);const base=compile(f),tight=structuredClone(f);applyOperations(tight,[{op:'set_object',id:'r',spacing:.25}]);validateDocument(tight);assert.ok(compile(tight).count>base.count*1.4,'per-object row spacing');
 const ang=structuredClone(f);applyOperations(ang,[{op:'set_object',id:'r',angle:90}]);const rows=compile(ang).stitches.filter(s=>s.cmd==='stitch');assert.ok(rows.slice(1,20).filter((p,i)=>Math.abs(p.x-rows[i].x)<.01).length>10,'a 90° fill runs along the y axis');
 applyOperations(ang,[{op:'set_object',id:'r',angle:null,spacing:null}]);assert.equal(ang.objects[0].angle,undefined);assert.throws(()=>{const bad=structuredClone(f);bad.objects[0].spacing=5;validateDocument(bad);},/row spacing/);
});

test('SVG export: millimetre viewBox, holes, satin strokes, lettering and stitch layers',()=>{
 const d=blank();d.hoop=100;d.hoopH=60;applyOperations(d,[{op:'add_shape',id:'r',kind:'rect',x:-20,y:-20,width:40,height:40,thread:'#d9897e'},{op:'add_shape',id:'c',kind:'ellipse',x:-5,y:-5,width:10,height:10},{op:'subtract',targetId:'r',cutterId:'c'},{op:'add_path',id:'s',name:'Stem & leaf',x:0,y:0,points:[[0,10],[5,25]],stitch:'satin',satinWidth:4,thread:'#527461'},{op:'add_text',id:'t',text:'HI',x:-10,y:30,height:8}]);
 const svg=exportSvg(d);assert.match(svg,/width="100mm" height="60mm" viewBox="-50 -30 100 60"/);assert.match(svg,/fill-rule="evenodd"/);assert.equal((svg.match(/Z/g)||[]).length,2,'outer ring and hole are both closed');assert.match(svg,/stroke-width="4" stroke-linecap="butt"/);assert.match(svg,/<title>Stem &amp; leaf<\/title>/);assert.ok((svg.match(/<path /g)||[]).length===3);
 const layer=importStitchLayer(pinnedMachineFixture('jef').bytes,'jef',{fileName:'x.jef'});const e=blank();e.objects=[layer];assert.match(exportSvg(e),/<g><title>.*<\/title><path d="M/);
 const xml=new Set();for(const m of svg.matchAll(/<(\w+)[ >]/g))xml.add(m[1]);assert.deepEqual([...xml].sort(),['path','svg','title']);
});

// ---- registry fonts: Ink/Stitch conversions, TrueType outlines, custom fonts and text options ----
import {loadBundledFonts} from '../server-fonts.js';
import {registry,getFont,registerFont} from '../src/fonts.js';
import {ttfToFont,parseTrueType} from '../src/ttf.js';
import {readFileSync,existsSync} from 'node:fs';
const FONT_ROOT=new URL('..',import.meta.url).pathname;
loadBundledFonts(FONT_ROOT);
const textDoc=(font,extra={})=>{const d=blank();d.hoop=250;applyOperations(d,[{op:'add_text',id:'t',text:extra.text??'Hello',x:-40,y:0,font,thread:'#527461',...extra}]);return d;};

test('bundled fonts: 117 Ink/Stitch conversions and 78 TrueType outlines are registered with licences and sane metrics',()=>{
 const ink=[...registry.keys()].filter(k=>k.startsWith('inkstitch/')),ttf=[...registry.keys()].filter(k=>k.startsWith('ttf/'));assert.equal(ink.length,117);assert.equal(ttf.length,78);
 for(const [k,f] of registry){assert.ok(f.name&&f.license,`${k} has a name and licence`);assert.ok(!/NC|ND/.test(f.license.replace(/\bSIL\b/,'')),`${k} licence ${f.license} permits commercial use and derivatives`);assert.ok(f.unitsPerEm>0&&f.glyphs['A']||f.glyphs['a']||f.glyphs['1']||Object.keys(f.glyphs).length>10,`${k} has glyphs`);assert.ok(f.size>0&&f.minScale<f.maxScale);}
 assert.ok(registry.get('inkstitch/emilio_20').glyphs['A'].p.some(p=>p[0]==='s'),'Emilio 20 is satin');assert.ok(registry.get('inkstitch/neon_blinking').glyphs['A'].p.every(p=>p[0]==='r'),'Néon blinking is running stitch');assert.equal(registry.get('ttf/lato').kind,'outline');
});

test('registry font lettering compiles for every font family type, with satin rails, fills and running stitch',()=>{
 for(const font of ['inkstitch/emilio_20','inkstitch/geneva_simple','inkstitch/neon_blinking','inkstitch/pixel10','ttf/lato','ttf/pacifico','ttf/bebasneue']){
  const f=getFont(font),d=textDoc(font,{text:'Hi 5',height:f.size});d.hoop=300;validateDocument(d);const plan=compile(d);assert.ok(plan.count>40,`${font} stitches (${plan.count})`);assert.deepEqual(plan.errors,[],font);assert.ok(encode(plan,'jef','#527461',300,d).length>200,font+' exports');}
 const satin=textDoc('inkstitch/emilio_20',{text:'I',height:48.5});const run=textDoc('ttf/lato',{text:'I',height:20,stitch:'run'}),fill=textDoc('ttf/lato',{text:'I',height:20,stitch:'fill'});
 assert.ok(compile(fill).count>compile(run).count*1.5,'outline fonts fill by default and can run along the contour');assert.ok(compile(satin).stitches.some(s=>s.cmd==='jump'));
});

test('text options: letter and word spacing, kerning, italic, bold, line height, alignment and multiple lines',()=>{
 const w=o=>textDoc('ttf/lato',{height:20,...o}).objects[0].w;const base=w({text:'ABC'});assert.ok(Math.abs(w({text:'ABC',tracking:3})-(base+6))<.01,'tracking adds to each gap');assert.ok(Math.abs(w({text:'A B',wordSpacing:5})-w({text:'A B'})-5)<.01);assert.ok(w({text:'ABC',tracking:-2})<base);
 const bounds=o=>objectBounds(textDoc('ttf/lato',{height:20,...o}).objects[0]);const plain=bounds({text:'HI'}),slant=bounds({text:'HI',italic:15});assert.ok(slant[2]>plain[2]+1.5&&Math.abs(slant[1]-plain[1])<.05,'italic shears the tops to the right without changing height');
 const bold=compile(textDoc('ttf/lato',{text:'I',height:20,bold:1.2}));const thin=compile(textDoc('ttf/lato',{text:'I',height:20}));assert.ok(bold.bounds[2]-bold.bounds[0]>thin.bounds[2]-thin.bounds[0]+.9,'bold widens fills');
 const sat=compile(textDoc('inkstitch/emilio_20',{text:'I',height:48.5,bold:2})),sat0=compile(textDoc('inkstitch/emilio_20',{text:'I',height:48.5}));assert.ok(sat.bounds[2]-sat.bounds[0]>sat0.bounds[2]-sat0.bounds[0]+1.5,'bold widens satin columns');
 const one=bounds({text:'HI'}),two=bounds({text:'HI\nHI'}),loose=bounds({text:'HI\nHI',lineHeight:2});assert.ok(two[3]-two[1]>(one[3]-one[1])*1.9,'second line below the first');assert.ok(loose[3]-loose[1]>two[3]-two[1]+10,'line height scales the gap');
 const left=bounds({text:'HIII\nH',align:'left'}),centre=bounds({text:'HIII\nH',align:'center'}),right=bounds({text:'HIII\nH',align:'right'});assert.ok(Math.abs(left[0]-centre[0])<.01&&Math.abs(left[2]-centre[2])<.01,'the box does not move, only the short line does');
 const lineX=(o,line)=>{const d=textDoc('ttf/lato',{height:20,...o});const pts=geometry(d.objects[0]).flat().filter(p=>line?p[1]>10:p[1]<=10);return Math.min(...pts.map(p=>p[0]));};assert.ok(lineX({text:'HIII\nH',align:'right'},true)>lineX({text:'HIII\nH',align:'left'},true)+10,'right-aligned second line moves right');
 assert.ok(Math.abs(measureText('Hello','ttf/lato',20)-textDoc('ttf/lato',{height:20}).objects[0].w)<.01,'measureText agrees with the layout');
 const kerned=measureText('AV','inkstitch/emilio_20',48.5);assert.ok(Number.isFinite(kerned));
 assert.throws(()=>{const d=textDoc('ttf/lato',{height:20});d.objects[0].bold=9;validateDocument(d);},/bold/);assert.throws(()=>{const d=textDoc('ttf/lato',{height:20});d.objects[0].align='middle';validateDocument(d);},/alignment/);assert.throws(()=>{const d=textDoc('ttf/lato',{height:20});d.objects[0].text='a\n\n\n\n\n\n\n';validateDocument(d);},/too many lines/);
 const via=textDoc('ttf/lato',{height:20});applyOperations(via,[{op:'set_object',id:'t',text:'Longer text',tracking:2}]);assert.ok(via.objects[0].w>w({text:'Hello'}),'set_object refreshes the width');
});

test('sizes follow each font; unknown or unloaded fonts fail clearly; text on path and rotation work with registry fonts',()=>{
 const d=textDoc('inkstitch/geneva_simple',{});assert.equal(d.objects[0].h,getFont('inkstitch/geneva_simple').size,'default size comes from the font');assert.throws(()=>{const bad=structuredClone(d);bad.objects[0].h=60;validateDocument(bad);},/size/);
 const missing=textDoc('ttf/lato',{height:20});missing.objects[0].font='ttf/not-a-font';validateDocument(missing);assert.throws(()=>compile(missing),/not loaded/);
 const onPath=textDoc('ttf/lato',{height:12,text:'ARC'});applyOperations(onPath,[{op:'add_path',id:'arc',x:0,y:0,points:Array.from({length:40},(_,k)=>[-40*Math.cos(k/39*Math.PI)*.9,-40*Math.sin(k/39*Math.PI)*.9+30]),thread:'#d9897e'},{op:'text_on_path',textId:'t',pathId:'arc',offset:20}]);validateDocument(onPath);const b=objectBounds(onPath.objects.find(o=>o.id==='t'));assert.ok(b[3]-b[1]>5,'lettering bends');assert.ok(compile(onPath).count>200);
 const rot=textDoc('inkstitch/emilio_20',{text:'I'});applyOperations(rot,[{op:'transform',id:'t',rotation:90}]);const rb=objectBounds(rot.objects[0]),nb=objectBounds(textDoc('inkstitch/emilio_20',{text:'I'}).objects[0]);assert.ok(Math.abs((rb[2]-rb[0])-(nb[3]-nb[1]))<.5,'rotation swaps width and height');
});

test('TrueType parser: Lato outlines convert to filled rings with holes, and custom fonts travel inside the document',()=>{
 const file='/tmp/ttf2/lato_regular.ttf';const bytes=existsSync(file)?readFileSync(file):null;if(!bytes)return;
 const font=ttfToFont(bytes,{id:'mylato',name:'My Lato'});assert.equal(font.unitsPerEm,2000);const O=font.glyphs['O'].p[0][1];assert.equal(O.length,2,'O has an outer ring and a counter');assert.ok(Math.max(...O[0].filter((_,i)=>i%2))>Math.max(...O[1].filter((_,i)=>i%2)),'inner ring lies inside');
 assert.ok(font.glyphs['é'],'Latin-1 letters are included');assert.ok(font.glyphs[' ']);assert.throws(()=>parseTrueType(new Uint8Array(40)),/font/i);assert.throws(()=>parseTrueType(Uint8Array.from([0x4f,0x54,0x54,0x4f,0,0,0,0,0,0,0,0])),/CFF/);
 const d=blank();d.hoop=200;d.customFonts={mylato:{...font,key:undefined}};applyOperations(d,[{op:'add_text',id:'t',text:'Own',x:-30,y:0,font:'custom/mylato',height:20}]);validateDocument(d);assert.ok(compile(d).count>100,'the document carries its font');
 const gone=structuredClone(d);delete gone.customFonts;assert.throws(()=>validateDocument(gone),/font/);assert.throws(()=>{const bad=structuredClone(d);bad.customFonts.mylato.glyphs=null;validateDocument(bad);},/custom font/);
});

test('rotation about a pivot: each centre moves about the point, rotating about its own centre keeps it, and transform takes a pivot key',()=>{
 const mk=()=>{const d=blank();d.hoop=250;return d;},centre=o=>{const b=objectBounds(o);return [(b[0]+b[2])/2,(b[1]+b[3])/2];},near=(p,q)=>assert.ok(Math.abs(p[0]-q[0])<.01&&Math.abs(p[1]-q[1])<.01,`${p} != ${q}`);
 let d=mk();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:9,y:-1,width:2,height:2},{op:'add_shape',id:'b',kind:'rect',x:-1,y:9,width:2,height:2},{op:'rotate',ids:['a','b'],angle:90,cx:0,cy:0}]);
 near(centre(d.objects[0]),[0,10]);near(centre(d.objects[1]),[-10,0]);assert.equal(d.objects[0].rotation,90,'each object turns by the angle');
 d=mk();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:9,y:-1,width:2,height:2},{op:'rotate',ids:['a'],angle:45,cx:10,cy:0}]);near(centre(d.objects[0]),[10,0]);
 d=mk();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:9,y:-1,width:2,height:2},{op:'transform',id:'a',rotation:90,pivot:{x:0,y:0}}]);validateDocument(d);near(centre(d.objects[0]),[0,10]);assert.equal(d.objects[0].rotation,90);
 applyOperations(d,[{op:'transform',id:'a',rotation:180,pivot:{x:0,y:0}}]);near(centre(d.objects[0]),[-10,0]);assert.equal(d.objects[0].rotation,180,'the pivot key turns by the change in rotation, not to an absolute centre');
 applyOperations(d,[{op:'transform',id:'a',rotation:-180}]);assert.equal(d.objects[0].rotation,-180,'without a pivot the rotation is set as before');
});

test('sewing tips carry a category, and hiding a category drops only its tips',()=>{
 const d=blank();d.hoop=100;
 applyOperations(d,[{op:'add_shape',id:'out',kind:'rect',x:60,y:-5,width:20,height:10},{op:'add_shape',id:'tiny',kind:'rect',x:-40,y:-40,width:1,height:1},{op:'add_shape',id:'dup1',kind:'rect',x:-20,y:0,width:10,height:10},{op:'add_shape',id:'dup2',kind:'rect',x:-20,y:0,width:10,height:10}]);
 const tips=designWarnings(d),cats=new Set(tips.map(t=>t.category));
 assert.ok(cats.has('hoop')&&cats.has('fill')&&cats.has('duplicate'),'the design gives hoop, fill and duplicate tips');
 for(const t of tips)assert.ok(TIP_CATEGORIES.some(c=>c.id===t.category),`${t.category} is a known category`);
 const fills=tips.filter(t=>t.category==='fill').length;
 assert.equal(visibleTips(tips,['fill']).length,tips.length-fills,'hiding fill drops only the fill tips');
 assert.ok(visibleTips(tips,['fill']).every(t=>t.category!=='fill'));
 assert.equal(visibleTips(tips,['bogus']).length,tips.length,'an unknown category is ignored');
 assert.equal(visibleTips(tips).length,tips.length,'nothing hidden shows every tip');
});

test('measure tool helper: distance and signed parts between two points',()=>{
 const m=measureBetween([0,0],[3,4]);assert.equal(m.distance,5);assert.equal(m.dx,3);assert.equal(m.dy,4);
 const r=measureBetween([10,10],[7,6]);assert.equal(r.distance,5);assert.equal(r.dx,-3);assert.equal(r.dy,-4,'the parts point from the first point to the second');
 assert.equal(measureBetween([-2,5],[-2,5]).distance,0,'the same point measures zero');
});

test('direct manipulation ops: scale, rotate about a pivot, flip, translate, to_path and lock/hide',()=>{
 const mk=()=>{const d=blank();d.hoop=250;return d;};
 let d=mk();applyOperations(d,[{op:'add_shape',id:'r',kind:'rect',x:10,y:10,width:20,height:10},{op:'scale',ids:['r'],sx:2,sy:3,ox:10,oy:10}]);validateDocument(d);assert.deepEqual([d.objects[0].x,d.objects[0].y,d.objects[0].w,d.objects[0].h],[10,10,40,30],'scale about the top-left corner');
 applyOperations(d,[{op:'scale',ids:['r'],sx:.5,sy:.5,ox:30,oy:25}]);assert.deepEqual([d.objects[0].x,d.objects[0].y,d.objects[0].w,d.objects[0].h],[20,17.5,20,15],'scale about the centre');
 d=mk();applyOperations(d,[{op:'add_shape',id:'r',kind:'rect',x:0,y:0,width:20,height:10},{op:'transform',id:'r',rotation:90},{op:'scale',ids:['r'],sx:2,sy:1,ox:10,oy:5}]);validateDocument(d);assert.equal(d.objects[0].kind,'path','a rotated rectangle becomes a path for non-uniform scaling');const b=objectBounds(d.objects[0]);assert.ok(Math.abs((b[2]-b[0])-20)<.01&&Math.abs((b[3]-b[1])-20)<.01,'its 10x20 rotated footprint is stretched to 20x20');
 d=mk();applyOperations(d,[{op:'add_path',id:'p',x:0,y:0,points:[[0,0],[10,0],[10,10]],closed:true,stitch:'fill'},{op:'scale',ids:['p'],sx:3,sy:3,ox:0,oy:0}]);assert.deepEqual(d.objects[0].points,[[0,0],[30,0],[30,30]]);
 d=mk();applyOperations(d,[{op:'add_text',id:'t',text:'AB',x:0,y:20,height:8},{op:'scale',ids:['t'],sx:1.5,sy:1.5,ox:0,oy:0}]);validateDocument(d);assert.ok(Math.abs(d.objects[0].h-12)<.01&&Math.abs(d.objects[0].y-30)<.01,'text size and baseline scale');
 applyOperations(d,[{op:'scale',ids:['t'],sx:5,sy:5,ox:0,oy:0}]);assert.equal(d.objects[0].h,16,'lettering size is clamped to the font range');
 d=mk();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:20,y:-2,width:4,height:4},{op:'rotate',ids:['a'],angle:90,cx:0,cy:0}]);let c=objectBounds(d.objects[0]);assert.ok(Math.abs((c[0]+c[2])/2)<.01&&Math.abs((c[1]+c[3])/2-22)<.01,'rotated about a pivot');assert.equal(d.objects[0].rotation,90);
 d=mk();applyOperations(d,[{op:'add_path',id:'p',x:0,y:0,points:[[0,0],[10,0],[10,5]]},{op:'flip',ids:['p'],axis:'horizontal'}]);assert.deepEqual(d.objects[0].points,[[10,0],[0,0],[0,5]]);applyOperations(d,[{op:'flip',ids:['p'],axis:'vertical',pivot:0}]);assert.deepEqual(d.objects[0].points,[[10,0],[0,0],[0,-5]]);
 assert.throws(()=>{const t=mk();applyOperations(t,[{op:'add_text',id:'t',text:'A',x:0,y:0},{op:'flip',ids:['t'],axis:'horizontal'}]);},/cannot be flipped/);
 d=mk();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:0,y:0,width:5,height:5},{op:'add_shape',id:'b',kind:'ellipse',x:20,y:0,width:5,height:5},{op:'translate',ids:['a','b'],dx:3,dy:-2}]);assert.deepEqual(d.objects.map(o=>[o.x,o.y]),[[3,-2],[23,-2]]);
 d=mk();applyOperations(d,[{op:'add_shape',id:'r',kind:'rect',x:0,y:0,width:20,height:10,thread:'#d9897e'},{op:'transform',id:'r',rotation:30},{op:'to_path',ids:['r']}]);validateDocument(d);assert.equal(d.objects[0].kind,'path');assert.equal(d.objects[0].rotation,undefined);assert.equal(d.objects[0].points.length,4);assert.ok(Math.abs(polyArea(d.objects[0].points)-200)<.5,'rotation is baked in without changing the area');
 d=mk();applyOperations(d,[{op:'add_shape',id:'e',kind:'ellipse',x:0,y:0,width:30,height:20},{op:'to_path',ids:['e']}]);validateDocument(d);assert.equal(d.objects[0].handles.length,4);const eb=objectBounds(d.objects[0]);assert.ok(Math.abs(eb[0])<.2&&Math.abs(eb[2]-30)<.2&&Math.abs(eb[3]-20)<.2,'the four-node Bézier circle matches the ellipse bounds');assert.ok(compile(d).count>200);
 d=mk();applyOperations(d,[{op:'add_text',id:'t',text:'Oe',x:0,y:20,font:'ttf/lato',height:20},{op:'to_path',ids:['t']}]);validateDocument(d);assert.ok(d.objects.length>=2&&d.objects.every(o=>o.kind==='path'),'each glyph becomes a path');assert.equal(new Set(d.objects.map(o=>o.groupId)).size,1,'outlines stay grouped');assert.ok(d.objects.some(o=>o.holes),'counters become holes');assert.ok(compile(d).count>100);
 d=mk();applyOperations(d,[{op:'add_shape',id:'r',kind:'rect',x:0,y:0,width:5,height:5},{op:'set_object',id:'r',locked:true,visible:false}]);validateDocument(d);assert.equal(d.objects[0].locked,true);assert.throws(()=>compile(d),/no sewable/,'hidden objects are not sewn');
});

test('multi-node edits and ruler guides',()=>{
 const d=blank();applyOperations(d,[{op:'add_path',id:'p',x:0,y:0,points:[[0,0],[10,0],[10,10],[0,10],[5,15]],closed:true,stitch:'fill'},{op:'set_path_node_type',id:'p',index:1,type:'smooth'},{op:'move_path_points',id:'p',indexes:[1,2],dx:3,dy:-1}]);validateDocument(d);
 assert.deepEqual(d.objects[0].points.slice(0,4),[[0,0],[13,-1],[13,9],[0,10]]);assert.ok(d.objects[0].handles[1].o[0]>=13,'handles travel with their node');
 applyOperations(d,[{op:'delete_path_points',id:'p',indexes:[0,4]}]);assert.equal(d.objects[0].points.length,3);assert.throws(()=>applyOperations(d,[{op:'delete_path_points',id:'p',indexes:[0]}]),/at least three/);assert.throws(()=>applyOperations(d,[{op:'move_path_points',id:'p',indexes:[9],dx:1,dy:1}]),/Unknown path point/);
 const g=blank();applyOperations(g,[{op:'add_guide',axis:'x',pos:12.5},{op:'add_guide',axis:'y',pos:-3},{op:'move_guide',index:0,pos:20}]);validateDocument(g);assert.deepEqual(g.guides,[{axis:'x',pos:20},{axis:'y',pos:-3}]);applyOperations(g,[{op:'remove_guide',index:0},{op:'remove_guide',index:0}]);assert.equal(g.guides,undefined);
 assert.throws(()=>applyOperations(g,[{op:'add_guide',axis:'z',pos:1}]),/axis/);assert.throws(()=>{const bad=blank();bad.guides=[{axis:'x',pos:'a'}];validateDocument(bad);},/guides/);
});

// ---- stitch planner: auto-fill, stagger, underlay -------------------------------------------------------------
import {planFill,planContour,planFillUnderlay,sampleRun,rowOffset} from '../src/stitchplan.js';
const circleRing=(cx,cy,r,n=48,rev=false)=>{const pts=Array.from({length:n},(_,k)=>{const a=(rev?-1:1)*k/n*Math.PI*2;return [cx+r*Math.cos(a),cy+r*Math.sin(a)];});return [...pts,pts[0]];};
const inPoly=(p,rings)=>{let inside=false;for(const ring of rings)for(let i=1;i<ring.length;i++){const [x1,y1]=ring[i-1],[x2,y2]=ring[i];if((y1>p[1])!==(y2>p[1])&&p[0]<(x2-x1)*(p[1]-y1)/(y2-y1)+x1)inside=!inside;}return inside;};
const distToRings=(p,rings)=>{let best=Infinity;for(const ring of rings)for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy,t=l2?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2)):0;best=Math.min(best,Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t));}return best;};
const SHAPES={rect:[[[0,0],[40,0],[40,20],[0,20],[0,0]]],donut:[circleRing(0,0,25),circleRing(0,0,10,32,true)],ushape:[[[0,0],[10,0],[10,30],[30,30],[30,0],[40,0],[40,40],[0,40],[0,0]]],lobes:[[[0,0],[50,0],[50,10],[30,10],[30,30],[50,30],[50,40],[0,40],[0,0]],circleRing(12,20,6,24,true)],star:(()=>{const pts=Array.from({length:10},(_,k)=>{const a=k/10*Math.PI*2-Math.PI/2,r=k%2?9:22;return [r*Math.cos(a),r*Math.sin(a)];});return [[...pts,pts[0]]];})()};

test('auto-fill: every shape sews as one continuous run with no long stitches and every needle on the shape',()=>{
 for(const [name,rings] of Object.entries(SHAPES)){
  const runs=planFill(rings,{spacing:.4,angle:32,length:3,stagger:4}),pts=runs.flatMap(r=>r.pts);
  assert.ok(runs.length<=1,`${name}: ${runs.length} runs (jumps) instead of one`);
  let maxStep=0;runs.forEach(r=>r.pts.forEach((p,i)=>{if(i)maxStep=Math.max(maxStep,Math.hypot(p[0]-r.pts[i-1][0],p[1]-r.pts[i-1][1]));}));assert.ok(maxStep<=4.1,`${name}: longest stitch ${maxStep.toFixed(2)} mm`);
  assert.ok(pts.every(p=>inPoly(p,rings)||distToRings(p,rings)<.08),`${name}: needles stay on the shape`);
  assert.ok(pts.length>150,`${name}: ${pts.length} needles`);
  // coverage: sample points in the shape are close to a sewn line (rows are 0.4 mm apart)
  const polyline=runs.flatMap(r=>r.pts.slice(1).map((p,i)=>[r.pts[i],p]));let missed=0,tested=0;const xs=rings.flat().map(p=>p[0]),ys=rings.flat().map(p=>p[1]);for(let x=Math.min(...xs);x<Math.max(...xs);x+=1.7)for(let y=Math.min(...ys);y<Math.max(...ys);y+=1.9){if(!inPoly([x,y],rings)||distToRings([x,y],rings)<.6)continue;tested++;let d=Infinity;for(const [a,b] of polyline){const dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy,t=l2?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/l2)):0;d=Math.min(d,Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t));if(d<.3)break;}if(d>.3)missed++;}
  assert.ok(tested>20&&missed===0,`${name}: ${missed} of ${tested} sample points are not within 0.3 mm of a stitch`);
  assert.deepEqual(planFill(rings,{spacing:.4,angle:32,length:3,stagger:4}),runs,`${name}: planning is deterministic`);}
});

test('auto-fill staggers needle penetrations between rows and honours stitch length and angle',()=>{
 const rect=SHAPES.rect,runs=planFill(rect,{spacing:.5,angle:0,length:3,stagger:4}),rows=new Map();for(const p of runs[0].pts){const k=Math.round((p[1]-.25)/.5);(rows.get(k)||rows.set(k,[]).get(k)).push(p[0]);}
 const phase=k=>{const xs=rows.get(k).slice(1,-1);return ((xs[0]%3)+3)%3/3;};
 const phases=new Set([0,1,2,3,4,5,6,7].map(k=>phase(k+3).toFixed(2)));assert.ok(phases.size>=4,`four distinct row phases, got ${[...phases]}`);
 assert.deepEqual([0,1,2,3].map(k=>rowOffset(k,4)),[0,.5,.25,.75]);assert.equal(rowOffset(5,1),0);
 const plain=planFill(rect,{spacing:.5,angle:0,length:3,stagger:1}),aligned=new Set(plain[0].pts.filter(p=>Math.abs(p[1]-.25)<.01||Math.abs(p[1]-.75)<.01).map(p=>(p[0]%3).toFixed(1)));assert.ok(aligned.size<=3,'without stagger, rows share needle columns');
 const long=planFill(rect,{spacing:.5,angle:0,length:5,stagger:2});let maxStep=0;long[0].pts.forEach((p,i)=>{if(i&&Math.abs(p[1]-long[0].pts[i-1][1])<.01)maxStep=Math.max(maxStep,Math.abs(p[0]-long[0].pts[i-1][0]));});assert.ok(maxStep<=5.0001&&maxStep>4,`stitch length 5 respected (${maxStep.toFixed(2)})`);
 const diag=planFill(rect,{spacing:.5,angle:90,length:3,stagger:4});const vertical=diag[0].pts.slice(1,40).filter((p,i)=>Math.abs(p[0]-diag[0].pts[i][0])<.01).length;assert.ok(vertical>20,'a 90° fill runs along y');
});

test('underlay: contour sits inside the outline, fill underlay runs perpendicular and is sparser, satin types differ by width',()=>{
 const rect=SHAPES.rect,contour=planContour(rect,{inset:.5});assert.equal(contour.length,1);const allIn=contour[0].pts.every(p=>p[0]>=.45&&p[0]<=39.55&&p[1]>=.45&&p[1]<=19.55);assert.ok(allIn,'contour underlay is inset 0.5 mm');
 const under=planFillUnderlay(rect,{angle:122,spacing:2.2,length:3.5,inset:.6}),top=planFill(rect,{spacing:.4,angle:32,length:3,stagger:4});assert.ok(under.flatMap(r=>r.pts).length<top.flatMap(r=>r.pts).length/3,'underlay is much sparser than the top fill');
 assert.equal(under.length,1,'the underlay rows chain into one run');const upts=under[0].pts,rowsN=upts.filter((p,i)=>i&&Math.hypot(p[0]-upts[i-1][0],p[1]-upts[i-1][1])>1.5);assert.ok(rowsN.length>10);
 const d=blank();d.hoop=200;applyOperations(d,[{op:'add_path',id:'thin',x:0,y:0,points:[[0,0],[30,0]],stitch:'satin',satinWidth:1.2},{op:'add_path',id:'mid',x:0,y:10,points:[[0,10],[30,10]],stitch:'satin',satinWidth:3.5},{op:'add_path',id:'wide',x:0,y:30,points:[[0,30],[30,30]],stitch:'satin',satinWidth:8}]);d.settings.underlay=true;
 const count=id=>{const e=structuredClone(d);e.objects=e.objects.filter(o=>o.id===id);return compile(e).count;},none=id=>{const e=structuredClone(d);e.objects=e.objects.filter(o=>o.id===id);e.settings.underlay=false;return compile(e).count;};
 const extra={thin:count('thin')-none('thin'),mid:count('mid')-none('mid'),wide:count('wide')-none('wide')};assert.ok(extra.thin>0&&extra.mid>0&&extra.wide>0,JSON.stringify(extra));assert.ok(extra.wide>extra.mid&&extra.mid>extra.thin*.9,`wider columns get more underlay: ${JSON.stringify(extra)}`);
 const typed=type=>{const e=structuredClone(d);e.objects=e.objects.filter(o=>o.id==='wide');e.objects[0].underlayType=type;return compile(e).count;};assert.ok(typed('center+zigzag')>typed('center')&&typed('contour+zigzag')>typed('contour')&&typed('none')<typed('center'),'explicit underlay types change the stitch count as expected');
 const f=blank();f.hoop=200;applyOperations(f,[{op:'add_shape',id:'r',kind:'rect',x:0,y:0,width:40,height:25}]);f.settings.underlay=true;const ft=type=>{const e=structuredClone(f);e.objects[0].underlayType=type;return compile(e).count;};assert.ok(ft('none')<ft('contour')&&ft('contour')<ft('contour+fill')&&ft('fill')>ft('none'),'fill underlay types stack');
});

test('compiled fills have no jumps inside one shape, per-object stitch length and stagger validate, and old documents still compile',()=>{
 const d=blank();d.hoop=200;applyOperations(d,[{op:'add_path',id:'u',x:0,y:0,points:SHAPES.ushape[0].slice(0,-1),closed:true,stitch:'fill'},{op:'add_path',id:'o',x:0,y:0,points:circleRing(60,20,20,40).slice(0,-1),closed:true,stitch:'fill',holes:[circleRing(60,20,8,24,true).slice(0,-1)]}]);d.objects[1].holes=[circleRing(60,20,8,24,true).slice(0,-1)];
 const plan=compile(d);assert.equal(plan.stitches.filter(s=>s.cmd==='jump').length,2,'one jump to each shape, none inside them');
 const e=structuredClone(d);applyOperations(e,[{op:'set_object',id:'u',stitchLength:4.5,stagger:2,underlayType:'contour+fill',underlayInset:.5,underlaySpacing:3}]);validateDocument(e);assert.ok(compile(e).count!==plan.count);
 assert.throws(()=>{const bad=structuredClone(d);bad.objects[0].stitchLength=20;validateDocument(bad);},/stitch length/);assert.throws(()=>{const bad=structuredClone(d);bad.objects[0].stagger=0;validateDocument(bad);},/stagger/);assert.throws(()=>{const bad=structuredClone(d);bad.objects[0].underlayType='sideways';validateDocument(bad);},/underlay/);
 const g=structuredClone(d);g.settings.stitchLength=2;g.settings.stagger=2;validateDocument(g);assert.ok(compile(g).count>plan.count,'a shorter document stitch length means more needles');
 const jef=encode(plan,'jef','#527461',200,d);assert.ok(jef.length>1000);assert.ok(encode(plan,'dst','#527461',200,d).length>1000);
});

test('i18n: Spanish placeholders and exact strings resolve', async()=>{
  globalThis.location={search:'?lang=es'};
  const {t,lang}=await import('../src/i18n.js?es');
  assert.equal(lang,'es');
  assert.equal(t('Export'),'Exportar');
  assert.equal(t('Copied {n} objects.',{n:3}),'3 objetos copiados.');
  assert.equal(t('Agent applied 5 edits.'),'El agente aplicó 5 ediciones.');
  assert.equal(t('Needle 1.0, 2.0 mm'),'Aguja 1.0, 2.0 mm');
  assert.equal(t('Not translated here'),'Not translated here');
  delete globalThis.location;
});

test('satin rungs pair rails where they cross them, and Ink/Stitch satin glyphs do not collapse into fans',async()=>{
 const {satinFromRails}=await import('../src/engine.js'),fs=await import('node:fs');
 // a rung that overshoots both rails pairs the points where it crosses them
 const {pairs}=satinFromRails([[0,0],[20,0]],[[0,4],[40,4]],.4,0,[[[10,-1],[20,5]]]);
 assert.ok(pairs.some(([a,b])=>Math.abs(a[0]-11.67)<.3&&Math.abs(b[0]-18.33)<.3),'rung crossing positions are paired');
 assert.ok(pairs.every(([a,b],i)=>!i||b[0]>=pairs[i-1][1][0]-1e-6),'the far rail only advances');
 // no run of 8+ needle pairs may share one point on the other rail in these glyphs (the old nearest-point pairing collapsed them)
 const font=JSON.parse(fs.readFileSync(new URL('../fonts/inkstitch/emilio_20.json',import.meta.url),'utf8')),pts=a=>{const o=[];for(let i=0;i<a.length;i+=2)o.push([a[i],a[i+1]]);return o;};
 for(const ch of 'RSBGQ8'){font.glyphs[ch].p.forEach((p,i)=>{if(p[0]!=='s')return;const {pairs:pp}=satinFromRails(pts(p[1]),pts(p[2]),.4,0,(p[3]||[]).map(r=>[[r[0],r[1]],[r[2],r[3]]]));let run=0;for(let k=1;k<pp.length;k++){const db=Math.hypot(pp[k][1][0]-pp[k-1][1][0],pp[k][1][1]-pp[k-1][1][1]);run=db<.05?run+1:0;assert.ok(run<8,`${ch} column ${i} fans out`);}});}
});

test('start and end points steer fills and satin columns, follow the object, and validate',()=>{
 const d=blank();d.settings.underlay=true;
 applyOperations(d,[{op:'add_shape',id:'r',kind:'rect',x:0,y:0,width:30,height:20},{op:'add_path',id:'s',x:0,y:0,points:[[0,40],[30,40]],stitch:'satin',satinWidth:3}]);
 const ends=(doc,id)=>{const p=compile(doc);const n=p.stitches.filter(s=>s.cmd==='stitch');return {first:n[0],last:n.at(-1),plan:p};};
 const at=(doc,id,[sx,sy],[ex,ey])=>{const e=structuredClone(doc);applyOperations(e,[{op:'set_object',id,startAt:[sx,sy],endAt:[ex,ey]}]);validateDocument(e);return e;};
 const single=id=>{const e=structuredClone(d);e.objects=e.objects.filter(o=>o.id===id);return e;};
 for(const [s,e] of [[[0,0],[1,1]],[[1,1],[0,0]],[[1,0],[0,1]]]){
  const doc=at(single('r'),'r',s,e),{first,last,plan}=ends(doc,'r');const pt=f=>[f[0]*30,f[1]*20];
  assert.ok(Math.hypot(first.x-pt(s)[0],first.y-pt(s)[1])<6,`fill starts near ${s}`);assert.ok(Math.hypot(last.x-pt(e)[0],last.y-pt(e)[1])<6,`fill ends near ${e}`);assert.deepEqual(plan.errors,[]);}
 const sat=at(single('s'),'s',[1,0.5],[0,0.5]),sp=ends(sat,'s');assert.ok(sp.first.x>20&&sp.last.x<10,'satin runs from the right end to the left end');
 const flipped=at(single('s'),'s',[0,.5],[1,.5]),fp=ends(flipped,'s');assert.ok(fp.first.x<10&&fp.last.x>20,'and the other way when asked');
 const moved=structuredClone(at(single('r'),'r',[0,0],[1,1]));applyOperations(moved,[{op:'transform',id:'r',x:40}]);assert.ok(ends(moved,'r').first.x>38,'start point follows the object');
 assert.throws(()=>{const bad=structuredClone(d);bad.objects[0].startAt=[2,0];validateDocument(bad);},/startAt/);
 // a donut sews as one piece: a single jump to get there, no cross-hole travel
 const donut=blank();donut.settings.underlay=true;applyOperations(donut,[{op:'add_shape',id:'o',kind:'ellipse',x:-20,y:-20,width:40,height:40},{op:'add_shape',id:'i',kind:'ellipse',x:-10,y:-10,width:20,height:20},{op:'subtract',targetId:'o',cutterId:'i'}]);
 const dp=compile(donut);assert.ok(dp.stitches.filter(s=>s.cmd==='jump').length<=1,'a donut has at most one jump');assert.equal(dp.stitches.filter(s=>s.cmd==='stitch'&&Math.hypot(s.x,s.y)<9.3).length,0,'nothing is sewn inside the hole');
});

test('contour fill sews concentric rings inside the shape without jumps',()=>{
 for(const shape of ['rect','ellipse']){const d=blank();applyOperations(d,[{op:'add_shape',id:'a',kind:shape,x:0,y:0,width:30,height:20},{op:'set_object',id:'a',fillMethod:'contour'}]);validateDocument(d);
  const p=compile(d),n=p.stitches.filter(s=>s.cmd==='stitch');assert.deepEqual(p.errors,[]);assert.ok(n.length>300,`${shape}: dense enough`);
  assert.ok(n.every(s=>s.x>=-.3&&s.x<=30.3&&s.y>=-.3&&s.y<=20.3),`${shape}: stays inside`);assert.ok(p.stitches.filter(s=>s.cmd==='jump').length<=1,`${shape}: no jumps`);
  let max=0;for(let i=1;i<n.length;i++)max=Math.max(max,Math.hypot(n[i].x-n[i-1].x,n[i].y-n[i-1].y));assert.ok(max<4.5,`${shape}: longest step ${max}`);}
 assert.throws(()=>{const d=blank();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:0,y:0,width:10,height:10}]);d.objects[0].fillMethod='zigzag';validateDocument(d);},/fillMethod/);
});

test('spiral, meander and guided fills sew inside the shape in few runs with sane stitch lengths',()=>{
 for(const [method,extra] of [['spiral',{}],['meander',{}],['guided',{guide:[[0,.6],[.5,.4],[1,.6]]}]]){
  for(const shape of ['rect','ellipse']){const d=blank();applyOperations(d,[{op:'add_shape',id:'a',kind:shape,x:0,y:0,width:40,height:24},{op:'set_object',id:'a',fillMethod:method,...extra}]);validateDocument(d);
   const p=compile(d),n=p.stitches.filter(s=>s.cmd==='stitch');assert.deepEqual(p.errors,[],`${method}/${shape}`);assert.ok(n.length>200,`${method}/${shape}: has stitches`);
   assert.ok(n.every(s=>s.x>=-.4&&s.x<=40.4&&s.y>=-.4&&s.y<=24.4),`${method}/${shape}: stays inside`);assert.ok(p.stitches.filter(s=>s.cmd==='jump').length<=1,`${method}/${shape}: jumps`);
   let max=0;for(let i=1;i<n.length;i++)max=Math.max(max,Math.hypot(n[i].x-n[i-1].x,n[i].y-n[i-1].y));assert.ok(max<=5.5,`${method}/${shape}: longest step ${max.toFixed(1)}`);}}
 const d=blank();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:0,y:0,width:10,height:10},{op:'set_object',id:'a',fillMethod:'guided'}]);validateDocument(d);assert.ok(compile(d).count>50,'guided without a guide falls back to rows');
 assert.throws(()=>{d.objects[0].guide=[[0,0]];validateDocument(d);},/guide/);
});

test('vector-editing basics: rounded rectangles, rounded path corners, tapered satin columns, bordered fills with a width, lettering that follows its path',()=>{
 let d=blank();
 applyOperations(d,[{op:'add_shape',id:'r',kind:'rect',x:0,y:0,width:30,height:20,radius:5}]);validateDocument(d);
 const ring=geometry(d.objects[0])[0];assert.ok(ring.length>30,'rounded rectangle is a many-point outline');assert.ok(!ring.some(([x,y])=>x<.5&&y<.5),'the corner is cut away');assert.ok(ring.every(([x,y])=>x>=-1e-9&&x<=30+1e-9&&y>=-1e-9&&y<=20+1e-9));
 applyOperations(d,[{op:'transform',id:'r',x:10}]);assert.equal(d.objects[0].radius,5);applyOperations(d,[{op:'set_object',id:'r',radius:null}]);assert.equal(d.objects[0].radius,undefined);
 assert.throws(()=>{const e=blank();applyOperations(e,[{op:'add_shape',id:'c',kind:'ellipse',x:0,y:0,width:5,height:5}]);e.objects[0].radius=2;validateDocument(e);},/radius/);
 // path corners
 d=blank();applyOperations(d,[{op:'add_path',id:'p',x:0,y:0,points:[[0,0],[20,0],[20,20],[0,20]],closed:true,stitch:'fill'},{op:'round_corners',id:'p',radius:4}]);validateDocument(d);
 assert.equal(d.objects[0].points.length,8,'each of the four corners becomes two nodes');const out=geometry(d.objects[0])[0];assert.ok(!out.some(([x,y])=>Math.hypot(x-20,y)<1),'the sharp corner is gone');assert.ok(Math.min(...out.map(([x,y])=>Math.hypot(x-17,y-3)))<.2||out.some(([x,y])=>y>=0&&Math.hypot(x-20,y-4)<.3),'the arc ends where expected');
 assert.throws(()=>applyOperations(d,[{op:'round_corners',id:'p',radius:0}]),/radius/);
 // open path: end nodes stay
 d=blank();applyOperations(d,[{op:'add_path',id:'o',x:0,y:0,points:[[0,0],[10,0],[10,10]],stitch:'run'},{op:'round_corners',id:'o',radius:2}]);assert.deepEqual(d.objects[0].points[0],[0,0]);assert.deepEqual(d.objects[0].points.at(-1),[10,10]);assert.equal(d.objects[0].points.length,4);
 // taper
 d=blank();applyOperations(d,[{op:'add_path',id:'s',x:0,y:0,points:[[0,10],[40,10]],stitch:'satin',satinWidth:6},{op:'set_object',id:'s',satinWidthEnd:1}]);validateDocument(d);
 const n=compile(d).stitches.filter(s=>s.cmd==='stitch'),span=a=>{const ys=a.map(s=>s.y);return Math.max(...ys)-Math.min(...ys);};
 assert.ok(span(n.filter(s=>s.x<8))>4.5&&span(n.filter(s=>s.x>32))<2.6,'the column narrows from 6 mm to 1 mm');
 assert.throws(()=>{const e=blank();applyOperations(e,[{op:'add_shape',id:'q',kind:'rect',x:0,y:0,width:5,height:5}]);e.objects[0].satinWidthEnd=2;validateDocument(e);},/end width/);
 // border width
 d=blank();d.settings.underlay=false;applyOperations(d,[{op:'add_shape',id:'b',kind:'rect',x:0,y:0,width:30,height:20},{op:'set_object',id:'b',border:true,borderThread:'#d9897e'}]);const plain=compile(d);
 applyOperations(d,[{op:'set_object',id:'b',borderWidth:2}]);validateDocument(d);const wide=compile(d);assert.ok(wide.count>plain.count+200,'a satin border sews many more needles than a running outline');assert.deepEqual(wide.errors,[]);
 const bs=wide.stitches.filter(s=>s.cmd==='stitch'&&s.thread==='#d9897e');assert.ok(Math.min(...bs.map(s=>s.x))<-.5&&Math.max(...bs.map(s=>s.x))>30.5,'the border straddles the outline');
 assert.throws(()=>{applyOperations(d,[{op:'set_object',id:'b',borderWidth:20}]);validateDocument(d);},/border width/);
 // lettering follows its path and re-follows when the path changes
 d=blank();applyOperations(d,[{op:'add_path',id:'arc',x:0,y:0,points:[[0,30],[30,10],[60,30]],stitch:'run',smooth:true},{op:'add_text',id:'t',text:'HI',x:0,y:0,height:8},{op:'text_on_path',textId:'t',pathId:'arc'}]);
 const before=JSON.stringify(d.objects.find(o=>o.id==='t').along.points);applyOperations(d,[{op:'transform',id:'arc',x:20}]);
 const after=d.objects.find(o=>o.id==='t').along;assert.notEqual(JSON.stringify(after.points),before,'the lettering moved with its path');assert.equal(after.pathId,'arc');validateDocument(d);
 applyOperations(d,[{op:'delete',id:'arc'}]);assert.equal(d.objects.find(o=>o.id==='t').along.pathId,undefined,'deleting the path detaches the link but keeps the lettering where it was');validateDocument(d);
});

test('the neon font module used by the browser matches its JSON source, and no browser module uses JSON imports (Safari workers cannot)',async()=>{
 const mod=(await import('../fonts/neon_blinking/glyphs.js')).default;assert.deepEqual(mod,neonGlyphs);
 const fs=await import('node:fs'),files=fs.readdirSync(new URL('../src/',import.meta.url)).filter(f=>f.endsWith('.js'));
 for(const f of files)assert.ok(!/from\s+['"][^'"]+\.json['"]|with\s*\{\s*type\s*:\s*['"]json/.test(fs.readFileSync(new URL('../src/'+f,import.meta.url),'utf8')),`${f} must not import JSON`);
});

test('stroke widths per node, caps and joins on satin paths',()=>{
 const path=(extra={})=>{const d=blank();applyOperations(d,[{op:'add_path',id:'p',x:0,y:0,points:[[0,10],[20,10],[40,10]],stitch:'satin',satinWidth:4},{op:'set_object',id:'p',...extra}]);validateDocument(d);return d;};
 const span=(plan,lo,hi)=>{const ys=plan.stitches.filter(s=>s.cmd==='stitch'&&s.x>=lo&&s.x<=hi).map(s=>s.y);return Math.max(...ys)-Math.min(...ys);};
 // width at a node: widen only the middle node
 let d=path();applyOperations(d,[{op:'set_width_at_node',id:'p',index:1,width:9}]);validateDocument(d);assert.equal(d.objects[0].widthStops.length,3);const plan=compile(d);
 assert.ok(span(plan,18,22)>7.5&&span(plan,0,3)<4.6&&span(plan,37,40)<4.6,'wide in the middle, narrow at the ends');
 applyOperations(d,[{op:'set_width_at_node',id:'p',index:1,width:null}]);assert.deepEqual(d.objects[0].widthStops.map(s=>s[0]),[0,1]);
 assert.throws(()=>applyOperations(d,[{op:'set_width_at_node',id:'p',index:1,width:20}]),/Width/);
 // caps lengthen the column beyond its end points
 const xs=pl=>{const v=pl.stitches.filter(s=>s.cmd==='stitch').map(s=>s.x);return [Math.min(...v),Math.max(...v)];};
 const butt=xs(compile(path({cap:'butt'}))),square=xs(compile(path({cap:'square'}))),round=xs(compile(path({cap:'round'})));
 assert.ok(butt[0]>-.6&&butt[1]<40.6,'butt ends at the end points');assert.ok(square[0]<-1.5&&square[1]>41.5,'square cap extends by half the width');assert.ok(round[0]<-1.2&&round[1]>41.2,'round cap extends too');assert.ok(compile(path({cap:'round'})).count!==compile(path({cap:'butt'})).count);
 // joins on a sharp corner
 const corner=j=>{const e=blank();applyOperations(e,[{op:'add_path',id:'c',x:0,y:0,points:[[0,0],[20,0],[20,20]],stitch:'satin',satinWidth:4},{op:'set_object',id:'c',join:j}]);validateDocument(e);const p=compile(e);assert.deepEqual(p.errors,[],j);const n=p.stitches.filter(s=>s.cmd==='stitch');assert.ok(Math.max(...n.map((s,i)=>i?Math.hypot(s.x-n[i-1].x,s.y-n[i-1].y):0))<=12.2,`${j}: no overlong stitch`);return [Math.max(...n.map(s=>s.x)),Math.min(...n.map(s=>s.y))];};
 const [mx,my]=corner('miter'),[rx,ry]=corner('round'),[bx,by]=corner('bevel');assert.ok(mx>21.8&&my<-1.8,'miter reaches the sharp tip');assert.ok(rx<22.2&&rx>=21.8,'round stays within half a width');assert.ok(bx<=22.05,'bevel cuts the corner');
 assert.throws(()=>{const e=path();e.objects[0].cap='pointy';validateDocument(e);},/cap or join/);assert.throws(()=>{const e=blank();applyOperations(e,[{op:'add_shape',id:'r',kind:'rect',x:0,y:0,width:5,height:5}]);e.objects[0].widthStops=[[0,2]];validateDocument(e);},/width stops/);
});

test('clipping masks: fills, satin, lettering and borders are sewn only inside the mask; the mask is not sewn; links follow edits',()=>{
 const d=blank();d.settings.underlay=false;
 applyOperations(d,[{op:'add_shape',id:'big',kind:'rect',x:0,y:0,width:40,height:20},{op:'add_shape',id:'m',kind:'ellipse',x:10,y:2,width:20,height:16}]);
 const full=compile(d),inMask=(x,y)=>((x-20)/10.4)**2+((y-10)/8.4)**2<=1;
 applyOperations(d,[{op:'clip',ids:['big'],maskId:'m'}]);validateDocument(d);assert.equal(d.objects.find(o=>o.id==='m').mask,true);
 const clipped=compile(d),n=clipped.stitches.filter(s=>s.cmd==='stitch');assert.ok(n.length>100&&n.length<full.count*.6,'fewer stitches than the unclipped fill');assert.ok(n.every(s=>inMask(s.x,s.y)),'every needle lies inside the ellipse');
 // satin, running stitch and lettering are cut at the mask edge
 applyOperations(d,[{op:'add_path',id:'sat',x:0,y:0,points:[[-10,10],[50,10]],stitch:'satin',satinWidth:4},{op:'add_path',id:'run',x:0,y:0,points:[[-10,5],[50,5]],stitch:'run'},{op:'add_text',id:'t',text:'HELLO',x:2,y:6,height:8},{op:'clip',ids:['sat','run','t'],maskId:'m'}]);
 const all=compile(d);assert.deepEqual(all.errors,[]);for(const s of all.stitches.filter(s=>s.cmd==='stitch'))assert.ok(inMask(s.x,s.y),`needle ${s.x},${s.y} outside`);
 assert.ok(all.stitches.filter(s=>s.cmd==='stitch'&&Math.abs(s.y-5)<.3).length>10,'the running stitch is sewn inside');
 // border follows the clipped outline
 applyOperations(d,[{op:'set_object',id:'big',border:true,borderThread:'#d9897e'}]);assert.ok(compile(d).stitches.filter(s=>s.thread==='#d9897e').every(s=>inMask(s.x,s.y)));
 // moving the mask moves the clip; deleting it releases the objects
 applyOperations(d,[{op:'transform',id:'m',x:20}]);const moved=compile(d).stitches.filter(s=>s.cmd==='stitch');assert.ok(Math.max(...moved.map(s=>s.x))>30);
 applyOperations(d,[{op:'delete',id:'m'}]);assert.equal(d.objects.find(o=>o.id==='big').clipId,undefined);validateDocument(d);assert.ok(compile(d).count>full.count*.9,'unclipped again');
 // release and errors
 applyOperations(d,[{op:'add_shape',id:'m2',kind:'rect',x:0,y:0,width:10,height:10},{op:'clip',ids:['big'],maskId:'m2'},{op:'release_clip',ids:['big']}]);assert.equal(d.objects.find(o=>o.id==='m2').mask,undefined,'an unused mask is a normal shape again');
 assert.throws(()=>applyOperations(d,[{op:'clip',ids:['big'],maskId:'big'}]),/not including/);assert.throws(()=>applyOperations(d,[{op:'clip',ids:['big'],maskId:'t'}]),/clipping mask must be/);
 const out=blank();applyOperations(out,[{op:'add_shape',id:'a',kind:'rect',x:-30,y:-30,width:5,height:5},{op:'add_shape',id:'b',kind:'rect',x:20,y:20,width:5,height:5},{op:'add_shape',id:'z',kind:'rect',x:0,y:0,width:5,height:5},{op:'clip',ids:['a'],maskId:'b'}]);const op=compile(out);assert.ok(op.issues.some(i=>/outside its clipping mask/.test(i.message)),'an object entirely outside its mask is reported');
});

test('colour blend fill: two threads share the rows, the second thread takes over from one end to the other',()=>{
 const d=blank();d.settings.underlay=false;applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:0,y:0,width:30,height:20,thread:'#527461'},{op:'set_object',id:'a',angle:0,blendThread:'#d9897e'}]);validateDocument(d);
 const p=compile(d),A=p.stitches.filter(s=>s.cmd==='stitch'&&s.thread==='#527461'),B=p.stitches.filter(s=>s.cmd==='stitch'&&s.thread==='#d9897e');assert.deepEqual(p.errors,[]);assert.ok(A.length>100&&B.length>100,'both threads are sewn');
 const meanY=a=>a.reduce((n,s)=>n+s.y,0)/a.length;assert.ok(meanY(B)>meanY(A)+3,'the second thread is concentrated at the far end');
 const rows=new Set(A.map(s=>Math.round(s.y*10))),rowsB=new Set(B.map(s=>Math.round(s.y*10)));assert.ok([...rows].every(r=>!rowsB.has(r)),'no row is sewn in both colours');assert.ok(p.stitches.filter(s=>s.cmd==='color').length>=1);
 let max=0;const n=p.stitches.filter(s=>s.cmd==='stitch');for(let i=1;i<n.length;i++)if(n[i].thread===n[i-1].thread)max=Math.max(max,Math.hypot(n[i].x-n[i-1].x,n[i].y-n[i-1].y));assert.ok(max<12.2);
 applyOperations(d,[{op:'set_object',id:'a',blendStart:.5,blendEnd:.5}]);const half=compile(d);assert.ok(half.stitches.filter(s=>s.cmd==='stitch'&&s.thread==='#d9897e').every(s=>s.y>9.4),'a hard edge at 50%');
 assert.throws(()=>{const e=blank();applyOperations(e,[{op:'add_shape',id:'r',kind:'rect',x:0,y:0,width:5,height:5,stitch:'run'}]);e.objects[0].blendThread='#d9897e';validateDocument(e);},/blend/);
});

test('embroidery options: bean run, stitch length for runs, length variance, per-object compensation, cross stitch fill and appliqué with machine stops',()=>{
 const base=()=>{const d=blank();d.settings.underlay=false;return d;};
 // run stitch length and bean style
 let d=base();applyOperations(d,[{op:'add_path',id:'r',x:0,y:0,points:[[0,0],[30,0]],stitch:'run'}]);const single=compile(d).stitches.filter(s=>s.cmd==='stitch').length;
 applyOperations(d,[{op:'set_object',id:'r',stitchLength:1.5}]);const fine=compile(d).stitches.filter(s=>s.cmd==='stitch').length;assert.ok(fine>single*1.4,'a shorter run stitch means more needles');
 applyOperations(d,[{op:'set_object',id:'r',stitchLength:null,runStyle:'bean'}]);validateDocument(d);const bean=compile(d).stitches.filter(s=>s.cmd==='stitch').length;assert.ok(bean>single*2.6&&bean<single*3.4,'bean stitches go over each segment three times');
 assert.throws(()=>{d.objects[0].runStyle='wavy';validateDocument(d);},/runStyle/);
 // length variance keeps stitches within the varied length but changes the pattern
 d=base();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:0,y:0,width:30,height:20},{op:'set_object',id:'a',angle:0,stagger:1}]);const plain=compile(d).stitches.filter(s=>s.cmd==='stitch');
 applyOperations(d,[{op:'set_object',id:'a',lengthVariance:.4}]);validateDocument(d);const varied=compile(d).stitches.filter(s=>s.cmd==='stitch');assert.notDeepEqual(plain.slice(0,40).map(s=>s.x),varied.slice(0,40).map(s=>s.x));
 let max=0;for(let i=1;i<varied.length;i++)if(Math.abs(varied[i].y-varied[i-1].y)<.01)max=Math.max(max,Math.abs(varied[i].x-varied[i-1].x));assert.ok(max<=3*1.45+.01,`varied stitch ${max}`);
 // per-object compensation widens fills
 d=base();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:0,y:0,width:20,height:10},{op:'set_object',id:'a',compensation:1}]);validateDocument(d);const xs=compile(d).stitches.filter(s=>s.cmd==='stitch').map(s=>s.x);assert.ok(Math.min(...xs)<-.6&&Math.max(...xs)>20.6,'a 1 mm compensation pulls the outline out');
 assert.throws(()=>{d.objects[0].compensation=5;validateDocument(d);},/compensation/);
 // cross stitch
 d=base();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:0,y:0,width:20,height:10},{op:'set_object',id:'a',fillMethod:'cross',crossSize:2.5}]);validateDocument(d);const cs=compile(d);assert.deepEqual(cs.errors,[]);const cn=cs.stitches.filter(s=>s.cmd==='stitch');assert.ok(cn.length>100,'8×4 cells of X stitches');assert.ok(cn.every(s=>s.x>=-.01&&s.x<=20.01&&s.y>=-.01&&s.y<=10.01));
 assert.ok(cn.filter(s=>Math.abs((s.x/2.5)%1)<.02&&Math.abs((s.y/2.5)%1)<.02).length>cn.length*.85,'needles sit on the cell grid');
 // appliqué
 d=base();applyOperations(d,[{op:'add_shape',id:'a',kind:'ellipse',x:0,y:0,width:30,height:20},{op:'set_object',id:'a',applique:true,appliqueWidth:2.5,borderThread:'#d9897e'}]);validateDocument(d);
 const ap=compile(d);assert.deepEqual(ap.errors,[]);const ev=ap.stitches.filter(s=>s.cmd==='stop'||s.cmd==='color');assert.ok(ap.stitches.filter(s=>s.cmd==='stop').length>=1&&ev.length===2,`placement, stop, tack-down, colour change, cover: ${ev.map(e=>e.cmd)}`);
 const an=ap.stitches.filter(s=>s.cmd==='stitch'),inside=an.filter(s=>((s.x-15)/13.8)**2+((s.y-10)/8.8)**2<.6);assert.ok(inside.length<an.length*.15,'the area is not filled');assert.ok(an.length>200);
 for(const f of ['jef','vp3','dst'])assert.ok(encode(ap,f,undefined,110,d).length>100,`${f} export of an appliqué`);
 assert.throws(()=>{const e=base();applyOperations(e,[{op:'add_shape',id:'r',kind:'rect',x:0,y:0,width:5,height:5,stitch:'run'}]);e.objects[0].applique=true;validateDocument(e);},/appliqué/);
});

test('colour blend on contour and spiral fills keeps the whole shape',()=>{
 for(const fillMethod of ['contour','spiral']){
  const d=blank();d.settings.underlay=false;
  applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:-30,y:-15,width:60,height:30,thread:'#527461'},{op:'set_object',id:'a',angle:0,fillMethod}]);
  const plain=compile(d).stitches.filter(s=>s.cmd==='stitch').length;
  applyOperations(d,[{op:'set_object',id:'a',blendThread:'#d9897e',blendAngle:0}]);
  const p=compile(d),st=p.stitches.filter(s=>s.cmd==='stitch'),A=st.filter(s=>s.thread==='#527461'),B=st.filter(s=>s.thread==='#d9897e'),mx=a=>a.reduce((n,s)=>n+s.x,0)/a.length;
  assert.deepEqual(p.errors,[]);assert.ok(st.length>plain*.95,`${fillMethod}: the blend sews the whole shape`);assert.ok(A.length>200&&B.length>200,`${fillMethod}: both threads sewn`);assert.ok(mx(B)>mx(A)+4,`${fillMethod}: the second thread is at the right end`);
 }
});
test('a blend palette fades through its threads in order across the fill',()=>{
 const d=blank();d.settings.underlay=false;const cols=['#527461','#d9897e','#d3ad61'];
 applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:-30,y:-10,width:60,height:20,stitch:'fill'},{op:'set_object',id:'a',angle:0,blendAngle:0,blendPalette:cols}]);validateDocument(d);
 const p=compile(d);assert.deepEqual(p.errors,[]);
 const mean=c=>{const a=p.stitches.filter(s=>s.cmd==='stitch'&&s.thread===c);return a.length?a.reduce((n,s)=>n+s.x,0)/a.length:NaN;};
 const m=cols.map(mean);
 assert.ok(m.every(Number.isFinite),'all three palette threads sewn');
 assert.ok(m[0]<m[1]&&m[1]<m[2],'colours run in palette order across the shape');
 assert.throws(()=>{d.objects[0].blendThread='#d9897e';validateDocument(d);},/not both/);
 assert.throws(()=>{d.objects[0].blendThread=undefined;d.objects[0].blendPalette=['#527461'];validateDocument(d);},/blendPalette/);
});

test('colour blend in any direction and for other patterns; underpath keeps shapes in few runs',()=>{
 const d=blank();d.settings.underlay=false;
 applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:0,y:0,width:40,height:20,thread:'#527461'},{op:'set_object',id:'a',angle:0,blendThread:'#d9897e',blendAngle:0}]);validateDocument(d);
 let p=compile(d);const A=p.stitches.filter(s=>s.cmd==='stitch'&&s.thread==='#527461'),B=p.stitches.filter(s=>s.cmd==='stitch'&&s.thread==='#d9897e'),mx=a=>a.reduce((n,s)=>n+s.x,0)/a.length;
 assert.deepEqual(p.errors,[]);assert.ok(A.length>100&&B.length>100,'both threads sewn');assert.ok(mx(B)>mx(A)+4,'the second thread is concentrated at the right end for a blend along x');
 applyOperations(d,[{op:'set_object',id:'a',blendAngle:null,fillMethod:'spiral'}]);p=compile(d);assert.deepEqual(p.errors,[]);assert.ok(p.stitches.some(s=>s.cmd==='stitch'&&s.thread==='#d9897e')&&p.stitches.some(s=>s.cmd==='stitch'&&s.thread==='#527461'),'a spiral fill blends too');
 assert.throws(()=>{d.objects[0].blendAngle=999;validateDocument(d);},/blendAngle/);
 // underpath: a comb shape sews in one run, and turning it off cannot make it better
 const comb=[[-30,-20],[30,-20],[30,-10],[20,-10],[20,20],[12,20],[12,-10],[4,-10],[4,20],[-4,20],[-4,-10],[-12,-10],[-12,20],[-20,20],[-20,-10],[-30,-10]];
 const jumps=up=>{const e=blank();applyOperations(e,[{op:'add_path',id:'p',x:0,y:0,points:comb,closed:true,stitch:'fill'},{op:'set_object',id:'p',angle:90,underpath:up}]);validateDocument(e);return compile(e).stitches.filter(s=>s.cmd==='jump').length;};
 assert.ok(jumps(true)<=jumps(false)&&jumps(true)<=1);d.objects[0].blendAngle=0;assert.throws(()=>{d.objects[0].underpath='yes';validateDocument(d);},/underpath/);
});

test('ripple fill: scaled copies of the outline towards a centre, clipped to the shape',()=>{
 const d=blank();d.settings.underlay=false;applyOperations(d,[{op:'add_shape',id:'a',kind:'ellipse',x:0,y:0,width:40,height:24},{op:'set_object',id:'a',fillMethod:'ripple'}]);validateDocument(d);
 let p=compile(d);assert.deepEqual(p.errors,[]);let n=p.stitches.filter(s=>s.cmd==='stitch');assert.ok(n.length>300);assert.ok(n.every(s=>((s.x-20)/20.2)**2+((s.y-12)/12.2)**2<=1.01),'inside the ellipse');assert.ok(p.stitches.filter(s=>s.cmd==='jump').length<=1);
 applyOperations(d,[{op:'set_object',id:'a',rippleCenter:[0,.5]}]);p=compile(d);n=p.stitches.filter(s=>s.cmd==='stitch');assert.ok(n.every(s=>((s.x-20)/20.2)**2+((s.y-12)/12.2)**2<=1.01),'still inside with an off-centre target');
 const end=n.at(-1);assert.ok(end.x<8,`the winding ends near the target (${end.x})`);
 // a concave shape stays inside too
 const e=blank();applyOperations(e,[{op:'add_path',id:'u',x:0,y:0,points:[[0,0],[10,0],[10,15],[20,15],[20,0],[30,0],[30,25],[0,25]],closed:true,stitch:'fill'},{op:'set_object',id:'u',fillMethod:'ripple'}]);const q=compile(e);assert.deepEqual(q.errors,[]);assert.ok(q.stitches.filter(s=>s.cmd==='stitch').every(s=>!(s.x>10.1&&s.x<19.9&&s.y<14.9)),'nothing sewn in the notch');
});

test('photo stitch: a grey picture becomes rows of zigzags that are wider where the picture is dark',()=>{
 const pw=40,ph=20,gray=Buffer.alloc(pw*ph);for(let y=0;y<ph;y++)for(let x=0;x<pw;x++)gray[y*pw+x]=x<pw/2?20:235;   // dark left half, light right half
 const d=blank();d.settings.underlay=false;applyOperations(d,[{op:'add_shape',id:'p',kind:'rect',x:0,y:0,width:40,height:20},{op:'set_object',id:'p',photo:{pw,ph,data:gray.toString('base64'),spacing:.8}}]);validateDocument(d);
 const p=compile(d);assert.deepEqual(p.errors,[]);const n=p.stitches.filter(s=>s.cmd==='stitch');assert.ok(n.length>800&&p.stitches.filter(s=>s.cmd==='jump').length<=1,'the dark half is one continuous line');assert.equal(n.filter(s=>s.x>22).length,0,'nothing is sewn where the picture is white');
 const spread=pts=>{const ys=pts.map(s=>Math.abs(s.y-(Math.floor(s.y/.8)+.5)*.8));return ys.reduce((a,b)=>a+b,0)/ys.length;};
 assert.ok(spread(n.filter(s=>s.x<18))>.12,'the dark side zigzags widely');
 assert.ok(n.every(s=>s.x>=-.01&&s.x<=40.01&&s.y>=-.5&&s.y<=20.5));
 let max=0;for(let i=1;i<n.length;i++)max=Math.max(max,Math.hypot(n[i].x-n[i-1].x,n[i].y-n[i-1].y));assert.ok(max<3,`longest step ${max}`);
 applyOperations(d,[{op:'set_object',id:'p',photo:{pw,ph,data:gray.toString('base64'),spacing:.8,invert:true}}]);const inv=compile(d).stitches.filter(s=>s.cmd==='stitch');assert.ok(inv.filter(s=>s.x>22).length>800&&inv.filter(s=>s.x<18).length===0,'invert swaps the sides');
 assert.throws(()=>{d.objects[0].photo={pw:4,ph:4,data:'AAAA'};validateDocument(d);},/photo/);assert.throws(()=>{const e=blank();applyOperations(e,[{op:'add_shape',id:'c',kind:'ellipse',x:0,y:0,width:5,height:5}]);e.objects[0].photo={pw:2,ph:2,data:'AAAAAA=='};validateDocument(e);},/photo/);
});

test('two-tone photo stitch: a second thread sews the light tones first, the main thread adds the dark detail',()=>{
 const pw=40,ph=20,gray=Buffer.alloc(pw*ph);for(let y=0;y<ph;y++)for(let x=0;x<pw;x++)gray[y*pw+x]=Math.round(255*(1-x/(pw-1)));   // dark to light ramp
 const d=blank();d.settings.underlay=false;applyOperations(d,[{op:'add_shape',id:'p',kind:'rect',x:0,y:0,width:40,height:20},{op:'set_object',id:'p',photo:{pw,ph,data:gray.toString('base64'),spacing:.8,thread2:'#d3ad61'}}]);validateDocument(d);
 const p=compile(d);assert.deepEqual(p.errors,[]);const order=p.stitches.filter(s=>s.cmd==='stitch'||s.cmd==='color').map(s=>s.cmd==='color'?'C':s.thread);const firstDark=order.indexOf('#527461'),lastLight=order.lastIndexOf('#d3ad61');assert.ok(lastLight<firstDark,'the light thread is sewn completely first');
 const light=p.stitches.filter(s=>s.cmd==='stitch'&&s.thread==='#d3ad61'),dark=p.stitches.filter(s=>s.cmd==='stitch'&&s.thread==='#527461');assert.ok(light.length>300&&dark.length>100);
 const mx=a=>a.reduce((n,s)=>n+s.x,0)/a.length;assert.ok(mx(dark)>mx(light),'dark detail sits on the dark (right) side');
 assert.throws(()=>{d.objects[0].photo.thread2='gold';validateDocument(d);},/second or third thread/);
});

test('four-tone photo stitch: each tone band sews in its own thread, from light to dark',()=>{
 const pw=40,ph=20,gray=Buffer.alloc(pw*ph);for(let y=0;y<ph;y++)for(let x=0;x<pw;x++)gray[y*pw+x]=Math.round(255*(1-x/(pw-1)));
 const d=blank();d.settings.underlay=false;applyOperations(d,[{op:'add_shape',id:'p',kind:'rect',x:0,y:0,width:40,height:20},{op:'set_object',id:'p',photo:{pw,ph,data:gray.toString('base64'),spacing:.8,thread2:'#d3ad61',thread3:'#89a377',thread4:'#d9897e'}}]);validateDocument(d);
 const p=compile(d);assert.deepEqual(p.errors,[]);
 const bands=['#d3ad61','#89a377','#d9897e','#527461'];
 const order=p.stitches.filter(s=>s.cmd==='stitch').map(s=>s.thread);
 for(const t of bands)assert.ok(order.filter(x=>x===t).length>30,`${t} sews a visible share of the photo`);
 for(let i=0;i+1<bands.length;i++)assert.ok(order.lastIndexOf(bands[i])<order.indexOf(bands[i+1]),`${bands[i]} finishes before ${bands[i+1]} starts`);
 d.objects[0].photo.thread4=undefined;d.objects[0].photo.thread3=undefined;d.objects[0].photo.thread4='#d9897e';assert.throws(()=>validateDocument(d),/fourth thread/);
});

test('reference image: set, move, hide, clear and validate; it never affects the stitches',()=>{
 const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
 const d=blank();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:0,y:0,width:20,height:10}]);const before=compile(d).count;
 assert.throws(()=>applyOperations(d,[{op:'set_reference',x:0}]),/picture data/);
 applyOperations(d,[{op:'set_reference',data:png,x:-30,y:-20,w:60,h:40,opacity:.5,name:'sketch.png'}]);validateDocument(d);assert.equal(d.reference.w,60);
 assert.equal(compile(d).count,before,'the reference is not sewn');
 applyOperations(d,[{op:'set_reference',opacity:.8,visible:false,locked:true}]);validateDocument(d);assert.equal(d.reference.data,png,'moving keeps the picture');assert.equal(d.reference.visible,false);
 assert.throws(()=>{d.reference.opacity=2;validateDocument(d);},/opacity/);d.reference.opacity=.5;assert.throws(()=>{d.reference.data='data:text/html;base64,AAAA';validateDocument(d);},/reference image/);d.reference.data=png;assert.throws(()=>{d.reference.w=0;validateDocument(d);},/millimetres/);d.reference.w=60;
 applyOperations(d,[{op:'clear_reference'}]);assert.equal(d.reference,undefined);validateDocument(d);
});

test('DST import: exported DST files come back as stitch layers with the same geometry, trims and colour blocks',async()=>{
 const {decodeEmbroidery}=await import('../src/readers.js');
 const d=initialDocument(),plan=compile(d),bytes=encode(plan,'dst',undefined,d.hoop,d),layer=importStitchLayer(bytes,'dst',{fileName:'x.dst'});
 const sew=plan.stitches.filter(s=>s.cmd==='stitch'),got=layer.stitches.filter(s=>s.cmd==='stitch');assert.equal(got.length,sew.length);
 let worst=0;sew.forEach((s,i)=>{worst=Math.max(worst,Math.hypot(s.x-got[i].x,s.y-got[i].y));});assert.ok(worst<=.06,`positions within rounding (${worst} mm)`);
 assert.equal(layer.stitches.filter(s=>s.cmd==='color').length,plan.stitches.filter(s=>s.cmd==='color').length,'colour changes survive');
 assert.equal(layer.stitches.filter(s=>s.cmd==='trim').length,plan.stitches.filter(s=>s.cmd==='trim').length,'trims survive');
 assert.equal(layer.threads.length,plan.colors.length>0?layer.threads.length:1);assert.ok(layer.source.warnings.some(w=>/no thread colours/.test(w)));
 const doc=blank();doc.objects.push(layer);validateDocument(doc);assert.ok(compile(doc).count>=sew.length,'the layer compiles as part of a design');
 assert.throws(()=>decodeEmbroidery(new Uint8Array(600),'dst'),/header/);assert.throws(()=>decodeEmbroidery(new Uint8Array(10),'dst'),/too short/);
 // round trip through every writer: DST -> layer -> DST gives the same needles
 const again=encode(compile(doc),'dst',undefined,110,doc),back=importStitchLayer(again,'dst',{fileName:'y.dst'}).stitches.filter(s=>s.cmd==='stitch');assert.equal(back.length,sew.length);
});

test('sewing warnings and the clear / restore operations',async()=>{
 const {designWarnings}=await import('../src/engine.js');
 const d=blank();applyOperations(d,[{op:'add_shape',id:'tiny',kind:'ellipse',x:0,y:0,width:1.5,height:1.5},{op:'add_shape',id:'eye',kind:'ellipse',x:5,y:0,width:4,height:5},{op:'add_path',id:'hair',x:0,y:0,points:[[0,20],[30,20]],stitch:'satin',satinWidth:.6},{op:'add_path',id:'thick',x:0,y:0,points:[[0,30],[30,30]],stitch:'satin',satinWidth:9},{op:'add_shape',id:'a',kind:'rect',x:-60,y:0,width:10,height:10},{op:'add_shape',id:'b',kind:'rect',x:-60,y:0,width:10,height:10},{op:'add_text',id:'t',text:'HI',x:0,y:45,height:3,font:'inkstitch/emilio_20'}].filter(o=>o.id!=='t'));
 const w=designWarnings(d),msg=id=>w.filter(x=>x.id===id).map(x=>x.message).join(' ');
 assert.match(msg('tiny'),/too small for a clean fill/);assert.match(msg('eye'),/small fill/);assert.match(msg('hair'),/under 1 mm/);assert.match(msg('thick'),/wider than 7 mm/);assert.match(msg('a')+msg('b'),/outside the 110|duplicate/);assert.ok(w.some(x=>/duplicate of/.test(x.message)),'duplicates are flagged');
 const ok=blank();applyOperations(ok,[{op:'add_shape',id:'good',kind:'rect',x:0,y:0,width:20,height:10}]);assert.deepEqual(designWarnings(ok),[]);
 const keep=structuredClone(d.objects);applyOperations(d,[{op:'clear'}]);assert.equal(d.objects.length,0);applyOperations(d,[{op:'restore',objects:keep,settings:d.settings,name:'Back',hoop:d.hoop}]);validateDocument(d);assert.equal(d.objects.length,keep.length);assert.equal(d.name,'Back');
 assert.throws(()=>applyOperations(d,[{op:'restore'}]),/restore needs/);
});

test('three-tone photo stitch: light, mid-tone and main threads are sewn in that order',()=>{
 const pw=60,ph=20,gray=Buffer.alloc(pw*ph);for(let y=0;y<ph;y++)for(let x=0;x<pw;x++)gray[y*pw+x]=Math.round(255*(1-x/(pw-1)));
 const d=blank();d.settings.underlay=false;applyOperations(d,[{op:'add_shape',id:'p',kind:'rect',x:-30,y:-10,width:60,height:20},{op:'set_object',id:'p',photo:{pw,ph,data:gray.toString('base64'),spacing:.8,thread2:'#d3ad61',thread3:'#d9897e'}}]);validateDocument(d);
 const p=compile(d);assert.deepEqual(p.errors,[]);const seq=p.stitches.filter(s=>s.cmd==='stitch').map(s=>s.thread),f=c=>seq.indexOf(c),l=c=>seq.lastIndexOf(c);
 assert.ok(f('#d3ad61')>=0&&f('#d9897e')>=0&&f('#527461')>=0,'all three threads are used');assert.ok(l('#d3ad61')<f('#d9897e')&&l('#d9897e')<f('#527461'),'light, then mid, then dark');
 const mx=c=>{const a=p.stitches.filter(s=>s.cmd==='stitch'&&s.thread===c);return a.reduce((n,s)=>n+s.x,0)/a.length;};assert.ok(mx('#527461')>mx('#d9897e'),'dark detail sits further toward the dark side than the mid-tones');assert.ok(Math.abs(mx('#d9897e'))<8,'the mid-tone thread concentrates around the middle of the ramp');
 assert.equal(p.stitches.filter(s=>s.cmd==='color').length,2,'two colour changes');
 assert.throws(()=>{d.objects[0].photo={pw,ph,data:gray.toString('base64'),thread3:'#d9897e'};validateDocument(d);},/third thread/);
});

test('architecture guard: the browser code never imports server modules and only the agent bridge talks to the relay API',async()=>{
 const fs=await import('node:fs'),dir=new URL('../src/',import.meta.url);
 for(const f of fs.readdirSync(dir).filter(n=>n.endsWith('.js'))){const src=fs.readFileSync(new URL(f,dir),'utf8');
  assert.ok(!/from\s+['"][^'"]*server[^'"]*['"]/.test(src)&&!/from\s+['"]node:/.test(src),`${f} must not import server or Node modules`);
  if(f!=='agent.js')assert.ok(!/['"`]\/api\//.test(src),`${f} must not call the relay API`);}
 const app=fs.readFileSync(new URL('app.js',dir),'utf8');const mentions=[...app.matchAll(/\/artifacts\//g)].length;assert.ok(mentions<=2,'only the "open this design from an agent link" path reads an artifact');
});

test('continue digitizing extends a closed path in place, opens it, and closes it again',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_path',id:'p',x:0,y:0,points:[[-10,-10],[10,-10],[0,10]],closed:true,stitch:'fill'}]);
 applyOperations(doc,[{op:'continue_path',id:'p',points:[[-10,-10],[10,-10],[0,10],[0,20]],closed:false,stitch:'run'}]);
 assert.equal(doc.objects.length,1);
 assert.deepEqual([doc.objects[0].points.length,doc.objects[0].closed,doc.objects[0].stitch],[4,false,'run']);
 validateDocument(doc);
 applyOperations(doc,[{op:'continue_path',id:'p',points:[...doc.objects[0].points,[-10,25]],closed:true,stitch:'fill'}]);
 assert.deepEqual([doc.objects[0].points.length,doc.objects[0].closed,doc.objects[0].stitch],[5,true,'fill']);
 validateDocument(doc);assert.ok(compile(doc).count>0);
});

test('raised satin adds a centre run and zigzag underlay under the same column',()=>{
 const doc=initialDocument();doc.objects=[];doc.settings.underlay=false;
 applyOperations(doc,[{op:'add_path',id:'s',x:0,y:0,points:[[-20,0],[0,0],[20,0]],stitch:'satin',satinWidth:4}]);
 const flat=compile(doc).count;
 applyOperations(doc,[{op:'set_object',id:'s',raised:true}]);
 assert.equal(doc.objects[0].raised,true);validateDocument(doc);
 assert.ok(compile(doc).count>flat,'raised satin has more stitches (underlay)');
});

test('redwork sews a run out and back along the same path',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_path',id:'r',x:0,y:0,points:[[-20,0],[0,0],[20,0]],stitch:'run'}]);
 const single=compile(doc).count;
 applyOperations(doc,[{op:'set_object',id:'r',runStyle:'redwork'}]);
 validateDocument(doc);
 assert.ok(compile(doc).count>single*1.8,'redwork roughly doubles the run');
});

test('buttonhole adds a bar tack at each end of an open satin column',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_path',id:'b',x:0,y:0,points:[[-15,0],[15,0]],stitch:'satin',satinWidth:3}]);
 const plain=compile(doc).count;
 applyOperations(doc,[{op:'set_object',id:'b',buttonhole:true}]);
 validateDocument(doc);
 assert.ok(compile(doc).count>plain+8,'bar tacks add stitches at both ends');
});

test('motif loops sew a small loop every few mm along a path',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_path',id:'m',x:0,y:0,points:[[-20,0],[20,0]],stitch:'run'}]);
 const run=compile(doc).count;
 applyOperations(doc,[{op:'set_object',id:'m',stitch:'motif'}]);
 validateDocument(doc);
 assert.ok(compile(doc).count>run*3,'each loop adds about twelve stitches');
});

test('needle stagger splits fill rows into tiled phases',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_shape',id:'f',kind:'rect',x:-15,y:-10,width:30,height:20,thread:'#527461',stitch:'fill'}]);
 const four=JSON.stringify(compile(doc).stitches);
 applyOperations(doc,[{op:'set_object',id:'f',stagger:2}]);
 validateDocument(doc);
 assert.notEqual(JSON.stringify(compile(doc).stitches),four,'two phases tile differently from four');
});

test('paired motif loops sit on both sides of the column, at the satin width',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_path',id:'p',x:0,y:0,points:[[-20,0],[20,0]],satinWidth:6},{op:'set_object',id:'p',stitch:'motif'}]);
 const single=compile(doc).count;
 applyOperations(doc,[{op:'set_object',id:'p',motifPair:true}]);
 validateDocument(doc);
 const plan=compile(doc);
 assert.ok(plan.count>single*1.8,'pairs roughly double the loops');
 const ys=plan.stitches.filter(s=>s.cmd==='stitch').map(s=>s.y);assert.ok(Math.max(...ys)>2.5&&Math.min(...ys)<-2.5,'loops sit about 3 mm either side');
});

test('motif fill covers a closed shape with a staggered grid of loops',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_shape',id:'q',kind:'rect',x:-15,y:-15,width:30,height:30,thread:'#527461',stitch:'fill'},{op:'set_object',id:'q',fillMethod:'motif'}]);
 validateDocument(doc);
 const plan=compile(doc);assert.deepEqual(plan.errors,[]);
 assert.ok(plan.count>150&&plan.count<3000,'loops every 4 mm fill the square ('+plan.count+')');
});

test('motif warp shrinks the loops across the fill along the chosen axis',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_shape',id:'q',kind:'rect',x:-15,y:-15,width:30,height:30,thread:'#527461',stitch:'fill'},{op:'set_object',id:'q',fillMethod:'motif',motifSize:3}]);
 const flat=compile(doc),y1=flat.bounds[3];
 applyOperations(doc,[{op:'set_object',id:'q',motifWarp:'x'}]);
 validateDocument(doc);
 const warpX=compile(doc);
 assert.equal(warpX.count,flat.count,'the warp changes loop size, not the loop count');
 assert.ok(warpX.bounds[2]<flat.bounds[2]-.3,'the far right loops are smaller than the left loops');
 applyOperations(doc,[{op:'set_object',id:'q',motifWarp:'y'}]);
 const warpY=compile(doc);
 assert.ok(warpY.bounds[3]<y1-.3,'the bottom loops are smaller than the top loops');
 applyOperations(doc,[{op:'set_object',id:'q',motifWarp:'diagonal'}]);
 assert.throws(()=>validateDocument(doc),/motif warp/);
});

test('motif warp along a path shrinks the loops from start to end',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_path',id:'m',x:0,y:0,points:[[0,0],[60,0]]},{op:'set_object',id:'m',stitch:'motif',motifSize:3}]);
 const flat=compile(doc);
 applyOperations(doc,[{op:'set_object',id:'m',motifWarp:'along'}]);
 validateDocument(doc);
 const warped=compile(doc);
 assert.equal(warped.count,flat.count,'the warp changes loop size, not the loop count');
 assert.equal(warped.bounds[0],flat.bounds[0],'the start loop keeps its full size');
 assert.ok(warped.bounds[2]<flat.bounds[2]-.5,'the end loop is smaller than the start loop');
 applyOperations(doc,[{op:'add_path',id:'p',x:0,y:0,points:[[0,30],[60,30]]},{op:'set_object',id:'p',stitch:'motif',motifPair:true,satinWidth:4,motifSize:3}]);
 const pairFlat=compile(doc);
 applyOperations(doc,[{op:'set_object',id:'p',motifWarp:'along'}]);
 assert.ok(compile(doc).bounds[2]<pairFlat.bounds[2]-.5,'paired loops also shrink towards the end of the path');
});

test('motif spacing and size change how many loops are sewn',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_path',id:'m',x:0,y:0,points:[[-20,0],[20,0]]},{op:'set_object',id:'m',stitch:'motif'}]);
 const wide=compile(doc).count;
 applyOperations(doc,[{op:'set_object',id:'m',motifSpacing:2}]);
 validateDocument(doc);
 assert.ok(compile(doc).count>wide*1.6,'a 2 mm spacing sews more loops than 4 mm');
 applyOperations(doc,[{op:'set_object',id:'m',motifSpacing:4,motifSize:3}]);
 applyOperations(doc,[{op:'set_object',id:'m',motifSize:9}]);assert.throws(()=>validateDocument(doc),/motif spacing or size/);
});

test('sequins sew a centre stitch with a fixing loop every few mm',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_path',id:'s',x:0,y:0,points:[[-20,0],[20,0]]},{op:'set_object',id:'s',stitch:'sequin'}]);
 validateDocument(doc);
 const plan=compile(doc);assert.deepEqual(plan.errors,[]);
 assert.ok(plan.count>20,'sequins are sewn ('+plan.count+')');
});

test('beads sew one short pass across the path at each point',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_path',id:'b',x:0,y:0,points:[[-20,0],[20,0]]},{op:'set_object',id:'b',stitch:'bead'}]);
 validateDocument(doc);
 const plan=compile(doc);assert.deepEqual(plan.errors,[]);
 // A 40 mm path with beads every 6 mm sews one short pass per bead (about 16 stitches with travel). Three identical passes sewed 64.
 assert.ok(plan.count>=10&&plan.count<=30,'each bead is sewn once ('+plan.count+' stitches)');
});

test('bling sews a stone with a centre stitch and two fixing rings',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_path',id:'g',x:0,y:0,points:[[-20,0],[20,0]]},{op:'set_object',id:'g',stitch:'bling'}]);
 validateDocument(doc);
 const plan=compile(doc);assert.deepEqual(plan.errors,[]);
 assert.ok(plan.count>40,'bling stones are sewn ('+plan.count+')');
});

test('bling stones are round by default, square on request, and only known shapes are accepted',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_path',id:'g',x:0,y:0,points:[[-20,0],[20,0]]},{op:'set_object',id:'g',stitch:'bling'}]);
 const round=compile(doc);assert.deepEqual(round.errors,[]);
 applyOperations(doc,[{op:'set_object',id:'g',blingShape:'square'}]);
 validateDocument(doc);
 const square=compile(doc);assert.deepEqual(square.errors,[]);
 assert.notEqual(square.count,round.count,'square stones sew different fixing rings ('+square.count+' vs '+round.count+')');
 applyOperations(doc,[{op:'set_object',id:'g',blingShape:'triangle'}]);
 assert.throws(()=>validateDocument(doc),/bling shape/);
});

test('svg fill rule: one closed filled subpath becomes a fill; counters, open or stroked paths keep the outline',()=>{
 const square=parseSvgPath('M20 20 L90 20 L90 90 L20 90 Z');
 assert.deepEqual(svgPathFill('#d9897e',null,square),{fill:true,note:null,holes:0,islands:0,depths:[0]},'a filled closed square is a fill');
 assert.deepEqual(svgPathFill('#d9897e','none',square),{fill:true,note:null,holes:0,islands:0,depths:[0]},'an explicit no-stroke is still a fill');
 const counter=parseSvgPath('M20 20 L90 20 L90 90 L20 90 Z M40 40 L70 40 L70 70 L40 70 Z');
 assert.deepEqual(svgPathFill('#527461',null,counter),{fill:true,note:null,holes:1,islands:0,depths:[0,1]},'a counter inside the outer ring becomes a hole');
 const islands=parseSvgPath('M10 10 L40 10 L40 40 L10 40 Z M60 60 L90 60 L90 90 L60 90 Z');
 assert.equal(svgPathFill('#2f5d4a',null,islands).fill,false,'two islands side by side keep the outline');
 assert.match(svgPathFill('#2f5d4a',null,islands).note,/several outer shapes/);
 const nestedCounter=parseSvgPath('M0 0 L100 0 L100 100 L0 100 Z M10 10 L90 10 L90 90 L10 90 Z M20 20 L30 20 L30 30 L20 30 Z');
 assert.deepEqual(svgPathFill('#527461',null,nestedCounter),{fill:true,note:null,holes:1,islands:1,depths:[0,1,2]},'an island inside a hole is its own fill');
 const tooDeep=parseSvgPath('M0 0 L100 0 L100 100 L0 100 Z M10 10 L90 10 L90 90 L10 90 Z M20 20 L80 20 L80 80 L20 80 Z M30 30 L40 30 L40 40 L30 40 Z');
 assert.equal(svgPathFill('#527461',null,tooDeep).fill,false,'a ring nested three levels deep keeps the outline');
 assert.match(svgPathFill('#527461',null,tooDeep).note,/nested deeper/);
 assert.equal(svgPathFill('#527461',null,parseSvgPath('M0 0 L10 0 L10 10')).fill,false,'an open filled path keeps the outline');
 assert.match(svgPathFill('#527461',null,parseSvgPath('M0 0 L10 0 L10 10')).note,/not closed/);
 assert.deepEqual(svgPathFill(null,'#2f5d4a',square),{fill:false,note:null,holes:0,islands:0,depths:[]},'no fill is not a fill');
 assert.deepEqual(svgPathFill('#d9897e','#2f5d4a',square),{fill:false,note:null,holes:0,islands:0,depths:[]},'a stroked path keeps its stroke import');
});

test('my threads: a colour maps to the nearest listed thread, an empty list maps to nothing, and invalid lines are counted',()=>{
 assert.deepEqual(nearestStockThread('#ff0000',['#0000ff','#fe0101','#00ff00']),{hex:'#fe0101',index:2,distance:3});
 assert.equal(nearestStockThread('#ff0000',[]),null,'an empty stock maps to nothing');
 assert.deepEqual(parseThreadStock('#abc\n#112233\nzzz\n#112233, #ABCDEF'),{colours:['#112233','#abcdef'],invalid:2},'valid hex colours once each, and the rest counted');
});

test('stem run: stitches alternate to each side of the path, half a stem width away, and both ends sit on the path',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_path',id:'p',x:0,y:0,points:[[0,0],[30,0]]},{op:'set_object',id:'p',stitch:'run',runStyle:'stem'}]);
 validateDocument(doc);const plan=compile(doc);assert.deepEqual(plan.errors,[]);
 const st=plan.stitches.filter(s=>s.cmd==='stitch');
 assert.ok(st.filter(s=>s.y>.4).length>=2&&st.filter(s=>s.y<-.4).length>=2,'the stitches go to both sides');
 assert.ok(st.every(s=>Math.abs(s.y)<=.6+1e-6),'no stitch is further than half a stem width from the path');
 assert.ok(Math.abs(st[0].y)<1e-6&&Math.abs(st[0].x)<1e-6,'the stem starts on the path');
 const last=st.at(-1);assert.ok(Math.abs(last.y)<1e-6&&Math.abs(last.x-30)<1e-6,'the stem ends on the path');
 doc.objects[0].runStyle='sideways';assert.throws(()=>validateDocument(doc),/runStyle must be/);
});

test('appliqué from a group skips open paths and text: they keep their stitch, the closed shapes still form the group',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_shape',id:'a',kind:'rect',x:0,y:0,width:30,height:20},{op:'add_path',id:'p',x:0,y:0,points:[[0,0],[10,0],[10,10]]},{op:'add_shape',id:'b',kind:'rect',x:8,y:6,width:12,height:8}]);
 const pStitch=doc.objects.find(o=>o.id==='p').stitch;
 applyOperations(doc,[{op:'applique_group',ids:['b','p','a']}]);
 validateDocument(doc);
 const by=id=>doc.objects.find(o=>o.id===id);
 assert.equal(by('a').stitch,'fill');assert.equal(by('a').applique,undefined,'the bottom-most closed shape stays the fabric');
 assert.equal(by('b').applique,true,'the closed shape above it is an appliqué');
 assert.equal(by('p').stitch,pStitch,'the open path keeps its stitch');assert.equal(by('p').applique,undefined,'and is not an appliqué');
 assert.ok(isClosedShape(by('a'))&&!isClosedShape(by('p')),'a closed rectangle counts, an open path does not');
 assert.ok(compile(doc).errors.length===0);
});

test('appliqué from a group: the bottom-most closed shape stays a fill, each other becomes an appliqué; an open path or a single shape is refused',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_shape',id:'a',kind:'rect',x:0,y:0,width:30,height:20},{op:'add_shape',id:'b',kind:'rect',x:8,y:6,width:12,height:8},{op:'add_shape',id:'c',kind:'ellipse',x:40,y:0,width:10,height:10}]);
 applyOperations(doc,[{op:'applique_group',ids:['c','b','a']}]);
 validateDocument(doc);
 const by=id=>doc.objects.find(o=>o.id===id);
 assert.equal(by('a').stitch,'fill');assert.equal(by('a').applique,undefined,'the bottom-most shape stays the fabric');
 assert.equal(by('b').applique,true,'the shape above it is an appliqué');assert.equal(by('c').applique,true,'every shape above the bottom one is an appliqué');
 const plan=compile(doc);assert.deepEqual(plan.errors,[]);assert.ok(plan.count>40,'the appliqué group sews ('+plan.count+')');
 applyOperations(doc,[{op:'add_path',id:'p',x:0,y:0,points:[[0,0],[10,0],[10,10]]}]);
 assert.throws(()=>applyOperations(doc,[{op:'applique_group',ids:['a','p']}]),/two or more closed shapes/,'one closed shape and an open path leaves one closed shape, so it is refused');
 assert.throws(()=>applyOperations(doc,[{op:'applique_group',ids:['a']}]),/two or more/);
});

test('corner radii: four values round each corner separately; a uniform radius still rounds all four; a bad count is refused',()=>{
 assert.deepEqual(cornerRadii({radius:3}),[3,3,3,3]);assert.deepEqual(cornerRadii({radius:3,radii:[0,5,0,5]}),[0,5,0,5],'radii override the uniform radius');assert.deepEqual(cornerRadii({}),[0,0,0,0]);
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:0,y:0,width:20,height:10},{op:'set_object',id:'r',radii:[0,5,0,5]}]);
 validateDocument(doc);
 const pts=geometry(doc.objects[0]).flat();const has=(x,y)=>pts.some(p=>Math.abs(p[0]-x)<1e-6&&Math.abs(p[1]-y)<1e-6);
 assert.ok(has(0,0)&&has(20,10),'the top-left and bottom-right corners stay square');
 assert.ok(!has(20,0)&&!has(0,10),'the top-right and bottom-left corners are rounded');
 applyOperations(doc,[{op:'set_object',id:'r',radius:3}]);assert.equal(doc.objects[0].radii,undefined,'setting the uniform radius clears the four radii');
 doc.objects[0].radii=[1,2,3];assert.throws(()=>validateDocument(doc),/radii must be four values/);
});

test('knife: a line across a closed shape gives two closed pieces; a line that misses, or an open path, is refused',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:0,y:0,width:20,height:20}]);
 applyOperations(doc,[{op:'knife',id:'r',a:[-5,10],b:[25,10]}]);
 validateDocument(doc);
 assert.equal(doc.objects.length,2,'the square is cut into two pieces');
 assert.ok(doc.objects.every(o=>o.kind==='path'&&o.closed&&o.points.length===4),'each piece is a closed four-point shape');
 const first=doc.objects[0].id;
 assert.throws(()=>applyOperations(doc,[{op:'knife',id:first,a:[-5,60],b:[25,60]}]),/does not cut the shape/);
 applyOperations(doc,[{op:'add_path',id:'p',x:0,y:0,points:[[0,0],[10,0],[10,10]]}]);
 assert.throws(()=>applyOperations(doc,[{op:'knife',id:'p',a:[-5,5],b:[25,5]}]),/Knife cuts a closed shape/);
});

test('redwork by colour: selected paths become redwork runs, grouped by thread so each thread sews as one block',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_path',id:'a1',x:0,y:0,points:[[-30,-20],[30,-20]],thread:'#ff0000'},{op:'add_path',id:'b1',x:0,y:0,points:[[-30,0],[30,0]],thread:'#0000ff'},{op:'add_path',id:'a2',x:0,y:0,points:[[-30,20],[30,20]],thread:'#ff0000'}]);
 applyOperations(doc,[{op:'redwork_group',ids:['a1','b1','a2']}]);
 assert.deepEqual(doc.objects.map(o=>o.id),['a1','a2','b1'],'the selected paths are grouped by thread, at the place of the first one');
 assert.ok(doc.objects.every(o=>o.stitch==='run'&&o.runStyle==='redwork'),'each path is a redwork run');
 validateDocument(doc);const plan=compile(doc);assert.deepEqual(plan.errors,[]);
 const blocks=threadPlan(plan);assert.equal(blocks.length,2,'one block per thread');assert.equal(blocks[0].thread.toLowerCase(),'#ff0000','the first thread in the selection sews first');
 assert.throws(()=>applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:0,y:0,width:10,height:10},{op:'redwork_group',ids:['r']}]),/needs paths/);
});

test('pear stones compile and validate, and differ from marquise stones',()=>{
 const make=shape=>{const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_path',id:'g',x:0,y:0,points:[[-20,0],[20,0]]},{op:'set_object',id:'g',stitch:'bling',blingShape:shape,stoneTurn:true}]);validateDocument(doc);return doc;};
 const pear=make('pear'),marquise=make('marquise');const plan=compile(pear);assert.deepEqual(plan.errors,[]);assert.ok(plan.count>40,'pear stones are sewn ('+plan.count+')');
 assert.notDeepEqual(compile(pear).stitches,compile(marquise).stitches,'the round end gives different stitches from the pointed end');
});

test('cushion stones are six millimetres across the path, turn with it, and differ from square stones',()=>{
 const sewn=(points,shape)=>{const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_path',id:'g',x:0,y:0,points},{op:'set_object',id:'g',stitch:'bling',motifSize:6,blingShape:shape,stoneTurn:true}]);validateDocument(doc);const plan=compile(doc);assert.deepEqual(plan.errors,[]);return plan;};
 const width=(b)=>b[2]-b[0],height=(b)=>b[3]-b[1];
 const flat=sewn([[-20,0],[20,0]],'cushion'),square=sewn([[-20,0],[20,0]],'square');
 assert.ok(flat.count>40,'cushion stones are sewn ('+flat.count+')');
 assert.ok(Math.abs(height(flat.bounds)-6)<0.2,'a cushion stone is 6 mm across a horizontal path ('+height(flat.bounds)+')');
 assert.notDeepEqual(flat.stitches,square.stitches,'the rounded corners give different stitches from the square');
 const tall=sewn([[0,-20],[0,20]],'cushion');
 assert.ok(Math.abs(width(tall.bounds)-6)<0.2,'a cushion turns to 6 mm across a vertical path ('+width(tall.bounds)+')');
});

test('marquise stones compile and validate, and are refused as an unknown shape only when unlisted',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_path',id:'g',x:0,y:0,points:[[-20,0],[20,0]]},{op:'set_object',id:'g',stitch:'bling',blingShape:'marquise',stoneTurn:true}]);
 validateDocument(doc);const plan=compile(doc);assert.deepEqual(plan.errors,[]);assert.ok(plan.count>40,'marquise stones are sewn ('+plan.count+')');
 applyOperations(doc,[{op:'set_object',id:'g',blingShape:'triangle'}]);assert.throws(()=>validateDocument(doc),/bling shape/);
});

test('teardrop and baguette stones compile and validate; the baguette keeps its turn setting',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_path',id:'g',x:0,y:0,points:[[-20,0],[20,0]]},{op:'set_object',id:'g',stitch:'bling',blingShape:'teardrop'}]);
 validateDocument(doc);const drop=compile(doc);assert.deepEqual(drop.errors,[]);assert.ok(drop.count>40,'teardrop stones are sewn ('+drop.count+')');
 applyOperations(doc,[{op:'set_object',id:'g',blingShape:'baguette',stoneTurn:true}]);validateDocument(doc);
 const bag=compile(doc);assert.deepEqual(bag.errors,[]);assert.ok(bag.count>40,'baguette stones are sewn ('+bag.count+')');
 assert.equal(doc.objects[0].stoneTurn,true);
});

test('oval bling stones turn with the path: narrow across it, long along it',()=>{
 const size=(b)=>({w:b[2]-b[0],h:b[3]-b[1]});
 const sewn=(points,shape)=>{const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_path',id:'g',x:0,y:0,points},{op:'set_object',id:'g',stitch:'bling',motifSize:6,blingShape:shape}]);validateDocument(doc);const plan=compile(doc);assert.deepEqual(plan.errors,[]);return plan;};
 const flatRound=sewn([[-20,0],[20,0]],'round'),flatOval=sewn([[-20,0],[20,0]],'oval');
 assert.equal(flatOval.count,flatRound.count,'oval stones sew the same number of stitches as round ones');
 assert.ok(size(flatRound.bounds).h>5.5,'round stones are 6 mm across');
 assert.ok(size(flatOval.bounds).h<4.5,'oval stones on a horizontal path are about 4 mm across it');
 const tallOval=sewn([[0,-20],[0,20]],'oval'),tallRound=sewn([[0,-20],[0,20]],'round');
 assert.ok(size(tallRound.bounds).w>5.5,'round stones are 6 mm wide on a vertical path');
 assert.ok(size(tallOval.bounds).w<4.5,'oval stones on a vertical path are about 4 mm across it, so they turn with the path');
});

test('hexagon bling stones are six-sided and as wide as round ones, and sew the same stitch count',()=>{
 const size=(b)=>({w:b[2]-b[0],h:b[3]-b[1]});
 const sewn=(points,shape)=>{const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_path',id:'g',x:0,y:0,points},{op:'set_object',id:'g',stitch:'bling',motifSize:6,blingShape:shape}]);validateDocument(doc);const plan=compile(doc);assert.deepEqual(plan.errors,[]);return {count:plan.count,bounds:plan.bounds};};
 const flatRound=sewn([[-20,0],[20,0]],'round'),flatHex=sewn([[-20,0],[20,0]],'hexagon');
 // A hexagon outline has six sides where a round stone has twelve segments, so each hexagon stone sews fewer stitches.
 assert.ok(flatHex.count>0&&flatHex.count<flatRound.count,'hexagon stones sew fewer stitches than round ones');
 // On a horizontal path the stones run along x, so their size across the path shows in h: corners point along the path, flats face across it.
 assert.ok(Math.abs(size(flatRound.bounds).h-6)<0.2,'round stones are 6 mm across the path');
 assert.ok(Math.abs(size(flatHex.bounds).h-6*Math.sqrt(3)/2)<0.2,'hexagon stones are 5.2 mm flat to flat across the path');
});

test('add_path keeps embellishment stitch types on open paths, and still turns other open paths into running stitches',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_path',id:'b',x:0,y:0,points:[[-20,0],[20,0]],stitch:'bling'},{op:'add_path',id:'m',x:0,y:0,points:[[-20,5],[20,5]],stitch:'motif'},{op:'add_path',id:'s',x:0,y:0,points:[[-20,10],[20,10]],stitch:'sequin'},{op:'add_path',id:'be',x:0,y:0,points:[[-20,15],[20,15]],stitch:'bead'},{op:'add_path',id:'f',x:0,y:0,points:[[-20,20],[20,20]],stitch:'fill'}]);
 const stitchOf=(id)=>doc.objects.find(o=>o.id===id).stitch;
 assert.deepEqual(['b','m','s','be','f'].map(stitchOf),['bling','motif','sequin','bead','run']);
 validateDocument(doc);assert.deepEqual(compile(doc).errors,[]);
});

test('star bling stones are five-pointed: they sew their own stitch count and stand about 5.8 mm across a horizontal path',()=>{
 const size=(b)=>({w:b[2]-b[0],h:b[3]-b[1]});
 const sewn=(shape)=>{const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_path',id:'g',x:0,y:0,points:[[-20,0],[20,0]]},{op:'set_object',id:'g',stitch:'bling',motifSize:6,blingShape:shape}]);validateDocument(doc);const plan=compile(doc);assert.deepEqual(plan.errors,[]);return plan;};
 const round=sewn('round'),star=sewn('star');
 assert.notEqual(star.count,round.count,'star stones sew a different number of stitches from round ones');
 // Outer points are 3 mm from the centre; the points at 72° and 288° reach 2.85 mm off the path, so the stone is about 5.8 mm across it.
 assert.ok(Math.abs(size(star.bounds).h-5.8)<0.3,'star stones are about 5.8 mm across a horizontal path ('+size(star.bounds).h+')');
});

test('square, hexagon and star stones turn with the path unless stoneTurn is false, and the stitch count does not change',()=>{
 const across=(shape,stoneTurn)=>{const doc=initialDocument();doc.objects=[];const op={op:'set_object',id:'g',stitch:'bling',motifSize:6,blingShape:shape};if(stoneTurn!==undefined)op.stoneTurn=stoneTurn;applyOperations(doc,[{op:'add_path',id:'g',x:0,y:0,points:[[0,-20],[0,20]]},op]);validateDocument(doc);const plan=compile(doc);assert.deepEqual(plan.errors,[]);return {w:plan.bounds[2]-plan.bounds[0],count:plan.count};};
 // On a vertical path a hexagon turned with the path has its flats across it (5.2 mm); fixed, its corners point across it (6 mm).
 const turned=across('hexagon'),fixed=across('hexagon',false);
 assert.ok(Math.abs(turned.w-5.2)<0.2,'a turned hexagon is 5.2 mm across a vertical path ('+turned.w+')');
 assert.ok(Math.abs(fixed.w-6)<0.2,'a fixed hexagon is 6 mm across a vertical path ('+fixed.w+')');
 assert.equal(turned.count,fixed.count,'turning a stone changes its shape, not its stitch count');
 assert.equal(across('hexagon',true).count,turned.count,'stoneTurn true is the default');
 const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_path',id:'g',x:0,y:0,points:[[-20,0],[20,0]]},{op:'set_object',id:'g',stitch:'bling',stoneTurn:'yes'}]);
 assert.throws(()=>validateDocument(doc),/stoneTurn/);
});

test('twin sequins sew two sequins side by side across the path, and only accept true or false',()=>{
 const sewn=(extra)=>{const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_path',id:'s',x:0,y:0,points:[[-20,0],[20,0]]},{op:'set_object',id:'s',stitch:'sequin',...extra}]);validateDocument(doc);const plan=compile(doc);assert.deepEqual(plan.errors,[]);return plan;};
 const single=sewn({}),twin=sewn({sequinTwin:true});
 const height=(b)=>b[3]-b[1];
 // One sequin is 3 mm across, so a single row is 3 mm tall; twins sit a sequin's width either side of the path, so they are 6 mm tall together.
 assert.ok(Math.abs(height(single.bounds)-3)<0.3,'a single sequin row is about 3 mm across ('+height(single.bounds)+')');
 assert.ok(Math.abs(height(twin.bounds)-6)<0.3,'twin sequins are about 6 mm across the path ('+height(twin.bounds)+')');
 assert.ok(twin.count>1.8*single.count&&twin.count<2.2*single.count,'twins sew about twice the stitches ('+twin.count+' vs '+single.count+')');
 const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_path',id:'s',x:0,y:0,points:[[-20,0],[20,0]]},{op:'set_object',id:'s',stitch:'sequin',sequinTwin:'yes'}]);
 assert.throws(()=>validateDocument(doc),/sequinTwin/);
});

test('heart bling stones are six millimetres across the path, turn with it, and sew their own stitch count',()=>{
 const sewn=(points,shape)=>{const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_path',id:'g',x:0,y:0,points},{op:'set_object',id:'g',stitch:'bling',motifSize:6,blingShape:shape}]);validateDocument(doc);const plan=compile(doc);assert.deepEqual(plan.errors,[]);return plan;};
 const width=(b)=>b[2]-b[0],height=(b)=>b[3]-b[1];
 const flat=sewn([[-20,0],[20,0]],'heart'),round=sewn([[-20,0],[20,0]],'round');
 assert.ok(Math.abs(height(flat.bounds)-6)<0.2,'a heart stone is 6 mm across a horizontal path ('+height(flat.bounds)+')');
 assert.notEqual(flat.count,round.count,'heart stones sew their own stitch count');
 // A heart turns with the path like an oval: on a vertical path it is 6 mm across it, where a fixed heart would be about 5.4 mm.
 const tall=sewn([[0,-20],[0,20]],'heart');
 assert.ok(Math.abs(width(tall.bounds)-6)<0.2,'a heart turns to 6 mm across a vertical path ('+width(tall.bounds)+')');
});

test('bling stones sew one or two fixing rings; one ring keeps the stone size and halves the stitches, and only 1 or 2 are accepted',()=>{
 const sewn=(rings)=>{const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_path',id:'g',x:0,y:0,points:[[-20,0],[20,0]]},{op:'set_object',id:'g',stitch:'bling',motifSize:6,blingShape:'square',blingRings:rings}]);validateDocument(doc);const plan=compile(doc);assert.deepEqual(plan.errors,[]);return plan;};
 const two=sewn(2),one=sewn(1);
 // The outer ring is the same in both, so the stones keep their size; the inner fixing ring is what goes.
 assert.deepEqual(one.bounds.map(v=>Math.round(v*100)),two.bounds.map(v=>Math.round(v*100)),'one ring keeps the stone size');
 assert.equal(one.count*2,two.count,'one fixing ring sews half the stitches of two');
 const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_path',id:'g',x:0,y:0,points:[[-20,0],[20,0]]},{op:'set_object',id:'g',stitch:'bling',blingRings:3}]);
 assert.throws(()=>validateDocument(doc),/blingRings/);
});

test('dot beads are small round beads the size of the bead length; dash beads stay one pass across the path',()=>{
 const sewn=(extra)=>{const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_path',id:'b',x:0,y:0,points:[[-20,0],[20,0]]},{op:'set_object',id:'b',stitch:'bead',motifSize:2,...extra}]);validateDocument(doc);const plan=compile(doc);assert.deepEqual(plan.errors,[]);return plan;};
 const dash=sewn({}),dot=sewn({beadShape:'dot'});
 const height=(b)=>b[3]-b[1];
 // A dot is a 13-point ring 2 mm across, so the path is 2 mm tall; a dash is a line across the path, which has no height.
 assert.ok(Math.abs(height(dot.bounds)-2)<0.2,'dot beads are 2 mm across ('+height(dot.bounds)+')');
 assert.ok(height(dash.bounds)<0.2,'dash beads lie across the path, so the path has no height');
 assert.ok(dot.count>dash.count,'a dot ring sews more stitches than a dash ('+dot.count+' vs '+dash.count+')');
 const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_path',id:'b',x:0,y:0,points:[[-20,0],[20,0]]},{op:'set_object',id:'b',stitch:'bead',beadShape:'star'}]);
 assert.throws(()=>validateDocument(doc),/bead shape/);
});

test('twin beads sit one either side of the centre line, side by side across the path, and only accept true or false',()=>{
 const sewn=(extra)=>{const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_path',id:'b',x:0,y:0,points:[[-20,0],[20,0]]},{op:'set_object',id:'b',stitch:'bead',motifSize:2,...extra}]);validateDocument(doc);const plan=compile(doc);assert.deepEqual(plan.errors,[]);return plan;};
 const height=(b)=>b[3]-b[1];
 const single=sewn({beadShape:'dot'}),twin=sewn({beadShape:'dot',beadTwin:true});
 // Two 2 mm dots, centres a bead length apart across the path, span 4 mm; a single dot is 2 mm.
 assert.ok(Math.abs(height(single.bounds)-2)<0.2,'a single dot is 2 mm across ('+height(single.bounds)+')');
 assert.ok(Math.abs(height(twin.bounds)-4)<0.2,'twin dots span 4 mm across the path ('+height(twin.bounds)+')');
 assert.ok(twin.count>1.9*single.count&&twin.count<2.3*single.count,'twins sew about twice the stitches ('+twin.count+' vs '+single.count+')');
 const dash=sewn({beadTwin:true});
 assert.ok(Math.abs(height(dash.bounds)-2)<0.2,'twin dashes lie side by side across the path, 2 mm across');
 const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_path',id:'b',x:0,y:0,points:[[-20,0],[20,0]]},{op:'set_object',id:'b',stitch:'bead',beadTwin:'yes'}]);
 assert.throws(()=>validateDocument(doc),/beadTwin/);
});

test('satin pull can be set on each side: the right rail moves out by pullRight and the left by pullLeft, and an unset side uses the pull compensation',()=>{
 // Walking along a path east, the right-hand rail is the one at +y on screen (y is down): a satin column 4 mm wide spans -2..2 across it.
 const span=(extra)=>{const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_path',id:'s',x:0,y:0,points:[[-30,0],[30,0]],stitch:'satin',satinWidth:4},{op:'set_object',id:'s',compensation:0,...extra}]);validateDocument(doc);const plan=compile(doc);assert.deepEqual(plan.errors,[]);return {minY:plan.bounds[1],maxY:plan.bounds[3]};};
 const none=span({}),right=span({pullRight:1.5}),left=span({pullLeft:1.5}),both=span({pullRight:1,pullLeft:0.5});
 const near=(a,b)=>Math.abs(a-b)<0.15;
 assert.ok(near(none.maxY,2)&&near(none.minY,-2),'an unpulled 4 mm satin spans -2 to 2 ('+none.minY+', '+none.maxY+')');
 assert.ok(near(right.maxY,3.5)&&near(right.minY,-2),'pullRight moves only the right rail, out by 1.5 mm ('+right.minY+', '+right.maxY+')');
 assert.ok(near(left.minY,-3.5)&&near(left.maxY,2),'pullLeft moves only the left rail, out by 1.5 mm ('+left.minY+', '+left.maxY+')');
 assert.ok(near(both.maxY,3)&&near(both.minY,-2.5),'each side takes its own pull ('+both.minY+', '+both.maxY+')');
 const comp=(()=>{const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_path',id:'s',x:0,y:0,points:[[-30,0],[30,0]],stitch:'satin',satinWidth:4},{op:'set_object',id:'s',compensation:0.5}]);validateDocument(doc);const b=compile(doc).bounds;return {minY:b[1],maxY:b[3]};})();
 assert.ok(near(comp.maxY,2.5)&&near(comp.minY,-2.5),'an unset side uses the object pull compensation on both sides');
 const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_path',id:'s',x:0,y:0,points:[[-30,0],[30,0]],stitch:'satin',satinWidth:4},{op:'set_object',id:'s',pullRight:3}]);
 assert.throws(()=>validateDocument(doc),/pull/);
});

test('laydown underlay sews a light fill at wide rows under a fill, stays inside the shape, and is for fills only',()=>{
 const sewn=(u)=>{const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:-20,y:-15,width:40,height:30,stitch:'fill'},{op:'set_object',id:'r',underlayType:u}]);validateDocument(doc);const plan=compile(doc);assert.deepEqual(plan.errors,[]);return plan;};
 const none=sewn('none'),laydown=sewn('laydown');
 assert.ok(laydown.count>none.count,'laydown adds stitches under the fill ('+laydown.count+' vs '+none.count+')');
 // The laydown is inset from the outline like the other underlays, so nothing sews outside the 40 x 30 mm rectangle.
 assert.ok(laydown.bounds[0]>=-20.5&&laydown.bounds[2]<=20.5&&laydown.bounds[1]>=-15.5&&laydown.bounds[3]<=15.5,'laydown stays inside the shape ('+laydown.bounds.join(' ')+')');
 const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_path',id:'s',x:0,y:0,points:[[-20,0],[20,0]],stitch:'satin',satinWidth:4},{op:'set_object',id:'s',underlayType:'laydown'}]);
 assert.throws(()=>validateDocument(doc),/laydown underlay/);
});

test('print template is a 1:1 millimetre sheet the size of the hoop, with the design outline inside it and a 10 mm scale bar',()=>{
 const doc=initialDocument();doc.objects=[];doc.hoop=100;doc.hoopH=80;
 applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:-10,y:-5,width:20,height:10}]);
 const svg=exportPrintTemplate(doc);
 assert.match(svg,/width="100mm" height="80mm" viewBox="-50 -40 100 80"/,'the sheet is the hoop in millimetres, centred on the origin');
 // Design outlines are the green paths; every point must sit inside the hoop (|x| <= 50, |y| <= 40).
 const design=[...svg.matchAll(/<path d="([^"]+)" fill="none" stroke="#2f5d4a"/g)].map(m=>m[1]);
 assert.equal(design.length,1,'one design outline for the one shape');
 const nums=design[0].match(/-?\d+(\.\d+)?/g).map(Number);
 for(let i=0;i<nums.length;i+=2)assert.ok(Math.abs(nums[i])<=50&&Math.abs(nums[i+1])<=40,'design point '+nums[i]+','+nums[i+1]+' is inside the hoop');
 assert.match(svg,/M-45 35H-35/,'the 10 mm scale bar sits at the bottom left, 10 mm long');
 assert.match(svg,/>10 mm</,'the scale bar is labelled');
});

test('fabric presets set the document stitch settings, explicit settings still win, and unknown fabrics are rejected',()=>{
 const settingsFor=(ops)=>{const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:-20,y:-15,width:40,height:30,stitch:'fill'},{op:'set_settings',...ops}]);validateDocument(doc);return {doc,plan:compile(doc)};};
 const knit=settingsFor({fabric:'knit'}),towel=settingsFor({fabric:'towel'});
 assert.equal(knit.doc.settings.compensation,0.5,'knit pulls in 0.5 mm of compensation');
 assert.equal(knit.doc.settings.fabric,'knit');
 assert.equal(towel.doc.settings.stitchLength,2.5,'towel uses a 2.5 mm stitch length');
 assert.equal(towel.doc.settings.stagger,8,'towel uses the widest needle stagger the select offers (8 phases)');
 assert.deepEqual(towel.plan.errors,[]);
 assert.notEqual(towel.plan.count,settingsFor({fabric:'woven'}).plan.count,'the towel preset sews a different stitch plan from woven');
 const over=settingsFor({fabric:'towel',compensation:0});
 assert.equal(over.doc.settings.compensation,0,'an explicit compensation after a fabric preset wins');
 const doc=initialDocument();doc.objects=[];
 assert.throws(()=>applyOperations(doc,[{op:'set_settings',fabric:'silk'}]),/Unknown fabric/);
});

test('redwork outline runs around a closed shape out and back, and refuses open paths',()=>{
 const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:-20,y:-15,width:40,height:30,stitch:'fill'},{op:'redwork_outline',id:'r',newId:'rw'}]);validateDocument(doc);
 const o=doc.objects.find(x=>x.id==='rw');
 assert.equal(o.kind,'path');assert.equal(o.stitch,'run');assert.equal(o.runStyle,'redwork');
 assert.deepEqual(o.points[0],o.points.at(-1),'the redwork run closes on its start point');
 doc.objects=[o];const plan=compile(doc);assert.deepEqual(plan.errors,[]);
 // Out and back: the outline is sewn once there and once back, so about twice a plain run around the same points.
 const plainDoc=initialDocument();plainDoc.objects=[];applyOperations(plainDoc,[{op:'add_path',id:'p',x:0,y:0,points:o.points,stitch:'run'}]);validateDocument(plainDoc);const plain=compile(plainDoc);
 assert.ok(plan.count>1.8*plain.count&&plan.count<2.2*plain.count,'redwork sews about twice a plain outline ('+plan.count+' vs '+plain.count+')');
 const open=initialDocument();open.objects=[];applyOperations(open,[{op:'add_path',id:'l',x:0,y:0,points:[[-20,0],[20,0]],stitch:'run'}]);
 assert.throws(()=>applyOperations(open,[{op:'redwork_outline',id:'l'}]),/closed shape/);
});

test('satin end inset moves the first and last needle inward along the column, leaves the stitch count alone, and is limited to 0-2 mm',()=>{
 const ends=(extra)=>{const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_path',id:'s',x:0,y:0,points:[[-30,0],[30,0]],stitch:'satin',satinWidth:4},{op:'set_object',id:'s',compensation:0,underlayType:'none',...extra}]);validateDocument(doc);const plan=compile(doc);assert.deepEqual(plan.errors,[]);const xs=plan.stitches.filter(s=>s.cmd==='stitch').map(s=>s.x);return {first:xs[0],last:xs.at(-1),count:plan.count};};
 const none=ends({}),inset=ends({endInset:1});
 // Each end's needle moves 1 mm towards the middle of the column; the stitch count is unchanged.
 assert.ok(Math.abs((inset.first-none.first)-1)<0.2,'the start needle moves 1 mm inward ('+none.first+' -> '+inset.first+')');
 assert.ok(Math.abs((none.last-inset.last)-1)<0.2,'the end needle moves 1 mm inward ('+none.last+' -> '+inset.last+')');
 assert.equal(inset.count,none.count,'an end inset does not change the stitch count');
 const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_path',id:'s',x:0,y:0,points:[[-30,0],[30,0]],stitch:'satin',satinWidth:4},{op:'set_object',id:'s',endInset:3}]);
 assert.throws(()=>validateDocument(doc),/end inset/);
});

test('sequin fill lays sequins on a staggered grid inside a closed shape, far fewer stitches than tatami',()=>{
 const sewn=(fm)=>{const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:-20,y:-15,width:40,height:30,stitch:'fill'},{op:'set_object',id:'r',fillMethod:fm,underlayType:'none'}]);validateDocument(doc);const plan=compile(doc);assert.deepEqual(plan.errors,[]);return plan;};
 const sequin=sewn('sequin'),rows=sewn('rows');
 // Each sequin is a centre stitch and a 3 mm fixing ring whose centre lies inside the 40 x 30 mm shape, so the sewn area stays within about a sequin's radius of it.
 assert.ok(sequin.bounds[0]>=-22&&sequin.bounds[2]<=22&&sequin.bounds[1]>=-16.5&&sequin.bounds[3]<=16.5,'sequins stay within a sequin of the shape ('+sequin.bounds.join(' ')+')');
 assert.ok(sequin.count>150&&sequin.count<rows.count/2,'a sequin fill sews a few sequins, far fewer stitches than tatami ('+sequin.count+' vs '+rows.count+')');
});

test('hoop presets are the default and the Brother 4x4, 5x7 and 6x10 hoops, each set as the document hoop',()=>{
 assert.deepEqual(HOOP_PRESETS.map(p=>[p.w,p.h]),[[110,110],[100,100],[180,130],[260,160]]);
 for(const p of HOOP_PRESETS){const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'set_hoop',width:p.w,height:p.h}]);validateDocument(doc);assert.deepEqual(hoopSize(doc),{w:p.w,h:p.h},p.key+' is stored as the hoop');}
 const doc=initialDocument();doc.objects=[];
 assert.throws(()=>applyOperations(doc,[{op:'set_hoop',width:500,height:160}]),/Hoop width and height/);
});

test('raised fill adds a second tatami underlay inside the shape, and a raised fill takes a true or false value',()=>{
 const sewn=(extra)=>{const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:-20,y:-15,width:40,height:30,stitch:'fill'},{op:'set_object',id:'r',underlayType:'none',...extra}]);validateDocument(doc);const plan=compile(doc);assert.deepEqual(plan.errors,[]);return plan;};
 const flat=sewn({}),raised=sewn({raised:true});
 assert.ok(raised.count>flat.count*1.1,'a raised fill sews extra underlay stitches ('+raised.count+' vs '+flat.count+')');
 assert.ok(raised.bounds[0]>=-20.5&&raised.bounds[2]<=20.5&&raised.bounds[1]>=-15.5&&raised.bounds[3]<=15.5,'the raised underlay stays inside the shape ('+raised.bounds.join(' ')+')');
 const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:-20,y:-15,width:40,height:30,stitch:'fill'},{op:'set_object',id:'r',raised:'yes'}]);
 assert.throws(()=>validateDocument(doc),/raised/);
});

test('accordion spacing makes the rows dense at the start of the fill and open at the end, and needs both values',()=>{
 const rowsOf=(extra)=>{const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:-20,y:-15,width:40,height:30,stitch:'fill'},{op:'set_object',id:'r',angle:0,underlayType:'none',...extra}]);validateDocument(doc);const plan=compile(doc);assert.deepEqual(plan.errors,[]);const ys=[...new Set(plan.stitches.filter(s=>s.cmd==='stitch').map(s=>Math.round(s.y*10)/10))];return {above:ys.filter(y=>y<0).length,below:ys.filter(y=>y>0).length,total:ys.length};};
 const uniform=rowsOf({spacing:0.4}),accordion=rowsOf({accordionStart:0.4,accordionEnd:1.2});
 assert.ok(Math.abs(uniform.above-uniform.below)<=2,'a uniform fill has about the same rows on each side ('+uniform.above+' above, '+uniform.below+' below)');
 assert.ok(accordion.above>accordion.below*1.5,'accordion rows are dense at the start (top) and open at the end ('+accordion.above+' above, '+accordion.below+' below)');
 assert.ok(accordion.total<uniform.total*0.75,'an accordion fill sews fewer rows than a uniform one at the start spacing ('+accordion.total+' vs '+uniform.total+')');
 const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:-20,y:-15,width:40,height:30,stitch:'fill'},{op:'set_object',id:'r',accordionStart:0.4}]);
 assert.throws(()=>validateDocument(doc),/accordion/);
});

test('raised spacing sets the rows of the raised underlay, 1 to 4 mm',()=>{
 const sewn=(extra)=>{const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:-20,y:-15,width:40,height:30,stitch:'fill'},{op:'set_object',id:'r',underlayType:'none',raised:true,...extra}]);validateDocument(doc);const plan=compile(doc);assert.deepEqual(plan.errors,[]);return plan;};
const plain=sewn({raised:false}),two=sewn({}),four=sewn({raisedSpacing:4});
 // Compare only the raised layer's own stitches (the total minus a plain fill): 4 mm rows give about half as many as 2 mm rows.
 assert.ok(four.count-plain.count<(two.count-plain.count)*0.7,'a 4 mm raised spacing sews far fewer raised stitches than the 2 mm default ('+(four.count-plain.count)+' vs '+(two.count-plain.count)+')');
 const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:-20,y:-15,width:40,height:30,stitch:'fill'},{op:'set_object',id:'r',raisedSpacing:5}]);
 assert.throws(()=>validateDocument(doc),/raised spacing/);
});

test('bling fill lays stones on a staggered grid inside a closed shape; round stones with two fixing rings sew more than sequins, and the stones stay near the shape',()=>{
 const sewn=(fm,extra={})=>{const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:-20,y:-15,width:40,height:30,stitch:'fill'},{op:'set_object',id:'r',fillMethod:fm,underlayType:'none',motifSize:3,...extra}]);validateDocument(doc);const plan=compile(doc);assert.deepEqual(plan.errors,[]);return plan;};
 const sequin=sewn('sequin'),square=sewn('bling',{blingShape:'square'}),round=sewn('bling');
 // Each round stone is a centre stitch with two fixing rings, against a sequin's centre and one ring, so the round bling fill sews more.
 assert.ok(round.count>sequin.count,'round bling stones sew more than sequins at the same size ('+round.count+' vs '+sequin.count+')');
 // Stones are centred on the grid inside the 40 x 30 mm shape; their outlines reach at most a stone's radius past it.
 for(const plan of [square,round])assert.ok(plan.bounds[0]>=-22&&plan.bounds[2]<=22&&plan.bounds[1]>=-16&&plan.bounds[3]<=16,'stones stay within a stone of the shape ('+plan.bounds.join(' ')+')');
 const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:-20,y:-15,width:40,height:30,stitch:'fill'},{op:'set_object',id:'r',fillMethod:'bling',blingShape:'triangle'}]);
 assert.throws(()=>validateDocument(doc),/bling shape/);
});

test('name drop batch gives each copy the next name in its first lettering, and needs lettering',()=>{
 const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_text',id:'t',text:'Old',x:0,y:0,height:8}]);validateDocument(doc);
 const docs=batchDocuments(doc,{names:['Ana','Ben','Carla']});
 const texts=docs.flatMap(d=>d.objects.filter(o=>o.kind==='text').map(o=>o.text));
 assert.deepEqual(texts,['Ana','Ben','Carla'],'each of the three copies carries its name, in order');
 for(const d of docs)assert.deepEqual(compile(d).errors,[]);
 const plain=initialDocument();plain.objects=[];applyOperations(plain,[{op:'add_shape',id:'r',kind:'rect',x:0,y:0,width:10,height:10}]);validateDocument(plain);
 assert.throws(()=>batchDocuments(plain,{names:['Ana']}),/lettering/);
});

test('satin end inset can differ at each end: a start value moves only the first needle, an end value only the last, and an explicit end value overrides the single value',()=>{
 const ends=(extra)=>{const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_path',id:'s',x:0,y:0,points:[[-30,0],[30,0]],stitch:'satin',satinWidth:4},{op:'set_object',id:'s',compensation:0,underlayType:'none',...extra}]);validateDocument(doc);const plan=compile(doc);assert.deepEqual(plan.errors,[]);const xs=plan.stitches.filter(s=>s.cmd==='stitch').map(s=>s.x);return {first:xs[0],last:xs.at(-1),count:plan.count};};
 const base=ends({}),startOnly=ends({endInsetStart:1}),endOnly=ends({endInsetEnd:1}),both=ends({endInsetStart:1,endInsetEnd:1}),single=ends({endInset:1}),override=ends({endInset:1,endInsetEnd:0});
 const near=(a,b)=>Math.abs(a-b)<0.15;
 assert.ok(near(startOnly.first-base.first,1)&&near(startOnly.last,base.last),'a start inset moves only the first needle ('+startOnly.first+', '+startOnly.last+')');
 assert.ok(near(endOnly.first,base.first)&&near(base.last-endOnly.last,1),'an end inset moves only the last needle ('+endOnly.first+', '+endOnly.last+')');
 assert.deepEqual([both.first,both.last],[single.first,single.last],'both per-end values match the single value on both ends');
 assert.ok(near(override.first-base.first,1)&&near(override.last,base.last),'an explicit end value of 0 overrides the single value at the end only');
 assert.equal(startOnly.count,base.count,'a per-end inset does not change the stitch count');
 const doc=initialDocument();doc.objects=[];applyOperations(doc,[{op:'add_path',id:'s',x:0,y:0,points:[[-30,0],[30,0]],stitch:'satin',satinWidth:4},{op:'set_object',id:'s',endInsetStart:3}]);
 assert.throws(()=>validateDocument(doc),/start inset/);
});

test('organize fonts lists custom fonts with the lettering that uses them, and remove unused drops only the fonts no lettering uses',()=>{
 const font=(name)=>({name,glyphs:{},unitsPerEm:1000,baseline:0,size:10});
 const doc=initialDocument();doc.objects=[];doc.customFonts={kept:font('Kept'),spare:font('Spare')};
 applyOperations(doc,[{op:'add_text',id:'t',text:'A',x:0,y:0,height:8,font:'custom/kept'}]);
 validateDocument(doc);
 assert.deepEqual(customFontUsage(doc).map(f=>[f.id,f.uses.length]),[['kept',1],['spare',0]]);
 applyOperations(doc,[{op:'remove_unused_fonts'}]);
 assert.deepEqual(Object.keys(doc.customFonts),['kept'],'the used font is kept and the unused one is removed');
 validateDocument(doc);
 applyOperations(doc,[{op:'remove_unused_fonts'}]);
 assert.deepEqual(Object.keys(doc.customFonts),['kept'],'running it again changes nothing');
});

test('a document can hold up to 16 custom fonts, and a 17th is refused',()=>{
 const font=(i)=>({name:'F'+i,glyphs:{},unitsPerEm:1000,baseline:0,size:10});
 const fonts=(n)=>Object.fromEntries(Array.from({length:n},(_,i)=>['f'+i,font(i)]));
 const ok=initialDocument();ok.objects=[];ok.customFonts=fonts(16);validateDocument(ok);
 const tooMany=initialDocument();tooMany.objects=[];tooMany.customFonts=fonts(17);
 assert.throws(()=>validateDocument(tooMany),/at most 16 fonts/);
});

test('vertical lettering stacks one letter under another, centred on its x position, and refuses multi-line, path and legacy-font use',()=>{
 const extent=(b)=>({w:b[2]-b[0],h:b[3]-b[1]});
 const stitched=(extra)=>{const d=textDoc('ttf/lato',{text:'ABC',height:10,...extra});validateDocument(d);const p=compile(d);assert.deepEqual(p.errors,[]);return p;};
 const across=stitched({}),down=stitched({vertical:true});
 assert.ok(extent(down.bounds).h>extent(across.bounds).h*1.5,'a vertical word is much taller than the same word across ('+extent(down.bounds).h+' vs '+extent(across.bounds).h+')');
 assert.ok(extent(down.bounds).w<extent(across.bounds).w/2,'and much narrower (one letter wide)');
 // textDoc places its lettering at x = -40, so the column's middle should be there.
 assert.ok(Math.abs((down.bounds[0]+down.bounds[2])/2+40)<1,'the column is centred on the lettering x position (its middle is at x = -40, the lettering position)');
 assert.throws(()=>{const d=textDoc('ttf/lato',{text:'A\nB',vertical:true});validateDocument(d);},/one line/);
 assert.throws(()=>{const d=textDoc('ttf/lato',{text:'AB'});applyOperations(d,[{op:'add_path',id:'p',x:0,y:0,points:[[-20,0],[20,0]]},{op:'text_on_path',textId:'t',pathId:'p'}]);d.objects.find(o=>o.id==='t').vertical=true;validateDocument(d);},/cannot follow a path/);
 assert.throws(()=>{const d=textDoc('welcome-mono/1',{text:'AB',vertical:true});validateDocument(d);},/bundled or loaded font/);
});

test('batch plan counts copies per hoop and hoops needed',async()=>{
 const {batchPlan}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:-10,y:-5,width:20,height:10,thread:'#527461',stitch:'fill'}]);
 const p=batchPlan(doc,{copies:100});
 assert.deepEqual(p.design,[20,10]);assert.equal(p.perHoop,p.cols*p.rows);assert.equal(p.hoopsNeeded,Math.ceil(100/p.perHoop));
 assert.ok(p.perHoop>=20,'a 20 × 10 mm design packs many copies into 110 mm');
});

test('batch documents lay copies out per hoop and every hoop compiles',async()=>{
 const {batchDocuments}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:-10,y:-5,width:20,height:10,thread:'#527461',stitch:'fill'}]);
 const docs=batchDocuments(doc,{copies:40});
 assert.equal(docs.length,2);assert.equal(docs[0].objects.length+docs[1].objects.length,40);
 for(const d of docs){const plan=compile(d);assert.deepEqual(plan.errors,[]);}
});

test('batch documents encode to JEF, VP3 and DST, one file per hoop',async()=>{
 const {batchDocuments}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:-10,y:-5,width:20,height:10,thread:'#527461',stitch:'fill'}]);
 const docs=batchDocuments(doc,{copies:40});
 for(const format of ['jef','vp3','dst']){
  for(const d of docs){const bytes=encode(compile(d),format,'#527461',110,d);assert.ok(bytes.length>100,format+' file has content');}
 }
});

test('batch documents encode to SEW and every hoop decodes back to its planned needles',async()=>{
 const {batchDocuments}=await import('../src/engine.js');const {decodeEmbroidery}=await import('../src/readers.js');
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:-10,y:-5,width:20,height:10,thread:'#527461',stitch:'fill'}]);
 const docs=batchDocuments(doc,{copies:40});assert.ok(docs.length>1,'the copies span more than one hoop');
 const tenths=s=>[Math.round(s.x*10),Math.round(s.y*10)];
 for(const d of docs){
  const plan=compile(d),back=decodeEmbroidery(encode(plan,'sew','#527461',110,d),'sew');
  const [x0,y0,x1,y1]=back.bounds;assert.ok(x0>=-55&&y0>=-55&&x1<=55&&y1<=55,'every SEW hoop stays inside the 110 mm hoop');
  // A zero-length step leaves no SEW record, so a repeated planned point is written once, and a stitch that starts where a jump ends is that jump's record.
  const want=plan.stitches.filter(s=>s.cmd==='stitch').map(tenths).filter((p,i,all)=>i===0||p[0]!==all[i-1][0]||p[1]!==all[i-1][1]),got=back.stitches.filter(s=>s.cmd==='stitch'||s.cmd==='jump').map(tenths);let next=0;
  for(const p of got)if(next<want.length&&want[next][0]===p[0]&&want[next][1]===p[1])next++;
  assert.equal(next,want.length,'every planned needle point is written, in order');
 }
});

test('EXP export decodes back to the planned stitch path',async()=>{
 const {encodeExp}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:-8,y:-6,width:16,height:12,thread:'#527461',stitch:'run'}]);
 const plan=compile(doc);const bytes=encodeExp(plan);
 let x=0,y=0,i=0;const decoded=[];
 while(i+1<bytes.length){if(bytes[i]!==0x80){const dx=(bytes[i]<<24)>>24,dy=-((bytes[i+1]<<24)>>24);x+=dx;y+=dy;decoded.push([x,y,'s']);i+=2;continue;}const control=bytes[i+1];const dx=(bytes[i+2]<<24)>>24,dy=-((bytes[i+3]<<24)>>24);i+=4;if(control===0x80)continue;if(control===0x01)continue;if(control===0x04){x+=dx;y+=dy;continue;}}
 const planned=plan.stitches.filter(s=>s.cmd==='stitch').map(s=>[Math.round(s.x*10),Math.round(s.y*10)]);
 assert.ok(decoded.length>0&&planned.length>0);
 const last=decoded.at(-1);const lastPlanned=plan.stitches.filter(s=>s.cmd!=='end').at(-1);
 assert.ok(Math.abs(last[0]-Math.round(lastPlanned.x*10))<=1&&Math.abs(last[1]-Math.round(lastPlanned.y*10))<=1,'the last decoded needle matches the last planned needle');
});

test('PEC export starts with the PEC signature and a 512-byte header before the stitch block',async()=>{
 const {encodePec}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:-8,y:-6,width:16,height:12,thread:'#527461',stitch:'run'}]);
 const bytes=encodePec(compile(doc),'Badge');
 assert.equal(String.fromCharCode(...bytes.slice(0,8)),'#PEC0001');
 assert.equal(String.fromCharCode(...bytes.slice(8,11)),'LA:');
 assert.equal(bytes[520],0x00);assert.equal(bytes[521],0x00);assert.equal(bytes[525],0x31);
});

test('PES export has the PES signature, sew segment sections and the PEC block it points to',async()=>{
 const {encodePes}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:-8,y:-6,width:16,height:12,thread:'#527461',stitch:'run'}]);
 const bytes=encodePes(compile(doc),'Badge');
 const text=String.fromCharCode(...bytes.slice(0,bytes.length));
 assert.equal(String.fromCharCode(...bytes.slice(0,8)),'#PES0001');
 assert.ok(text.includes('CEmbOne')&&text.includes('CSewSeg'));
 const pec=bytes[8]|(bytes[9]<<8)|(bytes[10]<<16)|(bytes[11]<<24);
 assert.equal(String.fromCharCode(...bytes.slice(pec,pec+3)),'LA:');
});

test('paired motif loops follow a tapered satin width',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_path',id:'p',x:0,y:0,points:[[-20,0],[20,0]],satinWidth:2},{op:'set_object',id:'p',stitch:'motif',motifPair:true}]);
 const flat=compile(doc).bounds;
 applyOperations(doc,[{op:'set_object',id:'p',widthStops:[[0,2],[1,8]]}]);
 validateDocument(doc);
 const taper=compile(doc).bounds;
 assert.ok(taper[3]>flat[3]+2,'the wide end pushes the loops further out ('+taper[3]+' vs '+flat[3]+')');
});

test('PES v6 export has its own signature, a thread table and the PEC block it points to',async()=>{
 const {encodePesV6}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:-8,y:-6,width:16,height:12,thread:'#527461',stitch:'run'}]);
 const bytes=encodePesV6(compile(doc),'Badge');
 assert.equal(String.fromCharCode(...bytes.slice(0,8)),'#PES0060');
 const text=String.fromCharCode(...bytes);assert.ok(text.includes('CEmbOne')&&text.includes('CSewSeg'));
 const pec=bytes[8]|(bytes[9]<<8)|(bytes[10]<<16)|(bytes[11]<<24);
 assert.equal(String.fromCharCode(...bytes.slice(pec,pec+3)),'LA:');
});

test('SEW export has a colour header, zero padding to 0x1D78 and decodes back to the planned path',async()=>{
 const {encodeSew}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_shape',id:'a',kind:'rect',x:-30,y:-20,width:24,height:14,thread:'#527461',stitch:'fill'},{op:'add_path',id:'b',x:0,y:0,points:[[-30,10],[0,10],[30,10]],thread:'#d9897e',stitch:'run'}]);
 const plan=compile(doc),bytes=encodeSew(plan);
 const count=bytes[0]|(bytes[1]<<8),indices=[...Array(count)].map((_,k)=>bytes[2+2*k]|(bytes[3+2*k]<<8));
 assert.equal(count,2,'one colour change gives two colour blocks');
 assert.notEqual(indices[0],indices[1]);assert.ok(indices.every(i=>i>=0&&i<79),'indices point into the 79-entry Janome thread set');
 assert.ok(bytes.length>0x1D78);assert.ok(bytes.slice(2+2*count,0x1D78).every(b=>b===0),'header padding is zero');
 assert.deepEqual([...bytes.slice(-4)],[0x80,0,0,0],'the stream ends with the end record');
 let x=0,y=0,i=0x1D78,colours=0;const decoded=[];
 while(i+1<bytes.length){if(bytes[i]!==0x80){x+=(bytes[i]<<24)>>24;y-=(bytes[i+1]<<24)>>24;decoded.push([x,y]);i+=2;continue;}const control=bytes[i+1];const dx=(bytes[i+2]<<24)>>24,dy=(bytes[i+3]<<24)>>24;i+=4;if(control&1){colours++;continue;}if(control===0x04){x+=dx;y-=dy;decoded.push([x,y]);continue;}break;}
 assert.equal(colours,count-1,'colour change records match the header');
 const planned=plan.stitches.filter(s=>['stitch','jump','color'].includes(s.cmd)).map(s=>[Math.round(s.x*10),Math.round(s.y*10)]).filter((p,k,a)=>k===0||p[0]!==a[k-1][0]||p[1]!==a[k-1][1]);
 let next=0;for(const [px,py] of decoded)if(next<planned.length&&planned[next][0]===px&&planned[next][1]===py)next++;
 assert.equal(next,planned.length,'every planned point appears in order (long moves may add intermediate jump records)');
});

test('leaf motif loops are elongated along the path, circles are round',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_path',id:'m',x:0,y:0,points:[[-20,0],[20,0]]},{op:'set_object',id:'m',stitch:'motif',motifSize:4}]);
 const circle=compile(doc).bounds;
 applyOperations(doc,[{op:'set_object',id:'m',motifShape:'leaf'}]);
 validateDocument(doc);
 const leaf=compile(doc).bounds;
 assert.ok(leaf[3]-leaf[1]<circle[3]-circle[1]-.5,'a leaf is narrower across the path than a circle');
 applyOperations(doc,[{op:'set_object',id:'m',motifShape:'star'}]);
 assert.throws(()=>validateDocument(doc),/motif shape/);
});

test('edge closing adds a back-stitch at each cut end of a clipped run, and is off by default',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_shape',id:'mask',kind:'rect',x:-10,y:-10,width:20,height:20,thread:'#527461',stitch:'fill'},{op:'add_path',id:'r',x:0,y:0,points:[[-30,0],[30,0]],stitch:'run'}]);
 applyOperations(doc,[{op:'clip',ids:['r'],maskId:'mask'}]);
 const open=compile(doc).count;
 applyOperations(doc,[{op:'set_object',id:'r',edgeClose:true}]);
 validateDocument(doc);
 assert.ok(compile(doc).count>open,'closing adds stitches at the two cut ends');
 applyOperations(doc,[{op:'set_object',id:'r',edgeClose:'yes'}]);
 assert.throws(()=>validateDocument(doc),/edgeClose/);
});

test('edge closing also applies to clipped satin columns',()=>{
 const doc=initialDocument();doc.objects=[];
 applyOperations(doc,[{op:'add_shape',id:'mask',kind:'rect',x:-10,y:-10,width:20,height:20,thread:'#527461',stitch:'fill'},{op:'add_path',id:'s',x:0,y:0,points:[[-30,0],[30,0]],stitch:'satin',satinWidth:3}]);
 applyOperations(doc,[{op:'clip',ids:['s'],maskId:'mask'}]);
 const open=compile(doc).count;
 applyOperations(doc,[{op:'set_object',id:'s',edgeClose:true}]);
 validateDocument(doc);
 assert.ok(compile(doc).count>open,'closing adds stitches to a clipped satin column');
});

test('the browser benchmark fixture (100 filled squares) compiles to the pinned stitch counts',()=>{
 // Same fixture as scripts/bench-compile.mjs and scripts/bench-browser.mjs; the counts are the Node baseline.
 const squares=size=>{const doc=initialDocument();doc.objects=[];doc.hoop=400;const cols=10,step=size+4,ops=[];for(let i=0;i<100;i++){const c=i%cols,r=Math.floor(i/cols);ops.push({op:'add_shape',id:`s${i}`,kind:'rect',x:-(cols*step)/2+c*step,y:-(cols*step)/2+r*step,width:size,height:size,thread:'#527461',stitch:'fill'});}applyOperations(doc,ops);return doc;};
 assert.equal(compile(squares(12)).count,26463);
 assert.equal(compile(squares(34)).count,145700);
});

test('U01 export: a 256-byte header, 3-byte records, a colour change is a needle record, a trim is a trim record, a long move splits, and the file ends F8 00 00',()=>{
 const d=blank();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:-30,y:-20,width:24,height:14,thread:'#527461',stitch:'fill'},{op:'add_shape',id:'c',kind:'ellipse',x:30,y:-20,width:18,height:12,thread:'#2471a3',stitch:'fill'}]);
 const plan=compile(d),bytes=encode(plan,'u01','#527461',110,d);
 assert.ok(bytes.slice(0,128).every(b=>b===0x30),'the first 128 bytes are ASCII 0');
 const n=(bytes.length-256-3)/3;assert.ok(Number.isInteger(n),'the body is 3-byte records after the 256-byte header and the end record');
 assert.deepEqual([...bytes.slice(-3)],[0xF8,0,0],'the file ends F8 00 00');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 assert.equal(view.getInt32(140,true),n+1,'the header counts the records plus one');
 const cmds=[];for(let i=0;i<n;i++)cmds.push(bytes[256+i*3]&0x1F);
 assert.equal(cmds.filter(c=>c>=0x09&&c<=0x17).length,plan.stitches.filter(s=>s.cmd==='color').length,'one needle change per colour change');
 assert.equal(cmds.filter(c=>c===0x07).length,plan.stitches.filter(s=>s.cmd==='trim').length,'one trim record per planned trim');
 // A jump of 30 mm is 300 units: three records of at most 127 units, 127, 127 and 46, all positive in x and y (control 0x41).
 const jump={errors:[],stitches:[{cmd:'jump',x:0,y:0,thread:'#000000'},{cmd:'jump',x:30,y:0,thread:'#000000'}]};
 const j=encode(jump,'u01','#000000',110,null);
 assert.equal(j.length,256+3*3+3,'a 30 mm jump is split into three records');
 assert.deepEqual([...j.slice(256,262)],[0x41,0,127,0x41,0,127],'the first two records are 12.7 mm');
 assert.equal(j[262],0x41);assert.equal(j[263],0);assert.equal(j[264],46,'the last record is the remaining 4.6 mm');
});

test('XXX export: a 252-byte header and the stitches from 0x100, a jump of 30 mm is three pieces of at most 12.3 mm, a colour change is 7F 08 00 00, and the file ends with the end marker and the thread table',()=>{
 const jump={errors:[],stitches:[{cmd:'jump',x:0,y:0,thread:'#000000'},{cmd:'jump',x:30,y:0,thread:'#000000'}]};
 const j=encode(jump,'xxx','#000000',110,null),view=new DataView(j.buffer,j.byteOffset,j.byteLength);
 assert.deepEqual([...j.slice(0x100,0x100+12)],[0x7F,0x01,123,0,0x7F,0x01,123,0,0x7F,0x01,54,0],'the 300-unit jump is cut into 123, 123 and 54');
 assert.equal(view.getInt32(23,true),3,'the header counts three records');
 assert.equal(view.getInt32(0xFC,true),0x100+12,'the offset of the end of the stitches is stored at 0xFC');
 assert.deepEqual([...j.slice(0x100+12,0x100+16)],[0x7F,0x7F,0x02,0x14],'the end marker follows the stitches');
 assert.equal(j.length,0x100+12+4+2+21*4+6,'the thread table: 00 00, one 4-byte entry per thread block, 21 slots, then the closing bytes');
 const d=blank();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:-30,y:-20,width:24,height:14,thread:'#527461',stitch:'fill'},{op:'add_shape',id:'c',kind:'ellipse',x:30,y:-20,width:18,height:12,thread:'#2471a3',stitch:'fill'}]);
 const plan=compile(d),bytes=encode(plan,'xxx','#527461',110,d),endAt=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getInt32(0xFC,true);
 let changes=0;for(let i=0x100;i+3<endAt;i++)if(bytes[i]===0x7F&&bytes[i+1]===0x08&&bytes[i+2]===0&&bytes[i+3]===0)changes++;
 assert.equal(changes,plan.stitches.filter(s=>s.cmd==='color').length,'one colour change record per colour change');
 assert.equal(bytes.length,endAt+4+2+2*4+(21-2)*4+6,'the thread table holds the two blocks, then 21 slots');
});

test('TBF export: a 0x600-byte ASCII header with the needle order and thread table, records from 0x600, a jump of 30 mm is three pieces, a colour change is a needle record with a jump after it, and the file ends 8F 1A',()=>{
 const jump={errors:[],stitches:[{cmd:'jump',x:0,y:0,thread:'#000000'},{cmd:'jump',x:30,y:0,thread:'#000000'}]};
 const j=encode(jump,'tbf','#000000',110,null);
 assert.equal(String.fromCharCode(...j.slice(0,4)),'3.00','the header starts with the version');
 assert.equal(String.fromCharCode(...j.slice(0x80,0x83)),'LA:','the name line sits at 0x80');
 assert.deepEqual([...j.slice(0x600,0x600+9)],[0x7F,0,0x90,0x7F,0,0x90,0x2E,0,0x90],'a 30 mm jump is cut into 127, 127 and 46 units, each a jump record');
 assert.deepEqual([...j.slice(0x609,0x60D)],[0,0,0x8F,0x1A],'the END record, then the terminal 1A');
 const d=blank();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:-30,y:-20,width:24,height:14,thread:'#527461',stitch:'fill'},{op:'add_shape',id:'c',kind:'ellipse',x:30,y:-20,width:18,height:12,thread:'#2471a3',stitch:'fill'}]);
 const plan=compile(d),bytes=encode(plan,'tbf','#527461',110,d);
 assert.equal(bytes[0x10A],1,'the first colour change uses needle 1 in the order table');
 assert.equal(bytes[0x10A+1],0,'the design has one colour change, so the next entry is unused');
 assert.deepEqual([...bytes.slice(0x20E,0x20E+5)],[0x45,0x52,0x74,0x61,0x20],'the first thread is 0x45, its RGB and a space');
 assert.equal(bytes[0x20E+5],0x45,'the second thread entry follows');
 assert.equal((bytes.length-0x600-1)%3,0,'records are 3 bytes after the 0x600 header, then the terminal 1A');
 assert.equal(bytes[bytes.length-1],0x1A);
 assert.equal(bytes[bytes.length-2],0x8F,'the END record (dx, dy, 8F) is the last record before the terminal 1A');
 let changes=0;for(let i=0x600;i+2<bytes.length;i+=3)if(bytes[i+2]===0x81)changes++;
 assert.equal(changes,plan.stitches.filter(s=>s.cmd==='color').length,'one needle record per colour change');
});

test('rotate hoop swaps the width and height, keeps the design where it is, and rotating again restores the hoop',()=>{
 const d=blank();applyOperations(d,[{op:'set_hoop',width:100,height:160},{op:'add_shape',id:'r',kind:'rect',x:-75,y:-25,width:150,height:50,thread:'#527461',stitch:'fill'}]);
 validateDocument(d);
 const hoopWarnings=()=>designWarnings(d).filter(w=>w.category==='hoop').length;
 assert.equal(hoopWarnings(),1,'150 mm across a 100 mm hoop is outside it');
 applyOperations(d,[{op:'rotate_hoop'}]);validateDocument(d);
 assert.deepEqual(hoopSize(d),{w:160,h:100},'the hoop is now 160 by 100');
 assert.equal(d.objects[0].x,-75);assert.equal(d.objects[0].y,-25,'the design is not moved');
 assert.equal(hoopWarnings(),0,'150 mm fits across the rotated 160 mm hoop');
 applyOperations(d,[{op:'rotate_hoop'}]);assert.deepEqual(hoopSize(d),{w:100,h:160},'rotating again restores the hoop');
});

test('every batch format encodes the copies of a design, and the batch copies compile',()=>{
 const d=blank();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:-20,y:-10,width:12,height:12,thread:'#527461',stitch:'fill'},{op:'add_text',id:'t',text:'ANA',x:-20,y:14,height:6}]);
 validateDocument(d);
 for(const format of ['jef','vp3','dst','sew','exp','pec','pes','pes6','u01','xxx','tbf']){
  const docs=batchDocuments(d,{copies:2});assert.equal(docs.length,1,'two copies fit one hoop');
  const plan=compile(docs[0]);assert.deepEqual(plan.errors,[],format+' copies compile');
  const bytes=encode(plan,format,'#527461',110,docs[0]);assert.ok(bytes.length>256,format+' writes a file');
 }
});

test('name drop writes each name into the lettering marked nameDrop, and into the first lettering when none is marked',()=>{
 const d=blank();applyOperations(d,[{op:'add_text',id:'t1',text:'FIRST',x:-20,y:0,height:8},{op:'add_text',id:'t2',text:'SECOND',x:20,y:0,height:8}]);
 validateDocument(d);
 const texts=docs=>docs.map(doc=>doc.objects.filter(o=>o.kind==='text').map(o=>o.text));
 const first=batchDocuments(d,{names:['Ana','Ben']});assert.equal(first.length,1,'two copies fit one hoop');
 assert.deepEqual(texts(first),[['Ana','SECOND','Ben','SECOND']],'with none marked, the first lettering takes each name');
 applyOperations(d,[{op:'set_object',id:'t2',nameDrop:true}]);validateDocument(d);
 const marked=batchDocuments(d,{names:['Ana','Ben']});
 assert.deepEqual(texts(marked),[['FIRST','Ana','FIRST','Ben']],'the marked lettering takes the names; the first one keeps its text');
 assert.throws(()=>{applyOperations(d,[{op:'set_object',id:'t1',nameDrop:'yes'}]);validateDocument(d);},/nameDrop/);
 applyOperations(d,[{op:'set_object',id:'t1',nameDrop:false}]);
});

test('remove small holes: holes under 1 mm² go, larger holes stay, and a non-closed path is refused',()=>{
 const d=blank();applyOperations(d,[{op:'add_path',id:'p',x:0,y:0,points:[[-20,-15],[20,-15],[20,15],[-20,15]],closed:true,thread:'#527461',stitch:'fill'},{op:'add_hole',id:'p',points:[[-10,-3],[-9.4,-3],[-9.4,-2.4],[-10,-2.4]]},{op:'add_hole',id:'p',points:[[5,-2],[9,-2],[9,2],[5,2]]}]);
 validateDocument(d);
 assert.equal(d.objects[0].holes.length,2);
 applyOperations(d,[{op:'remove_small_holes',ids:['p']}]);validateDocument(d);
 assert.equal(d.objects[0].holes.length,1,'the 0.36 mm² hole goes, the 16 mm² hole stays');
 assert.deepEqual(d.objects[0].holes[0][0],[5,-2]);
 applyOperations(d,[{op:'remove_small_holes',ids:['p']}]);assert.equal(d.objects[0].holes.length,1,'nothing to remove leaves the holes alone');
 applyOperations(d,[{op:'add_path',id:'o',x:0,y:0,points:[[0,0],[5,0],[5,5]]}]);
 assert.throws(()=>applyOperations(d,[{op:'remove_small_holes',ids:['o']}]),/closed paths/);
});

test('remove small islands: a closed shape under the island limit is deleted whole; the rest stay',()=>{
 const d=blank();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:0,y:0,width:20,height:20,thread:'#527461',stitch:'fill'},{op:'add_shape',id:'b',kind:'rect',x:30,y:0,width:0.6,height:0.6,thread:'#527461',stitch:'fill'},{op:'add_shape',id:'c',kind:'rect',x:40,y:0,width:3,height:3,thread:'#527461',stitch:'fill'}]);
 applyOperations(d,[{op:'remove_small_islands',ids:['a','b','c']}]);validateDocument(d);
 assert.deepEqual(d.objects.map(o=>o.id),['a','c'],'the 0.36 mm² piece goes; the 400 and 9 mm² shapes stay');
 applyOperations(d,[{op:'remove_small_islands',ids:['a','c'],maxArea:20}]);
 assert.deepEqual(d.objects.map(o=>o.id),['a'],'a 20 mm² limit takes the 9 mm² shape, and the 400 mm² one stays');
});

test('remove small islands: the area is the outline less its holes, and only closed shapes with a limit from 0.1 to 20 mm² are accepted',()=>{
 const d=blank();applyOperations(d,[{op:'add_path',id:'p',x:0,y:0,points:[[0,0],[4,0],[4,4],[0,4]],closed:true,thread:'#527461',stitch:'fill'},{op:'add_hole',id:'p',points:[[0.5,0.5],[3.5,0.5],[3.5,3.5],[0.5,3.5]]},{op:'add_path',id:'o',x:0,y:0,points:[[0,0],[5,0],[5,5]]}]);
 applyOperations(d,[{op:'remove_small_islands',ids:['p'],maxArea:7}]);validateDocument(d);
 assert.equal(d.objects.length,2,'16 - 9 = 7 mm² is not under a 7 mm² limit');
 applyOperations(d,[{op:'remove_small_islands',ids:['p'],maxArea:8}]);
 assert.deepEqual(d.objects.map(o=>o.id),['o'],'7 mm² is under 8');
 assert.throws(()=>applyOperations(d,[{op:'remove_small_islands',ids:['o']}]),/closed shapes/);
 assert.throws(()=>applyOperations(d,[{op:'remove_small_islands',ids:['o'],maxArea:25}]),/island limit/);
});

test('remove small holes: the hole limit is a setting, from 0.1 to 20 mm²',()=>{
 const d=blank();applyOperations(d,[{op:'add_path',id:'p',x:0,y:0,points:[[-20,-15],[20,-15],[20,15],[-20,15]],closed:true,thread:'#527461',stitch:'fill'},{op:'add_hole',id:'p',points:[[-10,-3],[-9.4,-3],[-9.4,-2.4],[-10,-2.4]]},{op:'add_hole',id:'p',points:[[5,-2],[9,-2],[9,2],[5,2]]}]);
 applyOperations(d,[{op:'remove_small_holes',ids:['p'],maxArea:20}]);validateDocument(d);
 assert.equal(d.objects[0].holes,undefined,'a 20 mm² limit removes both holes, the 0.36 and the 16 mm²');
 const e=blank();applyOperations(e,[{op:'add_path',id:'p',x:0,y:0,points:[[-20,-15],[20,-15],[20,15],[-20,15]],closed:true,thread:'#527461',stitch:'fill'},{op:'add_hole',id:'p',points:[[-10,-3],[-9.4,-3],[-9.4,-2.4],[-10,-2.4]]},{op:'add_hole',id:'p',points:[[5,-2],[9,-2],[9,2],[5,2]]}]);
 assert.throws(()=>applyOperations(e,[{op:'remove_small_holes',ids:['p'],maxArea:25}]),/hole limit/);
});

test('knife along a polyline: a bent cut across a rectangle makes two pieces, and a polyline that crosses itself is refused',()=>{
 const d=blank();applyOperations(d,[{op:'add_shape',id:'r',kind:'rect',x:-20,y:-15,width:40,height:30,thread:'#527461',stitch:'fill'}]);
 applyOperations(d,[{op:'knife',id:'r',points:[[-30,0],[10,0],[10,5],[30,5]]}]);validateDocument(d);
 assert.equal(d.objects.length,2,'the bent cut splits the rectangle into two pieces');
 const e=blank();applyOperations(e,[{op:'add_shape',id:'r',kind:'rect',x:-20,y:-15,width:40,height:30,thread:'#527461',stitch:'fill'}]);
 assert.throws(()=>applyOperations(e,[{op:'knife',id:'r',points:[[-30,-5],[30,5],[30,-5],[-30,5]]}]),/crosses itself/);
 assert.equal(e.objects.length,1,'a refused knife leaves the shape alone');
 assert.throws(()=>applyOperations(e,[{op:'knife',id:'r',points:[[0,0]]}]),/two or more points/);
});

test('trim jumps from a set length: a 7 mm jump is trimmed at the default 5 mm but not at 10, a 12 mm jump is trimmed at 10, and a length outside 2-30 is refused',()=>{
 const trimsFor=(trimMm,x2)=>{const d=blank();applyOperations(d,[{op:'add_path',id:'a',x:0,y:0,points:[[0,0],[1,0]],thread:'#527461',stitch:'run'},{op:'add_path',id:'b',x:0,y:0,points:[[x2,0],[x2+1,0]],thread:'#527461',stitch:'run'},{op:'set_settings',trims:true,...(trimMm===undefined?{}:{trimMm})}]);validateDocument(d);return compile(d).stitches.filter(s=>s.cmd==='trim').length;};
 assert.equal(trimsFor(undefined,8),1,'the default 5 mm trims a 7 mm jump');
 assert.equal(trimsFor(10,8),0,'at 10 mm a 7 mm jump is not trimmed');
 assert.equal(trimsFor(10,13),1,'at 10 mm a 12 mm jump is trimmed');
 const d=blank();assert.throws(()=>{applyOperations(d,[{op:'set_settings',trimMm:50}]);validateDocument(d);},/trim length/);
});

test('sewing time per thread: 600 stitches a minute, 8 s per trim in the block, 20 s for the colour change into it',()=>{
 assert.equal(blockTimeLabel(blockSeconds({stitches:600,trims:0,changed:false})),'1:00','600 stitches are one minute');
 assert.equal(blockTimeLabel(blockSeconds({stitches:300,trims:2,changed:true})),'1:06','30 s of stitches, 16 s of trims and the 20 s change');
 const d=blank();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:-30,y:-20,width:24,height:14,thread:'#527461',stitch:'fill'},{op:'add_shape',id:'c',kind:'ellipse',x:30,y:-20,width:18,height:12,thread:'#2471a3',stitch:'fill'}]);
 const blocks=threadPlan(compile(d));
 assert.equal(blocks.length,2);assert.equal(blocks[0].changed,false,'the first block has no change into it');assert.equal(blocks[1].changed,true,'the second block follows a colour change');
 assert.ok(blocks.every(b=>blockSeconds(b)>0),'every block takes time');
});

test('oval, heart and teardrop stones turn with the path by default, and can be set to stay upright',()=>{
 const sewn=(shape,extra)=>{const d=blank();applyOperations(d,[{op:'add_path',id:'g',x:0,y:0,points:[[0,-20],[0,20]]},{op:'set_object',id:'g',stitch:'bling',motifSize:6,blingShape:shape,...extra}]);validateDocument(d);return compile(d);};
 const width=p=>{const xs=p.stitches.filter(s=>s.cmd==='stitch').map(s=>s.x);return Math.max(...xs)-Math.min(...xs);};
 for(const shape of ['oval','heart','teardrop']){
  assert.deepEqual(sewn(shape,{}).stitches,sewn(shape,{stoneTurn:true}).stitches,shape+': the default turns with the path');
  assert.notDeepEqual(sewn(shape,{stoneTurn:true}).stitches,sewn(shape,{stoneTurn:false}).stitches,shape+': stoneTurn off keeps the stone upright');
 }
 assert.notEqual(Math.round(width(sewn('oval',{stoneTurn:false}))*10),Math.round(width(sewn('oval',{}))*10),'an upright oval is a different width across a vertical path');
});

test('COL thread list: the colours in order of first use, each once, as a CRLF text file',()=>{
 const d=blank();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:-30,y:-20,width:24,height:14,thread:'#C0392B',stitch:'fill'},{op:'add_shape',id:'b',kind:'rect',x:0,y:0,width:20,height:10,thread:'#2471a3',stitch:'fill'},{op:'add_shape',id:'c',kind:'rect',x:30,y:0,width:6,height:6,thread:'#C0392B',stitch:'fill'}]);
 assert.equal(new TextDecoder().decode(encode(compile(d),'col','#527461',110,d)),'2\r\n0,192,57,43\r\n1,36,113,163\r\n');
});

test('EDR thread list: the same colours in the same order as COL, four bytes each (red, green, blue, pad)',()=>{
 const d=blank();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:-30,y:-20,width:24,height:14,thread:'#C0392B',stitch:'fill'},{op:'add_shape',id:'b',kind:'rect',x:0,y:0,width:20,height:10,thread:'#2471a3',stitch:'fill'},{op:'add_shape',id:'c',kind:'rect',x:30,y:0,width:6,height:6,thread:'#C0392B',stitch:'fill'}]);
 assert.deepEqual([...encode(compile(d),'edr','#527461',110,d)],[192,57,43,0,36,113,163,0]);
});

test('accordion profiles: ease in is slow at the top, ease out slow at the bottom, and an unknown profile is refused',()=>{
 const rect=[[[0,0],[20,0],[20,30],[0,30],[0,0]]];
 const rows=runs=>[...new Set(runs.flatMap(run=>run.pts.map(p=>+p[1].toFixed(3))))].sort((x,y)=>x-y);
 const gaps=R=>R.slice(1).map((v,i)=>v-R[i]);
 const g=c=>gaps(rows(planFill(rect,{spacing:.4,accordion:[.5,1.2,c]})));
 const lin=g('linear'),inn=g('easeIn'),out=g('easeOut');
 assert.ok(Math.abs(inn[1]-inn[0])<Math.abs(lin[1]-lin[0])/3,'ease in: the top rows barely change');
 assert.ok(Math.abs(out.at(-1)-out.at(-2))<Math.abs(lin.at(-1)-lin.at(-2))/3,'ease out: the bottom rows barely change');
 const d=blank();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:0,y:0,width:20,height:30,thread:'#527461',stitch:'fill'},{op:'set_object',id:'a',accordionStart:.5,accordionEnd:1.2,accordionEase:'easeOut'}]);
 validateDocument(d);assert.deepEqual(compile(d).errors,[]);
 assert.throws(()=>{applyOperations(d,[{op:'set_object',id:'a',accordionEase:'bounce'}]);validateDocument(d);},/accordionEase/);
});

test('accordion curve: ease in and out changes the row spacing more slowly at both ends than linear, and an unknown curve is refused',()=>{
 const rect=[[[0,0],[20,0],[20,30],[0,30],[0,0]]];
 const rows=runs=>[...new Set(runs.flatMap(run=>run.pts.map(p=>+p[1].toFixed(3))))].sort((x,y)=>x-y);
 const gaps=R=>R.slice(1).map((v,i)=>v-R[i]);
 const lin=gaps(rows(planFill(rect,{spacing:.4,accordion:[.5,1.2]}))),eased=gaps(rows(planFill(rect,{spacing:.4,accordion:[.5,1.2,true]})));
 assert.ok(Math.abs(eased[0]-eased[1])<Math.abs(lin[0]-lin[1])/3,'near the top the eased rows barely change ('+eased[0].toFixed(3)+', '+eased[1].toFixed(3)+')');
 assert.ok(Math.abs(eased.at(-1)-eased.at(-2))<Math.abs(lin.at(-1)-lin.at(-2)),'and near the bottom the change is smaller too');
 const d=blank();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:0,y:0,width:20,height:30,thread:'#527461',stitch:'fill'},{op:'set_object',id:'a',accordionStart:.5,accordionEnd:1.2,accordionEase:'ease'}]);
 validateDocument(d);assert.deepEqual(compile(d).errors,[]);
 assert.throws(()=>{applyOperations(d,[{op:'set_object',id:'a',accordionEase:'sideways'}]);validateDocument(d);},/accordionEase/);
});

test('print template: a check line that measures 100 mm on a 110 mm hoop, and the width less 10 mm on a narrower hoop',()=>{
 const wide=blank();wide.hoop=110;const narrow=blank();narrow.hoop=100;
 assert.ok(exportPrintTemplate(wide).includes('100 mm check: measure this line'),'a 110 mm hoop gets the 100 mm check');
 assert.ok(exportPrintTemplate(wide).includes('M-50 40H50'),'the check line is 100 mm, from x -50 to 50 (the hoop is -55 to 55)');
 assert.ok(exportPrintTemplate(narrow).includes('90 mm check: measure this line'),'a 100 mm hoop gets a 90 mm check so it stays inside the hoop');
});

test('organize fonts lists bundled fonts used by lettering, read-only, and leaves custom fonts to customFontUsage',()=>{
 const d=blank();applyOperations(d,[{op:'add_text',id:'t1',text:'ANA',x:0,y:0,height:8,font:'inkstitch/allegria20',name:'Name one'},{op:'add_text',id:'t2',text:'BEN',x:0,y:10,height:8,font:'inkstitch/allegria20'},{op:'add_text',id:'t3',text:'CAT',x:0,y:20,height:8,font:'inkstitch/abecedaire'}]);
 assert.deepEqual(bundledFontUsage(d),[{id:'inkstitch/allegria20',uses:['Lettering: ANA','Lettering: BEN']},{id:'inkstitch/abecedaire',uses:['Lettering: CAT']}],'two bundled fonts, with the lettering that uses each');
 assert.deepEqual(customFontUsage(d),[],'no custom fonts are listed here');
});

test('raised underlay turn: the default is 90 degrees from the fill, a turn changes the underlay, and an out-of-range turn is refused',()=>{
 const make=extra=>{const d=blank();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:-20,y:-15,width:40,height:30,thread:'#527461',stitch:'fill'},{op:'set_object',id:'a',raised:true,...extra}]);validateDocument(d);return compile(d).stitches;};
 assert.deepEqual(make({}),make({raisedAngle:90}),'the default is 90 degrees, as before');
 assert.notDeepEqual(make({}),make({raisedAngle:0}),'a turn of 0 changes the raised underlay');
 assert.throws(()=>{const d=blank();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:0,y:0,width:10,height:10,thread:'#527461',stitch:'fill'},{op:'set_object',id:'a',raisedAngle:200}]);validateDocument(d);},/raised underlay turn/);
});

test('laydown rows: the default is 4 mm, a wider spacing changes the underlay, and an out-of-range spacing is refused',()=>{
 const make=extra=>{const d=blank();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:-20,y:-15,width:40,height:30,thread:'#527461',stitch:'fill'},{op:'set_object',id:'a',underlayType:'laydown',...extra}]);validateDocument(d);return compile(d).stitches;};
 assert.deepEqual(make({}),make({laydownSpacing:4}),'the default is 4 mm, as before');
 assert.notDeepEqual(make({}),make({laydownSpacing:8}),'8 mm rows change the laydown underlay');
 assert.throws(()=>{const d=blank();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:0,y:0,width:10,height:10,thread:'#527461',stitch:'fill'},{op:'set_object',id:'a',laydownSpacing:12}]);validateDocument(d);},/laydown row spacing/);
});

test('stem width: the default is 1.2 mm across, a wider stem spreads its stitches further, and an out-of-range width is refused',()=>{
 const sewn=extra=>{const d=blank();applyOperations(d,[{op:'add_path',id:'s',x:0,y:0,points:[[-20,0],[0,0],[20,0]]},{op:'set_object',id:'s',stitch:'run',runStyle:'stem',...extra}]);validateDocument(d);return compile(d);};
 const width=p=>{const ys=p.stitches.filter(s=>s.cmd==='stitch').map(s=>s.y);return Math.max(...ys)-Math.min(...ys);};
 assert.ok(Math.abs(width(sewn({}))-1.2)<.05,'the default braid is 1.2 mm across ('+width(sewn({}))+')');
 assert.ok(Math.abs(width(sewn({stemWidth:3}))-3)<.05,'a 3 mm stem is 3 mm across');
 assert.throws(()=>{const d=blank();applyOperations(d,[{op:'add_path',id:'s',x:0,y:0,points:[[-20,0],[20,0]]},{op:'set_object',id:'s',stitch:'run',runStyle:'stem',stemWidth:9}]);validateDocument(d);},/stem width/);
});

test('PES v6 export: each thread carries its colour hex as the description, in thread order',()=>{
 const d=blank();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:-30,y:-20,width:24,height:14,thread:'#C0392B',stitch:'fill'},{op:'add_shape',id:'b',kind:'rect',x:0,y:0,width:20,height:10,thread:'#2471a3',stitch:'fill'}]);
 const bytes=encode(compile(d),'pes6','#527461',110,d),text=String.fromCharCode(...bytes);
 assert.ok(text.includes('\x07#c0392b'),'the first thread description is #c0392b, with its length byte');
 assert.ok(text.indexOf('#c0392b')<text.indexOf('#2471a3'),'descriptions follow the thread order');
});

test('replace thread: every object in that colour takes the new one, without case, and the thread plan merges the blocks',()=>{
 const d=blank();applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:-30,y:-10,width:10,height:10,thread:'#527461',stitch:'fill'},{op:'add_shape',id:'b',kind:'ellipse',x:0,y:-10,width:10,height:10,thread:'#D9897E',stitch:'fill'},{op:'add_shape',id:'c',kind:'rect',x:20,y:-10,width:10,height:10,thread:'#527461',stitch:'fill'}]);
 validateDocument(d);
 assert.equal(threadPlan(compile(d)).length,3,'three blocks: green, pink, green');
 applyOperations(d,[{op:'replace_thread',from:'#527461',to:'#d9897e'}]);validateDocument(d);
 assert.deepEqual(d.objects.map(o=>o.thread),['#d9897e','#D9897E','#d9897e'],'the two green objects take the pink, the pink one keeps its own case');
 assert.equal(threadPlan(compile(d)).length,1,'one block now');
 assert.throws(()=>applyOperations(d,[{op:'replace_thread',from:'red',to:'#000000'}]),/#rrggbb/);
});

test('appliqué templates: each appliqué piece prints as its own 1:1 outline with its name and size; the base is not printed',()=>{
 const d=blank();applyOperations(d,[{op:'add_shape',id:'base',kind:'rect',x:0,y:0,width:60,height:50,thread:'#527461',stitch:'fill'},{op:'add_shape',id:'leaf',kind:'ellipse',x:0,y:0,width:20,height:10,thread:'#d9897e',stitch:'fill'},{op:'add_shape',id:'star',kind:'rect',x:-15,y:0,width:12,height:12,thread:'#c0392b',stitch:'fill'},{op:'set_object',id:'leaf',name:'Leaf'},{op:'set_object',id:'star',name:'Star'},{op:'set_object',id:'base',name:'Fabric'},{op:'applique_group',ids:['base','leaf','star']}]);
 validateDocument(d);
 const svg=exportAppliqueTemplates(d);
 assert.match(svg,/^<\?xml[^>]*>\n<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="[\d.]+mm" height="[\d.]+mm"/);
 assert.ok(svg.includes('Leaf · 20.0 × 10.0 mm'),'the ellipse piece is labelled with its 1:1 size');
 assert.ok(svg.includes('Star · 12.0 × 12.0 mm'),'the square piece is labelled too');
 assert.ok(!svg.includes('Fabric ·'),'the fabric base is not printed');
 assert.equal((svg.match(/stroke-linejoin="round"/g)||[]).length,2,'one outline per appliqué piece (the scale bar has no linejoin)');
 assert.throws(()=>exportAppliqueTemplates(blank()),/No appliqué pieces/);
});

test('thread length: a 40 mm run is 0.04 m, jumps between runs add nothing, and the worksheet and thread plan show it',()=>{
 const d=blank();applyOperations(d,[{op:'add_path',id:'a',x:0,y:0,points:[[-20,0],[20,0]]},{op:'set_object',id:'a',stitch:'run',thread:'#c0392b'},{op:'add_path',id:'b',x:0,y:100,points:[[-20,0],[20,0]]},{op:'set_object',id:'b',stitch:'run',thread:'#c0392b'}]);
 validateDocument(d);const p=compile(d),blocks=threadPlan(p);
 assert.equal(blocks.length,1,'one thread, so one block');
 assert.ok(Math.abs(blocks[0].mm-80)<1.6,'two 40 mm runs are 80 mm of thread, not the 100 mm gap between them ('+blocks[0].mm+')');
 const single=blank();applyOperations(single,[{op:'add_path',id:'a',x:0,y:0,points:[[-20,0],[20,0]]},{op:'set_object',id:'a',stitch:'run',thread:'#c0392b'}]);
 const one=threadPlan(compile(single))[0];assert.ok(Math.abs(one.mm-40)<0.8,'a 40 mm run is 40 mm of thread ('+one.mm+')');
 const text=sewingWorksheet(single,compile(single),'text');
 assert.match(text,/Length \(m\)/);assert.ok(text.includes('0.04'),'the row shows 0.04 m');assert.ok(text.includes('Length: 0.04 m'),'the footer shows the total');
 assert.ok(sewingWorksheet(single,compile(single),'svg').includes('0.04 m'));
});

test('sewing worksheet lists thread blocks in sewing order with stitch counts and the time estimate',()=>{
 const d=blank();d.name='Badge <A> & B';applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:-30,y:0,width:10,height:10,thread:'#d9897e',stitch:'fill'},{op:'add_shape',id:'b',kind:'rect',x:0,y:0,width:10,height:10,thread:'#527461',stitch:'fill'},{op:'add_shape',id:'c',kind:'rect',x:30,y:0,width:10,height:10,thread:'#d9897e',stitch:'fill'}]);
 const p=compile(d),blocks=threadPlan(p);
 assert.deepEqual(blocks.map(b=>b.thread),['#d9897e','#527461','#d9897e']);
 assert.equal(blocks.reduce((n,b)=>n+b.stitches,0),p.count);
 const stops=p.stitches.filter(s=>s.cmd==='color'||s.cmd==='stop').length,trims=p.stitches.filter(s=>s.cmd==='trim').length;
 assert.equal(sewingSeconds(p),p.count/600*60+stops*20+trims*8);
 const text=sewingWorksheet(d,p,'text');
 assert.match(text,/^Sewing worksheet: Badge <A> & B\nHoop: 110 mm\n/);
 assert.ok(text.includes(`Threads: 3   Stitches: ${p.count.toLocaleString('en-US')}`));
 assert.ok(text.indexOf('#d9897e')<text.indexOf('#527461'));
 const svg=sewingWorksheet(d,p,'svg');
 assert.ok(svg.startsWith('<?xml'));assert.match(svg,/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="120mm"/);
 assert.ok(svg.includes('<title>Badge &lt;A&gt; &amp; B</title>'));assert.equal(svg.match(/<rect /g).length,3);
 assert.throws(()=>sewingWorksheet(d,p,'pdf'),/Unsupported worksheet format/);
 const empty={revision:0,count:0,stitches:[]};assert.equal(threadPlan(empty).length,0);assert.match(sewingWorksheet(blank(),empty,'text'),/Threads: 0   Stitches: 0\nEstimate: about 1 min/);
});
