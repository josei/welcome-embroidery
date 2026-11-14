import {test,expect} from '@playwright/test';

// Node editing of a finished path shows its point handles. Adding an object afterwards must leave that mode, so the new
// object gets its normal selection frame and handles, the same as on a fresh load.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const frameState=page=>page.evaluate(()=>({
 frame:document.querySelectorAll('#art .sel-box').length,
 handles:document.querySelectorAll('#art .sel-handle').length,
 nodes:document.querySelectorAll('#art .path-node').length,
}));

// Draws a three-point path on the drawing and finishes it with Enter, so it is left with its point handles showing.
async function drawAndFinishPath(page){
 const art=await page.locator('#art').boundingBox();
 const cx=art.x+art.width/2,cy=art.y+art.height/2;
 await page.locator('#path').click();
 await page.mouse.click(cx-80,cy-40);
 await page.mouse.click(cx,cy+30);
 await page.mouse.click(cx+80,cy-40);
 await page.keyboard.press('Enter');
 await expect.poll(async()=>(await frameState(page)).nodes).toBeGreaterThan(0);
}

// Adds lettering and commits the placeholder box with Tab, which blurs it and keeps the text.
async function addLettering(page){
 await page.locator('#letter').click();
 await expect(page.locator('#canvasText')).toBeVisible();
 await page.locator('#canvasText').press('Tab');
 await expect(page.locator('#canvasText')).toHaveCount(0);
}

test('lettering added on a fresh load shows its frame and handles',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1600,height:1000});
 await page.goto('/?lang=en');
 await expect(page.locator('#hoopRing')).toBeVisible();
 await addLettering(page);
 const state=await frameState(page);
 expect(state.frame).toBe(1);
 expect(state.handles).toBeGreaterThan(0);
 expect(state.nodes).toBe(0);
 expect(errors).toEqual([]);
});

test('lettering added during path node editing gets a normal frame and handles',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1600,height:1000});
 await page.goto('/?lang=en');
 await expect(page.locator('#hoopRing')).toBeVisible();

 await page.locator('#letter').click();
 await expect(page.locator('#canvasText')).toBeVisible();
 await page.locator('#canvasText').press('Tab');
 await expect(page.locator('#canvasText')).toHaveCount(0);
 const fresh=await frameState(page);

 await page.keyboard.press('Control+z');
 await drawAndFinishPath(page);
 await addLettering(page);

 const after=await frameState(page);
 expect(after.nodes,'the path point handles are gone once lettering is added').toBe(0);
 expect(after.frame,'the new lettering shows its selection frame').toBe(1);
 expect(after.handles,'the new lettering shows the same handles as on a fresh load').toBe(fresh.handles);
 expect(errors).toEqual([]);
});
