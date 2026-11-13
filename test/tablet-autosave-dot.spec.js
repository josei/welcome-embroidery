import {test,expect} from '@playwright/test';

// At tablet portrait (768x1024) the autosave dot has no label, so it sits alone in the top bar. It must sit on the bar's
// text row (the title's centre), not at the top edge of the screen.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const box=(page,sel)=>page.locator(sel).first().evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,cy:r.top+r.height/2};});

for(const lang of ['en','es']){
 test(`tablet portrait 768x1024 ${lang}: autosave dot sits on the top bar's text row`,async({page})=>{
  await page.setViewportSize({width:768,height:1024});
  await page.goto(`/?lang=${lang}`);
  await expect(page.locator('.canvas')).toBeVisible();
  const dot=page.locator('.top .save-status').first();
  const label=await dot.evaluate(e=>getComputedStyle(e).fontSize==='0px'||getComputedStyle(e).color==='rgba(0, 0, 0, 0)'||getComputedStyle(e).color==='transparent');
  const shown=await dot.isVisible();
  if(!shown) return;
  const d=await box(page,'.top .save-status');
  const name=await box(page,'.top #name');
  expect(label,'the dot has no visible label at this width').toBe(true);
  expect(Math.abs(d.cy-name.cy),'dot centre within 2px of the text row').toBeLessThanOrEqual(2);
  const others=await page.evaluate(()=>[...document.querySelectorAll('.top button, .top input, .top .segmented button, .top .export-split, .top .name-field')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0}).map(e=>{const r=e.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom}}));
  const overlaps=others.filter(o=>d.left<o.r-0.5&&o.l<d.right-0.5&&d.top<o.b-0.5&&o.t<d.bottom-0.5);
  expect(overlaps,'dot does not overlap other top-bar controls').toEqual([]);
 });
}
