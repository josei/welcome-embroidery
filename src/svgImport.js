// @ts-check
// SVG import: decides whether a filled <path> imports as fill objects (its counters become holes and islands) or stays an outline.
// The editor's SVG import calls this; the engine re-exports it.
import {insideRings} from './stitchRuns.js';

/** @typedef {import('./geom.js').Pt} Pt */
/** @typedef {{fill: boolean, note: string|null, holes: number, islands: number, depths: number[]}} SvgFill */

// SVG <path> fill rule. A path with a fill (not none) and no stroke imports as fill objects when its subpaths are closed rings and nest at most two levels: one outer ring (depth 0), holes inside it (depth 1, up to 20 of up to 200 points), and islands inside a hole (depth 2, each its own fill object, up to 1,000 points). Deeper nesting, or several outer rings, keeps the running-outline import and the note says why. Returns {fill, note, holes, islands, depths}: depths gives each subpath's depth, and holes and islands count the depth 1 and depth 2 rings.
/**
 * @param {string|null|undefined} fill
 * @param {string|null|undefined} stroke
 * @param {Pt[][]} subpaths
 * @returns {SvgFill}
 */
export function svgPathFill(fill,stroke,subpaths){const filled=fill!==null&&fill!==undefined&&fill!=='none',stroked=stroke!==null&&stroke!==undefined&&stroke!=='none';const none={fill:false,note:null,holes:0,islands:0,depths:[]};if(!filled||stroked)return none;
/** @type {(pts: Pt[]) => boolean} */
const closedRing=pts=>pts.length>=3&&Math.hypot(pts[0][0]-pts[pts.length-1][0],pts[0][1]-pts[pts.length-1][1])<1e-9;
/** @type {(text: string) => SvgFill} */
const outlineNote=(text)=>({...none,note:text});
if(!subpaths.every(closedRing))return outlineNote(subpaths.length===1?'A filled path that is not closed imports as an outline.':'A filled path with several subpaths, some not closed, imports as an outline.');
const rings=subpaths.map(r=>r.slice(0,-1));
const depths=rings.map((r,i)=>rings.reduce((n,q,j)=>n+(j!==i&&insideRings([q],r[0])?1:0),0));
if(depths.filter(d=>d===0).length!==1)return outlineNote('A filled path with several outer shapes imports as an outline: its counters would otherwise fill in.');
const holes=depths.filter(d=>d===1).length,islands=depths.filter(d=>d===2).length;
const deep=depths.some(d=>d>2);const tooBig=rings.some((r,i)=>(depths[i]===1&&r.length>200)||(depths[i]===2&&r.length>1000))||holes>20||islands>20;
if(deep||tooBig)return outlineNote('A filled path with counters nested deeper than an island in a hole, or too many points, imports as an outline.');
return {fill:true,note:null,holes,islands,depths};}
