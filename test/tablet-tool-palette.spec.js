import {test,expect} from '@playwright/test';

// The tablet portrait tool palette shows the desktop's icons, one per tool, in the same order, with the same accessible
// names. It shows no text labels, and every button is at least 44 px, the touch target the phone tool dock uses.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

// Each visible tool button: its id, its sprite symbol, its accessible name, and its size.
const palette=page=>page.evaluate(()=>[...document.querySelectorAll('.tool-rail button[id]')]
 .filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;})
 .map(e=>{const r=e.getBoundingClientRect();return {
  id:e.id,
  symbol:e.querySelector('use')?.getAttribute('href')??null,
  name:e.getAttribute('aria-label'),
  w:r.width,h:r.height,
  labels:[...e.querySelectorAll('.rail-label')].filter(l=>getComputedStyle(l).display!=='none'&&l.textContent.trim()).map(l=>l.textContent.trim()),
 };}));

async function open(page,width,height,lang){
 await page.setViewportSize({width,height});
 await page.goto(`/?lang=${lang}`);
 await expect(page.locator('.tool-rail')).toBeVisible();
}

for(const lang of ['en','es']) test(`tablet tool palette uses the desktop's icons and names at 768x1024 (${lang})`,async({page})=>{
 await open(page,1280,800,lang);
 const desktop=await palette(page);
 expect(desktop.length,'desktop tools were found').toBeGreaterThan(10);
 await open(page,768,1024,lang);
 const tablet=await palette(page);
 expect(tablet.map(t=>t.id),'tools in the same order').toEqual(desktop.map(t=>t.id));
 expect(tablet.map(t=>t.symbol),'same sprite symbol for every tool').toEqual(desktop.map(t=>t.symbol));
 expect(tablet.map(t=>t.name),'same accessible name for every tool').toEqual(desktop.map(t=>t.name));
});

for(const lang of ['en','es']) test(`tablet tool palette shows no visible text labels at 768x1024 (${lang})`,async({page})=>{
 await open(page,768,1024,lang);
 const tools=await palette(page);
 expect(tools.length).toBeGreaterThan(10);
 for(const t of tools) expect(t.labels,`${t.id} shows no text`).toEqual([]);
});

for(const lang of ['en','es']) test(`every tablet tool button is at least 44 px at 768x1024 (${lang})`,async({page})=>{
 await open(page,768,1024,lang);
 const tools=await palette(page);
 for(const t of tools) expect(Math.min(t.w,t.h),`${t.id} touch target`).toBeGreaterThanOrEqual(44);
});
