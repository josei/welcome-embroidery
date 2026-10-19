// Builds the header wordmark as an inline SVG path from a bundled open font (Pacifico, OFL), so the logo needs no webfont.
// usage: node scripts/make-logo.mjs [text] [font-id]   -> prints the <svg> element used in index.html
import fs from 'node:fs';
import {rdp} from '../src/geom.js';
const text=process.argv[2]||'welcome',fid=process.argv[3]||'pacifico';
const font=JSON.parse(fs.readFileSync(new URL(`../fonts/ttf/${fid}.json`,import.meta.url),'utf8'));
let x=0,d='';const rnd=v=>+v.toFixed(1);
for(const ch of text){const g=font.glyphs[ch];if(!g)continue;
 for(const [t,rings] of g.p){if(t!=='f')continue;for(const flat of rings){let pts=[];for(let i=0;i<flat.length;i+=2)pts.push([flat[i]+x,flat[i+1]]);pts=rdp(pts,3);d+='M';pts.forEach((q,i)=>{d+=(i?'L':'')+Math.round(q[0])+' '+Math.round(q[1]);});d+='Z';}}
 x+=g.a;}
// bounding box from the path numbers
const nums=[...d.matchAll(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g)].map(m=>[+m[1],+m[2]]),minX=Math.min(...nums.map(p=>p[0])),maxX=Math.max(...nums.map(p=>p[0])),minY=Math.min(...nums.map(p=>p[1])),maxY=Math.max(...nums.map(p=>p[1]));
const w=maxX-minX,h=maxY-minY;
console.log(`<svg class="logo-mark" viewBox="${rnd(minX)} ${rnd(minY)} ${rnd(w)} ${rnd(h)}" width="${rnd(26*w/h*1.0)}" height="26" role="img" aria-label="Welcome"><path fill-rule="evenodd" d="${d}"/></svg>`);
