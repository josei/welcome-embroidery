// @ts-check
// Documents: the starting document for a new design and the batch copies of a design (copies in a row, or one per name).
// The engine re-exports these functions, so callers keep importing them from engine.js.
import {validateDocument} from './validate.js';
import {objectBounds} from './transforms.js';

/** @typedef {import('./stitchRuns.js').Settings & {compensation?: number}} Settings */
/** @typedef {{design: number[], origin: number[], hoop: number[], cols: number, rows: number, perHoop: number, copies: number, hoopsNeeded: number|null,
 * gap: number}} BatchPlan */
/** @typedef {import('./transforms.js').Obj & Settings & {source?: {originalBytesBase64?: string|null, [key: string]: unknown}, clipId?: string, nameDrop?:
 * boolean, smooth?: boolean, cap?: string}} Item */
/** @typedef {import('./geom.js').Pt} Pt */
/** @typedef {{schema: string, name: string, revision: number, hoop: number, hoopH?: number, settings: Settings, objects: Item[], [key: string]: unknown}}
 * Doc */

/**
 * The document a new design starts from: a sample blossom with its stem, leaf and lettering.
 * @returns {Doc}
 */
export function initialDocument() {
  return {schema:'welcome/1',name:'Untitled design',revision:0,hoop:110,settings:{spacing:.4,angle:32,underlay:true,compensation:.2},objects:[
    // Six-petal blossom: a smooth Bézier rosette (not a flat ellipse) filled with tatami rows blended across a
    // three-colour palette (coral -> peach -> gold) for thread-painted shading, finished with a crisp satin-like border.
    {id:'flower',name:'Wildflower',kind:'path',closed:true,smooth:true,
      points:[[0,-28.8],[3.6,-22.24],[11.09,-22.4],[7.2,-16],[11.09,-9.6],[3.6,-9.76],[
        0,-3.2],[-3.6,-9.76],[-11.09,-9.6],[-7.2,-16],[-11.09,-22.4],[-3.6,-22.24]],
      handles:[{i:[-2.5,-28.8],o:[2.5,-28.8]},{i:[1.44,-23.48],o:[5.76,-20.99]},{i:[9.84,-24.56],o:[12.33,-20.24]},{i:[7.2,-18.5],o:[7.2,-13.5]},
        {i:[12.33,-11.76],o:[9.84,-7.44]},{i:[5.76,-11.01],o:[1.44,-8.52]},{i:[2.5,-3.2],o:[-2.5,-3.2]},{i:[-1.44,-8.52],o:[-5.76,-11.01]},
        {i:[-9.84,-7.44],o:[-12.33,-11.76]},{i:[-7.2,-13.5],o:[-7.2,-18.5]},{i:[-12.33,-20.24],o:[-9.84,-24.56]},{i:[-5.76,-20.99],o:[-1.44,-23.48]}],
      x:-11.09,y:-28.8,w:22.18,h:25.6,
      thread:'#d9897e',stitch:'fill',fillMethod:'rows',blendPalette:['#d9897e','#e5b089','#d3ad61'],blendAngle:-100,border:true,borderThread:'#b5614f'},
    // Spiral-stitched center with its own ring border, so the eye lands on a round swirl rather than a flat dot.
    {id:'center',name:'Flower center',kind:'ellipse',x:-4.2,y:-20.2,w:8.4,h:8.4,thread:'#d3ad61',stitch:'fill',fillMethod:'spiral',underlayType:'center',
      border:true,borderThread:'#9c7a3a'},
    // Curved satin stem tapering from a wider base to a fine tip at the blossom: real tapered rails, not a thin running line.
    {id:'stem',name:'Stem',kind:'path',closed:false,smooth:false,
      points:[[2,24],[-3,10],[1,-3]],
      handles:[{i:[3.67,28.67],o:[0.33,19.33]},{i:[-2.67,19],o:[-3.33,1]},{i:[-0.33,1.33],o:[2.33,-7.33]}],
      x:-3,y:-3,w:5,h:27,
      thread:'#89a377',stitch:'satin',satinWidth:2.4,satinWidthEnd:.8,cap:'round'},
    // Pointed lanceolate leaf (Bézier again, not an ellipse) with a contour fill that reads as natural venation, plus a border.
    {id:'leaf',name:'Leaf',kind:'path',closed:true,smooth:true,
      points:[[-7,5],[-10.6,-6.45],[-27.35,-7.72],[-21.45,1.86]],
      handles:[{i:[-9.44,3.47],o:[-4.56,6.53]},{i:[-3.88,-2.25],o:[-17.32,-10.65]},{i:[-24.5,-5.94],o:[-30.2,-9.5]},{i:[-28.17,-2.34],o:[-14.73,6.06]}],
      x:-27.35,y:-7.72,w:20.35,h:12.72,
      thread:'#527461',stitch:'fill',fillMethod:'contour',border:true,borderThread:'#38503f'},
    // Cursive wordmark in a bundled script font (filled, not a mono running line), so the lettering reads as sewn calligraphy.
    {id:'letters',name:'Text',kind:'text',text:'Bloom',x:-13.45,y:33,w:26.9,h:11,thread:'#527461',stitch:'fill',fillMethod:'rows',font:'ttf/greatvibes'}
  ]};
}

