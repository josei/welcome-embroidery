import {test,expect} from '@playwright/test';

// On a phone (390x844) the top bar's Export button is the export glyph, not a word: it has no visible text,
// is at most 44 px wide, and leaves the project name at least 200 px wide. Its name is kept in aria-label.
// The same button still opens the export dialog, and so does the Export row in the phone Menu.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openEditor(page,width,height,lang){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.locator('#rect').click();
 return errors;
}

for(const lang of ['en','es']){
 const word=lang==='en'?'Export':'Exportar';
 test(`phone bar Export is an icon with its name in aria-label (${lang})`,async({page})=>{
  const errors=await openEditor(page,390,844,lang);
  const exportBtn=page.locator('#export');
  await expect(exportBtn).toBeVisible();
  expect(await exportBtn.evaluate(e=>e.innerText.trim()),'no visible text in the Export button').toBe('');
  const width=await exportBtn.evaluate(e=>e.getBoundingClientRect().width);
  expect(width,'Export button width').toBeLessThanOrEqual(44);
  expect(await exportBtn.getAttribute('aria-label'),'aria-label').toBe(word);
  expect(await exportBtn.getAttribute('title'),'title').toBe(word);
  const nameWidth=await page.locator('#name').evaluate(e=>e.getBoundingClientRect().width);
  expect(nameWidth,'name field width at 390 px').toBeGreaterThanOrEqual(200);
  expect(errors).toEqual([]);
 });
}

test('the bar icon and the Menu entry both open the export dialog at 390x844',async({page})=>{
 const errors=await openEditor(page,390,844,'en');
 await page.locator('#export').click();
 await expect(page.locator('#exportDialog[open]')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('#exportDialog[open]')).toHaveCount(0);

 await page.locator('#phoneMenu').click();
 for(;;){
  const folded=page.locator('#phoneMenuList .menu-section[aria-expanded="false"]').first();
  if(!(await folded.count())) break;
  await folded.click();
 }
 await page.locator('#menuExport').click();
 await expect(page.locator('#exportDialog[open]')).toBeVisible();
 expect(errors).toEqual([]);
});

test('bar Export stays a word on the desktop at 1280x800',async({page})=>{
 const errors=await openEditor(page,1280,800,'en');
 const exportBtn=page.locator('#export');
 expect(await exportBtn.evaluate(e=>e.innerText.trim())).toBe('Export');
 expect(await exportBtn.evaluate(e=>getComputedStyle(e.querySelector('.export-icon')).display)).toBe('none');
 expect(errors).toEqual([]);
});

test('the phone bar at 390x844 in Spanish, with a design open',async({page})=>{
 const errors=await openEditor(page,390,844,'es');
 await page.locator('#rect').click();
 await page.locator('#export').hover();
 await page.screenshot({path:'test-results/phone-bar-390-es.png',clip:{x:0,y:0,width:390,height:60}});
 expect(errors).toEqual([]);
});

test('the desktop bar at 1280x800 in English',async({page})=>{
 const errors=await openEditor(page,1280,800,'en');
 await page.screenshot({path:'test-results/desktop-bar-1280-en.png',clip:{x:0,y:0,width:1280,height:70}});
 expect(errors).toEqual([]);
});
