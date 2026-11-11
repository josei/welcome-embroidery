import test from 'node:test';
import assert from 'node:assert/strict';
import {encode} from '../src/engine.js';
import {decodeEmbroidery} from '../src/readers.js';
import {readMachineFixtures} from './fixture-archive.js';

// Every point a stitch writer emits must lie within 0.1 mm of a sewn line of the source. Split pieces of a long move are interpolated from the
// unrounded source endpoints and rounded once, so they stay within half a 0.1 mm grid diagonal (0.071 mm) of their line; this test guards that.
// The sewn lines start at the machine origin (0, 0), where the Brother, Pfaff and JEF writers start, so a first stitch counts as sewn from there.

const WRITERS=['jef','vp3','dst','exp','pec','pes','pes6','sew','u01','xxx','tbf'];
const READERS={pes6:'pes'};
const LAYER_FORMATS=/\.(jef|vp3|sew|pec|pes|dst|exp|hus|xxx|dsb|dsz|tap|tbf|pcs|shv|stx|bro|emd|ksm|10o|u01)$/i;
const READ_FORMAT=name=>name.toLowerCase().split('.').pop();
const TOLERANCE_MM=0.1;
const STITCH_LAYERS=380;
// XXX refuses a design with more than 21 thread blocks. That is a format limit, not a placement problem, so the test does not count it.
const FORMAT_REFUSAL=/XXX holds up to 21 thread blocks/;

// Distance from p to the segment a-b, in mm.
function distanceToSegment(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy;
  const t=len2?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len2)):0;
  return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
}

// The sewn segments of a decoded layer, each from the point before it (the machine origin for the first stitch) to a stitch.
function sewnSegments(decoded){
  const segments=[];
  let prev={x:0,y:0};
  for(const s of decoded.stitches){
    if(s.cmd==='stitch')segments.push([prev,s]);
    if(s.cmd!=='end')prev=s;
  }
  return segments;
}

const layers=[];
for(const [name,bytes] of readMachineFixtures(LAYER_FORMATS)){
  let decoded;
  try{decoded=decodeEmbroidery(bytes,READ_FORMAT(name));}catch{continue;}
  if(!decoded.stitches.some(s=>s.cmd==='stitch'))continue;
  const segments=sewnSegments(decoded);
  const plan={errors:[],bounds:decoded.bounds,count:decoded.stitches.length,stitches:decoded.stitches.map(s=>({x:s.x,y:s.y,cmd:s.cmd,thread:'#000000'}))};
  layers.push({name,plan,segments});
}

test('the fixture set has the expected number of stitch layers',()=>{
  assert.equal(layers.length,STITCH_LAYERS);
});

for(const writer of WRITERS){
  test(`${writer}: every stitch point of every fixture layer is within 0.1 mm of a sewn line`,()=>{
    let points=0,worst=0;
    const offenders=[];
    for(const {name,plan,segments} of layers){
      let out;
      try{out=decodeEmbroidery(encode(plan,writer,'#000000'),READERS[writer]??writer);}
      catch(err){
        if(FORMAT_REFUSAL.test(err.message)&&writer==='xxx')continue;
        throw err;
      }
      for(const p of out.stitches){
        if(p.cmd!=='stitch')continue;
        points++;
        let nearest=Infinity;
        for(const [a,b] of segments){
          nearest=Math.min(nearest,distanceToSegment(p,a,b));
          if(nearest<=TOLERANCE_MM)break;
        }
        worst=Math.max(worst,nearest);
        if(nearest>TOLERANCE_MM&&offenders.length<5)offenders.push(`${name} at ${p.x},${p.y} is ${nearest.toFixed(3)} mm off`);
      }
    }
    assert.ok(points>0,`${writer} wrote stitch points`);
    assert.deepEqual(offenders,[],`${writer} worst ${worst.toFixed(4)} mm`);
  });
}
