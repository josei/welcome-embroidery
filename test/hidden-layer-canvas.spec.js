import {test,expect} from '@playwright/test';

// A hidden layer is left out of the stitches and the export, so the drawing shows it ghosted at every size. Hiding it
// lowers the opacity of its shape; showing it again removes that, so the shape is back at full strength.

const SIZES=[[1440,900,false],[390,844,true],[768,1024,true]];

async function openPage(browser,w,h,touch){
 const context=await browser.newContext({viewport:{width:w,height:h},hasTouch:touch,baseURL:test.info().project.use.baseURL});
 const page=await context.newPage();
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 page.on('dialog',d=>d.accept());
 return {page,context};
}

// Draws one rectangle and makes sure the Layers list is on screen.
async function drawRect(page){
 await page.goto('/?lang=en');
 await expect(page.locator('header.top')).toBeVisible();
 if(await page.locator('#restoreDialog[open]').count())await page.locator('#restoreNo').click();
 if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
 const before=await page.locator('#shapes [data-id]').evaluateAll(els=>els.map(e=>e.dataset.id));
 await page.locator('#rect').click();
 const c=await page.locator('.canvas').boundingBox();
 await page.mouse.move(c.x+c.width*0.3,c.y+c.height*0.3);
 await page.mouse.down();
 await page.mouse.move(c.x+c.width*0.6,c.y+c.height*0.6,{steps:5});
 await page.mouse.up();
 await expect(page.locator('#remove')).toBeEnabled();
 if(!(await page.locator('.object-row').first().isVisible())&&await page.locator('#phoneMenu').isVisible()){
  await page.locator('#phoneMenu').click();
  await page.locator('#menuLayers').click();
 }
 await expect(page.locator('.object-row').first()).toBeVisible();
 // The rectangle is the one object the draw added.
 const after=await page.locator('#shapes [data-id]').evaluateAll(els=>els.map(e=>e.dataset.id));
 return after.find(id=>!before.includes(id));
}

// The drawn shape, read from the SVG scene by its object id.
const shapeOpacity=(page,id)=>page.locator(`#shapes [data-id="${id}"]`).evaluate(el=>({
 attr:el.getAttribute('opacity'),
 classed:el.classList.contains('hidden-layer'),
}));

for(const [w,h,touch] of SIZES){
 test(`a hidden layer is ghosted on the canvas and restored when shown at ${w}x${h}`,async({browser})=>{
  test.setTimeout(120000);
  const {page,context}=await openPage(browser,w,h,touch);
  try{
   const id=await drawRect(page);
   // Visible: the shape is drawn at full strength.
   await expect.poll(()=>shapeOpacity(page,id)).toEqual({attr:null,classed:false});

   const eye=page.locator(`.object-row[data-id="${id}"]`).locator('xpath=..').locator('.row-eye');
   await eye.click();
   await expect(eye).toHaveAttribute('aria-pressed','true');
   // Hidden: the shape is ghosted and marked as hidden.
   await expect.poll(()=>shapeOpacity(page,id)).toEqual({attr:'0.3',classed:true});

   await eye.click();
   await expect(eye).toHaveAttribute('aria-pressed','false');
   // Shown again: back to full strength.
   await expect.poll(()=>shapeOpacity(page,id)).toEqual({attr:null,classed:false});
  }finally{
   await context.close();
  }
 });
}
