import {test,expect} from '@playwright/test';
import {openPanel,closePanel} from '../scripts/walk-helpers.mjs';

// A hoop change on a phone refits the view, even when it is made in Properties: the hoop's outline stays inside the canvas
// after a preset, a typed size or a rotation. A zoom the user made is kept when the hoop does not change.
const SIZES=[[360,640],[390,844]];

test.use({hasTouch:true});
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const boxes=page=>page.evaluate(()=>{
  const r=e=>{const b=document.querySelector(e).getBoundingClientRect();return {l:b.left,t:b.top,r:b.right,b:b.bottom,w:b.width};};
  return {canvas:r('.layout main>.canvas'),hoop:r('#hoopOuter')};
});

function expectInside({canvas,hoop}){
  expect(hoop.l).toBeGreaterThanOrEqual(canvas.l);
  expect(hoop.r).toBeLessThanOrEqual(canvas.r);
  expect(hoop.t).toBeGreaterThanOrEqual(canvas.t);
  expect(hoop.b).toBeLessThanOrEqual(canvas.b);
}

async function setUp(page,width,height){
  await page.setViewportSize({width,height});
  await page.goto('/');
  await expect(page.locator('.tool-rail')).toBeVisible();
  await page.locator('#zoomFit').click();
}

for(const [width,height] of SIZES){
  test(`Choosing a larger hoop preset refits the view at ${width}x${height}`,async({page})=>{
    await setUp(page,width,height);
    await openPanel(page,'properties');
    await page.locator('#hoopPreset').selectOption('5x7in');
    await closePanel(page,'#inspector');
    await page.waitForTimeout(300);
    expectInside(await boxes(page));
  });

  test(`Typing a larger hoop size refits the view at ${width}x${height}`,async({page})=>{
    await setUp(page,width,height);
    await openPanel(page,'properties');
    for(const [id,v] of [['#hoopW','150'],['#hoopH','200']]){
      await page.locator(id).fill(v);
      await page.locator(id).press('Enter');
    }
    await closePanel(page,'#inspector');
    await page.waitForTimeout(300);
    expectInside(await boxes(page));
  });

  test(`Rotating the hoop refits the view at ${width}x${height}`,async({page})=>{
    await setUp(page,width,height);
    await openPanel(page,'properties');
    await page.locator('#hoopPreset').selectOption('5x7in');
    await page.locator('#hoopRotate').click();
    await closePanel(page,'#inspector');
    await page.waitForTimeout(300);
    expectInside(await boxes(page));
  });

  test(`A zoom the user made is kept when the hoop does not change at ${width}x${height}`,async({page})=>{
    await setUp(page,width,height);
    await page.locator('#zoomIn').click();
    const before=(await boxes(page)).hoop.w;
    await openPanel(page,'properties');
    await closePanel(page,'#inspector');
    await page.waitForTimeout(300);
    expect((await boxes(page)).hoop.w).toBeCloseTo(before,0);
  });
}
