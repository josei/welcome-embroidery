import {test,expect} from '@playwright/test';

// A phone shows a selection bar with Duplicate, Delete and Properties while something is selected, so each is one tap away.
// The bar is hidden with nothing selected. The Menu lists Layers, Properties and the view switch first; with an object selected
// its Menu has no Properties row, since the bar carries that control.
const PHONES=[[390,844],[844,390],[360,640]];

test.use({hasTouch:true});
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openPhone(page,width,height,lang='en'){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto(`/?lang=${lang}`);
 return errors;
}

for(const [width,height] of PHONES){
 test(`the selection bar is hidden with nothing selected at ${width}x${height}`,async({page})=>{
  const errors=await openPhone(page,width,height);
  await expect(page.locator('.phone-selection')).toBeHidden();
  expect(errors).toEqual([]);
 });

 test(`Duplicate, Delete and Properties are one tap away with a selection at ${width}x${height}`,async({page})=>{
  const errors=await openPhone(page,width,height);
  await page.locator('#rect').tap();
  const bar=page.locator('.phone-selection');
  await expect(bar).toBeVisible();
  const viewport=page.viewportSize();
  for(const id of ['barDuplicate','barDelete','barProperties']){
   const button=page.locator(`#${id}`);
   await expect(button,`${id} is shown`).toBeVisible();
   const box=await button.boundingBox();
   expect(box.width,`${id} is at least 44 px wide`).toBeGreaterThanOrEqual(44);
   expect(box.height,`${id} is at least 44 px tall`).toBeGreaterThanOrEqual(44);
   expect(box.y>=0 && box.y+box.height<=viewport.height,`${id} is on screen without scrolling`).toBe(true);
   expect(box.x>=0 && box.x+box.width<=viewport.width,`${id} is on screen without scrolling`).toBe(true);
  }
  await expect(page.locator('#barDuplicate')).toBeEnabled();
  await expect(page.locator('#barDelete')).toBeEnabled();
  expect(errors).toEqual([]);
 });

 test(`tapping Properties on the selection bar opens the Properties sheet at ${width}x${height}`,async({page})=>{
  const errors=await openPhone(page,width,height);
  await page.locator('#rect').tap();
  await page.locator('#barProperties').tap();
  await expect(page.locator('#inspector.sheet-open')).toBeVisible();
  expect(errors).toEqual([]);
 });

 test(`tapping Duplicate and then Delete on the selection bar changes the drawing at ${width}x${height}`,async({page})=>{
  const errors=await openPhone(page,width,height);
  await page.locator('#rect').tap();
  const count=()=>page.locator('.object-row').count();
  const before=await count();
  await page.locator('#barDuplicate').tap();
  await expect.poll(count).toBe(before+1);
  await page.locator('#barDelete').tap();
  await expect.poll(count).toBe(before);
  expect(errors).toEqual([]);
 });

 for(const lang of ['en','es']){
  test(`with an object selected, the first Menu section holds Layers and the view switch, not Properties, at ${width}x${height} (${lang})`,async({page})=>{
    const errors=await openPhone(page,width,height,lang);
    await page.locator('#rect').tap();
    await page.locator('#phoneMenu').tap();
    const list=page.locator('#phoneMenuList');
    await expect(list).toBeVisible();
    const listBox=await list.boundingBox();
    for(const id of ['menuLayers','menuView-design','menuView-stitches','menuView-preview']){
     const row=page.locator(`#${id}`);
     await expect(row,`${id} is a Menu row`).toHaveCount(1);
     const box=await row.boundingBox();
     expect(box.y>=listBox.y && box.y+box.height<=listBox.y+listBox.height,`${id} needs no scrolling`).toBe(true);
    }
    // The search field is the first item; the first section follows it.
    const order=await list.locator('[role="menuitem"]').evaluateAll(els=>els.map(e=>e.id).filter(id=>!id.startsWith('menuSection-')).slice(1,5));
    expect(order).toEqual(['menuLayers','menuView-design','menuView-stitches','menuView-preview']);
    await expect(page.locator('#menuProperties'),'no Properties row while an object is selected').toHaveCount(0);
    expect(errors).toEqual([]);
   });

   test(`with nothing selected, the first Menu section holds Properties too, at ${width}x${height} (${lang})`,async({page})=>{
    const errors=await openPhone(page,width,height,lang);
    await page.locator('#phoneMenu').tap();
    const list=page.locator('#phoneMenuList');
    await expect(list).toBeVisible();
    const listBox=await list.boundingBox();
    const row=page.locator('#menuProperties');
    await expect(row,'menuProperties is a Menu row').toHaveCount(1);
    const box=await row.boundingBox();
    expect(box.y>=listBox.y && box.y+box.height<=listBox.y+listBox.height,'menuProperties needs no scrolling').toBe(true);
    const order=await list.locator('[role="menuitem"]').evaluateAll(els=>els.map(e=>e.id).filter(id=>!id.startsWith('menuSection-')).slice(1,6));
    expect(order).toEqual(['menuLayers','menuProperties','menuView-design','menuView-stitches','menuView-preview']);
    await row.tap();
    await expect(page.locator('#inspector')).toBeVisible();
    expect(errors).toEqual([]);
   });
 }
}
