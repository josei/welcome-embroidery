import {test,expect} from '@playwright/test';

// Spanish labels are wider than the English ones, so the narrow layouts must still fit them:
// in the Layers list, the stitch type word stays whole, and a row keeps the height English rows have (no extra wrapped line);
// in the Properties panel, the underlay select shows its longest value in full.

test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 page.on('dialog',d=>d.accept());
});

const SIZES=[[768,1024],[844,390],[390,844]];

// Draws one rectangle, then opens the Layers list and selects the first row.
async function drawAndSelect(page,lang){
 await page.goto(`/?lang=${lang}`);
 await expect(page.locator('header.top')).toBeVisible();
 // A design left by the previous language's page may be offered back; start from a blank one.
 if(await page.locator('#restoreDialog[open]').count())await page.locator('#restoreNo').click();
 if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
 await page.locator('#rect').click();
 const c=await page.locator('.canvas').boundingBox();
 await page.mouse.move(c.x+c.width*0.3,c.y+c.height*0.3);
 await page.mouse.down();
 await page.mouse.move(c.x+c.width*0.6,c.y+c.height*0.6,{steps:5});
 await page.mouse.up();
 await expect(page.locator('#remove')).toBeEnabled();
 if(await page.locator('#layersBtn').isVisible()){
  await page.locator('#layersBtn').click();
 }else if(await page.locator('#phoneMenu').isVisible()){
  await page.locator('#phoneMenu').click();
  await page.locator('#menuLayers').click();
 }
 if(!(await page.locator('#tabLayers').isVisible())){
  const strip=page.locator('.inspector-collapse');
  if(await strip.isVisible())await strip.click();
  else if(await page.locator('.inspector-toggle').isVisible())await page.locator('.inspector-toggle').click();
 }
 if(await page.locator('#tabLayers').isVisible())await page.locator('#tabLayers').click();
 await expect(page.locator('.object-row').first()).toBeVisible();
 // The stitch count appears once the design has compiled; the rows are measured with it shown.
 await expect(page.locator('.row-count').first()).toBeVisible();
}

// Measures every visible layer row: its height, and whether its type word is shown whole.
function measureRows(){
 return [...document.querySelectorAll('.object-row')].filter(r=>r.offsetParent).map(r=>{
  const kind=r.querySelector('.row-kind');
  return {
   height:Math.round(r.getBoundingClientRect().height),
   kindWhole:kind.scrollWidth<=kind.clientWidth,
   kind:kind.textContent,
  };
 });
}

for(const [w,h] of SIZES){
 test(`layer rows keep the English height and show the type word whole at ${w}x${h}`,async({page})=>{
  test.setTimeout(120000);
  await page.setViewportSize({width:w,height:h});
  const heights={};
  for(const lang of ['en','es']){
   await drawAndSelect(page,lang);
   const rows=await page.evaluate(measureRows);
   expect(rows.length,`${lang} rows`).toBeGreaterThan(0);
   for(const row of rows){
    expect(row.kindWhole,`type word "${row.kind}" in ${lang} at ${w}x${h}`).toBe(true);
   }
   heights[lang]=[...new Set(rows.map(r=>r.height))];
  }
  expect(heights.es,`Spanish row heights at ${w}x${h}`).toEqual(heights.en);
 });
}

for(const [w,h] of SIZES){
 for(const lang of ['en','es']){
  test(`underlay value is shown in full in ${lang} at ${w}x${h}`,async({page})=>{
   await page.setViewportSize({width:w,height:h});
   await drawAndSelect(page,lang);
   if(await page.locator('.object-row').first().isVisible())await page.locator('.object-row').first().click();
   if(await page.locator('#tabProperties').isVisible())await page.locator('#tabProperties').click();
   else if(await page.locator('.inspector-toggle').isVisible())await page.locator('.inspector-toggle').click();
   else if(await page.locator('#phoneMenu').isVisible()){
    await page.locator('#phoneMenu').click();
    await page.locator('#menuProperties').click();
   }
   const select=page.locator('#underlayType');
   await expect(select).toBeVisible();
   const fit=await select.evaluate(s=>{
    const option=s.options[s.selectedIndex];
    const cs=getComputedStyle(s);
    const ctx=document.createElement('canvas').getContext('2d');
    ctx.font=`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    return {
     label:option.text,
     boxWidth:s.getBoundingClientRect().width,
     textWidth:Math.ceil(ctx.measureText(option.text).width),
     padding:parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight),
    };
   });
   // The arrow of a native select takes about 20px inside the box, beside the text, so the text needs room for it too.
   const arrowRoom=20;
   expect(fit.boxWidth,`"${fit.label}" in ${lang} at ${w}x${h}`).toBeGreaterThanOrEqual(fit.textWidth+fit.padding+arrowRoom);
  });
 }
}