// Batch plan: how many copies of the whole design fit in one hoop, with a gap between copies, and how many hoops N copies need.
/**
 * @param {Doc} doc
 * @param {{copies?: number, gap?: number}} [options]
 * @returns {BatchPlan|null}
 */
export function batchPlan(doc,{copies=1,gap=3}={}){if(!doc.objects.length)return null;const boxes=doc.objects.map(objectBounds),x0=
  Math.min(...boxes.map(b=>b[0])),y0=Math.min(...boxes.map(b=>b[1])),x1=Math.max(...boxes.map(b=>b[2])),y1=Math.max(...boxes.map(b=>b[3])),hoopW=doc.hoop,hoopH=
  doc.hoopH??doc.hoop,cols=Math.floor((hoopW+gap)/(x1-x0+gap)),rows=Math.floor((hoopH+gap)/(y1-y0+gap)),perHoop=Math.max(0,cols*rows);
  return {design:[x1-x0,y1-y0],origin:[x0,y0],hoop:[hoopW,hoopH],cols,rows,perHoop,copies,hoopsNeeded:perHoop?Math.ceil(copies/perHoop):null,gap};}

// One document per hoop: copies laid out in the batch grid, centred on the hoop.
/**
 * @param {Doc} doc
 * @param {{copies?: number, gap?: number, names?: string[]|null}} [options]
 * @returns {Doc[]}
 */
export function batchDocuments(doc,{copies=1,gap=3,names=null}={}){
  // Name drop writes each name into the lettering marked nameDrop; with none marked, into the first lettering object.
const marked=doc.objects.filter(o=>o.kind==='text'&&o.nameDrop===true),targets=
  new Set((marked.length?marked:doc.objects.filter(o=>o.kind==='text').slice(0,1)).map(o=>o.id));
  if(names&&!targets.size)throw Error('Name drop needs a text object in the design.');if(names)copies=names.length;const p=batchPlan(doc,{copies,gap});
  if(!p||!p.perHoop)return [];const [dw,dh]=p.design,cw=dw+gap,ch=dh+gap,gridW=p.cols*cw-gap,gridH=Math.ceil(p.perHoop/p.cols)*ch-gap,docs=[];
  for(let start=0;start<copies;start+=p.perHoop){const n=Math.min(p.perHoop,copies-start),d={...structuredClone(doc),objects:/** @type {Item[]} */([])};
  for(let k=0;k<n;k++){const col=k%p.cols,row=Math.floor(k/p.cols),dx=-gridW/2+col*cw-p.origin[0],dy=-gridH/2+row*ch-p.origin[1],tag=`${start+k+1}`;
  for(const o of doc.objects){const c=structuredClone(o);c.id=`${o.id}-${tag}`;if(names&&targets.has(o.id))c.text=names[start+k];
  if(c.kind==='stitch_layer')c.source={...c.source,originalBytesBase64:null};if(c.clipId)c.clipId=`${c.clipId}-${tag}`;c.x+=dx;c.y+=dy;
/** @type {(p: Pt) => Pt} */ const sh=([x,y])=>[x+dx,y+dy];if(c.points)c.points=c.points.map(sh);if(c.handles)c.handles=
  c.handles.map(h=>h?{i:sh(h.i),o:sh(h.o)}:null);if(c.holes)c.holes=c.holes.map(hl=>hl.map(sh));d.objects.push(c);}}validateDocument(d);docs.push(d);
  }return docs;}
