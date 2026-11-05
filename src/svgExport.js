// @ts-check
import {geometry} from './engine.js';
import {hoopSize} from './hoops.js';

// Plain SVG for Inkscape and friends: millimetre units, origin at the hoop centre, one element per object (fills with even-odd
// holes, satin as a thick butt-capped stroke along the centreline, running stitches and lettering as thin strokes, imported
// machine stitches as per-colour polylines). It is a design interchange file, not a stitch plan.
/** @param {Record<string, any>} doc @returns {string} */
export function exportSvg(doc){
  const hs=hoopSize(doc);
  /** @type {(v: any) => number} */
  const f=v=>+Number(v).toFixed(3);
  /** @type {(t: any) => string} */
  const esc=t=>String(t).replace(/[&<>"]/g,c=>/** @type {Record<string, string>} */({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
  /** @type {(lines: number[][][], close?: boolean) => string} */
  const d=(lines,close=false)=>lines.map(l=>'M'+l.map(([x,y])=>`${f(x)} ${f(y)}`).join('L')+(close?'Z':'')).join('');
  const out=[];
  for(const o of doc.objects){if(o.visible===false)continue;const title=`<title>${esc(o.name||o.kind)}</title>`;
    if(o.kind==='stitch_layer'){const [x0,y0,x1,y1]=o.source.bounds,sx=o.w/Math.max(.1,x1-x0),sy=o.h/Math.max(.1,y1-y0),a=(Number(o.rotation)||0)*Math.PI/180,c=Math.cos(a),sn=Math.sin(a),cx=o.x+o.w/2,cy=o.y+o.h/2,paths=new Map();let prev=null;
      for(const st of o.stitches){const lx=(st.x-(x0+x1)/2)*sx,ly=(st.y-(y0+y1)/2)*sy,p=[cx+lx*c-ly*sn,cy+lx*sn+ly*c];if(st.cmd==='stitch'){const col=o.threadOverrides?.[st.thread]||o.threads[st.thread]?.color||o.thread;if(!paths.has(col))paths.set(col,'');paths.set(col,paths.get(col)+(prev?`M${f(prev[0])} ${f(prev[1])}L${f(p[0])} ${f(p[1])}`:`M${f(p[0])} ${f(p[1])}`));prev=p;}else prev=(st.cmd==='trim'||st.cmd==='end')?null:p;}
      out.push(`<g>${title}${[...paths].map(([col,dd])=>`<path d="${dd}" fill="none" stroke="${col}" stroke-width=".3" stroke-linecap="round"/>`).join('')}</g>`);continue;}
    const lines=geometry(o,0);if(!lines.length)continue;
    if(o.kind==='path'&&o.stitch==='satin')out.push(`<path d="${d([lines[0]])}" fill="none" stroke="${o.thread}" stroke-width="${f(o.satinWidth??3)}" stroke-linecap="butt" stroke-linejoin="round">${title}</path>`);
    else if(o.stitch==='fill'&&o.kind!=='text'&&(o.kind!=='path'||o.closed))out.push(`<path d="${d(lines,true)}" fill="${o.thread}" fill-rule="evenodd"${o.border?` stroke="${o.borderThread||o.thread}" stroke-width="${f(Math.max(.5,Number(o.borderWidth)||0))}"`:''}>${title}</path>`);
    else out.push(`<path d="${d(lines)}" fill="none" stroke="${o.thread}" stroke-width=".4" stroke-linecap="round" stroke-linejoin="round">${title}</path>`);}
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${f(hs.w)}mm" height="${f(hs.h)}mm" viewBox="${f(-hs.w/2)} ${f(-hs.h/2)} ${f(hs.w)} ${f(hs.h)}">\n<title>${esc(doc.name)}</title>\n${out.join('\n')}\n</svg>\n`;
}
