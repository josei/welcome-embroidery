// @ts-check
// Overlay drawing for the canvas: the measure and knife lines, ruler guides, the smart-snap lines and the fill-angle handle.
// Each draws into the overlay or guide layer it is given, at the scale it is given.
import {lang,t} from './i18n.js';
import {formatNumber} from './decimalText.js';
import {el} from './canvasGeometry.js';

// The measure tool's line and its two points, drawn in mm over the design.
export function drawMeasureLine(/** @type {any} */ overlay,/** @type {any} */ m,/** @type {number} */ scale){if(!m)return;const k=1/scale;
  if(m.b)overlay.append(el('line',{class:'measure-line',x1:m.a[0],y1:m.a[1],x2:m.b[0],y2:m.b[1]}));
  for(const p of m.b?[m.a,m.b]:[m.a])overlay.append(el('circle',{class:'measure-point',cx:p[0],cy:p[1],r:3*k}));}
// The knife tool's points, joined by lines, until Enter cuts the shape along them.
export function drawKnifeLine(/** @type {any} */ overlay,/** @type {any} */ k,/** @type {number} */ scale){
if(!k?.length)return;
if(k.length>1)overlay.append(el('polyline',{class:'measure-line',fill:'none',points:k.map((/** @type {any} */ p)=>p.join(',')).join(' ')}));
for(const p of k)overlay.append(el('circle',{class:'measure-point',cx:p[0],cy:p[1],r:3/scale}));
}
export function drawGuideLines(/** @type {any} */ guidesLayer,/** @type {any} */ d){
  if(!guidesLayer)return;guidesLayer.replaceChildren();const big=1e5;
  (d.guides||[]).forEach((/** @type {any} */ g,/** @type {any} */ i)=>
    {const x=g.axis==='x';const line=el('line',{class:'guide','data-guide':i,x1:x?g.pos:-big,x2:x?g.pos:big,y1:x?-big:g.pos,y2:x?big:g.pos});
    guidesLayer.append(line);
    guidesLayer.append(
    el('line',
    {class:'guide-hit','data-guide':i,x1:line.getAttribute('x1'),x2:line.getAttribute('x2'),y1:line.getAttribute('y1'),y2:line.getAttribute('y2')}));});
}
export function drawSmartLines(/** @type {any} */ overlay,/** @type {any[]} */ smartLines){overlay.querySelectorAll('.smart').forEach((/** @type {any} */ n)=>n.remove());
const big=1e5;
for(const l of smartLines)overlay.append(
  el('line',{class:'smart',x1:l.axis==='x'?l.pos:-big,x2:l.axis==='x'?l.pos:big,y1:l.axis==='x'?-big:l.pos,y2:l.axis==='x'?big:l.pos}));
}
// Draws the angle handle and its line at an angle (degrees) from the object's centre.
export function drawAngleHandle(/** @type {any} */ overlay,/** @type {any} */ spot,/** @type {any} */ deg,/** @type {string|null} */ label,/** @type {number} */ scale){
  const k=1/scale,rad=deg*Math.PI/180,r=spot.dist+18*k,hp=[spot.c[0]+r*Math.cos(rad),spot.c[1]+r*Math.sin(rad)];
  overlay.append(el('line',{class:'sel-stem sel-angle-line',x1:spot.c[0],y1:spot.c[1],x2:hp[0],y2:hp[1]}));
  overlay.append(el('circle',{class:'sel-hit','data-hit':'angle',cx:hp[0],cy:hp[1],r:22*k}));
  overlay.append(el('circle',{
    class:'sel-angle','data-handle':'angle',tabindex:0,role:'button',
    'aria-label':t('Fill angle {deg}°. Drag or use the arrow keys to turn the rows.',{deg:formatNumber(deg, lang, 0)}),
    cx:hp[0],cy:hp[1],r:4*k,
  }));
  if(label){const t=el('text',{class:'sel-note',x:hp[0],y:hp[1]-9*k,'text-anchor':'middle','font-size':11*k});t.textContent=label;overlay.append(t);}
}
