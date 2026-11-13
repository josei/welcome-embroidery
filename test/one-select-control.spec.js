import {test,expect} from '@playwright/test';

// The editor shows one Select control per screen: the tool in the tool row. The multi-select toggle in the
// canvas bar has its own name and icon. Every icon in the bar that shows for a selected object has a name.
const SIZES=[[390,844],[768,1024],[1440,900]];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openEditor(page,width,height,lang){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 return errors;
}

for(const [width,height] of SIZES){
 test(`the editor shows exactly one Select control at ${width}x${height}`,async({page})=>{
  const errors=await openEditor(page,width,height,'en');
  const selects=page.getByRole('button',{name:/^Select\b/});
  await expect(selects,'one visible Select control').toHaveCount(1);
  await expect(selects).toBeVisible();
  expect(errors).toEqual([]);
 });
}

for(const lang of ['en','es']){
 test(`every icon in the selected-object bar has a name at 390x844 (${lang})`,async({page})=>{
  const errors=await openEditor(page,390,844,lang);
  await page.locator('#rect').click();
  await expect(page.locator('#barDuplicate'),'bar shown with a selection').toBeVisible();
  const bar=page.locator('.floating button');
  const count=await bar.count();
  expect(count,'the bar has buttons').toBeGreaterThan(0);
  for(let i=0;i<count;i++){
   const b=bar.nth(i);
   const name=await b.getAttribute('aria-label');
   expect(name?.trim(),`button ${i} has an accessible name`).toBeTruthy();
  }
  if(lang==='es') await expect(page.locator('#editNodes'),'edit nodes is named in Spanish').toHaveAttribute('aria-label','Editar nodos (Enter)');
  else await expect(page.locator('#editNodes'),'edit nodes is named in English').toHaveAttribute('aria-label','Edit nodes (Enter)');
  expect(errors).toEqual([]);
 });
}
