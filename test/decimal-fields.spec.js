import {test,expect} from '@playwright/test';

// Numeric fields show the decimal separator of the UI language, not the browser's: a dot in English, a comma in Spanish.
// The check reads the visible text of each field (a text field's inputValue is what is shown), not the stored value.
const selectRect=async page=>{await page.locator('#rect').click();};
// Opens an empty design: answers the restore prompt and any discard prompt, then clears the document with New.
const freshDesign=async page=>{
 await page.goto('/');
 if(await page.locator('#restoreDialog[open]').count())await page.locator('#restoreNo').click();
 if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
 await page.locator('#new').click();
 if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
 await expect(page.locator('.object-row')).toHaveCount(0);
};
const openAll=page=>page.evaluate(()=>document.querySelectorAll('details').forEach(d=>{d.open=true;}));

// How to bring each object-inspector decimal field on screen. Each recipe starts from a fresh page.
const recipes={
 rect: async page=>{await selectRect(page);},
 // A registry font (the first match for 'pacifico') enables the style fields; the default font is a single-line font, which disables them.
 letter: async page=>{await page.locator('#letter').click();await page.locator('#letteringText').fill('HI');await page.locator('#letteringText').press('Tab');await page.locator('#fontButton').click();await page.locator('#fontSearch').fill('pacifico');await page.locator('#fontSearch').press('Enter');await expect(page.locator('#fontPanel')).toBeHidden();await expect(page.locator('#font')).not.toHaveValue('welcome-mono/1');},
 fillMethodCross: async page=>{await selectRect(page);await page.locator('#fillMethod').selectOption('cross');},
 fillMethodMotif: async page=>{await selectRect(page);await page.locator('#fillMethod').selectOption('motif');},
 underlayContour: async page=>{await selectRect(page);await page.locator('#underlayType').selectOption('contour');},
 underlayLaydown: async page=>{await selectRect(page);await page.locator('#underlayType').selectOption('laydown');},
 blendThread: async page=>{await selectRect(page);await page.locator('#blendThread').selectOption('#527461');},
 fillRaised: async page=>{await selectRect(page);await page.locator('#fillRaised').check();},
 border: async page=>{await selectRect(page);await page.locator('#border').check();},
 applique: async page=>{await selectRect(page);await page.locator('#applique').check();},
 arrRadial: async page=>{await selectRect(page);await page.locator('#arrMode').selectOption('radial');},
 runStem: async page=>{await selectRect(page);await page.locator('#type').selectOption('run');await page.locator('#runStyle').selectOption('stem');},
 // A drawn open path set to satin: shows the satin width row and, for a single satin path, the end width row.
 satinPath: async page=>{await page.locator('#path').click();const box=await page.locator('#art').boundingBox();for(const [fx,fy] of [[0.3,0.6],[0.5,0.4],[0.7,0.6]])await page.mouse.click(box.x+box.width*fx,box.y+box.height*fy);await page.keyboard.press('Enter');await page.locator('#type').selectOption('satin');},
 // The fresh design has no path, so this draws a three-point open path with the path tool, then sets lettering to follow it.
 letterAlong: async page=>{await page.locator('#path').click();const box=await page.locator('#art').boundingBox();for(const [fx,fy] of [[0.3,0.6],[0.5,0.4],[0.7,0.6]])await page.mouse.click(box.x+box.width*fx,box.y+box.height*fy);await page.keyboard.press('Enter');await page.locator('#letter').click();await page.locator('#letteringText').fill('HI');await page.locator('#letteringText').press('Tab');await page.locator('#followPath').selectOption({index:1});},
};

// Object-inspector decimal fields, each with the recipe that shows it. Typed value is x,5 then x.5 (x is 2 unless the field's range needs a smaller one: 0 keeps 0.5 inside the bounds).
const table=[
 ['posX','rect'],['posY','rect'],['sizeW','rect'],['sizeH','rect'],['rotation','rect'],
 ['radius','rect'],['radiusTL','rect'],['radiusTR','rect'],['radiusBR','rect'],['radiusBL','rect'],
 ['hoopW','rect',50],['hoopH','rect',50],
 ['accordionStart','rect',0],['accordionEnd','rect',0],['angle','rect'],['spacing','rect',0],['lengthVariance','rect',0],
 ['stitchLength','rect'],['compensation','rect',0],
 ['offsetMm','rect',0],['strokeW','rect',0],['simpTol','rect',0],['roundMm','rect',0],['smallHoleArea','rect',0],['smallIslandArea','rect',0],
 ['arrA','rect'],['arrB','rect'],['arrAngle','arrRadial'],
 ['crossSize','fillMethodCross'],['motifSize','fillMethodMotif'],['motifSpacing','fillMethodMotif'],
 ['underlayInset','underlayContour'],['underlaySpacing','underlayContour'],['laydownSpacing','underlayLaydown'],
 ['blendAngle','blendThread'],['blendStart','blendThread',0],['blendEnd','blendThread',0],
 ['raisedSpacing','fillRaised'],['raisedAngle','fillRaised'],
 ['borderWidth','border'],['appliqueWidth','applique'],
 ['stemWidth','runStem'],
 ['satinWidth','satinPath'],['satinWidthEnd','satinPath'],['endInsetStart','satinPath',0],['endInsetEnd','satinPath',0],['pullLeft','satinPath',0],['pullRight','satinPath',0],
 ['letteringHeight','letter',15],['tracking','letter'],['wordSpacing','letter'],['lineHeight','letter'],['boldMm','letter'],['italicDeg','letter'],
 ['alongOffset','letterAlong'],
];
// Decimal fields the harness does not drive yet, with the reason. None is shown by the default rectangle.
const excluded={
 nodeWidth:'needs a satin path with a selected node (node editing), not driven here',
 widthClear:'needs a satin path with width stops, not driven here',
 photoSpacing:'needs a photo object; the photo import is not driven here',
 photoContrast:'needs a photo object; the photo import is not driven here',
};

