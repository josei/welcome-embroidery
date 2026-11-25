import {test,expect} from '@playwright/test';

// The Export dialog at phone and tablet widths: a 340 px card whose select and file-name field keep the desktop's width, with the
// desktop's stacked footer; no label wraps.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function measureDialog(page,width,height,lang){
 await page.setViewportSize({width,height});
 await page.goto(`/?lang=${lang}`);
 await expect(page.locator('.canvas')).toBeVisible();
 await page.locator('#export').click();
 await expect(page.locator('#exportDialog')).toBeVisible();
 const m=await page.evaluate(()=>{
  const box=el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height};};
  const d=document.querySelector('#exportDialog');
  const download=document.querySelector('#download');
  const lines=el=>{const r=document.createRange();r.selectNodeContents(el);return new Set([...r.getClientRects()].map(x=>Math.round(x.top))).size;};
  return {
   dialog:box(d),
   download:box(download),
   downloadLines:lines(download),
   downloadOverflow:download.scrollWidth>download.clientWidth,
   select:box(document.querySelector('#format')),
   fileStem:box(document.querySelector('#exportFileStem')),
  };
 });
 await page.keyboard.press('Escape');
 await expect(page.locator('#exportDialog')).toBeHidden();
 return m;
}

for(const lang of ['en','es']) for(const size of [{width:390,height:844},{width:768,height:1024}]){
 test(`Download is the one footer button, full width and 44 px tall, at ${size.width}x${size.height} (${lang})`,async({page})=>{
  const m=await measureDialog(page,size.width,size.height,lang);
  expect(Math.abs(m.download.x-m.fileStem.x),'same left edge as the fields').toBeLessThan(1);
  expect(m.download.w,'Download as wide as the fields').toBeCloseTo(m.fileStem.w,0);
  expect(m.download.h,'Download is a 44 px touch target').toBeGreaterThanOrEqual(44);
 });

 test(`no Export dialog button label wraps or overflows at ${size.width}x${size.height} (${lang})`,async({page})=>{
  await page.setViewportSize({width:size.width,height:size.height});
  await page.goto(`/?lang=${lang}`);
  await page.locator('#export').click();
  await expect(page.locator('#exportDialog')).toBeVisible();
  await page.locator('#allFormats').check();
  const formats=await page.locator('#format option').evaluateAll(os=>os.map(o=>o.value));
  expect(formats.length).toBeGreaterThan(1);
  for(const format of formats){
   await page.locator('#format').selectOption(format);
   const m=await page.evaluate(()=>{
    const download=document.querySelector('#download');
    const lines=el=>{const r=document.createRange();r.selectNodeContents(el);return new Set([...r.getClientRects()].map(x=>Math.round(x.top))).size;};
    return {label:download.textContent.trim(),downloadLines:lines(download),
     downloadOverflow:download.scrollWidth>download.clientWidth};
   });
   expect(m.downloadLines,`"${m.label}" on one line`).toBe(1);
   expect(m.downloadOverflow,`"${m.label}" fits its button`).toBe(false);
  }
 });
}

test('the Export select and file-name field at 768x1024 are no wider than the desktop dialog\'s (en)',async({page})=>{
 const tablet=await measureDialog(page,768,1024,'en');
 const desktop=await measureDialog(page,1280,800,'en');
 expect(tablet.select.w,'select width').toBeLessThanOrEqual(desktop.select.w+0.5);
 expect(tablet.fileStem.w,'file-name width').toBeLessThanOrEqual(desktop.fileStem.w+0.5);
});

test('the desktop Export dialog keeps its card width, field widths and stacked actions (en)',async({page})=>{
 const d=await measureDialog(page,1280,800,'en');
 expect(d.dialog.w,'card width').toBeCloseTo(340,0);
 expect(d.select.w,'select width').toBeCloseTo(292,0);
 expect(d.fileStem.w,'file-name width').toBeCloseTo(292,0);
 expect(d.download.w,'Download width').toBeCloseTo(292,0);
});
