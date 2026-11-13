import {test,expect} from '@playwright/test';

// At 1280x800, with an object selected, Duplicate, Delete and Export sit inside the
// window and the top bar does not overflow, in English and Spanish, with the default name and with a 45-character project name.
// Tabbing to Delete leaves it on screen. The boxes measured are attached to the report.
const LONG='Autumn garden sampler, a long name 45'; // 35 characters: padded to 45 below
const longName=LONG.padEnd(45,'x').slice(0,45);
const cases=[['en',null],['en',longName],['es',null],['es',longName]];

for(const [lang,name] of cases){
 test(`top bar fits at 1280px in ${lang} with ${name?'a 45-character':'the default'} name`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.addInitScript(()=>{delete window.showSaveFilePicker;});
  await page.setViewportSize({width:1280,height:800});
  await page.goto(`/?lang=${lang}`);
  await page.locator('#new').click();
  if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
  if(name){await page.locator('header.top #name').fill(name);await page.locator('header.top #name').press('Enter');}
  await page.locator('#rect').click();
  await expect(page.locator('#remove')).toBeEnabled();
  const box=async id=>page.locator(id).evaluate(e=>{const r=e.getBoundingClientRect();return {left:Math.round(r.left),right:Math.round(r.right),top:Math.round(r.top),bottom:Math.round(r.bottom)};});
  const boxes={duplicate:await box('#duplicate'),remove:await box('#remove'),export:await box('#export')};
  const bar=await page.locator('header.top').evaluate(e=>({scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}));
  test.info().attach('measured-boxes',{body:JSON.stringify({lang,name:name??'default',viewport:1280,boxes,bar},null,1),contentType:'application/json'});
  for(const [id,b] of Object.entries(boxes)){
   expect(b.left,`${id} left edge`).toBeGreaterThanOrEqual(0);
   expect(b.right,`${id} right edge inside 1280px`).toBeLessThanOrEqual(1280);
  }
  expect(bar.scrollWidth,'top bar has no horizontal overflow').toBe(bar.clientWidth);
  // The name shortens rather than pushing controls out: it keeps a usable width.
  expect(await page.locator('header.top #name').evaluate(e=>e.getBoundingClientRect().width),'project name width').toBeGreaterThanOrEqual(60);
  // Keyboard: shift+tab from the name back to Delete; it must be on screen, with the page not scrolled to hide it.
  await page.locator('header.top #name').focus();
  for(let i=0;i<12;i++){ if(await page.evaluate(()=>document.activeElement?.id)==='remove')break; await page.keyboard.press('Shift+Tab'); }
  expect(await page.evaluate(()=>document.activeElement?.id),'Tab reaches Delete').toBe('remove');
  const focused=await box('#remove');
  expect(focused.right,'focused Delete right edge inside 1280px').toBeLessThanOrEqual(1280);
  expect(focused.left,'focused Delete left edge inside window').toBeGreaterThanOrEqual(0);
  expect(await page.evaluate(()=>window.scrollX),'window not scrolled sideways').toBe(0);
  expect(errors).toEqual([]);
 });
}

// With a rectangle selected, the save status shows in full in the top bar at 1280px and 1024px, in English and Spanish.
// Spanish needs 189px at 1280px; the New design and Import buttons show as icons in that range to make room.
for(const lang of ['en','es']) for(const width of [1280,1024]){
 test(`save status is not clipped at ${width}px in ${lang}`,async({page})=>{
  await page.addInitScript(()=>{delete window.showSaveFilePicker;});
  await page.setViewportSize({width,height:800});
  await page.goto(`/?lang=${lang}`);
  await page.locator('#rect').click();
  await expect(page.locator('#remove')).toBeEnabled();
  const mark=await page.locator('#unsavedMark').evaluate(e=>({scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}));
  expect(mark.scrollWidth,'save status not clipped').toBeLessThanOrEqual(mark.clientWidth);
 });
}
