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
 await expect(list.locator('.menu-heading'),'Edit and Arrange headings').toHaveText(['File','Edit','Arrange']);
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

// Issue #458: a phone has no visible New button, so New design leads the phone Menu. At 390x844 and 360x740, in English and
// Spanish, it is the first row, sits inside the window without scrolling the list, is at least 44 px tall, and starts a new design.
for(const [width,height] of [[390,844],[360,740]]) for(const lang of ['en','es']){
 test(`New design is the first Menu row and starts a new design at ${width}x${height} (${lang})`,async({page})=>{
  const errors=await openEditor(page,width,height,lang);
  await page.locator('#rect').click();
  await expect(page.locator('.object-row'),'a shape is on the canvas').not.toHaveCount(0);
  await expect(page.locator('#new'),'the top bar keeps New hidden on a phone').toBeHidden();
  const menu=page.locator('#phoneMenu');
  await menu.click();
  const list=page.locator('#phoneMenuList');
  await expect(list).toBeVisible();
  const first=list.locator('[role="menuitem"]').first();
  await expect(first,'New design is the first item').toHaveAttribute('id','menuNew');
  await expect(first).toHaveText(lang==='es'?/Nuevo diseño/:/New design/);
  // Inside the window and inside the list without scrolling it.
  const box=await first.boundingBox();
  expect(box.y,'first row is in the window').toBeGreaterThanOrEqual(0);
  expect(box.y+box.height,'first row is in the window').toBeLessThanOrEqual(height);
  expect(await list.evaluate(e=>e.scrollTop),'the list is not scrolled').toBe(0);
  expect(Math.min(box.width,box.height),'touch target is at least 44 px').toBeGreaterThanOrEqual(44);
  await first.click();
  await expect(list,'the menu closes').toHaveCount(0);
  // The shape is unsaved, so New asks first, as the top-bar button does on desktop.
  const prompt=page.locator('dialog[open]');
  await expect(prompt,'unsaved changes are confirmed').toHaveCount(1);
  await prompt.getByRole('button',{name:lang==='es'?'Descartar':'Discard'}).click();
  await expect(page.locator('.object-row'),'the design is cleared').toHaveCount(0);
  await expect(page.locator('#name'),'the new design is untitled').toHaveValue(lang==='es'?/sin título/:/Untitled design/);
  expect(errors).toEqual([]);
 });
}

// Issue #460: at 390x844 and 360x740 every tool in the desktop tool list is reachable with one tap and no sideways swipe. The rail
// wraps onto more rows instead of scrolling, so each tool button is inside the window, unclipped, receives a tap, and is 44 px square.
const toolIds=page=>page.locator('.canvas .tool-rail button[id]').evaluateAll(els=>els.map(e=>e.id).sort());
for(const [width,height] of [[390,844],[360,740]]) test(`every desktop tool is reachable with one tap at ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width:1024,height:768});
 await page.goto('/');
 const desktop=await toolIds(page);
 expect(desktop.length,'the desktop tool list was found').toBeGreaterThan(10);
 const errors=await openEditor(page,width,height);
 expect(await toolIds(page),'phone tool set equals the desktop tool set').toEqual(desktop);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),'no page overflow').toBeLessThanOrEqual(0);
 const rail=page.locator('.canvas .tool-rail');
 expect(await rail.evaluate(e=>e.scrollWidth-e.clientWidth),'the rail does not scroll sideways').toBeLessThanOrEqual(0);
 for(const id of desktop){
  const btn=rail.locator(`#${id}`);
  const box=await btn.boundingBox();
  expect(box,`${id} has a box`).not.toBeNull();
  expect(box.x,`${id} is not clipped on the left`).toBeGreaterThanOrEqual(0);
  expect(box.x+box.width,`${id} is not clipped on the right`).toBeLessThanOrEqual(width);
  expect(box.y,`${id} is not clipped on the top`).toBeGreaterThanOrEqual(0);
  expect(box.y+box.height,`${id} is not clipped on the bottom`).toBeLessThanOrEqual(height);
  expect(Math.min(box.width,box.height),`${id} touch target is at least 44 px`).toBeGreaterThanOrEqual(44);
  const hit=await btn.evaluate(e=>{const r=e.getBoundingClientRect();const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!top&&e.contains(top);});
  expect(hit,`${id} receives a tap`).toBe(true);
 }
 expect(errors).toEqual([]);
});
