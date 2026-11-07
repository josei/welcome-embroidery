// @ts-check
// Design checks: plain-language sewing advice for a design, with the fixes that clear each problem. The engine re-exports
// designWarnings and shapeArea, so callers keep importing them from engine.js.
import {geometry} from './outlines.js';
import {objectBounds} from './transforms.js';
import {pathOutline,distP} from './pathGeometry.js';
import {isRegistryFont,getFont} from './fonts.js';
import {FABRIC_PROFILES} from './fabrics.js';

/** @typedef {import('./transforms.js').Obj & {mask?: boolean, photo?: boolean}} Item */
/** @typedef {{op: string, ids?: string[], id?: string, dx?: number, dy?: number, stitch?: string, satinWidth?: number}} Fix */
/** @typedef {{id: string, name: string, message: string, category: string, fix?: Fix[]}} Warning */
/** @typedef {{objects: Item[], hoop: number, hoopH?: number, settings?: {fabric?: string}}} Design */

/**
 * The area of one closed ring (shoelace formula).
 * @type {(r: Array<[number, number]>) => number}
 */
// ---- stitch planning per object: underlay, auto-fill, satin ---------------------------------------------------
export const ringArea=r=>{let a=0;for(let i=1;i<r.length;i++)a+=r[i-1][0]*r[i][1]-r[i][0]*r[i-1][1];return Math.abs(a/2);};

/**
 * @param {Array<Array<[number, number]>>} rings
 * @returns {number}
 */
export function shapeArea(rings){const as=rings.map(ringArea).sort((a,b)=>b-a);return Math.max(0,as[0]-as.slice(1).reduce((n,v)=>n+v,0));}

// Plain-language sewing advice for a design, so an agent (or a person) hears about likely problems before sewing. Thresholds follow common embroidery practice.
/**
 * @param {Design} doc
 * @returns {Warning[]}
 */
