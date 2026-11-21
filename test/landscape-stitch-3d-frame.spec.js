import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {revealMenuRow} from './menu-reveal.js';

// At 844x390 landscape, the Stitches and 3D views have no drawing palette and no empty tool column. Play and Restart
// sit clear of everything but the playback bar, the 3D view paints to the bottom edge of its frame, and both languages
// are screenshotted for the review.
const LANDSCAPE=[844,390];
const SHOTS='test-results';

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openEditor(page,lang){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width:LANDSCAPE[0],height:LANDSCAPE[1]});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await expect(page.locator('.tool-rail')).toBeVisible();
 return errors;
}

// On a landscape phone the view switch is in the Menu (Menu > View).
async function chooseView(page,view){
 await page.locator('#phoneMenu').click();
 const row=await revealMenuRow(page.locator('#phoneMenuList'),`menuView-${view}`);
 await row.click();
}

const box=(page,sel)=>page.evaluate(s=>{
 const e=document.querySelector(s);if(!e)return null;
 const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height};
},sel);

// Visible elements whose box meets the Play box, other than Play, its playback bar, and their ancestors.
const intruders=(page,sel)=>page.evaluate(s=>{
 const target=document.querySelector(s);const bar=target.closest('.playback-bar');
 const p=target.getBoundingClientRect();
 const hits=[];
 for(const e of document.querySelectorAll('body *')){
  if(e===target||e.contains(target)||target.contains(e)||(bar&&bar.contains(e)))continue;
  const cs=getComputedStyle(e);
  if(cs.display==='none'||cs.visibility==='hidden'||e.closest('[hidden],.sr-only'))continue;
  const r=e.getBoundingClientRect();
  if(r.width<=0||r.height<=0)continue;
  if(Math.min(r.right,p.right)-Math.max(r.left,p.left)>0.5&&Math.min(r.bottom,p.bottom)-Math.max(r.top,p.top)>0.5)
   hits.push(`${e.tagName}#${e.id}.${String(e.className?.baseVal ?? e.className)}`);
 }
 return hits;
},sel);

for(const lang of ['en','es']){
 test(`Stitches hides the drawing palette and keeps Play clear at 844x390 (${lang})`,async({page})=>{
  const errors=await openEditor(page,lang);
  await chooseView(page,'stitches');
  await expect(page.locator('#play')).toBeVisible();
  await expect(page.locator('.tool-rail')).toBeHidden();
  expect(await intruders(page,'#play')).toEqual([]);
  expect(await intruders(page,'#resetPlayback')).toEqual([]);
  // The status line reads "Compiling…" until the plan is ready; wait so the picture shows a settled state.
  await expect.poll(()=>page.evaluate(()=>/Compil/.test(document.body.innerText))).toBe(false);
  mkdirSync(SHOTS,{recursive:true});
  await page.screenshot({path:`${SHOTS}/642-stitches-844x390-${lang}.png`});
  expect(errors).toEqual([]);
 });

  test(`3D has no tool column and the frame runs edge to edge at 844x390 (${lang})`,async({page})=>{
  const errors=await openEditor(page,lang);
  await chooseView(page,'preview');
  await expect(page.locator('#preview3d')).toBeVisible();
  await expect(page.locator('.tool-rail')).toBeHidden();
  const frame=await box(page,'.layout main>.canvas');
  const cv=await box(page,'#preview3d');
  expect(frame.l).toBeLessThan(2);
  expect(frame.r).toBeCloseTo(LANDSCAPE[0],0);
  expect(Math.abs(cv.b-frame.b)).toBeLessThan(0.5);
  await page.screenshot({path:`${SHOTS}/642-3d-844x390-${lang}.png`});
  expect(errors).toEqual([]);
 });

}

test.describe('touch',()=>{
 test.use({hasTouch:true});
 test('a tap at the centre of Play and of Restart activates them (844x390)',async({page})=>{
  await openEditor(page,'en');
  await chooseView(page,'stitches');
  await expect(page.locator('#play')).toBeVisible();
  const play=await box(page,'#play');
  const at=await page.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);return e?.closest('button')?.id??e?.id;},[play.l+play.w/2,play.t+play.h/2]);
  expect(at).toBe('play');
  await page.touchscreen.tap(play.l+play.w/2,play.t+play.h/2);
  await expect(page.locator('#play')).toHaveClass(/playing/);
  await page.touchscreen.tap(play.l+play.w/2,play.t+play.h/2);
  await expect(page.locator('#play')).not.toHaveClass(/playing/);
  const reset=await box(page,'#resetPlayback');
  const hit=await page.evaluate(([x,y])=>document.elementFromPoint(x,y)?.closest('button')?.id,[reset.l+reset.w/2,reset.t+reset.h/2]);
  expect(hit).toBe('resetPlayback');
  await page.touchscreen.tap(reset.l+reset.w/2,reset.t+reset.h/2);
  await expect(page.locator('#playbackStitches')).toBeVisible();
 });
}
);
