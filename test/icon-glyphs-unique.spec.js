import {test,expect} from '@playwright/test';

// Two controls on one screen never share a glyph. A desktop toolbar button and a phone Menu row each name their icon in
// the sprite, so this compares those names: every visible control on the screen must reference a different symbol.

// The glyph a control shows: the sprite id of every icon inside it, in order. Chevrons on folding group headings are
// disclosure markers rather than commands, so the Menu check leaves them out.
async function glyphsOf(locator){
 return locator.evaluate(el=>[...el.querySelectorAll('use')].map(u=>u.getAttribute('href')));
}

// Lists the visible controls of a screen with their glyphs, then fails on any glyph two controls share.
function duplicates(entries){
 const byGlyph={};
 for(const {name,glyphs} of entries)for(const g of glyphs)(byGlyph[g]??=[]).push(name);
 return Object.entries(byGlyph).filter(([,names])=>names.length>1);
}

test('no two visible desktop toolbar controls share a glyph (1280x800)',async({page})=>{
 await page.setViewportSize({width:1280,height:800});
 await page.goto('/');
 await expect(page.locator('header.top #name')).toBeVisible();
 await page.screenshot({path:'test-results/glyph-desktop-1280x800.png'});
 const buttons=page.locator('header.top button, .zoombar button');
 const entries=[];
 for(let i=0;i<await buttons.count();i++){
  const b=buttons.nth(i);
  if(!await b.isVisible())continue;
  const glyphs=await glyphsOf(b);
  if(glyphs.length===0)continue;
  entries.push({name:(await b.getAttribute('id'))??(await b.getAttribute('aria-label')),glyphs});
 }
 expect(entries.length,'toolbar and zoom bar controls with a glyph').toBeGreaterThan(10);
 expect(duplicates(entries)).toEqual([]);
 expect(await glyphsOf(page.locator('#new'))).toEqual(['#i-new']);
 expect(await glyphsOf(page.locator('#zoomIn'))).toEqual(['#i-zoom-in']);
});

// The phone Menu is the screen. Every group is unfolded, so each row is listed; an Issues row is listed only when the
// document has an issue, so one is added first.
test('no two visible phone Menu rows share a glyph (390x844, Spanish)',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept().catch(()=>{}));
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?lang=es');
 await expect(page.locator('header.top #name')).toBeVisible();
 await page.locator('#phoneMenu').click();
 await expect(page.locator('#phoneMenuList')).toBeVisible();
 const headings=page.locator('#phoneMenuList button.menu-section[aria-expanded="false"]');
 while(await headings.count()>0)await headings.first().click();
 await expect(page.locator('#phoneMenuList button.menu-section[aria-expanded="false"]')).toHaveCount(0);
 await expect(page.locator('#menuMessages')).toBeVisible();

 await page.locator('#phoneMenuList').evaluate(el=>{el.scrollTop=0;});
 await page.screenshot({path:'test-results/glyph-menu-es-390x844.png'});
 const rows=page.locator('#phoneMenuList button[role="menuitem"]:not(.menu-section)');
 const entries=[];
 for(let i=0;i<await rows.count();i++){
  const r=rows.nth(i);
  if(!await r.isVisible())continue;
  entries.push({name:await r.getAttribute('id'),glyphs:await glyphsOf(r)});
 }
 expect(entries.length,'rows with a glyph').toBeGreaterThan(30);
 expect(entries.every(e=>e.glyphs.length===1),'every row has exactly one glyph').toBe(true);
 expect(duplicates(entries)).toEqual([]);
 expect(errors).toEqual([]);
});

test('the Save and Save As, Front and Back, Messages and Issues rows each have their own glyph (390x844, en)',async({page})=>{
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await expect(page.locator('header.top #name')).toBeVisible();
 // Moving an object outside the hoop adds an issue, which the status bar's issues chip shows (the Menu has no row for it).
 await page.locator('#phoneMenu').click();
 await page.locator('#menuLayers').click();
 await page.locator('.object-row').first().click();
 // The Layers sheet covers the selection bar, so it closes before the bar's Properties control is tapped.
 await page.locator('#layersSheet .close-control').click();
 await page.locator('#barProperties').click();
 await page.locator('#posX').fill('300');
 await page.locator('#posX').press('Tab');
 await expect(page.locator('#count')).toHaveClass(/error/);
 await page.locator('#phoneMenu').click();
 const headings=page.locator('#phoneMenuList button.menu-section[aria-expanded="false"]');
 while(await headings.count()>0)await headings.first().click();
 const glyph=id=>glyphsOf(page.locator(`#${id}`));
 expect(await glyph('menuSave')).toEqual(['#i-save']);
 expect(await glyph('menuSaveAs')).toEqual(['#i-save-as']);
 expect(await glyph('menuMessages')).toEqual(['#i-msg']);
  expect(await glyph('menuToFront')).not.toEqual(await glyph('menuToBack'));
});

// The phone Menu's Edit rows and the selection bar's buttons are one screen with a selection. Duplicate is the same command
// in both places, so it shares the desktop's glyph; Copy is a different command and must not share any glyph on the screen.
test('phone Copy has its own glyph, and Duplicate matches the selection bar (390x844, en)',async({page})=>{
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await expect(page.locator('header.top #name')).toBeVisible();
 await page.locator('#phoneMenu').click();
 await page.locator('#menuLayers').click();
 await page.locator('.object-row').first().click();
 await page.locator('#phoneMenu').click();
 const headings=page.locator('#phoneMenuList button.menu-section[aria-expanded="false"]');
 while(await headings.count()>0)await headings.first().click();
 const menu=page.locator('#phoneMenuList');
 const rows=menu.locator('button[role="menuitem"]:not(.menu-section)');
 const bar=page.locator('.context-bar button');
 const entries=[];
 for(const [locator,prefix] of [[rows,'menu'],[bar,'bar']]){
  for(let i=0;i<await locator.count();i++){
   const r=locator.nth(i);
   if(!await r.isVisible())continue;
   entries.push({name:(await r.getAttribute('id'))??(await r.getAttribute('aria-label'))??prefix,glyphs:await glyphsOf(r)});
  }
 }
 // Duplicate, Delete and Properties are the same command in the Menu and on the selection bar, so each pair may share a
 // glyph. Any other shared glyph is a defect.
 const sameCommand=[['barDuplicate','menuDuplicate'],['barDelete','menuDelete'],['barProperties','menuProperties']].map(p=>p.sort().join('|'));
 const clashes=duplicates(entries).filter(([,names])=>!sameCommand.includes([...names].sort().join('|')));
 expect(clashes).toEqual([]);
 expect(await glyphsOf(page.locator('#menuCopy'))).toEqual(['#i-copy-text']);
 expect(await glyphsOf(page.locator('#menuDuplicate'))).toEqual(['#i-copy']);
 expect(await glyphsOf(page.locator('#barDuplicate').first())).toEqual(['#i-copy']);
});