export function designWarnings(doc){
  // A warning may carry a fix: the edit operations that clear it, applied as one undo step. Only the unambiguous cases have one.
  /** @type {Warning[]} */ const out=[];
  const hoopW=doc.hoop,hoopH=doc.hoopH??doc.hoop,seen=new Map();
  /** @type {(o: Item, message: string, category: string, fix?: Fix[]) => void} */
  const w=(o,message,category,fix)=>{out.push({id:o.id,name:o.name||o.kind,message,category,...(fix?{fix}:{})});};
  for(const o of doc.objects){
    if(o.visible===false||o.mask||o.kind==='stitch_layer')continue;/** @type {number[]} */ let b;try{b=objectBounds(o);}catch{continue;}const bw=b[2]-b[0],
      bh=b[3]-b[1],label=o.name||o.id;
    if(b[0]<-hoopW/2||b[1]<-hoopH/2||b[2]>hoopW/2||b[3]>hoopH/2){
      // The fix moves the object inside the hoop, when it is no bigger than the hoop.
      const fits=bw<=hoopW&&bh<=hoopH,dx=b[0]<-hoopW/2?-hoopW/2-b[0]:b[2]>hoopW/2?hoopW/2-b[2]:0,dy=b[1]<-hoopH/2?-hoopH/2-b[1]:b[3]>hoopH/2?hoopH/2-b[3]:0;
      w(o,`${label} reaches outside the ${hoopW}×${hoopH} mm hoop.`,'hoop',fits?[{op:'translate',ids:[o.id],dx:+dx.toFixed(3),dy:+dy.toFixed(3)}]:undefined);
    }
    const key=[o.kind,o.stitch,o.thread,Math.round(b[0]),Math.round(b[1]),Math.round(b[2]),Math.round(b[3])].join('|');
      if(seen.has(key))w(o,`${label} is a duplicate of ${seen.get(key)}: it would be sewn twice. Delete one.`,'duplicate',[{op:'delete',id:o.id}]);
      else seen.set(key,label);
    const filled=o.stitch==='fill'&&o.kind!=='text'&&(o.kind!=='path'||o.closed);
    if(filled&&!o.photo){const lines=geometry(o,0).filter(l=>l.length>=4);
      if(lines.length){const area=shapeArea(lines),per=lines.reduce((n,r)=>n+r.reduce((m,p,i)=>i?m+distP(p,r[i-1]):m,0),0),mean=per?2*area/per:0;
      if(Math.min(bw,bh)<2||area<6)w(
        o,`${label} is ${bw.toFixed(1)}×${bh.toFixed(1)} mm, too small for a clean fill. Make it at least about 2 mm across, or use a satin column ` +
        `or running stitch.`,
        'fill',[{op:'set_object',id:o.id,stitch:'run'}]);
      else if(Math.min(bw,bh)<4.5||area<25)w(
        o,`${label} is a small fill (${bw.toFixed(1)}×${bh.toFixed(1)} mm): it will sew, but the rows are very short and can look dense or rough. A ` +
        `satin stitch or a slightly larger shape usually sews cleaner.`,
        'fill');
      else if(mean<1.4)w(o,`${label} is mostly narrower than 1.4 mm, so a fill will skip or look thin. Use a satin column along its centre line.`,'fill');}}
    if(o.kind==='path'&&!filled){const len=pathOutline(/** @type {import('./pathGeometry.js').PathLike} */(o)).reduce((n,p,i,a)=>i?n+distP(p,a[i-1]):0,0);
      if(len<2)w(o,`${label} is only ${len.toFixed(1)} mm long; stitches this short are skipped or bunch up.`,'short');
      if(o.stitch==='satin'){const wd=Math.max(Number(o.satinWidth)||3,Number(o.satinWidthEnd)||0);
        if((Number(o.satinWidth)||3)<1)w(
        o,`${label} is a satin column under 1 mm wide, which is hard to sew cleanly. Use a running stitch, or widen it to at least 1.5 mm.`,
        'satin',[{op:'set_object',id:o.id,satinWidth:1.5}]);
        if(wd>7)w(o,`${label} is a satin column wider than 7 mm; long satin stitches snag. Use a fill, or split it into narrower columns.`,'satin');}}
    if(o.kind==='text'&&Number(o.h)<5&&isRegistryFont(o.font)&&getFont(o.font)?.kind!=='line')w(
      o,`${label} is only ${Number(o.h).toFixed(1)} mm tall; lettering under about 5 mm rarely sews cleanly in a satin or fill font.`,'lettering');
  }
  const fabric=doc.settings?.fabric,profile=fabric&&fabric!=='woven'?FABRIC_PROFILES[fabric]:null,first=profile&&
    doc.objects.find(o=>o.visible!==false&&!o.mask&&o.kind!=='stitch_layer');
  if(first)out.push({id:first.id,name:first.name||first.kind,message:`Stabilizer for ${profile.label}: ${profile.stabilizer}`,category:'fabric'});
  return out;
}

// The sewing tip categories, in the order the Tips settings list shows them. Each warning from designWarnings carries one of these ids.
/** @type {Array<{id: string, label: string}>} */
export const TIP_CATEGORIES=[{id:'hoop',label:'Outside the hoop'},{id:'duplicate',label:'Duplicate objects'},{id:'fill',label:'Small or thin fills'},
  {id:'short',label:'Very short paths'},{id:'satin',label:'Satin columns too narrow or too wide'},{id:'lettering',label:'Small lettering'},
  {id:'fabric',label:'Fabric stabilizer'}];
// Drops the tips whose category is hidden. A hidden id that is not a category matches nothing, so it is ignored.
/**
 * @param {Warning[]} warnings
 * @param {string[]} [hidden]
 * @returns {Warning[]}
 */
export function visibleTips(warnings,hidden=[]){const off=new Set(hidden);return warnings.filter(w=>!off.has(w.category));}
