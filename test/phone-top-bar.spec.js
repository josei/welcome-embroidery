import {test,expect} from '@playwright/test';

// Issue #454: at phone widths (375x667 and 390x844, portrait) the top bar holds only Menu, the design name, undo, redo and Export,
// at the desktop bar's 48 px. Every command that left the bar is one tap to open the Menu and one tap to choose, and the save status
// is a line of text in the Menu. At desktop widths nothing leaves the bar.
const PHONES=[[375,667],[390,844]];
const BAR_CONTROLS=['#phoneMenu','#name','#undo','#redo','#export'];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openEditor(page,width,height,lang='en'){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 return errors;
}

// The visible controls in the top bar, by id (the Menu button has an id; the name is an input).
const visibleBarIds=page=>page.locator('header.top button, header.top input').evaluateAll(els=>els
 .filter(e=>e.offsetParent!==null && !e.closest('.file-menu-list') && e.getBoundingClientRect().width>0)
 .map(e=>e.id||e.className).filter(Boolean));

for(const [width,height] of PHONES) for(const lang of ['en','es']){
 test(`the phone top bar holds only Menu, name, undo, redo and Export at ${width}x${height} (${lang})`,async({page})=>{
  const errors=await openEditor(page,width,height,lang);
  await page.locator('#rect').click();
  const ids=await visibleBarIds(page);
  expect(ids.sort(),'visible top-bar controls').toEqual([...BAR_CONTROLS].map(s=>s.slice(1)).sort());
  for(const sel of BAR_CONTROLS) await expect(page.locator(sel),`${sel} is shown`).toBeVisible();
  const h=await page.locator('header.top').evaluate(e=>e.getBoundingClientRect().height);
  expect(Math.abs(h-48),'top bar height is about 48 px').toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
 });
}

// Every command that left the bar, reached through the Menu: open the Menu, choose the row, and check what it did.
test('each command that left the bar is one tap to open the Menu and one to choose, at 390x844 (en)',async({page})=>{
 test.setTimeout(120000);
 const errors=await openEditor(page,390,844,'en');
 await page.locator('#rect').click();
 const menu=page.locator('#phoneMenu');
 const list=page.locator('#phoneMenuList');
 const open=async()=>{ if(!(await list.isVisible())) await menu.click(); await expect(list).toBeVisible(); };
 const objects=()=>page.locator('.object-row').count();

 // Save, Save As, Open and Import: each row exists and is enabled; Open and Import open their file pickers.
 await open();
 for(const id of ['menuSave','menuSaveAs','menuOpen','menuImport','menuShortcuts','menuSettings','menuDuplicate','menuDelete']){
  await expect(list.locator(`#${id}`),`${id} is in the Menu`).toBeVisible();
 }
 await expect(list.locator('.menu-heading')).toHaveText(['File','Edit','Arrange']);

 // Open: a file chooser opens.
 await open();
 const chooser=page.waitForEvent('filechooser');
 await list.locator('#menuOpen').click();
 await chooser.then(c=>expect(c.isMultiple()).toBe(false));
 await expect(list,'Open closes the menu').toHaveCount(0);

 // Import: a second file chooser opens.
 await open();
 const machine=page.waitForEvent('filechooser');
 await list.locator('#menuImport').click();
 await machine;
 await expect(list).toHaveCount(0);

 // Duplicate: one more object.
 const before=await objects();
 await open();
 await list.locator('#menuDuplicate').click();
 await expect.poll(objects).toBe(before+1);

 // Delete: back to the earlier count.
 await open();
 await list.locator('#menuDelete').click();
 await expect.poll(objects).toBe(before);
 await page.locator('#rect').click();

 // Keyboard shortcuts and Settings open their dialogs.
 await open();
 await list.locator('#menuShortcuts').click();
 await expect(page.locator('#keysDialog[open]'),'the shortcut sheet opens').toHaveCount(1);
 await page.keyboard.press('Escape');
 await open();
 await list.locator('#menuSettings').click();
 await expect(page.locator('#settingsDialog[open]'),'Settings opens').toHaveCount(1);
 await page.keyboard.press('Escape');

 expect(errors).toEqual([]);
});

// The save status: a visible line in the Menu, the same words as the header showed at desktop widths.
test('the save status is a visible line in the phone Menu (390x844, en)',async({page})=>{
 const errors=await openEditor(page,390,844,'en');
 await page.locator('#rect').click();
 await page.locator('#phoneMenu').click();
 const note=page.locator('#phoneMenuList .menu-note');
 await expect(note,'the status line is in the Menu').toHaveText('Autosaved in this browser');
 await expect(note).toBeVisible();
 expect(errors).toEqual([]);
});

// Desktop keeps every command on the bar and has no Menu button.
test('nothing leaves the top bar at 1024x768 and no phone Menu is shown',async({page})=>{
 const errors=await openEditor(page,1024,768,'en');
 await expect(page.locator('#phoneMenu'),'no phone Menu on a wide window').toHaveCount(0);
 for(const sel of ['#fileMenu','#editMenu','#arrangeMenu','#new','#open','#importMachine','#save','#undo','#redo','#duplicate','#remove','#helpBtn','#settingsBtn','#export']){
  await expect(page.locator(sel),`${sel} is on the bar`).toBeVisible();
 }
 expect(errors).toEqual([]);
});
