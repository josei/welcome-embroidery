import {test,expect} from '@playwright/test';

// Issue #443: at phone widths (600px and narrower) the tool strip scrolls sideways inside its own box, the page never scrolls,
// every tool can be selected, and Edit and Arrange sit behind one Menu button whose items can all be reached and clicked.
const PHONES=[[375,667],[390,844]];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openEditor(page,width,height,lang='en'){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 // A fresh browser context starts with an empty design; New is hidden at phone widths, so it is not clicked here.
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 return errors;
}

for(const [width,height] of PHONES) for(const lang of ['en','es']){
 test(`the page does not overflow and the tool strip fits or scrolls in its box at ${width}x${height} (${lang})`,async({page})=>{
  const errors=await openEditor(page,width,height,lang);
  // The page itself never scrolls sideways.
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),'no page overflow').toBeLessThanOrEqual(0);
  const rail=page.locator('.canvas .tool-rail');
  const box=await rail.boundingBox();
  const canvas=await page.locator('.canvas').boundingBox();
  // The strip sits inside the canvas and inside the window.
  expect(box.x,'strip starts inside the canvas').toBeGreaterThanOrEqual(canvas.x);
  expect(box.x+box.width,'strip ends inside the canvas').toBeLessThanOrEqual(canvas.x+canvas.width+0.5);
  expect(box.x+box.width,'strip ends inside the window').toBeLessThanOrEqual(width);
  // It either fits the width or scrolls sideways inside its own box.
  const scroll=await rail.evaluate(e=>({sw:e.scrollWidth,cw:e.clientWidth,ox:getComputedStyle(e).overflowX}));
  if(scroll.sw>scroll.cw) expect(['auto','scroll'],'overflowing strip scrolls').toContain(scroll.ox);
  expect(errors).toEqual([]);
 });

 test(`every tool and top-bar control is at least 24 px across at ${width}x${height} (${lang})`,async({page})=>{
  await openEditor(page,width,height,lang);
  const sizes=await page.evaluate(()=>[...document.querySelectorAll('.canvas .tool-rail button, header.top button, header.top .file-menu > button')]
   .filter(e=>e.getBoundingClientRect().width>0).map(e=>({id:e.id||e.className,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
  expect(sizes.length,'controls were found').toBeGreaterThan(10);
  for(const s of sizes) expect(Math.min(s.w,s.h),`touch target ${s.id}`).toBeGreaterThanOrEqual(24);
 });
}

test('every tool in the strip is reachable and becomes active at 375px',async({page})=>{
 const errors=await openEditor(page,375,667);
 const rail=page.locator('.canvas .tool-rail');
 // Tool modes: each one is armed, so its button reports aria-pressed="true".
 for(const id of ['select','line','measure','polygon','star','path','pen']){
  const btn=rail.locator(`#${id}`);
  await btn.click();
  await expect(btn,`${id} becomes active`).toHaveAttribute('aria-pressed','true');
  await expect(btn,`${id} is inside the strip`).toBeVisible();
 }
 // Add buttons place an object each time they are pressed.
 for(const id of ['rect','ellipse','letter']){
  const before=await page.locator('.object-row').count();
  await rail.locator(`#${id}`).click();
  await expect.poll(()=>page.locator('.object-row').count(),`${id} adds an object`).toBeGreaterThan(before);
 }
 // Trace opens its dialog.
 await rail.locator('#traceBtn').click();
 await expect(page.locator('dialog[open]'),'trace opens its dialog').toHaveCount(1);
 await page.keyboard.press('Escape');
 await expect(page.locator('dialog[open]')).toHaveCount(0);
 // Photo stitch is reached and hit by a tap (it opens a file picker, so it is not pressed here).
 const photo=rail.locator('#photo');
 await photo.scrollIntoViewIfNeeded();
 const hit=await photo.evaluate(e=>{const r=e.getBoundingClientRect();const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!top&&e.contains(top);});
 expect(hit,'photo stitch receives a tap').toBe(true);
 expect(errors).toEqual([]);
});

test('the Menu button opens Edit and Arrange and every enabled item is clickable at 375px',async({page})=>{
 test.setTimeout(120000);
 const errors=await openEditor(page,375,667);
 await page.locator('#rect').click();
 const menu=page.locator('#phoneMenu');
 await expect(menu,'Menu button is shown').toBeVisible();
 const menuBox=await menu.boundingBox();
 expect(Math.min(menuBox.width,menuBox.height),'Menu button touch target').toBeGreaterThanOrEqual(24);
 await menu.click();
 const list=page.locator('#phoneMenuList');
 await expect(list,'Menu opens').toBeVisible();
 await expect(list.locator('.menu-heading'),'Edit and Arrange headings').toHaveText(['Edit','Arrange']);
 const ids=await list.locator('[role="menuitem"]').evaluateAll(els=>els.map(e=>e.id));
 expect(ids,'Edit items are in the menu').toEqual(expect.arrayContaining(['menuUndo','menuCopy','menuDelete']));
 expect(ids,'Arrange items are in the menu').toEqual(expect.arrayContaining(['menuAlignLeft','menuToFront','menuIntersect']));
 let clicked=0;
 for(const id of ids){
  if(!(await list.isVisible())) await menu.click();
  const item=list.locator(`#${id}`);
  await item.scrollIntoViewIfNeeded();
  await expect(item,`${id} is reachable in the menu`).toBeVisible();
  if(await item.isDisabled()) continue; // a disabled row cannot be pressed; its reason is shown in the menu
  await item.click(); // Playwright checks that the item receives the tap, not something covering it
  clicked++;
  await expect(list,`${id} closes the menu`).toHaveCount(0);
  if(await page.locator('dialog[open]').count()) await page.keyboard.press('Escape');
  if(await page.locator('.object-row').count()===0) await page.locator('#rect').click();
 }
 expect(clicked,'enabled items were clicked').toBeGreaterThan(10);
 expect(errors).toEqual([]);
});

test('Edit and Arrange keep their own buttons above the phone width',async({page})=>{
 const errors=await openEditor(page,1024,768);
 await expect(page.locator('#phoneMenu'),'no Menu button on a wide window').toHaveCount(0);
 await expect(page.locator('#editMenu')).toBeVisible();
 await expect(page.locator('#arrangeMenu')).toBeVisible();
 expect(errors).toEqual([]);
});
