// @ts-check
// Sewing order, thread blocks and sewing time, read from a compiled plan. The engine re-exports these functions.

/**
 * @typedef {{x: number, y: number, cmd: string, thread: string}} PlanStitch
 * @typedef {{thread: string, stitches: number, mm: number, trims: number, changed: boolean}} Block
 * @typedef {{thread: string, start: number, end: number, stitches: number}} Span
 */

// Thread plan: the colours in sewing order. A block starts at the first stitch after a colour change or stop, so the same colour sewn twice gives two blocks, as the editor shows it.
// Thread blocks in sewing order. `mm` is the thread sewn in the block: the distance between consecutive stitches, so a jump or trim between two stitches adds nothing.
/**
 * @param {{stitches: PlanStitch[]}} plan
 * @returns {Block[]}
 */
export function threadPlan(plan){
  /** @type {Block[]} */ const blocks=[];
  /** @type {Block|null} */ let cur=null;
  /** @type {PlanStitch|null} */ let prev=null;let changed=false;for(const s of plan.stitches){if(s.cmd==='color'||s.cmd==='stop'){cur=null;prev=null;changed=true;continue;}if(s.cmd==='trim'&&cur)cur.trims++;if(s.cmd!=='stitch'){prev=null;continue;}if(!cur||cur.thread.toLowerCase()!==String(s.thread).toLowerCase()){cur={thread:s.thread,stitches:0,mm:0,trims:0,changed};blocks.push(cur);changed=false;prev=null;}cur.stitches++;if(prev)cur.mm+=Math.hypot(s.x-prev.x,s.y-prev.y);prev=s;}return blocks;}
// Sewing time for one thread block: its stitches at 600 a minute, 8 s per trim cut inside it, and 20 s for the colour change or stop that starts it (none for the first block). An estimate: jumps between blocks are not counted here, so the blocks add up to a little less than the total.
/** @param {{stitches: number, trims?: number, changed?: boolean}} b @returns {number} */
export function blockSeconds(b){return b.stitches/600*60+(b.trims||0)*8+(b.changed?20:0);}
/** @param {number} sec @returns {string} */
export function blockTimeLabel(sec){const s=Math.round(sec);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}
// Sewing time in seconds: 600 stitches a minute, 20 s per colour change or stop, 8 s per trim.
/** @param {{count: number, stitches: {cmd: string}[]}} plan @returns {number} */
export function sewingSeconds(plan){return plan.count/600*60+plan.stitches.filter(s=>s.cmd==='color'||s.cmd==='stop').length*20+plan.stitches.filter(s=>s.cmd==='trim').length*8;}
// The thread blocks of a plan as ranges of its command list: the same blocks threadPlan makes, with start and end as indexes into
// plan.stitches. The simulation bar draws them as its track, and its seek position is an index into the same list.
/** @param {{stitches: PlanStitch[]}} plan @returns {Span[]} */
export function threadSpans(plan){
 /** @type {Span[]} */ const spans=[];
 /** @type {Span|null} */ let cur=null;
 plan.stitches.forEach((s,i)=>{
  if(s.cmd==='color'||s.cmd==='stop'){cur=null;return;}
  if(s.cmd!=='stitch')return;
  if(!cur||cur.thread.toLowerCase()!==String(s.thread).toLowerCase()){
   if(spans.length)spans[spans.length-1].end=i;
   cur={thread:s.thread,start:spans.length?i:0,end:plan.stitches.length,stitches:0};
   spans.push(cur);
  }
  cur.stitches++;
 });
 return spans;
}
// Sewing seconds up to an index into plan.stitches, at the same rates as sewingSeconds: the time elapsed at a seek position.
/** @param {{stitches: {cmd: string}[]}} plan @param {number} index @returns {number} */
export function sewingSecondsUpTo(plan,index){
 let stitches=0,events=0,trims=0;
 for(let i=0,end=Math.min(index,plan.stitches.length);i<end;i++){const c=plan.stitches[i].cmd;if(c==='stitch')stitches++;else if(c==='color'||c==='stop')events++;else if(c==='trim')trims++;}
 return stitches/600*60+events*20+trims*8;
}
/** @type {(sec: number) => string} */
export const sewingLabel=sec=>{const m=Math.max(1,Math.round(sec/60));return m>=60?`${Math.floor(m/60)} h ${m%60} min`:`${m} min`;};
