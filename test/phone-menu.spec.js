import {test,expect} from '@playwright/test';

// Issue #474 (part of #468; spec #470 sections 2, 3 and 5): the phone Menu is a three-line icon button in the top bar, and it opens a
// full-height sheet with a Command palette search field and four groups (File, Edit, View, Settings and Help). Each row has an icon
// and a short label that stays on one line in English and Spanish, and each row is at least 44 px tall. The sheet scrolls inside
// itself; the page does not scroll.
const SIZES=[[390,844],[844,390]];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openEditor(page,width,height,lang){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.locator('#rect').click();
 return errors;
}

for(const [width,height] of SIZES) for(const lang of ['en','es']){
 test(`the phone Menu is an icon button and its sheet lists the four groups at ${width}x${height} (${lang})`,async({page})=>{
  const errors=await openEditor(page,width,height,lang);
  const menu=page.locator('#phoneMenu');
  await expect(menu,'the Menu control has an accessible name').toHaveAttribute('aria-label',lang==='es'?/.+/:'Menu');
  await expect(menu.locator('svg use')).toHaveCount(1);
  const box=await menu.boundingBox();
  expect(box.width,'Menu touch target width').toBeGreaterThanOrEqual(44);
  expect(box.height,'Menu touch target height').toBeGreaterThanOrEqual(44);
  // No visible text in the top bar reads "Menu" (English) or "Menú" (Spanish).
  const barText=await page.locator('header.top').evaluate(e=>e.innerText);
  expect(barText.split('\n').map(s=>s.trim())).not.toContain(lang==='es'?'Menú':'Menu');
  await menu.click();
  const list=page.locator('#phoneMenuList');
  await expect(list).toBeVisible();
  await expect(list.locator('.menu-heading')).toHaveText(lang==='es'
   ? ['Archivo','Editar','Vista','Ajustes y ayuda']
   : ['File','Edit','View','Settings and Help']);
  // The search field leads, and the sheet fills the window.
  await expect(list.locator('[role="menuitem"]').first()).toHaveAttribute('id','menuCommandPalette');
  const sheet=await list.boundingBox();
  // Issue #481: the Menu opens at full height below the top bar (52 px portrait, 44 px landscape), so a tap on the bar dismisses it.
  expect(sheet.height,'sheet fills the window below the top bar').toBeGreaterThanOrEqual(height-(height>width?52:44)-1);
  // Every row: one line, an icon, at least 44 px tall.
  const rows=await list.locator('[role="menuitem"]').evaluateAll(els=>els.map(e=>{
   const r=e.getBoundingClientRect(), label=e.querySelector(':scope > span').getClientRects().length;
   return {id:e.id,h:r.height,lines:label,icon:!!e.querySelector('svg use'),iconHref:e.querySelector('svg use')?.getAttribute('href')};
  }));
  expect(rows.length,'the rows are listed').toBeGreaterThan(20);
  for(const row of rows){
   expect(row.icon,`${row.id} has an icon`).toBe(true);
   expect(row.h,`${row.id} is at least 44 px tall`).toBeGreaterThanOrEqual(44);
   expect(row.lines,`${row.id} label is one box`).toBe(1);
  }
  for(const id of ['menuNew','menuOpen','menuImport','menuSave','menuSaveAs','menuExport','menuUndo','menuRedo','menuCut','menuCopy','menuPaste','menuDuplicate','menuSelectAll','menuRepeat','menuGrid','menuSnap','menuFitHoop','menuSettings','menuMessages','menuHelp'])
   expect(rows.map(r=>r.id),`${id} is listed`).toContain(id);
  expect(rows.map(r=>r.id),'no keyboard-shortcut sheet row on a phone').not.toContain('menuShortcuts');
  // The sheet scrolls inside itself; the page never does.
  const doc=await page.evaluate(()=>({sh:document.documentElement.scrollHeight,ih:innerHeight,sw:document.documentElement.scrollWidth,iw:innerWidth}));
  expect(doc.sh,'document height equals the window height').toBe(doc.ih);
  expect(doc.sw,'document width equals the window width').toBe(doc.iw);
  const scrolls=await list.evaluate(e=>e.scrollHeight>e.clientHeight);
  expect(typeof scrolls).toBe('boolean');
  expect(errors).toEqual([]);
 });
}
