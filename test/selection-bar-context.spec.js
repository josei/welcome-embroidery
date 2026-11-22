import {test,expect} from '@playwright/test';
import {revealMenuRow} from './menu-reveal.js';

// On a tablet the selection bar is contextual: it appears with a selection and stays away otherwise. A phone has no
// selection bar at all; its selection commands are Menu rows. Bar controls keep the desktop bar's accessible names and
// sprite icons, and none of them draws a pointer arrow. English and Spanish.
const TABLETS=[[768,1024]];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openEditor(page,width,height,lang){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 return errors;
}

// Every icon in the bar with the sprite symbol it draws and that symbol's shapes.
async function barIcons(page){
 return page.locator('.floating use').evaluateAll(uses=>uses.map(u=>{
  const href=u.getAttribute('href');
  const symbol=document.querySelector(href);
  return {href,shapes:symbol?[...symbol.querySelectorAll('path,rect')].map(n=>n.getAttribute('d')||n.tagName):[]};
 }));
}

// id, accessible name and sprite symbol of every named control in the bar, including controls hidden at this width.
async function barControls(page){
 return page.locator('.floating button[id]').evaluateAll(els=>els.map(e=>({
  id:e.id,
  name:e.getAttribute('aria-label'),
  symbol:e.querySelector('use')?.getAttribute('href'),
  shown:e.getBoundingClientRect().width>0,
 })));
}

for(const [width,height] of TABLETS) for(const lang of ['en','es']){
 test(`the selection bar is shown only with a selection at ${width}x${height} (${lang})`,async({page})=>{
  const errors=await openEditor(page,width,height,lang);
  const bar=page.locator('.floating');
  await expect(bar,'no bar with nothing selected').toBeHidden();
  await page.locator('#rect').click();
  await expect(bar,'bar shown with a selection').toBeVisible();

  const shown=(await barControls(page)).filter(c=>c.shown);
  expect(shown.length,'the bar has controls').toBeGreaterThan(0);
  for(const control of shown) expect(control.name?.trim(),`${control.id} has an accessible name`).toBeTruthy();
  // English and Spanish names fit: nothing in the bar overflows it.
  const overflow=await bar.evaluate(el=>el.scrollWidth-el.clientWidth);
  expect(overflow,'no text overflows the bar').toBeLessThanOrEqual(1);

  // The desktop bar is the reference for both the names and the icons.
  await page.setViewportSize({width:1280,height:800});
  await expect(page.locator('.floating #snap'),'desktop bar').toBeVisible();
  const desktop=Object.fromEntries((await barControls(page)).map(c=>[c.id,c]));
  for(const control of shown){
   expect(desktop[control.id],`${control.id} is also in the desktop bar`).toBeTruthy();
   expect(control.name,`${control.id} keeps the desktop's name`).toBe(desktop[control.id].name);
   expect(control.symbol,`${control.id} keeps the desktop's icon`).toBe(desktop[control.id].symbol);
  }
  expect(errors).toEqual([]);
 });
}

for(const [width,height] of TABLETS) for(const lang of ['en','es']){
 test(`no pointer arrow is drawn in the bar at ${width}x${height} (${lang})`,async({page})=>{
  const errors=await openEditor(page,width,height,lang);
  await page.locator('#rect').click();
  await expect(page.locator('.floating')).toBeVisible();

  // The Select tool in the tool row is the one pointer on the screen; its shape is what the bar must not repeat.
  const select=page.locator('.tool-rail #select use');
  await expect(select).toBeVisible();
  const pointer=await select.evaluate(u=>{
   const symbol=document.querySelector(u.getAttribute('href'));
   return [...symbol.querySelectorAll('path')].map(p=>p.getAttribute('d'));
  });
  expect(pointer.length,'the Select tool draws its pointer').toBeGreaterThan(0);

  const icons=await barIcons(page);
  expect(icons.length,'the bar has icons').toBeGreaterThan(0);
  for(const icon of icons){
   for(const shape of icon.shapes){
    expect(pointer.includes(shape),`${icon.href} repeats the Select pointer`).toBe(false);
   }
  }

  // The multi-select toggle adds to the selection: a plus in a square, never the pointer.
  const toggle=await page.locator('#selectToggle use').evaluate(u=>{
   const symbol=document.querySelector(u.getAttribute('href'));
   return {
    href:u.getAttribute('href'),
    square:[...symbol.querySelectorAll('rect')].length>0,
    strokes:[...symbol.querySelectorAll('path')].length,
   };
  });
  expect(toggle.href,'the toggle does not use the Select pointer').not.toBe('#i-select');
  expect(toggle.square&&toggle.strokes>0,'the toggle is a plus in a square').toBe(true);
  expect(errors).toEqual([]);
 });
}

for(const lang of ['en','es']){
 test(`a landscape phone has no selection bar and keeps its selection commands in the Menu (${lang})`,async({page})=>{
  const errors=await openEditor(page,844,390,lang);
  await page.locator('#rect').click();
  await expect(page.locator('.phone-selection'),'the selection bar is shown with a selection').toBeVisible();

  // The commands the bar carries below desktop are all reachable as Menu rows.
  await page.locator('#phoneMenu').click();
  for(const id of ['menuDuplicate','menuDelete','menuGroup','menuClip'])
   await expect(await revealMenuRow(page.locator('#phoneMenuList'),id),`${id} is a Menu row`).toHaveCount(1);
  // The add-to-selection toggle is on the phone bar, not in the Menu.
  await expect(page.locator('.phone-selection #selectToggle'),'the toggle is on the phone bar').toBeVisible();
  expect(errors).toEqual([]);
 });
}
