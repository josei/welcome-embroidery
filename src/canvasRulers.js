// @ts-check
// The rulers along the canvas's top and left edges, and the test for a pointer over them.
export const RULER=18,RULER_FONT=11;
export function niceStep(/** @type {number} */ scale){for(const s of [.5,1,2,5,10,20,50,100,200,500])if(s*scale>=42)return s;return 1000;}
export function drawRulers(/** @type {any} */ rulerTop,/** @type {any} */ rulerLeft,/** @type {any} */ vp,/** @type {{w:number,h:number}} */ {w,h}){
  if(!rulerTop)return;const dpr=devicePixelRatio||1,step=niceStep(vp.s),sub=step>=5?5:step>=2?4:2;
  for(const [cv,horizontal] of [[rulerTop,true],[rulerLeft,false]]){const len=horizontal?w:h;cv.width=(horizontal?w:RULER)*dpr;
    cv.height=(horizontal?RULER:h)*dpr;cv.style.width=(horizontal?w:RULER)+'px';cv.style.height=(horizontal?RULER:h)+'px';
    const g=cv.getContext('2d');g.scale(dpr,dpr);g.fillStyle='#fbfbf9';g.fillRect(0,0,cv.width,cv.height);g.strokeStyle='#c9cec8';g.fillStyle='#66726c';
      g.lineWidth=1;g.font=`${RULER_FONT}px Inter,system-ui,sans-serif`;
    const c0=horizontal?vp.cx-w/(2*vp.s):vp.cy-h/(2*vp.s),c1=c0+len/vp.s,first=Math.floor(c0/(step/sub))*(step/sub);
    for(let v=first;v<=c1+step;v+=step/sub){const pos=(v-c0)*vp.s+.5,major=Math.abs(v/step-Math.round(v/step))<1e-6,tick=major?RULER:RULER*.35;
      g.beginPath();if(horizontal){g.moveTo(pos,RULER);g.lineTo(pos,RULER-tick);}else{g.moveTo(RULER,pos);g.lineTo(RULER-tick,pos);}g.stroke();
      if(major){const label=String(Math.round(v*100)/100);if(horizontal)g.fillText(label,pos+2,RULER_FONT);
        else{g.save();g.translate(RULER_FONT,pos-2);g.rotate(-Math.PI/2);g.fillText(label,0,0);g.restore();}}}
    g.strokeStyle='#dfe3dd';g.beginPath();
      if(horizontal){g.moveTo(0,RULER-.5);g.lineTo(w,RULER-.5);}else{g.moveTo(RULER-.5,0);g.lineTo(RULER-.5,h);}g.stroke();}
}
export function overRuler(/** @type {any} */ e,/** @type {any} */ container){const r=container.getBoundingClientRect();
return e.clientX<r.left+RULER||e.clientY<r.top+RULER||e.clientX>r.right||e.clientY>r.bottom;
}
