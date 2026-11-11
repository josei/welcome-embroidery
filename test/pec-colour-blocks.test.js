import test from 'node:test';
import assert from 'node:assert/strict';
import {encode} from '../src/engine.js';
import {decodeEmbroidery} from '../src/readers.js';

// PEC, PES and PES v6 write one palette entry per colour block. A design whose first colour change comes before any stitch (as an imported
// file can have) used to get one palette entry too few, and the PEC reader refused it with "more color changes than colors".

const A='#ed171f', B='#0b3d91', C='#2f7e20', D='#ffd911';
const colourChanges=decoded=>decoded.stitches.filter(s=>s.cmd==='color'||s.cmd==='stop').length;

// Colour changes with a leading one: colour A is selected before any stitch, then B, C and D each start a block.
function leadingChangePlan(){
  return {errors:[],stitches:[
    {x:0,y:0,cmd:'color',thread:A},
    {x:5,y:0,cmd:'stitch',thread:A},
    {x:5,y:0,cmd:'color',thread:B},
    {x:10,y:0,cmd:'stitch',thread:B},
    {x:10,y:0,cmd:'color',thread:C},
    {x:10,y:5,cmd:'stitch',thread:C},
    {x:10,y:5,cmd:'color',thread:D},
    {x:15,y:5,cmd:'stitch',thread:D},
    {x:15,y:5,cmd:'end',thread:D},
  ]};
}

// A plan whose colour changes all select the same thread: the reader sees repeated palette entries and reads them as stops.
function repeatedThreadPlan(){
  return {errors:[],stitches:[
    {x:0,y:0,cmd:'stitch',thread:A},
    {x:5,y:0,cmd:'color',thread:A},
    {x:5,y:0,cmd:'stitch',thread:A},
    {x:10,y:0,cmd:'color',thread:A},
    {x:10,y:0,cmd:'stitch',thread:A},
    {x:10,y:0,cmd:'end',thread:A},
  ]};
}

for(const [format,reader] of [['pec','pec'],['pes','pes'],['pes6','pes']]){
  test(`${format}: a leading colour change and distinct colours re-read with the same colour changes`,()=>{
    const decoded=decodeEmbroidery(encode(leadingChangePlan(),format,A),reader);
    assert.equal(colourChanges(decoded),4,'four colour-change codes, as in the plan');
    const colours=decoded.stitches.filter(s=>s.cmd==='stitch').map(s=>decoded.threads[s.thread].color);
    assert.deepEqual([...new Set(colours)],[A,B,C,D]);
  });

  test(`${format}: colour changes to the same thread re-read without error`,()=>{
    const decoded=decodeEmbroidery(encode(repeatedThreadPlan(),format,A),reader);
    assert.equal(colourChanges(decoded),2,'two colour-change codes, read back as stops');
  });
}
