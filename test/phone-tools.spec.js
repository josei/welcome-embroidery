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
  const rail=page.locator('.tool-rail');
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
  const sizes=await page.evaluate(()=>[...document.querySelectorAll('.tool-rail button, header.top button, header.top .file-menu > button')]
   .filter(e=>e.getBoundingClientRect().width>0).map(e=>({id:e.id||e.className,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
  expect(sizes.length,'controls were found').toBeGreaterThan(10);
  for(const s of sizes) expect(Math.min(s.w,s.h),`touch target ${s.id}`).toBeGreaterThanOrEqual(24);
 });
}

// Issue #479 (part of #468; spec #470 sections 1-2): at phone portrait the tool dock is seven buttons on one row, each with its label
// under the icon. More tools opens one sheet with a Tools group and a Panels group, so every tool is one tap away with no sideways scroll.
const DOCK=['select','rect','path','letter','line','measure','toolMore'];
const SHEET_TOOLS=['ellipse','polygon','star','traceBtn','photo','pen'];
const openMore=async page=>{
 await page.locator('#toolMore').click();
 await expect(page.locator('#moreToolsSheet')).toHaveClass(/sheet-open/);
};
test('the dock tools are reachable and become active at 375px, with More tools for the rest',async({page})=>{
 const errors=await openEditor(page,375,667);
 const rail=page.locator('.tool-rail');
 // Dock tools: each one is armed, so its button reports aria-pressed="true".
 for(const id of ['select','line','measure','path']){
  const btn=rail.locator(`#${id}`);
  await btn.click();
  await expect(btn,`${id} becomes active`).toHaveAttribute('aria-pressed','true');
 }
 // Add buttons place an object each time they are pressed.
 for(const id of ['rect','letter']){
  const before=await page.locator('.object-row').count();
  await rail.locator(`#${id}`).click();
  await expect.poll(()=>page.locator('.object-row').count(),`${id} adds an object`).toBeGreaterThan(before);
 }
 // The sheet's tools: each one is armed from More tools, and the sheet closes after the tap.
 for(const id of ['polygon','star','pen']){
  await openMore(page);
  await page.locator(`#moreToolsSheet #${id}`).click();
  await expect(page.locator('#moreToolsSheet'),`${id} closes the sheet`).not.toHaveClass(/sheet-open/);
  await openMore(page);
  await expect(page.locator(`#moreToolsSheet #${id}`),`${id} becomes active`).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Escape');
 }
 // Trace opens its dialog from the sheet.
 await openMore(page);
 await page.locator('#moreToolsSheet #traceBtn').click();
 await expect(page.locator('dialog[open]'),'trace opens its dialog').toHaveCount(1);
 await page.keyboard.press('Escape');
 await expect(page.locator('dialog[open]')).toHaveCount(0);
 // Photo stitch is in the sheet and receives a tap (it opens a file picker, so it is not pressed here).
 await openMore(page);
 const photo=page.locator('#moreToolsSheet #photo');
 const hit=await photo.evaluate(e=>{const r=e.getBoundingClientRect();const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!top&&e.contains(top);});
 expect(hit,'photo stitch receives a tap').toBe(true);
 expect(errors).toEqual([]);
});

test('the Menu button opens File, Edit, View and Settings and Help, and every enabled item is clickable at 375px',async({page})=>{
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
 await expect(list.locator('.menu-heading'),'the four groups').toHaveText(['File','Edit','View','Settings and Help']);
 const ids=await list.locator('[role="menuitem"]').evaluateAll(els=>els.map(e=>e.id));
 expect(ids,'Edit items are in the menu').toEqual(expect.arrayContaining(['menuUndo','menuCopy','menuDuplicate','menuSelectAll','menuRepeat']));
 expect(ids,'Delete and keyboard shortcuts are not listed on a phone').not.toEqual(expect.arrayContaining(['menuDelete','menuShortcuts']));
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
  // The search field (Command palette) leads the sheet; New is the first group's first row.
  const first=list.locator('#menuNew');
  await expect(list.locator('[role="menuitem"]').first(),'the search field leads').toHaveAttribute('id','menuCommandPalette');
  await expect(first).toHaveText(lang==='es'?/^Nuevo$/:/^New$/);
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

// Issue #479: at 390x844 and 360x740 the dock holds exactly the seven dock buttons on one row, with no sideways scroll, every one inside
// the window at 44 px or more. More tools reaches the rest: the Tools group and the Panels group together hold every desktop tool.
const dockIds=page=>page.locator('.tool-rail button[id]').evaluateAll(els=>els.map(e=>e.id));
for(const [width,height] of [[390,844],[360,740]]) for(const lang of ['en','es']) test(`the dock holds seven buttons on one row and More tools reaches the rest at ${width}x${height} (${lang})`,async({page})=>{
 const errors=await openEditor(page,width,height,lang);
 expect(await dockIds(page),'dock buttons').toEqual(DOCK);
 const rail=page.locator('.tool-rail');
 expect(await rail.evaluate(e=>e.scrollWidth<=e.clientWidth),'the dock does not scroll sideways').toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),'no page overflow').toBeLessThanOrEqual(0);
 const railBox=await rail.boundingBox();
 for(const id of DOCK){
  const box=await rail.locator(`#${id}`).boundingBox();
  expect(box.x,`${id} inside the window`).toBeGreaterThanOrEqual(0);
  expect(box.x+box.width,`${id} inside the window`).toBeLessThanOrEqual(width);
  expect(Math.min(box.width,box.height),`${id} touch target`).toBeGreaterThanOrEqual(44);
  expect(box.y,`${id} inside the dock`).toBeGreaterThanOrEqual(railBox.y-0.5);
 }
 await openMore(page);
 for(const id of SHEET_TOOLS) await expect(page.locator(`#moreToolsSheet #${id}`),`${id} in More tools`).toBeVisible();
 // Every dock button has its label under the icon, and no label clips.
 for(const id of DOCK){
  const label=rail.locator(`#${id} .rail-label`);
  await expect(label,`${id} label is shown`).toBeVisible();
  expect(await label.evaluate(e=>e.scrollWidth<=e.clientWidth),`${id} label does not clip`).toBe(true);
 }
 await expect(page.locator('#moreToolsSheet #moreLayers'),'Layers in More tools').toBeVisible();
 await expect(page.locator('#moreToolsSheet #moreProperties'),'Properties in More tools').toBeVisible();
 // Layers opens as a bottom sheet from More tools, and replaces the More tools sheet.
 await page.locator('#moreToolsSheet #moreLayers').click();
 await expect(page.locator('#layersSheet')).toHaveClass(/sheet-open/);
 await expect(page.locator('#moreToolsSheet')).not.toHaveClass(/sheet-open/);
 expect(errors).toEqual([]);
});

// Issue #479: with More tools open the page still does not scroll, and every sheet control is at least 44 px.
for(const lang of ['en','es']) test(`More tools keeps the page fixed at 390x844 (${lang})`,async({page})=>{
 const errors=await openEditor(page,390,844,lang);
 await openMore(page);
 expect(await page.evaluate(()=>document.documentElement.scrollHeight-innerHeight),'no vertical page scroll').toBeLessThanOrEqual(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),'no horizontal page scroll').toBeLessThanOrEqual(0);
 const small=await page.locator('#moreToolsSheet button').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return `${e.id||e.className} ${Math.round(r.width)}x${Math.round(r.height)}`;}).filter(s=>{const [w,h]=s.split(' ').pop().split('x').map(Number);return w<44||h<44;}));
 expect(small,'sheet controls under 44x44').toEqual([]);
 expect(errors).toEqual([]);
});
