// @ts-check
// Print and interchange exports: a plain SVG of the design, a 1:1 print template of the hoop, and the appliqué pieces
// as cutting templates. The engine re-exports these functions, so callers keep importing them from engine.js.
import {geometry} from './outlines.js';
import {hoopSize} from './hoops.js';

/** @typedef {import('./geom.js').Pt} Pt */
/** @typedef {import('./transforms.js').Obj & {source?: {bounds: number[], format: string, defaultPlacement: object, originalBytesBase64?: string|null}, stitches?: Array<{x: number, y: number, cmd: string, thread: string}>, threadOverrides?: Record<string, string>, threads?: Record<string, {color?: string}>, borderWidth?: number}} Item */
/** @typedef {{objects: Item[], hoop: number, hoopH?: number, name?: string}} Design */

// Plain SVG for Inkscape and friends: millimetre units, origin at the hoop centre, one element per object (fills with even-odd
// holes, satin as a thick butt-capped stroke along the centreline, running stitches and lettering as thin strokes, imported
// machine stitches as per-colour polylines). It is a design interchange file, not a stitch plan.
/**
 * @param {Design} doc
 * @returns {string}
 */
export function exportSvg(doc){
  const hs=hoopSize(doc);
/** @type {(v: unknown) => number} */
const f=v=>+Number(v).toFixed(3);
/** @type {(t: unknown) => string} */
const esc=t=>String(t).replace(/[&<>"]/g,c=>/** @type {Record<string, string>} */({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
/** @type {(lines: Pt[][], close?: boolean) => string} */
const d=(lines,close=false)=>lines.map(l=>'M'+l.map(([x,y])=>`${f(x)} ${f(y)}`).join('L')+(close?'Z':'')).join('');
  const out=[];
  for(const o of doc.objects){if(o.visible===false)continue;const title=`<title>${esc(o.name||o.kind)}</title>`;
    if(o.kind==='stitch_layer'){const [x0,y0,x1,y1]=/** @type {NonNullable<Item['source']>} */(o.source).bounds,sx=o.w/Math.max(.1,x1-x0),sy=o.h/Math.max(.1,y1-y0),a=(Number(o.rotation)||0)*Math.PI/180,c=Math.cos(a),sn=Math.sin(a),cx=o.x+o.w/2,cy=o.y+o.h/2,paths=new Map();let prev=null;
      for(const st of /** @type {NonNullable<Item['stitches']>} */(o.stitches)){const lx=(st.x-(x0+x1)/2)*sx,ly=(st.y-(y0+y1)/2)*sy,p=[cx+lx*c-ly*sn,cy+lx*sn+ly*c];if(st.cmd==='stitch'){const col=o.threadOverrides?.[st.thread]||/** @type {NonNullable<Item['threads']>} */(o.threads)[st.thread]?.color||o.thread;if(!paths.has(col))paths.set(col,'');paths.set(col,paths.get(col)+(prev?`M${f(prev[0])} ${f(prev[1])}L${f(p[0])} ${f(p[1])}`:`M${f(p[0])} ${f(p[1])}`));prev=p;}else prev=(st.cmd==='trim'||st.cmd==='end')?null:p;}
      out.push(`<g>${title}${[...paths].map(([col,dd])=>`<path d="${dd}" fill="none" stroke="${col}" stroke-width=".3" stroke-linecap="round"/>`).join('')}</g>`);continue;}
    const lines=geometry(o,0);if(!lines.length)continue;
    if(o.kind==='path'&&o.stitch==='satin')out.push(`<path d="${d([lines[0]])}" fill="none" stroke="${o.thread}" stroke-width="${f(o.satinWidth??3)}" stroke-linecap="butt" stroke-linejoin="round">${title}</path>`);
    else if(o.stitch==='fill'&&o.kind!=='text'&&(o.kind!=='path'||o.closed))out.push(`<path d="${d(lines,true)}" fill="${o.thread}" fill-rule="evenodd"${o.border?` stroke="${o.borderThread||o.thread}" stroke-width="${f(Math.max(.5,Number(o.borderWidth)||0))}"`:''}>${title}</path>`);
    else out.push(`<path d="${d(lines)}" fill="none" stroke="${o.thread}" stroke-width=".4" stroke-linecap="round" stroke-linejoin="round">${title}</path>`);}
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${f(hs.w)}mm" height="${f(hs.h)}mm" viewBox="${f(-hs.w/2)} ${f(-hs.h/2)} ${f(hs.w)} ${f(hs.h)}">\n<title>${esc(doc.name)}</title>\n${out.join('\n')}\n</svg>\n`;
}

// Print template: a 1:1 placement sheet in millimetres (the sheet is the hoop, origin at its centre). Design outlines in green, the hoop dashed red, a centre cross, and a 10 mm scale bar to check the printer's scale before placing fabric.
/**
 * @param {Design} doc
 * @returns {string}
 */
export function exportPrintTemplate(doc){
  const {w,h}=hoopSize(doc);
/** @type {(v: unknown) => number} */
const f=v=>+Number(v).toFixed(3);
/** @type {(t: unknown) => string} */
const esc=t=>String(t).replace(/[&<>"]/g,c=>/** @type {Record<string, string>} */({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const x0=-w/2,y0=-h/2,ink='#2f5d4a';
/** @type {(lines: Pt[][]) => string} */
const d=lines=>lines.map(l=>'M'+l.map(([x,y])=>`${f(x)} ${f(y)}`).join('L')).join('');
  const out=[];
  for(const o of doc.objects){if(o.visible===false)continue;
    if(o.kind==='stitch_layer'){out.push(`<rect x="${f(o.x)}" y="${f(o.y)}" width="${f(o.w)}" height="${f(o.h)}" fill="none" stroke="${ink}" stroke-width="0.2"/>`);continue;}
    const lines=geometry(o,0);if(lines.length)out.push(`<path d="${d(lines)}" fill="none" stroke="${ink}" stroke-width="0.2" stroke-linejoin="round"/>`);}
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${f(w)}mm" height="${f(h)}mm" viewBox="${f(x0)} ${f(y0)} ${f(w)} ${f(h)}">`+
    `<title>${esc(doc.name||'Design')} print template</title>`+
    `<rect x="${f(x0)}" y="${f(y0)}" width="${f(w)}" height="${f(h)}" fill="none" stroke="#c0392b" stroke-width="0.3" stroke-dasharray="2 1"/>`+
    `<path d="M-5 0H5M0 -5V5" fill="none" stroke="#c0392b" stroke-width="0.2"/>`+
    out.join('')+
    `<path d="M${f(x0+5)} ${f(y0+h-5)}H${f(x0+15)}" fill="none" stroke="#000" stroke-width="0.3"/>`+
    `<text x="${f(x0+5)}" y="${f(y0+h-7)}" font-size="2.5" font-family="sans-serif">10 mm</text>`+
    // A check line for measuring the printout: 100 mm, or the hoop width less 10 mm when the hoop is narrower. Print at 100%; the line should measure exactly the length named on it.
    `<path d="M${f(x0+5)} ${f(y0+h-15)}H${f(x0+5+Math.min(100,w-10))}" fill="none" stroke="#000" stroke-width="0.3"/>`+
    `<text x="${f(x0+5)}" y="${f(y0+h-17)}" font-size="2.5" font-family="sans-serif">${f(Math.min(100,w-10))} mm check: measure this line</text>`+
    `<text x="${f(x0+3)}" y="${f(y0+4)}" font-size="2.5" font-family="sans-serif">${esc(doc.name||'Design')} · 1:1 placement sheet</text></svg>\n`;
}

// Appliqué templates: each appliqué piece's outline on its own, 1:1 in mm, stacked down one SVG sheet under its name and size, for cutting the fabric piece. A scale bar sits at the top. Throws when there is no appliqué piece.
/**
 * @param {Design} doc
 * @returns {string}
 */
export function exportAppliqueTemplates(doc){
  const pieces=doc.objects.filter(o=>o.applique&&o.visible!==false);
  if(!pieces.length)throw Error('No appliqué pieces to print. Make an appliqué from a group of closed shapes first.');
  /** @type {(v: unknown) => number} */
const f=v=>+Number(v).toFixed(3);
/** @type {(t: unknown) => string} */
const esc=t=>String(t).replace(/[&<>"]/g,c=>/** @type {Record<string, string>} */({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const margin=10,gap=12,ink='#000';
  const parts=[];let top=margin,W=0;
  for(const o of pieces){const lines=geometry(o,0).filter(l=>l.length>1);if(!lines.length)continue;
    const xs=lines.flat().map(p=>p[0]),ys=lines.flat().map(p=>p[1]),x0=xs.reduce((a,b)=>Math.min(a,b)),y0=ys.reduce((a,b)=>Math.min(a,b)),w=xs.reduce((a,b)=>Math.max(a,b))-x0,h=ys.reduce((a,b)=>Math.max(a,b))-y0;
    const dx=margin-x0,dy=top+6-y0,d=lines.map(l=>'M'+l.map(([x,y])=>`${f(x+dx)} ${f(y+dy)}`).join('L')).join('');
    parts.push(`<text x="${f(margin)}" y="${f(top+3.5)}" font-size="3" font-family="sans-serif">${esc(o.name||o.id)} · ${w.toFixed(1)} × ${h.toFixed(1)} mm</text>`+`<path d="${d}" fill="none" stroke="${ink}" stroke-width="0.2" stroke-linejoin="round"/>`);
    W=Math.max(W,w+2*margin,70);top+=h+6+gap;}
  if(!parts.length)throw Error('The appliqué pieces have no outline to print.');
  const H=top-gap+margin;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${f(W)}mm" height="${f(H)}mm" viewBox="0 0 ${f(W)} ${f(H)}">`+
    `<title>${esc(doc.name||'Design')} appliqué templates</title>`+
    `<path d="M${margin} 5H${margin+10}" fill="none" stroke="#000" stroke-width="0.3"/><text x="${margin+12}" y="6.5" font-size="2.5" font-family="sans-serif">10 mm</text>`+
    parts.join('')+'</svg>\n';
}
