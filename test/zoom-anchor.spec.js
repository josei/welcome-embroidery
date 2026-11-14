import {test,expect} from '@playwright/test';

// Zoom keeps the drawing point under the pointer (or the midpoint of two fingers) in place. The check is made
// on screen: the drawing point under the pointer before zooming is projected with the drawing's own transform
// after zooming, and the distance back to the pointer is the drift in CSS pixels.

const drawingPointAt=(page,cx,cy)=>page.evaluate(([x,y])=>{const m=document.querySelector('#art').getScreenCTM();const p=new DOMPoint(x,y).matrixTransform(m.inverse());return {x:p.x,y:p.y};},[cx,cy]);
const driftFrom=(page,p,cx,cy)=>page.evaluate(([p,cx,cy])=>{const m=document.querySelector('#art').getScreenCTM();return Math.hypot(m.a*p.x+m.e-cx,m.d*p.y+m.f-cy);},[p,cx,cy]);

const newDesign=async page=>{await page.locator('#new').click();if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();};

async function setupAt100(page,lang){
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.keyboard.press('Shift+Digit0');
 await expect(page.locator('#zoomPct')).toHaveText('100%');
}

// A point inside the drawing area, off its centre, so the zoom origin is not the centre of the view.
async function anchorPoint(page){
 return page.evaluate(()=>{const svg=document.querySelector('#art');const r=svg.getBoundingClientRect();return {x:r.left+r.width*0.42,y:r.top+r.height*0.37};});
}

const cases=[
 {name:'tablet portrait wheel',viewport:{width:768,height:1024},mode:'wheel'},
 {name:'tablet portrait pinch',viewport:{width:768,height:1024},mode:'pinch',touch:true},
 {name:'desktop 1440x900 wheel',viewport:{width:1440,height:900},mode:'wheel'},
];

for(const lang of ['en','es']){
 for(const c of cases){
  test(`zoom keeps the drawing point under the pointer: ${c.name} (${lang})`,async({page,browserName})=>{
   test.skip(c.touch&&browserName!=='chromium','touch points are dispatched through a Chromium CDP session');
   await page.setViewportSize(c.viewport);
   await setupAt100(page,lang);
   const {x:cx,y:cy}=await anchorPoint(page);
   const p0=await drawingPointAt(page,cx,cy);
   if(c.mode==='wheel'){
    await page.mouse.move(cx,cy);
    for(let i=0;i<3;i++){await page.mouse.wheel(0,-100);await page.waitForTimeout(60);}
   }else{
    const cdp=await page.context().newCDPSession(page);
    const pts=d=>[{id:1,x:cx-d,y:cy},{id:2,x:cx+d,y:cy}];
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:pts(40)});
    for(const d of [50,60,70,80,90,100])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:pts(d)});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   }
   await expect(page.locator('#zoomPct')).not.toHaveText('100%');
   const drift=await driftFrom(page,p0,cx,cy);
   // eslint-disable-next-line no-console
   console.log(`zoom drift ${c.name} ${lang}: ${drift.toFixed(2)} px`);
   expect(drift).toBeLessThan(1);
  });
 }
}