for(const [locale,sep,other] of [['en-US','.',','],['es-ES',',','.']]){
 test.describe(`decimal separator (${locale})`,()=>{
  test.use({locale,actionTimeout:10000});

  // One test per panel, so each fits its own time budget.
  const panels={
   'transform and hoop':['posX','posY','sizeW','sizeH','rotation','radius','radiusTL','radiusTR','radiusBR','radiusBL','hoopW','hoopH'],
   'stitch rows':table.map(([id])=>id).filter(id=>!['posX','posY','sizeW','sizeH','rotation','radius','radiusTL','radiusTR','radiusBR','radiusBL','hoopW','hoopH','arrA','arrB','arrAngle','letteringHeight','tracking','wordSpacing','lineHeight','boldMm','italicDeg','alongOffset'].includes(id)),
   'lettering':['letteringHeight','tracking','wordSpacing','lineHeight','boldMm','italicDeg'],
   'path':['alongOffset'],
   'array':['arrA','arrB','arrAngle'],
  };
  for(const [panel,ids] of Object.entries(panels)){
  test(`table, ${panel}: every decimal field shows the UI separator and accepts both separators`,async({page})=>{
   test.setTimeout(600000);
   // Every field is checked even when one fails; the failures are listed together at the end.
   const failures=[];
   for(const [id,recipe,x=2] of table.filter(([id])=>ids.includes(id))){
    // A fresh design per field, from an empty document.
    await freshDesign(page);
    await recipes[recipe](page);
    await openAll(page);
    const field=page.locator('#'+id);
    try{
     await expect(field,id).toBeVisible();
     // A disabled field fails here in seconds, instead of making fill wait out the whole budget.
     await expect(field,`${id} enabled`).toBeEnabled({timeout:6000});
     expect(await field.getAttribute('inputmode'),id).toBe('decimal');
     for(const [typed,expected] of [[`${x},5`,`${x}${sep}5`],[`${x}.5`,`${x}${sep}5`]]){
      await field.fill(typed);
      await field.press('Enter');
      await expect(field,`${id} typed ${typed}`).toHaveValue(expected);
      expect(await field.inputValue(),id).not.toContain(other);
     }
    }catch(e){failures.push(`${id}: ${e.message.split('\n')[0]}`);}
   }
   expect(failures,'fields that did not show the UI separator').toEqual([]);
  });
  }

  test('array: typing 1,5 into the step field commits 1.5 and matches the copies from 1.5',async({page})=>{
   // Reads the copy list of a three-copy linear array made from the given step text.
   const copies=async step=>{
    // A new page per run, so each array starts from an empty design.
    const run=await page.context().newPage();
    try{
     await freshDesign(run);
     await run.locator('#rect').click();
     await openAll(run);
     await run.locator('#arrMode').selectOption('linear');
     await run.locator('#arrCount').fill('3');
     await run.locator('#arrA').fill(step);
     await run.locator('#arrB').fill('0');
     await run.locator('#arrBtn').click();
     const rows=await run.locator('.object-row').count();
     expect(rows).toBeGreaterThan(1);
     // Where each copy is drawn, in pixels: the copies move with the step, so this compares positions, not text.
     return await run.locator('#shapes [data-id]').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)];}));
    }finally{await run.close();}
   };
   const comma=await copies('1,5');
   const dot=await copies('1.5');
   expect(comma.length).toBeGreaterThan(0);
   expect(comma).toEqual(dot);
   // The step is read, not ignored: a different step moves the copies.
   expect(comma).not.toEqual(await copies('3'));
  });
 });
}

// Excluded fields are listed so a reader can see what the table does not cover.
test('excluded decimal fields are not in the table, and each has a reason',()=>{
 const listed=new Set(table.map(([id])=>id));
 for(const [id,reason] of Object.entries(excluded)){expect(listed.has(id),id).toBe(false);expect(reason.length,id).toBeGreaterThan(0);}
});

test.describe('Corner radius and rows, English UI on a Spanish browser',()=>{
 test.use({locale:'es-ES'});
 test('numeric fields show a dot when the UI is English, whatever the browser locale',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('welcome.lang','en'));
  await page.goto('/');
  await selectRect(page);
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  expect(await page.locator('#posX').inputValue()).toMatch(/^-?\d+\.\d$/);
  expect(await page.locator('#hoopW').inputValue()).not.toContain(',');
  await page.locator('#posX').fill('-12.0');
  await page.locator('#posX').press('Enter');
  await expect(page.locator('#posX')).toHaveValue('-12.0');
 });
});
