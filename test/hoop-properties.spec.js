import {test,expect} from '@playwright/test';

// On phones and tablets the hoop preset, width, height and rotate controls live in
// Properties, not under the Layers list. On desktop they stay under the Layers list.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const HOOP_IDS=['#hoopPreset','#hoopW','#hoopH','#hoopRotate'];
const LANGS=['en','es'];

for(const lang of LANGS){
 const q=lang==='en'?'/':`/?lang=${lang}`;

 test(`hoop controls sit in the Properties sheet on a 390x844 phone (${lang})`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
  await page.setViewportSize({width:390,height:844});
  await page.goto(q);
  await page.locator('#phoneMenu').click();
  await page.locator('#menuProperties').click();
  await expect(page.locator('#inspector')).toHaveClass(/sheet-open/);
  for(const id of HOOP_IDS){
   const control=page.locator(`#inspector ${id}`);
   await expect(control).toHaveCount(1);
   await expect(control).toBeVisible();
   const box=await control.boundingBox();
   expect(box.height,`${id} height`).toBeGreaterThanOrEqual(44);
  }
  await expect(page.locator(`#layersSheet ${HOOP_IDS[1]}`)).toHaveCount(0);
  await expect(page.locator(`#layersSheet ${HOOP_IDS[3]}`)).toHaveCount(0);
  const scrolls=await page.evaluate(()=>document.scrollingElement.scrollHeight>document.scrollingElement.clientHeight+1);
  expect(scrolls).toBe(false);
  expect(errors).toEqual([]);
 });

 test(`hoop controls sit in the Properties tab on a 768x1024 tablet (${lang})`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
  await page.setViewportSize({width:768,height:1024});
  await page.goto(q);
  await page.locator('#tabProperties').click();
  for(const id of HOOP_IDS){
   const control=page.locator(`#inspector ${id}`);
   await expect(control).toHaveCount(1);
   await expect(control).toBeVisible();
   const box=await control.boundingBox();
   expect(box.height,`${id} height`).toBeGreaterThanOrEqual(44);
  }
  await expect(page.locator(`#layersSheet ${HOOP_IDS[1]}`)).toHaveCount(0);
  const scrolls=await page.evaluate(()=>document.scrollingElement.scrollHeight>document.scrollingElement.clientHeight+1);
  expect(scrolls).toBe(false);
  expect(errors).toEqual([]);
 });

 test(`hoop controls stay under the Layers list on a 1280x800 desktop (${lang})`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1280,height:800});
  await page.goto(q);
  for(const id of HOOP_IDS){
   await expect(page.locator(`#layersSheet ${id}`)).toHaveCount(1);
   await expect(page.locator(`#inspector ${id}`)).toHaveCount(0);
  }
  expect(errors).toEqual([]);
 });
}
