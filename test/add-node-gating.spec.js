import {test,expect} from '@playwright/test';

// The add-node control is offered only while the node editor is on, and it changes the shape only then. A shape that is
// merely selected keeps its stitches and path data, and the toolbar that carries the control keeps its width.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openWithShape(page,width,height,tool='#rect'){
 page.on('dialog',d=>d.accept());
 await page.setViewportSize({width:1280,height:800});
 await page.goto('/?lang=en');
 await page.locator('#new').click();
 if(await page.locator('#discardDialog[open]').count()) await page.locator('#discardDiscard').click();
 await page.setViewportSize({width,height});
 await page.locator(tool).click();
 await expect(page.locator('.object-row'),'the shape is added').toHaveCount(1);
 return page.locator('.object-row').first();
}

// The count is worked out after each edit, so read it once the compile has finished.
const stitchCount=async page=>{await expect(page.locator('#count')).not.toHaveText(/Compiling/);return page.locator('#count').textContent();};
// The outline of each drawn object: the selection frame and the node handles sit outside the shapes layer.
const pathData=page=>page.evaluate(()=>[...document.querySelectorAll('#shapes [data-id]')].map(e=>e.getAttribute('points')||e.getAttribute('d')).join('|'));

for(const [width,height] of [[768,1024],[1024,768],[1440,900]]){
 test(`selecting a shape without node editing offers no add-node control (${width}x${height})`,async({page})=>{
  const row=await openWithShape(page,width,height);
  await row.click();
  const countBefore=await stitchCount(page), dataBefore=await pathData(page);
  await expect(page.locator('#nodeAdd')).toBeHidden();
  expect(await stitchCount(page)).toBe(countBefore);
  expect(await pathData(page)).toBe(dataBefore);
 });
}

test('entering node editing shows add-node, and activating it adds one node (1440x900)',async({page})=>{
 await openWithShape(page,1440,900,'#ellipse');
 await page.keyboard.press('Enter');
 await expect(page.locator('.path-node').first(),'node editing shows the path nodes').toBeAttached();
 await expect(page.locator('#nodeAdd')).toBeVisible();
 const nodesBefore=await page.locator('.path-node').count(), countBefore=await stitchCount(page), dataBefore=await pathData(page);
 await page.locator('#nodeAdd').click();
 await expect(page.locator('.path-node')).toHaveCount(nodesBefore+1);
 expect(await pathData(page)).not.toBe(dataBefore);
 expect(await stitchCount(page)).not.toBe(countBefore);
});

test('the add-node control does not change the toolbar width at 1024x768',async({page})=>{
 await openWithShape(page,1024,768);
 await page.keyboard.press('Enter');
 await expect(page.locator('#nodeAdd')).toBeVisible();
 const bar=page.locator('#nodeAdd').locator('xpath=..');
 const shown=(await bar.boundingBox()).width;
 await page.keyboard.press('Escape');
 await expect(page.locator('#nodeAdd')).toBeHidden();
 const hidden=(await bar.boundingBox()).width;
 expect(hidden).toBe(shown);
});
