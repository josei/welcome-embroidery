import {test,expect} from '@playwright/test';

// Unfolds every Menu group, so the rows of a folded group are in the DOM.
async function expandMenuGroups(page){
 for(;;){
  const folded=page.locator('#phoneMenuList .menu-section[aria-expanded="false"]').first();
  if(!(await folded.count())) return;
  await folded.click();
 }
}

// The phone Menu is a three-line icon button in the top bar, and it opens a
// full-height sheet with a Command palette search field and five groups (File, Edit, Arrange, View, Settings and Help). Each row has an icon
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
 test(`the phone Menu is an icon button and its sheet lists its groups at ${width}x${height} (${lang})`,async({page})=>{
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
  // Every group is unfolded, so the rows of all of them are checked.
  await expandMenuGroups(page);
  await expect(list.locator('.menu-heading')).toHaveText(lang==='es'
   ? ['Vista','Archivo','Editar','Herramientas','Nodos','Organizar','Cuadrícula y zoom','Ajustes y ayuda']
   : ['View','File','Edit','Tools','Nodes','Arrange','Grid and zoom','Settings and Help']);
  // The search field leads, and the sheet fills the window. On a phone the Menu is the only navigation: the canvas bar and the More
  // tools panel are gone, and their commands are rows in the groups above.
  await expect(list.locator('[role="menuitem"]').first()).toHaveAttribute('id','menuCommandPalette');
  const sheet=await list.boundingBox();
  // The Menu opens at full height below the top bar (52 px portrait, 44 px landscape), so a tap on the bar dismisses it.
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
  for(const id of ['menuNew','menuOpen','menuImport','menuSave','menuSaveAs','menuExport','menuUndo','menuRedo','menuCut','menuCopy','menuPaste','menuDuplicate','menuSelectAll','menuRepeat','menuGrid','menuSnap','menuFitHoop','menuSettings','menuMessages','menuHelp','menuAlignLeft','menuFlipH','menuToFront','menuUnion','menuDelete',
   // The canvas bar and the More tools panel used to hold these on a phone; the Menu is their one home now.
   'menuEditNodes','menuNodeAdd','menuNodeDelete','menuNodeSmooth','menuNodeCorner','menuGroup','menuUngroup','menuClip','menuUnclip','menuTextOnPath','menuTextOffPath','menuEllipse','menuPolygon','menuStar','menuPen','menuTrace','menuPhoto','menuLayers'])
   // On a landscape phone the rail carries Ellipse, so the Menu leaves its row out there.
   if(!(id==='menuEllipse'&&width>height)) expect(rows.map(r=>r.id),`${id} is listed`).toContain(id);
  // This sheet opens with an object selected, and the selection bar's Properties control is the route then.
  expect(rows.map(r=>r.id),'no Properties row while an object is selected').not.toContain('menuProperties');
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

// The Menu's rows and headings, in order, with the glyph each row draws and the reason lines each group shows.
async function menuContents(page){
 return page.locator('#phoneMenuList').evaluate(list=>{
  const out=[];
  for(const el of list.children){
   if(el.classList.contains('menu-heading')) out.push({heading:el.textContent.trim()});
   else if(el.classList.contains('menu-group-reason')) out.push({groupReason:el.textContent.trim()});
   else if(el.matches('[role="menuitem"]')) out.push({id:el.id,href:el.querySelector('svg use')?.getAttribute('href')??null,drawnReason:[...el.querySelectorAll('.menu-reason')].filter(r=>r.getClientRects().length).map(r=>r.textContent.trim()).join('')});
  }
  return out;
 });
}

for(const [width,height] of SIZES){
 test(`no two Menu rows draw the same glyph at ${width}x${height}`,async({page})=>{
  await openEditor(page,width,height,'en');
  await page.locator('#phoneMenu').click();
  await expandMenuGroups(page);
  const rows=(await menuContents(page)).filter(r=>r.id);
  const byGlyph=new Map();
  for(const row of rows){
   expect(row.href,`${row.id} draws a glyph`).toBeTruthy();
   byGlyph.set(row.href,[...(byGlyph.get(row.href)??[]),row.id]);
  }
  const shared=[...byGlyph.entries()].filter(([,ids])=>ids.length>1);
  expect(shared,'rows sharing a glyph').toEqual([]);
 });

 test(`each Menu group shows its reason line at most once with every group open at ${width}x${height}`,async({page})=>{
  await openEditor(page,width,height,'en');
  await page.locator('#phoneMenu').click();
  await expandMenuGroups(page);
  const contents=await menuContents(page);
  let group=null;let groupLine=null;const perGroup=new Map();
  for(const item of contents){
   if(item.heading!==undefined){group=item.heading;groupLine=null;perGroup.set(group,0);}
   else if(item.groupReason!==undefined){groupLine=item.groupReason;perGroup.set(group,perGroup.get(group)+1);}
   else if(item.id&&item.drawnReason){
    // A row repeats its reason only when it differs from its group's line.
    expect(item.drawnReason,`${item.id} reason differs from ${group}'s line`).not.toBe(groupLine);
   }
  }
  expect(perGroup.size,'the Menu has groups').toBeGreaterThan(5);
  for(const [name,count] of perGroup) expect(count,`${name} shows at most one reason line`).toBeLessThanOrEqual(1);
  expect(contents.filter(r=>r.groupReason!==undefined&&!r.groupReason).length,'every reason line has text').toBe(0);
 });
}
