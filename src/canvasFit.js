// @ts-check
// Fitting the view to the hoop, the design and the selection, and keeping a selection clear of open panels and toolbars.
// The viewport (vp) and its redraw (apply) stay in canvas.js; they are passed in.
import {hoopSize,objectBounds} from './engine.js';
import {railInset,toolbarInset} from './floatingToolbar.js';
import {currentFitMargin,isPhoneFitLayout,PHONE_FIT_MARGIN} from './fitMargin.js';
import {RULER} from './canvasRulers.js';
import {union} from './canvasGeometry.js';

// The clear gap kept between a selection and a panel edge, in screen px: a finger's width.
const REVEAL_CLEAR=44;
// On a landscape phone the zoom bar sits along the canvas's bottom edge, 8 px in and 44 px tall. Fit hoop keeps this band clear.
const LANDSCAPE_BAR_RESERVE=52;

export function createCanvasFit(/** @type {any} */ {vp,apply,size,container,api,toScreen,drawArea}){
  function fitRect(/** @type {any} */ x0,/** @type {any} */ y0,/** @type {any} */ x1,/** @type {any} */ y1,margin=48,inset={top:0,right:0,bottom:0,left:0}){const {w,h}=size(),left=inset.left||0;
  vp.cx=(x0+x1)/2;
  vp.cy=(y0+y1)/2;
  vp.s=Math.max(.4,Math.min(120,Math.min((w-margin*2-RULER-left-inset.right)/Math.max(1,x1-x0),(h-margin*2-RULER-inset.top-inset.bottom)/Math.max(1,y1-y0))));
  vp.cx-=(RULER+left-inset.right)/2/vp.s;
  vp.cy-=(RULER+inset.top-inset.bottom)/2/vp.s;
  apply();
  }
  // Whether the hoop's outer frame lies wholly inside the drawing area at the current zoom.
  // reserve is a band along the bottom of the area that the hoop must also stay clear of (the landscape phone's zoom bar).
  function hoopInBox(/** @type {any} */ a,reserve=0){const hs=hoopSize(api.doc()),sc=(/** @type {number} */ x,/** @type {number} */ y)=>[(x-vp.cx)*vp.s+a.x+a.w/2,(y-vp.cy)*vp.s+a.y+a.h/2],[x0,y0]=sc(-hs.w/2-4,-hs.h/2-4),[x1,y1]=sc(hs.w/2+4,hs.h/2+4);
    return x0>=a.x-.5&&y0>=a.y-.5&&x1<=a.x+a.w+.5&&y1<=a.y+a.h-reserve+.5;}
  function hoopInArea(reserve=0){return hoopInBox(drawArea(),reserve);}
  // The band the zoom bar takes along the bottom of a landscape phone's canvas. Fit hoop keeps it clear; no other window has one.
  function zoomBarReserve(){const {w,h}=size();return h<w&&isPhoneFitLayout()?LANDSCAPE_BAR_RESERVE:0;}
  // The fit covers the hoop's outer frame, which is drawn 4 mm beyond the ring on each side. The margin depends on the
  // pointer and layout (see fitMargin.js): a touch tablet keeps the full margin so the whole hoop shows.
  // On a phone in landscape the height is what limits the fit. fitRect shifts the view down by the top ruler's band, which
  // leaves the hoop 22 px from the top of the canvas and 4 px from the bottom, and the zoom bar would cover that bottom
  // edge. Here the hoop is centred between the ruler and the zoom bar's band instead; the horizontal centring is left as
  // fitRect set it.
  function fitHoop(){const hs=hoopSize(api.doc()),{w,h}=size(),margin=currentFitMargin(Math.min(w,h)),f=4;
    const x0=-hs.w/2-f,y0=-hs.h/2-f,x1=hs.w/2+f,y1=hs.h/2+f;
    fitRect(x0,y0,x1,y1,margin,{top:0,right:0,bottom:0,...railInset(container)});
    // Phone portrait: the ruler takes RULER px on the left, so fitRect centres the hoop on the space beside it, 9 px right of
    // the canvas's middle. Here the hoop is centred on the canvas, with the same RULER band on the right, so it never reaches
    // under the ruler. The vertical placement fitRect chose is kept.
    if(margin===PHONE_FIT_MARGIN&&h>=w){const yc=(y0+y1)/2,sPortrait=Math.min(vp.s,(w-2*RULER)/Math.max(1,x1-x0));
      vp.s=sPortrait;vp.cx=(x0+x1)/2;vp.cy=yc-RULER/(2*sPortrait);apply();}
    if(margin!==PHONE_FIT_MARGIN||h>=w)return;
    // Landscape phone: the top ruler takes RULER px, so the hoop must not rise into it. The scale is reduced to fit between
    // the ruler and the bottom edge, less the zoom bar's band, and the hoop's centre keeps its place on screen across the change.
    const reserve=zoomBarReserve(),yc=(y0+y1)/2;
    const s0=vp.s,xc=(x0+x1)/2,cx0=vp.cx,sFit=Math.min(s0,(h-2*RULER-reserve)/Math.max(1,y1-y0));
    vp.cx=xc-(xc-cx0)*s0/sFit;vp.s=sFit;vp.cy=yc+reserve/(2*sFit);apply();}
  function contentBounds(ids=/** @type {any} */(undefined)){const d=api.doc(),hs=hoopSize(d),list=ids?
    d.objects.filter((/** @type {any} */ o)=>ids.includes(o.id)):d.objects,bs=list.filter((/** @type {any} */ o)=>o.visible!==false).map(objectBounds);
  return ids&&bs.length?union(bs):union([[-hs.w/2,-hs.h/2,hs.w/2,hs.h/2],...bs]);
  }
  function fitAll(){const b=contentBounds();fitRect(b[0],b[1],b[2],b[3],56,railInset(container));}
  function fitSelection(){const ids=api.ids();if(!ids.length)return fitAll();{const b=contentBounds(ids);fitRect(b[0],b[1],b[2],b[3],90,{...toolbarInset(container),...railInset(container)});}}
  // Refits the whole design into the part of the canvas no open phone sheet or toolbar covers, so a design that is larger than that part
  // still shows its full extent above the sheet. Used when Layers opens on a portrait phone.
  function fitAboveSheet(){const b=contentBounds(),t=toolbarInset(container),r=railInset(container);fitRect(b[0],b[1],b[2],b[3],56,{top:t.top+r.top,right:t.right+r.right,bottom:t.bottom+r.bottom,left:t.left+r.left});}
  function revealSelection(){const ids=api.ids();if(!ids.length)return;const b=contentBounds(ids),ins=toolbarInset(container),{w,h}=size(),[x0,y0]=toScreen(b[0],b[1]),[x1,y1]=toScreen(b[2],b[3]);if(!(x0<RULER||y0<RULER+ins.top||x1>w-ins.right||y1>h-ins.bottom))return;fitRect(b[0],b[1],b[2],b[3],90,ins);}
  // Pans, without zooming, so the selection sits in the part of the canvas no sheet or floating bar covers. The selection's
  // bounds keep REVEAL_CLEAR px from each panel or toolbar edge, a finger's width, so its handles can be reached. The view moves
  // only as far as needed, so the hoop stays in view as much as the panel allows. A selection larger than the clear area is
  // centred instead.
  function panToReveal(){const ids=api.ids();if(!ids.length)return;const b=contentBounds(ids),ins=toolbarInset(container),{w,h}=size(),[x0,y0]=toScreen(b[0],b[1]),[x1,y1]=toScreen(b[2],b[3]);
    const gap=(/** @type {number} */ v)=>v>0?REVEAL_CLEAR:0;
    const left=RULER,top=RULER+ins.top+gap(ins.top),right=w-ins.right-gap(ins.right),bottom=h-ins.bottom-gap(ins.bottom);
    const shift=(/** @type {number} */ lo,/** @type {number} */ hi,/** @type {number} */ a,/** @type {number} */ z)=>{
      if(z-a>hi-lo)return (a+z)/2-(lo+hi)/2;
      if(z>hi)return z-hi;
      if(a<lo)return a-lo;
      return 0;};
    const dx=shift(left,right,x0,x1),dy=shift(top,bottom,y0,y1);
    if(!dx&&!dy)return;
    vp.cx+=dx/vp.s;vp.cy+=dy/vp.s;apply();}
  return {fitHoop,fitAll,fitSelection,fitAboveSheet,revealSelection,panToReveal,hoopInBox,hoopInArea,zoomBarReserve};
}
