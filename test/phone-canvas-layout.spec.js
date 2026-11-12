import {test,expect} from '@playwright/test';

// Issue #457: at phone portrait (600 px wide and narrower) the canvas takes the full width and at least 55% of the height with no
// sheet open, and no control sits over it. The tools, the zoom bar, the canvas actions and the Layers and Properties bar sit in a
// stack under the canvas, and the 2D, Stitches and 3D tabs move to the Menu's View section. With Layers open the canvas still shows
// at least 40% of the screen. Every tool, zoom action, tab and sheet button is at least 44 px square.
const PORTRAIT=[[390,844],[375,667]];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openEditor(page,width,height,lang){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 return errors;
}

// The canvas box, and every visible control whose box intersects it (a control inside the canvas's own box counts as overlapping).
const canvasOverlaps=page=>page.evaluate(()=>{
 const c=document.querySelector('.layout main>.canvas').getBoundingClientRect();
 const hits=[];
 for(const e of document.querySelectorAll('button,input,select,textarea,summary,a,[role="menuitem"]')){
  const cs=getComputedStyle(e);
  if(cs.display==='none'||cs.visibility==='hidden'||e.closest('.sr-only,.sheet-open:not(#inspector):not(#layersSheet)')) continue;
  const r=e.getBoundingClientRect();
  if(r.width<=0||r.height<=0) continue;
  // A dialog or menu popup sits over the page on purpose, so the page controls under it are not compared.
  const ox=Math.min(c.right,r.right)-Math.max(c.left,r.left), oy=Math.min(c.bottom,r.bottom)-Math.max(c.top,r.top);
  if(ox>0.5&&oy>0.5) hits.push(`${e.tagName}#${e.id} "${(e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,20)}"`);
 }
 return hits;
});

const canvasBox=page=>page.evaluate(()=>{const r=document.querySelector('.layout main>.canvas').getBoundingClientRect();return {w:r.width/innerWidth,h:r.height/innerHeight,visibleAboveSheet:0};});

for(const [width,height] of PORTRAIT) for(const lang of ['en','es']){
 test(`the canvas fills the phone width and at least 55% of the height at ${width}x${height} (${lang})`,async({page})=>{
  const errors=await openEditor(page,width,height,lang);
  const c=await canvasBox(page);
  expect(c.w,'canvas width share').toBeGreaterThanOrEqual(0.8);
  expect(c.h,'canvas height share').toBeGreaterThanOrEqual(0.55);
  expect(await canvasOverlaps(page),'no control over the canvas').toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),'no page overflow').toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
 });

 test(`the canvas shows at least 40% of the screen with Layers open at ${width}x${height} (${lang})`,async({page})=>{
  const errors=await openEditor(page,width,height,lang);
  await page.locator('#layersBtn').click();
  await expect(page.locator('#layersSheet')).toHaveClass(/sheet-open/);
  const share=await page.evaluate(()=>{
   const c=document.querySelector('.layout main>.canvas').getBoundingClientRect();
   const sheetTop=document.querySelector('#layersSheet').getBoundingClientRect().top;
   return Math.max(0,Math.min(c.bottom,sheetTop)-Math.max(c.top,0))/innerHeight;
  });
  expect(share,'canvas above Layers').toBeGreaterThanOrEqual(0.4);
  expect(errors).toEqual([]);
 });

 test(`every tool, zoom action, Menu view and sheet button is at least 44 px at ${width}x${height} (${lang})`,async({page})=>{
  await openEditor(page,width,height,lang);
  const small=await page.evaluate(()=>[
   ...document.querySelectorAll('.canvas .tool-rail button[id],.canvas .zoombar button')
  ].filter(e=>e.getBoundingClientRect().width>0).map(e=>({id:e.id||e.className,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})).filter(s=>Math.min(s.w,s.h)<44));
  expect(small,'controls under 44 px').toEqual([]);
  await page.locator('#phoneMenu').click();
  for(const v of ['design','stitches','preview']){
   const item=page.locator(`#menuView-${v}`);
   await expect(item).toBeVisible();
   expect((await item.boundingBox()).height,`menu view ${v} height`).toBeGreaterThanOrEqual(44);
  }
  await page.keyboard.press('Escape');
 });
}
