import {test,expect} from '@playwright/test';

// The "Autosaved in this browser" strip hangs under the top bar on tablets and on a landscape phone. Each of those layouts
// gives the strip a band of its own, so no control starts under it. The cover check samples points across every visible
// control and asks which element is on top there.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const SIZES=[[768,1024],[1024,768],[667,375]];

// Counts sample points, 5 by 5 on each visible control, where the strip is the topmost element.
async function coveredPoints(page){
 return page.evaluate(()=>{
  const strip='#savedStatus,#idleStatus,#unsavedMark';
  const vw=innerWidth,vh=innerHeight;
  let covered=0,checked=0;
  const seen=new Set();
  for(const el of document.querySelectorAll('button,a,input,select,textarea,[role=tab],[role=button]')){
   const cs=getComputedStyle(el);
   if(cs.display==='none'||cs.visibility==='hidden'||el.closest('[hidden],[inert]'))continue;
   const r=el.getBoundingClientRect();
   if(r.width<1||r.height<1||r.right<=0||r.bottom<=0||r.left>=vw||r.top>=vh)continue;
   if(seen.has(el))continue;
   seen.add(el);
   for(let i=0;i<5;i++)for(let j=0;j<5;j++){
    const x=Math.min(vw-1,Math.max(0,r.left+r.width*(i+0.5)/5));
    const y=Math.min(vh-1,Math.max(0,r.top+r.height*(j+0.5)/5));
    const hit=document.elementFromPoint(x,y);
    if(!hit)continue;
    checked++;
    if(hit.closest(strip))covered++;
   }
  }
  return {covered,checked};
 });
}

for(const [w,h] of SIZES)for(const lang of ['en','es']){
 test(`${w} x ${h} ${lang}: the autosave strip covers no control on load or after one rectangle`,async({page})=>{
  await page.setViewportSize({width:w,height:h});
  await page.goto(`/?lang=${lang}`);
  await expect(page.locator('.canvas')).toBeVisible();
  const onLoad=await coveredPoints(page);
  expect(onLoad.checked,'sample points were checked').toBeGreaterThan(0);
  expect(onLoad.covered,'points covered by the strip on load').toBe(0);
  await page.locator('#rect').click();
  await expect(page.locator('#unsavedMark')).toBeVisible();
  const afterRect=await coveredPoints(page);
  expect(afterRect.covered,'points covered by the strip after one rectangle').toBe(0);
 });
}
