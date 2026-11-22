import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

// In Spanish the design name keeps at least its first word at the tablet portrait, phone and landscape sizes, the bar stays one
// row, and the undo and save controls are not covered by the name. The screenshot at 768 by 1024 is the report's evidence.
const SIZES=[[768,1024],[390,844],[844,390],[360,640]];
const SHOTS=process.env.DESIGN_NAME_SHOTS||'test-results/design-name-tablet';

for(const [width,height] of SIZES){
 test(`design name keeps its first word and the bar stays one row at ${width}x${height} in es-ES`,async({page})=>{
  mkdirSync(SHOTS,{recursive:true});
  await page.addInitScript(()=>{delete window.showSaveFilePicker;});
  await page.setViewportSize({width,height});
  await page.goto('/?lang=es');
  await page.locator('#rect').click();
  await expect(page.locator('#remove')).toBeEnabled();

  const m=await page.evaluate(()=>{
   const bar=document.querySelector('header.top');
   const input=document.querySelector('.top #name');
   const field=document.querySelector('.top .name-field');
   const box=e=>e.getBoundingClientRect();
   const cs=getComputedStyle(input);
   const ctx=document.createElement('canvas').getContext('2d');
   ctx.font=`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
   const firstWord=input.value.trim().split(/\s+/)[0];
   const padLeft=parseFloat(cs.paddingLeft),padRight=parseFloat(cs.paddingRight);
   return {
    barHeight:box(bar).height,
    firstWordWidth:ctx.measureText(firstWord).width,
    visibleTextWidth:box(input).width-padLeft-padRight,
    fieldRight:box(field).right,
    undoLeft:box(document.querySelector('.top #undo')).left,
    undoRight:box(document.querySelector('.top #undo')).right,
    saveVisible:!!document.querySelector('.top #save')?.offsetParent,
    saveLeft:document.querySelector('.top #save')?.offsetParent?box(document.querySelector('.top #save')).left:null,
    exportLeft:box(document.querySelector('.top #export')).left,
    fieldLeft:box(field).left,
    barOverflow:bar.scrollWidth-bar.clientWidth,
   };
  });

  // One row: the bar is no taller than a single 44 px control plus its padding.
  expect(m.barHeight,'top bar is one row').toBeLessThanOrEqual(60);
  expect(m.barOverflow,'top bar does not overflow').toBeLessThanOrEqual(0);
  // The name shows at least its first word.
  expect(m.visibleTextWidth,'name shows its first word').toBeGreaterThanOrEqual(m.firstWordWidth);
  // Undo, the name and Save keep their order and do not overlap.
  expect(m.undoRight,'undo is clear of the name').toBeLessThanOrEqual(m.fieldLeft+0.5);
  if(m.saveVisible)expect(m.fieldRight,'name is clear of save').toBeLessThanOrEqual(m.saveLeft+0.5);
  expect(m.fieldRight,'name is clear of export').toBeLessThanOrEqual(m.exportLeft+0.5);

  await page.locator('header.top').screenshot({path:`${SHOTS}/top-bar-${width}x${height}-es.png`});
 });
}
