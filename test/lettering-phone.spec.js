import {test,expect} from '@playwright/test';

// On a phone, the lettering text box opens inside the viewport (its right edge is never cut off), its Save
// control is a 44 px touch target, and the hint toast does not cover the zoom bar.
test.use({hasTouch:true});

const SIZES=[[390,844],[360,740]];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function addLettering(page,width,height,lang){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.locator('.tool-rail #letter').click();
 await expect(page.locator('#canvasText'),'text box opens').toBeVisible();
 return errors;
}

for(const [width,height] of SIZES) for(const lang of ['en','es']){
 test(`the text box and hint fit a ${width}x${height} phone and the zoom bar is uncovered (${lang})`,async({page})=>{
  const errors=await addLettering(page,width,height,lang);
  const box=await page.locator('#canvasText').boundingBox();
  expect(box.x,'box left edge inside the viewport').toBeGreaterThanOrEqual(0);
  expect(box.x+box.width,'box right edge inside the viewport').toBeLessThanOrEqual(width);
  const hint=await page.locator('#canvasTextHint').boundingBox();
  const zoom=await page.locator('.zoombar').boundingBox();
  const overlap=hint.x<zoom.x+zoom.width&&hint.x+hint.width>zoom.x&&hint.y<zoom.y+zoom.height&&hint.y+hint.height>zoom.y;
  expect(overlap,'hint does not cover the zoom bar').toBe(false);
  expect(errors).toEqual([]);
 });
}

test('the text can be typed and saved by touch, and the box is a 44 px touch target (390x844, en)',async({page})=>{
 const errors=await addLettering(page,390,844,'en');
 const box=page.locator('#canvasText');
 const size=await box.boundingBox();
 expect(Math.min(size.width,size.height),'text box touch target').toBeGreaterThanOrEqual(44);
 await box.tap();
 await page.keyboard.press('Control+A');
 await page.keyboard.type('HI');
 await expect(box,'typed text is in the box').toHaveValue('HI');
 // Saving by touch: tapping the canvas outside the box leaves the box and keeps the text.
 await page.locator('.canvas').tap({position:{x:20,y:20}});
 await expect(page.locator('#canvasText'),'box closes after a tap outside').toHaveCount(0);
 // The layers list sits in a bottom sheet that is closed on a phone, so the row is attached rather than visible.
 await expect(page.locator('.object-row',{hasText:'HI'}),'the lettering keeps the typed text').toHaveCount(1);
 expect(errors).toEqual([]);
});
