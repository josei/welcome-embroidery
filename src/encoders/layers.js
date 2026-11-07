// @ts-check
// Checks that an imported stitch layer still matches the source bytes kept with it.

/** @typedef {import('../encoders.js').PlanStitch} PlanStitch */

/**
 * @param {{kind: string, x: number, y: number, w: number, h: number, rotation?: number, thread?: string, threadOverrides: object, source: {format: string,
  * originalBytesBase64?: string|null, defaultThread: string, defaultPlacement: {x: number, y: number, w: number, h: number}}}} o
 * @param {string} format
 * @returns {boolean}
 */
export function layerCanPassThrough(o,format){const p=o.source.defaultPlacement;
  return Boolean(o.kind==='stitch_layer'&&o.source.format===format&&o.source.originalBytesBase64&&o.x===p.x&&o.y===p.y&&o.w===p.w&&o.h===p.h&&(o.rotation||0)===
  0&&o.thread===o.source.defaultThread&&Object.keys(o.threadOverrides).length===0);}
/**
 * @param {{bounds: number[], threads: unknown, stitches: Array<{x: number, y: number, cmd: string, thread: unknown}>}} decoded
 * @param {{source: {bounds: number[]}, threads: unknown, stitches: Array<{x: number, y: number, cmd: string, thread: unknown}>}} o
 * @returns {boolean}
 */
export function sourceMatches(decoded,o){
  if(JSON.stringify(decoded.bounds)!==JSON.stringify(o.source.bounds)||JSON.stringify(decoded.threads)!==JSON.stringify(o.threads)||decoded.stitches.length!==
  o.stitches.length)return false;
  for(let i=0;i<decoded.stitches.length;i++){const a=decoded.stitches[i],b=o.stitches[i];
  if(a.x!==b.x||a.y!==b.y||a.cmd!==b.cmd||a.thread!==b.thread)return false;}return true;}
/** @param {PlanStitch[]} stitches @returns {boolean} */
export function vp3LayerHasUnsupportedTravel(stitches){
  for(let i=0;i<stitches.length;i++){const p=stitches[i],prev=stitches[i-1],next=stitches[i+1];if(p.cmd==='trim'||p.cmd==='stop')return true;
  if(p.cmd==='jump'){const blockOrigin=i===0||prev?.cmd==='color'||next?.cmd==='color',noOp=prev&&p.x===prev.x&&p.y===prev.y;if(!blockOrigin&&!noOp)return true;
  }}return false;}
