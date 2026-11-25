import {test,expect} from '@playwright/test';

// Each tool on the portrait tablet's tool rail shows its word under its glyph, as the phone tool dock does, so a first-time
// Spanish user reads Polygon, Photo, Star and Trace without hovering. Each word is measured over its text: it sits inside its
// tile and the rail, on one line, unclipped. Each button keeps its full name in aria-label and title.

const SIZE=[768,1024];
const RAIL_TOOLS=['select','rect','path','letter','line','measure','polygon','star','traceBtn','photo','pen'];

test.use({hasTouch:true});
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function checkRail(page){
 const rail=page.locator('.canvas .tool-rail');
 await expect(rail).toBeVisible();
 const railBox=await rail.boundingBox();
 expect(await rail.evaluate(e=>e.scrollHeight<=e.clientHeight+1),'the rail does not scroll').toBe(true);
 for(const id of RAIL_TOOLS){
  const button=page.locator(`.canvas .tool-rail #${id}`);
  const word=button.locator('.rail-label');
  await expect(button,`${id} is shown`).toBeVisible();
  await expect(word,`${id} shows its word`).toBeVisible();
  const name=await button.getAttribute('aria-label');
  expect(name,`${id} keeps its full name`).toBeTruthy();
  expect(await button.getAttribute('title'),`${id} has a title`).toBeTruthy();

  const buttonBox=await button.boundingBox();
  const m=await word.evaluate(el=>{
   const range=document.createRange();range.selectNodeContents(el);
   const r=range.getBoundingClientRect();
   const rects=[...range.getClientRects()];
   const box=el.getBoundingClientRect();
   return {
    boxLeft:box.left,boxRight:box.right,
    left:r.left,right:r.right,top:r.top,bottom:r.bottom,
    lines:rects.length?new Set(rects.map(q=>Math.round(q.top))).size:0,
    scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,
   };
  });
  expect(m.left>=buttonBox.x-0.5 && m.right<=buttonBox.x+buttonBox.width+0.5,`${id} word lies inside its tile`).toBe(true);
  expect(m.left>=railBox.x-0.5 && m.right<=railBox.x+railBox.width+0.5,`${id} word lies inside the rail`).toBe(true);
  expect(m.top>=buttonBox.y-0.5 && m.bottom<=buttonBox.y+buttonBox.height+0.5,`${id} word lies inside its tile vertically`).toBe(true);
  expect(m.left>=m.boxLeft-0.5 && m.right<=m.boxRight+0.5,`${id} word lies inside its label box`).toBe(true);
  expect(m.scrollWidth<=m.clientWidth+1,`${id} word is not clipped`).toBe(true);
  expect(m.lines,`${id} word is one line`).toBe(1);
 }
}

test('the tablet tool rail shows a word under every tool in es-ES at 768x1024', async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept().catch(()=>{}));
 await page.setViewportSize({width:SIZE[0],height:SIZE[1]});
 await page.goto('/?lang=es');
 await checkRail(page);
 expect(errors).toEqual([]);
});

test('the tablet tool rail shows a word under every tool in en-US at 768x1024', async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept().catch(()=>{}));
 await page.setViewportSize({width:SIZE[0],height:SIZE[1]});
 await page.goto('/');
 await checkRail(page);
 expect(errors).toEqual([]);
});
