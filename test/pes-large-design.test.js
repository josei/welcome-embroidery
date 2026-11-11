import test from 'node:test';
import assert from 'node:assert/strict';
import {encode} from '../src/engine.js';

// PES export used Math.min(...xs) over every stitch, which overflows the call stack at about 140,000 stitches.
// This plan is well past that: 250,000 stitches in one colour, with a bounds check against a brute-force min/max.

const A='#ed171f';
function largePlan(count){
  const stitches=[{x:0,y:0,cmd:'stitch',thread:A}];
  for(let i=1;i<count;i++){
    stitches.push({x:((i*37)%2400)*0.25,y:((i*91)%1600)*0.25,cmd:'stitch',thread:A});
  }
  stitches.push({x:0,y:0,cmd:'end',thread:A});
  return {errors:[],stitches};
}

test('PES encodes a 250,000-stitch plan and the header bounds match a brute-force min/max', () => {
  const plan=largePlan(250000);
  const bytes=encode(plan,'pes');
  // Brute-force bounds on the same 0.1 mm grid the encoder uses.
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const s of plan.stitches){
    const x=Math.round(s.x*10),y=Math.round(s.y*10);
    if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
  }
  // Header: '#PES0001' (8) + PEC offset (4) + version (2+2+2) + 'CEmbOne' string (2+7) + 8 zero words + 4 floats + 2 floats = 77,
  // then the width and height as 16-bit values at offsets 77 and 79.
  const readI16=at=>{const v=bytes[at]|(bytes[at+1]<<8);return v>=0x8000?v-0x10000:v;};
  assert.equal(readI16(77),Math.trunc(maxX-minX));
  assert.equal(readI16(79),Math.trunc(maxY-minY));
});
