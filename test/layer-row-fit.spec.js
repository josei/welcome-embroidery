import {test,expect} from '@playwright/test';

// Spanish labels are wider than the English ones, so the narrow layouts must still fit them:
// in the Layers list, the stitch type word stays whole, and a row keeps the height English rows have (no extra wrapped line);
// in the Properties panel, the underlay select shows its longest value in full.
// The desktop Layers column is wide enough for the longest translated name, so a Spanish layer name is shown whole there too.

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
 // Only a phone keeps Layers in a sheet; a portrait tablet shows its object list already.
 if(!(await page.locator('#objects').isVisible()) && await page.locator('#phoneMenu').isVisible()){
  await page.locator('#phoneMenu').click();
  await page.locator('#menuLayers').click();
 }
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
   if(!(await page.locator('#inspector').isVisible()) && await page.locator('#phoneMenu').isVisible()){
    await page.locator('#layersSheet .close-control').click();
    await page.locator('#barProperties').click();
   }else if(!(await page.locator('#inspector').isVisible()) && await page.locator('#propertiesBtn').isVisible()){
    await page.locator('#propertiesBtn').click();
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

// Measures each visible layer row: whether its name is cut off, whether the name box stays inside the row, and how tall that box is
// (one line per wrapped line).
function measureNames(){
 return [...document.querySelectorAll('.object-row')].filter(r=>r.offsetParent).map(r=>{
  const name=r.querySelector('.row-name'),rowBox=r.getBoundingClientRect(),nameBox=name.getBoundingClientRect();
  return {
   name:name.textContent,
   rowHeight:Math.round(rowBox.height),
   nameHeight:Math.round(nameBox.height),
   cutOff:name.scrollWidth>name.clientWidth,
   inside:nameBox.top>=rowBox.top-0.5&&nameBox.bottom<=rowBox.bottom+0.5,
  };
 });
}

test('desktop 1440x900 shows the long Spanish layer name whole without growing the English rows',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 const measured={};
 for(const lang of ['en','es']){
  await drawAndSelect(page,lang);
  measured[lang]=await page.evaluate(measureNames);
  expect(measured[lang].length,`${lang} rows`).toBeGreaterThan(0);
  for(const row of measured[lang]){
   expect(row.cutOff,`"${row.name}" is cut off in ${lang}`).toBe(false);
   expect(row.inside,`"${row.name}" is outside its row in ${lang}`).toBe(true);
  }
 }
 // Every English name stays on one line, so none of the English rows grows to make room for it.
 const englishNameHeights=[...new Set(measured.en.map(r=>r.nameHeight))];
 expect(englishNameHeights,`English name line heights`).toHaveLength(1);
 // The long Spanish name is in the list, and its row is tall enough to show the name it has.
 const longName=measured.es.find(r=>r.name==='Centro de la flor');
 expect(longName,'the long Spanish layer name is in the list').toBeTruthy();
 expect(longName.rowHeight,`the row holding "Centro de la flor" is tall enough for its name`).toBeGreaterThanOrEqual(longName.nameHeight);
});

// At 1024x768 the Layers list sits beside the canvas, and its type and count line ("relleno · 1.102 puntadas") must stay on one
// line in Spanish, so no row is taller than its name plus one line.
test('no layer row at 1024x768 in Spanish is taller than two lines',async({page})=>{
 test.setTimeout(120000);
 await page.setViewportSize({width:1024,height:768});
 await drawAndSelect(page,'es');
 const rows=await page.evaluate(()=>[...document.querySelectorAll('.object-row')].filter(r=>r.offsetParent).map(r=>{
  const lineHeight=parseFloat(getComputedStyle(r.querySelector('.row-name')).lineHeight)||15;
  return Math.round(r.querySelector('.row-text').getBoundingClientRect().height/lineHeight);
 }));
 expect(rows.length).toBeGreaterThan(0);
 for(const lines of rows)expect(lines).toBeLessThanOrEqual(2);
});
