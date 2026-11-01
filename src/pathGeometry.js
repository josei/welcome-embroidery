// @ts-check
// Path outlines and satin rails: the curve a path sews along (straight, Bezier or smooth spline), the rails of a satin column drawn
// along it, and the satin zigzag. The engine re-exports the names it uses, so callers keep importing them from engine.js.

/** @typedef {import('./geom.js').Pt} Pt */
/**
 * @typedef {{points: Pt[], handles?: Array<{i?: Pt, o?: Pt}|null>, closed?: boolean, smooth?: boolean, satinWidth?: number, satinWidthEnd?: number, widthStops?: Array<[number, number]>, join?: string, cap?: string}} PathLike
 * @typedef {{a: Pt[], b: Pt[], rungs: Array<[Pt, Pt]>}} Rails
 */

/**
 * The last item of a non-empty list.
 * @template T
 * @param {T[]} list
 * @returns {T}
 */
const last=list=>/** @type {T} */(list.at(-1));

// Centripetal-free uniform Catmull-Rom through every node, sampled per segment.
/**
 * @param {Pt[]} pts
 * @param {boolean} closed
 * @returns {Pt[]}
 */
function splinePoints(pts,closed){
  /** @type {Pt[]} */ const out=[];
  const n=pts.length,segments=closed?n:n-1;
  /** @type {(i: number) => Pt} */
  const at=i=>closed?pts[((i%n)+n)%n]:pts[Math.max(0,Math.min(n-1,i))];
  for(let i=0;i<segments;i++){const p0=at(i-1),p1=at(i),p2=at(i+1),p3=at(i+2),steps=Math.max(4,Math.min(24,Math.ceil(Math.hypot(p2[0]-p1[0],p2[1]-p1[1])/1.5)));for(let k=0;k<steps;k++){const t=k/steps,t2=t*t,t3=t2*t;out.push(/** @type {Pt} */([0,1].map(a=>.5*((2*p1[a])+(-p0[a]+p2[a])*t+(2*p0[a]-5*p1[a]+4*p2[a]-p3[a])*t2+(-p0[a]+3*p1[a]-3*p2[a]+p3[a])*t3)))); }}
  out.push(closed?out[0]:[...pts[n-1]]);return out;
}

/**
 * @param {PathLike} o
 * @returns {Pt[]}
 */
function bezierOutline(o){
  /** @type {Pt[]} */ const pts=o.points.map(p=>/** @type {Pt} */([Number(p[0]),Number(p[1])]));
  const n=pts.length,segments=o.closed?n:n-1;
  /** @type {Pt[]} */ const out=[[...pts[0]]];
  for(let i=0;i<segments;i++){const j=(i+1)%n,p0=pts[i],p3=pts[j],p1=o.handles?.[i]?.o||p0,p2=o.handles?.[j]?.i||p3,steps=Math.max(4,Math.min(32,Math.ceil((Math.hypot(p1[0]-p0[0],p1[1]-p0[1])+Math.hypot(p2[0]-p1[0],p2[1]-p1[1])+Math.hypot(p3[0]-p2[0],p3[1]-p2[1]))/1.5)));
    for(let k=1;k<=steps;k++){const t=k/steps,u=1-t;out.push(/** @type {Pt} */([0,1].map(a=>u*u*u*p0[a]+3*u*u*t*p1[a]+3*u*t*t*p2[a]+t*t*t*p3[a])));}}
  return out;
}

/**
 * @param {PathLike} o
 * @returns {boolean}
 */
function hasHandles(o){return Array.isArray(o.handles)&&o.handles.some(Boolean);}

/**
 * @param {PathLike} o
 * @returns {Pt[]}
 */
export function pathOutline(o){if(hasHandles(o)&&o.points.length>=2)return bezierOutline(o);/** @type {Pt[]} */ const pts=o.points.map(p=>/** @type {Pt} */([Number(p[0]),Number(p[1])]));if(o.smooth&&pts.length>=3)return splinePoints(pts,Boolean(o.closed));return o.closed?[...pts,pts[0]]:pts;}

/**
 * @param {PathLike} o
 * @param {number} spacing
 * @param {number} comp
 * @returns {Pt[]}
 */
function satinZigzag(o,spacing,comp){
  // Satin column: needles alternate between the two rails (centerline offset by half the width plus pull compensation), one crossing every `spacing` mm along the path.
  const line=pathOutline(o),half=Math.max(.25,(Number(o.satinWidth)||3)/2+comp);
  /** @type {number[]} */ const cum=[0];
  for(let i=1;i<line.length;i++)cum.push(cum[i-1]+Math.hypot(line[i][0]-line[i-1][0],line[i][1]-line[i-1][1]));
  const total=last(cum);if(total<.2)return [];
  /** @type {(t: number) => Pt} */
  const at=t=>{t=Math.max(0,Math.min(total,t));let i=1;while(i<cum.length-1&&cum[i]<t)i++;const seg=cum[i]-cum[i-1]||1,f=(t-cum[i-1])/seg;return [line[i-1][0]+(line[i][0]-line[i-1][0])*f,line[i-1][1]+(line[i][1]-line[i-1][1])*f];};
  const n=Math.max(1,Math.ceil(total/spacing));
  /** @type {Pt[]} */ const out=[];
  for(let k=0;k<=n;k++){const t=Math.min(total,k*total/n),a=at(t-Math.min(.3,spacing/2)),b=at(t+Math.min(.3,spacing/2)),tx=b[0]-a[0],ty=b[1]-a[1],tl=Math.hypot(tx,ty)||1,side=k%2?-1:1,p=at(t);out.push([p[0]-ty/tl*half*side,p[1]+tx/tl*half*side]);}
  return out;
}

