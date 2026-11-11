// @ts-check
// Thread colour lists in the two forms pyembroidery reads and writes: COL (text) and EDR (binary).

/** @typedef {import('../encoders.js').Plan} Plan */

// Thread colour list (COL, the text form pyembroidery reads and writes): the number of colours, then index,r,g,b for each, with CRLF line ends. Each colour is
// listed once, in order of first use.
// The design's colours, each once, in order of first use, as [r, g, b] (shared by the COL and EDR colour lists). Every thread a command names counts, not only
// the blocks that hold stitches: a block of jumps before the first colour change (an empty block) still has its thread in the design's list.
/** @param {Plan} plan @returns {number[][]} */
function colourList(plan){if(plan.errors.length)throw Error(plan.errors.join(' '));
/** @type {string[]} */ const cols=[];
  for(const s of plan.stitches){if(!s.thread||s.cmd==='end')continue;const k=String(s.thread).toLowerCase();if(!cols.includes(k))cols.push(k);}return cols.map(
  hex=>[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)]);}
/** @param {Plan} plan @returns {Uint8Array} */
export function encodeCol(plan){const cols=colourList(plan),lines=[String(cols.length)];cols.forEach(([r,g,b],i)=>lines.push(`${i},${r},${g},${b}`));
  return new TextEncoder().encode(lines.join('\r\n')+'\r\n');}
// Thread colour list (EDR, the binary form pyembroidery reads and writes): four bytes per colour, red, green, blue and a zero pad byte, in the same order as
// COL.
/** @param {Plan} plan @returns {Uint8Array} */
export function encodeEdr(plan){return Uint8Array.from(colourList(plan).flatMap(([r,g,b])=>[r,g,b,0]));}
