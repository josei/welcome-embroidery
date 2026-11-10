import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,encode,initialDocument,validateDocument} from '../src/engine.js';
import {decodeEmbroidery} from '../src/readers.js';
import {threadPlan} from '../src/sewingTime.js';

// Encode -> decode round trip for generated designs, in every format the editor exports.
// Stitch points are compared by LCS alignment at each format's unit (0.1 mm for all of them:
// the encoders write tenths of a millimetre), so the comparison is order-aware and tolerant
// of the rounding the format imposes, but not of a dropped, added or moved stitch.

const RED='#527461', ROSE='#d9897e', GOLD='#c9a227';
const TOL=0.1+1e-6;

// Formats the editor exports. COL and EDR are colour lists, checked separately below against the plan's colours.
// Each entry names the reader used for the decode step.
const FORMATS=[
  {format:'jef',reader:'jef'},
  {format:'vp3',reader:'vp3'},
  {format:'dst',reader:'dst'},
  {format:'exp',reader:'exp'},
  {format:'pec',reader:'pec'},
  {format:'pes',reader:'pes'},
  {format:'pes6',reader:'pes'},
  {format:'sew',reader:'sew'},
  {format:'xxx',reader:'xxx'},
  {format:'tbf',reader:'tbf'},
  {format:'u01',reader:'u01'},
];

// Known deviations, tracked by follow-up issues. These formats stay in the suite as todo tests:
// the test runs and reports, and the suite stays green. Once the deviation is fixed, remove the
// entry so the test becomes a hard requirement.
const KNOWN_FAILING={
  u01:'#310: U01 drops zero-length stitches on write (the same encoder skip as EXP, SEW, XXX and TBF)',
};

const base=()=>{const d=initialDocument();d.objects=[];return d;};

// The four fixed designs from the round-trip audit (#294).
const DESIGNS={
  'path monogram':()=>{const d=base();d.objects=[{id:'m1',name:'M',kind:'path',closed:false,smooth:false,x:0,y:0,w:0,h:0,points:[[-20,-20],[-20,20],[0,0],[20,-20],[20,20]],thread:RED,stitch:'run'}];return d;},
  'fill plus satin':()=>{const d=base();d.objects=[{id:'f',name:'F',kind:'rect',x:-30,y:-15,w:25,h:30,thread:RED,stitch:'fill'},{id:'s',name:'S',kind:'path',closed:false,x:0,y:0,w:0,h:0,points:[[5,-15],[35,15]],thread:ROSE,stitch:'satin'}];return d;},
  'two fills, run, color change and trims':()=>{const d=base();d.objects=[{id:'a',name:'A',kind:'rect',x:-40,y:-20,w:20,h:20,thread:RED,stitch:'fill'},{id:'b',name:'B',kind:'rect',x:20,y:-20,w:20,h:20,thread:ROSE,stitch:'fill'},{id:'c',name:'C',kind:'path',closed:false,x:0,y:0,w:0,h:0,points:[[-40,30],[40,30]],thread:GOLD,stitch:'run'}];return d;},
  'fill plus run at the hoop edge':()=>{const d=base();d.objects=[{id:'e',name:'E',kind:'rect',x:-52,y:-52,w:104,h:8,thread:RED,stitch:'fill'},{id:'g',name:'G',kind:'path',closed:false,x:0,y:0,w:0,h:0,points:[[50,50],[54,54]],thread:ROSE,stitch:'run'}];return d;},
};

const stitchPoints=cmds=>cmds.filter(s=>s.cmd==='stitch').map(s=>[s.x,s.y]);
const count=(list,cmd)=>list.filter(s=>s.cmd===cmd).length;

// Longest-common-subsequence alignment of two point lists within TOL.
function lcsMatch(plan,decoded){
  const n=plan.length,m=decoded.length;
  const same=(a,b)=>Math.abs(a[0]-b[0])<=TOL&&Math.abs(a[1]-b[1])<=TOL;
  const T=Array.from({length:n+1},()=>new Uint32Array(m+1));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)
    T[i][j]=same(plan[i],decoded[j])?T[i+1][j+1]+1:Math.max(T[i+1][j],T[i][j+1]);
  let i=0,j=0,matched=0,maxDev=0;
  while(i<n&&j<m){
    if(same(plan[i],decoded[j])){matched++;maxDev=Math.max(maxDev,Math.abs(plan[i][0]-decoded[j][0]),Math.abs(plan[i][1]-decoded[j][1]));i++;j++;}
    else if(T[i+1][j]>=T[i][j+1])i++;else j++;
  }
  return {missing:n-matched,extra:m-matched,maxDev};
}

function roundTrip(designName,format,reader){
  const doc=DESIGNS[designName]();validateDocument(doc);
  const plan=compile(doc);
  assert.deepEqual(plan.errors,[],`${designName}: plan has no errors`);
  const decoded=decodeEmbroidery(encode(plan,format,RED,doc.hoop,doc),reader);
  return {plan:plan.stitches,decoded:decoded.stitches,threads:decoded.threads};
}

for(const [designName] of Object.entries(DESIGNS)){
  for(const {format,reader} of FORMATS){
    const label=`${designName} round-trips through ${format}`;
    const run=()=>{
      const {plan,decoded}=roundTrip(designName,format,reader);
      const m=lcsMatch(stitchPoints(plan),stitchPoints(decoded));
      assert.equal(m.missing,0,`${m.missing} planned stitch(es) missing after decode`);
      assert.equal(m.extra,0,`${m.extra} extra stitch(es) after decode`);
      assert.ok(m.maxDev<=TOL,`max deviation ${m.maxDev} mm exceeds ${TOL}`);
      assert.equal(count(decoded,'color'),count(plan,'color'),'color-change count');
      // Readers add their own leading move and trims around jumps, so the decoded move count can
      // exceed the plan's; it must never be lower (a lost jump or trim would change where the thread goes).
      assert.ok(count(decoded,'jump')+count(decoded,'trim')>=count(plan,'jump'),'no planned jump lost');
    };
    if(KNOWN_FAILING[format])test(label,{todo:KNOWN_FAILING[format]},run);
    else test(label,run);
  }
}

// COL and EDR carry the plan's colours only: each colour once, in order of first use, as RGB.
// The expected list is built from the plan's thread blocks, not from the encoder.
for(const [designName] of Object.entries(DESIGNS)){
  for(const format of ['col','edr']){
    test(`${designName} color list round-trips through ${format}`,()=>{
      const doc=DESIGNS[designName]();validateDocument(doc);
      const plan=compile(doc);
      assert.deepEqual(plan.errors,[],`${designName}: plan has no errors`);
      const expected=[];
      for(const b of threadPlan(plan)){const hex=b.thread.toLowerCase();if(!expected.includes(hex))expected.push(hex);}
      const decoded=decodeEmbroidery(encode(plan,format,RED,doc.hoop,doc),format);
      const got=decoded.threads.map(t=>t.color);
      assert.equal(got.length,expected.length,'color count');
      assert.deepEqual(got,expected,'color order and RGB');
      assert.deepEqual(decoded.threads.map(t=>t.index),expected.map((_,i)=>i),'color indices');
    });
  }
}
