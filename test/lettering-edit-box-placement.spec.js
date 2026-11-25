import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

// The lettering edit box opens over the lettering it edits, not beside its stem. On a phone or tablet the box covers most of
// the lettering's own rectangle with its middle over the letters, and the handles on the selected lettering stay apart.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const SHOT_DIR=process.env.WALK_SHOT_DIR||'test-results/lettering-edit-box';
const sizes=[[390,844],[768,1024]];

async function selectSampleLettering(page,width,height){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto('/');
 // The sample "Bloom" lettering is selected through its Layers row. Phone Layers is closed, so the row is clicked through
 // the DOM, which selects it the same way a tap does.
 await page.evaluate(()=>document.querySelector('.object-row[data-id="letters"]').click());
 await expect(page.locator('.sel-handle[data-handle="nw"]'),'the lettering is selected').toBeAttached();
 return errors;
}

const rectOf=(page,selector)=>page.evaluate(sel=>{
 const e=document.querySelector(sel);if(!e)return null;
 const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};
},selector);

for(const [width,height] of sizes){
 test(`the edit box covers the lettering and its centre is over it (${width}x${height})`,async({page})=>{
  const errors=await selectSampleLettering(page,width,height);
  await page.keyboard.press('Enter');
  await expect(page.locator('#canvasText'),'the edit box opens').toBeVisible();
  const box=await rectOf(page,'#canvasText');
  const letters=await rectOf(page,'#shapes [data-id="letters"]');
  const overlapW=Math.max(0,Math.min(box.right,letters.right)-Math.max(box.left,letters.left));
  const overlapH=Math.max(0,Math.min(box.bottom,letters.bottom)-Math.max(box.top,letters.top));
  const share=(overlapW*overlapH)/((letters.right-letters.left)*(letters.bottom-letters.top));
  expect(share,'at least 80% of the lettering is under the edit box').toBeGreaterThanOrEqual(0.8);
  const cx=(box.left+box.right)/2,cy=(box.top+box.bottom)/2;
  expect(cx>letters.left&&cx<letters.right&&cy>letters.top&&cy<letters.bottom,'the box centre is over the lettering').toBe(true);
  mkdirSync(SHOT_DIR,{recursive:true});
  await page.screenshot({path:`${SHOT_DIR}/edit-box-${width}x${height}.png`});
  expect(errors).toEqual([]);
 });

 test(`the handles on the selected lettering are at least 24 px apart (${width}x${height})`,async({page})=>{
  const errors=await selectSampleLettering(page,width,height);
  const centres=await page.evaluate(()=>[...document.querySelectorAll('.sel-handle[data-handle]')].map(h=>{
   const r=h.getBoundingClientRect();return {name:h.dataset.handle,x:r.left+r.width/2,y:r.top+r.height/2};
  }));
  expect(centres.length,'the selected lettering has its handles').toBeGreaterThan(0);
  for(let i=0;i<centres.length;i++)for(let j=i+1;j<centres.length;j++){
   const d=Math.hypot(centres[i].x-centres[j].x,centres[i].y-centres[j].y);
   expect(d,`${centres[i].name} and ${centres[j].name} handles`).toBeGreaterThanOrEqual(24);
  }
  mkdirSync(SHOT_DIR,{recursive:true});
  await page.screenshot({path:`${SHOT_DIR}/handles-${width}x${height}.png`});
  expect(errors).toEqual([]);
 });
}
