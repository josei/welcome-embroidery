import {test,expect} from '@playwright/test';
import {revealMenuRow} from './menu-reveal.js';

// The Stitches view and the Export card fit a landscape phone (844x390) and a tablet in portrait (820x1180): the hoop and the
// playback bar are on screen without overlapping, the playback bar sits clear of the top bar, and the tablet's Messages is in the Menu, not the
// footer. The Export Download button is in view. A landscape phone's Messages is a Menu row.
const LANDSCAPE=[844,390],TABLET=[820,1180];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openEditor(page,[width,height],lang){
 await page.setViewportSize({width,height});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await expect(page.locator('.tool-rail')).toBeVisible();
}

async function openStitches(page,size,lang){
 const label=lang==='en'?'Stitches':'Puntadas';
 if(size===TABLET) await page.locator('.canvas-views button').filter({hasText:label}).first().click();
 else{
  await page.locator('#phoneMenu').click();
  await page.locator('#phoneMenuList button, #phoneMenuList [role=menuitem]').filter({hasText:label}).first().click();
 }
 await expect(page.locator('.layout main:not(.design-view)')).toHaveCount(1);
 await page.waitForTimeout(300);
}

const box=(page,selector)=>page.evaluate(s=>{
 const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();
 return {l:r.left,t:r.top,r:r.right,b:r.bottom};
},selector);

const overlaps=(a,b)=>a&&b&&Math.min(a.r,b.r)-Math.max(a.l,b.l)>0.5&&Math.min(a.b,b.b)-Math.max(a.t,b.t)>0.5;

for(const lang of ['en','es']){
 test(`landscape Stitches: the hoop sits inside the canvas, clear of the playback bar (${lang})`,async({page})=>{
  await openEditor(page,LANDSCAPE,lang);
  await openStitches(page,LANDSCAPE,lang);
  const canvas=await box(page,'.layout main:not(.design-view) .canvas'),hoop=await box(page,'#hoopOuter'),zoom=await box(page,'.phone-playback');
  expect(hoop.t).toBeGreaterThanOrEqual(canvas.t);
  expect(hoop.b).toBeLessThanOrEqual(canvas.b);
  expect(hoop.l).toBeGreaterThanOrEqual(canvas.l);
  expect(hoop.r).toBeLessThanOrEqual(canvas.r);
  expect(overlaps(zoom,hoop)).toBe(false);
  // The playback bar runs along the bottom of the canvas column, directly under the canvas.
  expect(Math.abs(zoom.t-canvas.b)).toBeLessThan(1);
  await page.screenshot({path:`test-results/landscape-stitches-${lang}.png`});
 });

 test(`landscape Stitches: the playback bar sits under the canvas, clear of the top bar (${lang})`,async({page})=>{
  await openEditor(page,LANDSCAPE,lang);
  await openStitches(page,LANDSCAPE,lang);
  const playback=await box(page,'.phone-playback'),top=await box(page,'.top');
  expect(playback.t).toBeGreaterThanOrEqual(top.b);
  expect(playback.r-playback.l).toBeGreaterThan(playback.b-playback.t);
 });

 // A portrait tablet has no Messages button in its footer: the footer holds only the playback bar in Stitches, and Messages is a Menu row.
 test(`Stitches at tablet size: the footer holds no Messages button, the Menu does (${lang})`,async({page})=>{
  await openEditor(page,TABLET,lang);
  await openStitches(page,TABLET,lang);
  await expect(page.locator('#messagesBtn')).toHaveCount(0);
  await page.locator('#phoneMenu').click();
  const row=await revealMenuRow(page.locator('#phoneMenuList'),'menuMessages');
  await expect(row).toBeVisible();
  await page.screenshot({path:`test-results/tablet-stitches-${lang}.png`});
 });

 test(`Export at 844x390: the Download button is in view with the other controls (${lang})`,async({page})=>{
  await openEditor(page,LANDSCAPE,lang);
  await page.locator('#export').click();
  const download=page.locator('#download'),cancel=page.locator('#exportDialog .dialog-actions button').last();
  await expect(download).toBeVisible();
  const d=await box(page,'#download');
  expect(d.t).toBeGreaterThanOrEqual(0);
  expect(d.b).toBeLessThanOrEqual(LANDSCAPE[1]);
  const c=await cancel.boundingBox();
  expect(c.y+c.height).toBeLessThanOrEqual(LANDSCAPE[1]);
  await page.locator('#exportDialog form').evaluate(f=>{f.scrollTop=f.scrollHeight;});
  const after=await box(page,'#download');
  expect(after.b).toBeLessThanOrEqual(LANDSCAPE[1]);
  await page.screenshot({path:`test-results/landscape-export-${lang}.png`});
 });
}
