import {test,expect} from '@playwright/test';

// The four corner-radius fields name their corner in full, in both languages. Their visible letters are the
// Spanish corner abbreviations (SI, SD, ID, II) in es-ES, and each field's accessible name is the full corner name.
const CORNERS=[
 {id:'radiusTL',en:'Top-left corner radius (mm)',es:'Radio de esquina superior izquierda (mm)',visibleEs:'SI'},
 {id:'radiusTR',en:'Top-right corner radius (mm)',es:'Radio de esquina superior derecha (mm)',visibleEs:'SD'},
 {id:'radiusBR',en:'Bottom-right corner radius (mm)',es:'Radio de esquina inferior derecha (mm)',visibleEs:'ID'},
 {id:'radiusBL',en:'Bottom-left corner radius (mm)',es:'Radio de esquina inferior izquierda (mm)',visibleEs:'II'},
];

for(const [lang,key] of [['en','en'],['es','es']]){
 for(const width of [1280,1024]){
  test(`corner radius fields name their corner in ${lang} at ${width}px`,async({page})=>{
   await page.setViewportSize({width,height:800});
   await page.goto(`/?lang=${lang}`);
   await page.locator('#rect').click();
   await expect(page.locator('#radiusTL')).toBeVisible();
   for(const c of CORNERS){
    const field=page.locator(`#${c.id}`);
    await expect(field).toHaveAccessibleName(key==='es'?c.es:c.en);
    const name=page.locator(`#${c.id}`).locator('xpath=..').locator('.corner-name');
    const box=await name.evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));
    expect(box.scroll,`${c.id} visible letters fit`).toBeLessThanOrEqual(box.client);
    if(key==='es')await expect(name).toHaveText(c.visibleEs);
   }
  });
 }
}
