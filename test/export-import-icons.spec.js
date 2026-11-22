import {test,expect} from '@playwright/test';

// Export sends a file out of the app and Import brings one in. Their glyphs must differ in shape, so a
// phone reader never takes Export for Import. Each control points at its own sprite symbol.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

test('Export and Import have different sprite symbols and path data',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?lang=es');
 await page.locator('#rect').click();

 const symbols=await page.evaluate(()=>{
  const read=id=>{
   const s=document.getElementById(id);
   return s?[...s.querySelectorAll('path')].map(p=>p.getAttribute('d')).join('|'):null;
  };
  return {export:read('i-export'),import:read('i-import')};
 });
 expect(symbols.export,'Export symbol has path data').toBeTruthy();
 expect(symbols.import,'Import symbol has path data').toBeTruthy();
 expect(symbols.export,'Export and Import path data differ').not.toBe(symbols.import);

 await page.locator('#phoneMenu').click();
 for(;;){
  const folded=page.locator('#phoneMenuList .menu-section[aria-expanded="false"]').first();
  if(!(await folded.count())) break;
  await folded.click();
 }
 const hrefOf=id=>page.locator(`#${id} use`).getAttribute('href');
 const barHref=await page.locator('#export use').getAttribute('href');
 expect(barHref,'bar Export href').toBe('#i-export');
 expect(await hrefOf('menuExport'),'Menu Export href').toBe('#i-export');
 expect(await hrefOf('menuImport'),'Menu Import href').toBe('#i-import');
 expect(await hrefOf('menuExport'),'Export and Import hrefs differ').not.toBe(await hrefOf('menuImport'));
 expect(errors).toEqual([]);
});