// ---- stitch planning per object: underlay, auto-fill, satin ---------------------------------------------------
/** @type {(a: Pt, b: Pt) => number} */
export const distP=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

// Rails of a satin column drawn as a centre line with a width.
// Rails of a satin column drawn along a line. `halfAt(t)` is the half width at fraction t (0..1) of the length, so columns can taper or follow a width profile.
// Corners get a join (round, miter or bevel) and open ends a cap (butt, round or square). The pairs that matter at corners and caps are returned as rungs so
// the needles fan around the inner corner instead of being paired by length.
/**
 * @param {Pt[]} line
 * @param {(t: number) => number} halfAt
 * @param {{join?: string, cap?: string, capStart?: string, capEnd?: string, closed?: boolean}} [opt]
 * @returns {Rails|null}
 */
export function railsFromLine(line,halfAt,opt={}){
  const join=opt.join||'round',capS=opt.capStart||opt.cap||'butt',capE=opt.capEnd||opt.cap||'butt',closed=Boolean(opt.closed);
  /** @type {Pt[]} */ const pts=[];
  for(const p of line)if(!pts.length||distP(p,last(pts))>1e-6)pts.push([p[0],p[1]]);
  if(closed&&pts.length>2&&distP(pts[0],last(pts))<1e-6)pts.pop();
  const n=pts.length;if(n<2)return null;
  const segs=closed?n:n-1;
  /** @type {Pt[]} */ const dirs=[];
  /** @type {number[]} */ const lens=[];
  /** @type {number[]} */ const cum=[0];
  for(let i=0;i<segs;i++){const a=pts[i],b=pts[(i+1)%n],l=distP(a,b);lens.push(l);dirs.push([(b[0]-a[0])/l,(b[1]-a[1])/l]);cum.push(cum[i]+l);}
  const total=cum[segs];if(total<.2)return null;
  /** @type {Pt[]} */ const A=[];
  /** @type {Pt[]} */ const B=[];
  /** @type {Array<[Pt, Pt]>} */ const rungs=[];
  /** @type {(d: Pt) => Pt} */
  const left=d=>[-d[1],d[0]];
  /** @type {(s: number) => number} */
  const hw=s=>Math.max(.25,halfAt(Math.min(1,Math.max(0,s/total))));
  /** @type {(pa: Pt, pb: Pt, rung?: boolean) => void} */
  const emit=(pa,pb,rung=false)=>{A.push(pa);B.push(pb);if(rung)rungs.push([pa,pb]);};
  /** @type {(P: Pt, d: Pt, h: number) => [Pt, Pt]} */
  const off=(P,d,h)=>{const nrm=left(d);return [[P[0]+nrm[0]*h,P[1]+nrm[1]*h],[P[0]-nrm[0]*h,P[1]-nrm[1]*h]];};
  /** @type {(P: Pt, d: Pt, h: number, kind: string, atStart: boolean) => void} */
  const cap=(P,d,h,kind,atStart)=>{ // pairs beyond the end point, ordered along the rails
    if(kind==='butt'){const [pa,pb]=off(P,d,h);emit(pa,pb,true);return;}
    const m=Math.max(2,Math.ceil(h/.3));
    /** @type {Array<[Pt, Pt]>} */ const out=[];
    for(let k=0;k<=m;k++){const x=h*(1-k/m),w=kind==='round'?h*Math.sqrt(Math.max(0,1-(x/h)**2)):h,c=/** @type {Pt} */([P[0]+(atStart?-1:1)*d[0]*x,P[1]+(atStart?-1:1)*d[1]*x]),[pa,pb]=off(c,d,w);out.push([pa,pb]);}
    if(atStart){out.forEach(([pa,pb],k)=>emit(pa,pb,k===0||k===out.length-1));}
    else{out.reverse().forEach(([pa,pb],k)=>emit(pa,pb,k===0||k===out.length-1));}
  };
  /** @type {(P: Pt, dp: Pt, dn: Pt, s: number, minLen: number) => void} */
  const corner=(P,dp,dn,s,minLen)=>{
    const h=hw(s),cross=dp[0]*dn[1]-dp[1]*dn[0],dot=dp[0]*dn[0]+dp[1]*dn[1],ang=Math.atan2(cross,dot),np=left(dp),nn=left(dn);
    let mx=np[0]+nn[0],my=np[1]+nn[1];const ml=Math.hypot(mx,my);
    if(Math.abs(ang)<.3||ml<1e-6){if(ml<1e-6){const [pa,pb]=off(P,dn,h);emit(pa,pb);return;}mx/=ml;my/=ml;const k=h/Math.cos(ang/2);emit([P[0]+mx*k,P[1]+my*k],[P[0]-mx*k,P[1]-my*k]);return;}
    mx/=ml;my/=ml;
    const so=cross>0?-1:1,innerD=Math.min(h/Math.cos(ang/2),Math.max(.2,minLen*.9)+h),inner=/** @type {Pt} */([P[0]-so*mx*innerD,P[1]-so*my*innerD]);
    /** @type {(outer: Pt, rung: boolean) => void} */
    const pair=(outer,rung)=>{if(cross>0)emit(inner,outer,rung);else emit(outer,inner,rung);};
    const o0=/** @type {Pt} */([P[0]+so*np[0]*h,P[1]+so*np[1]*h]),o1=/** @type {Pt} */([P[0]+so*nn[0]*h,P[1]+so*nn[1]*h]);
    if(join==='miter'&&Math.cos(ang/2)>=1/3&&innerD+h/Math.cos(ang/2)<=11.5){pair([P[0]+so*mx*h/Math.cos(ang/2),P[1]+so*my*h/Math.cos(ang/2)],true);}
    else if(join==='round'){const t0=Math.atan2(so*np[1],so*np[0]);let dl=Math.atan2(so*nn[1],so*nn[0])-t0;while(dl>Math.PI)dl-=2*Math.PI;while(dl<-Math.PI)dl+=2*Math.PI;const k=Math.max(2,Math.ceil(Math.abs(dl)*h/.4));for(let j=0;j<=k;j++){const t=t0+dl*j/k;pair([P[0]+Math.cos(t)*h,P[1]+Math.sin(t)*h],j===0||j===k);}}
    else{pair(o0,true);pair(o1,true);}
  };
  // where the inner rails meet at a sharp corner, the offset lines end earlier than the segment does
  const setback=Array.from({length:n},(_,i)=>{if(!closed&&(i===0||i===n-1))return 0;const dp=dirs[(i+segs-1)%segs],dn=dirs[i%segs],ang=Math.atan2(dp[0]*dn[1]-dp[1]*dn[0],dp[0]*dn[0]+dp[1]*dn[1]);return Math.abs(ang)<.3?0:Math.min(hw(cum[i])*Math.abs(Math.tan(ang/2)),lens[(i+segs-1)%segs]/2,lens[i%segs]/2);});
  /** @type {(i: number, from0: number, to0: number) => void} */
  const along=(i,from0,to0)=>{const from=from0+setback[i],to=to0-setback[(i+1)%n],step=.5,m=Math.floor((to-from)/step);for(let k=1;k<m;k++){const u=from+(to-from)*k/m,P=/** @type {Pt} */([pts[i][0]+dirs[i][0]*u,pts[i][1]+dirs[i][1]*u]),[pa,pb]=off(P,dirs[i],hw(cum[i]+u));emit(pa,pb);}};
  if(closed)corner(pts[0],dirs[segs-1],dirs[0],0,Math.min(lens[segs-1],lens[0]));else cap(pts[0],dirs[0],hw(0),capS,true);
  if(!closed){const [pa,pb]=off(pts[0],dirs[0],hw(0));emit(pa,pb,true);}
  for(let i=0;i<segs;i++){
    along(i,0,lens[i]);
    if(i<segs-1)corner(pts[i+1],dirs[i],dirs[i+1],cum[i+1],Math.min(lens[i],lens[i+1]));
    else if(!closed){const [pa,pb]=off(last(pts),dirs[i],hw(total));emit(pa,pb,true);cap(last(pts),dirs[i],hw(total),capE,false);}
  }
  if(closed){A.push(A[0]);B.push(B[0]);}
  return {a:A,b:B,rungs};
}

// Width of a satin path at fraction t: a width profile (`widthStops`, smooth between stops) wins over the plain start/end taper.
/**
 * @param {PathLike} o
 * @param {number} t
 * @returns {number}
 */
export function widthAt(o,t){const st=o.widthStops;if(Array.isArray(st)&&st.length){if(t<=st[0][0])return st[0][1];for(let i=1;i<st.length;i++)if(t<=st[i][0]){const f=(t-st[i-1][0])/((st[i][0]-st[i-1][0])||1),e=f*f*(3-2*f);return st[i-1][1]+(st[i][1]-st[i-1][1])*e;}return last(st)[1];}
  const w0=Math.max(.5,Number(o.satinWidth)||3),w1=Math.max(.5,Number(o.satinWidthEnd)||w0);return w0+(w1-w0)*t;}

/**
 * @param {PathLike} o
 * @returns {Rails|null}
 */
export function railsFromCenterline(o){return railsFromLine(pathOutline(o),t=>widthAt(o,t)/2,{join:o.join,cap:o.cap,closed:Boolean(o.closed)});}
