import {test,expect} from '@playwright/test';

// On a landscape phone (844x390) a right-edge sheet closes on a rightward swipe of at least
// 80 px on its head, and on a tap on the dimmed area. With Properties open, the rail's Layers button is reachable and swaps the sheet.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});
test.use({viewport:{width:844,height:390},hasTouch:true});

const sheetOf=page=>page.locator('.layout>aside.panel.sheet-open');
const openedCount=page=>page.locator('.layout>aside.panel.sheet-open').count();

// A touch swipe along the sheet head, dispatched through CDP so the page sees real touch input.
const touchSwipe=async(page,from,dx)=>{
 const cdp=await page.context().newCDPSession(page);
 const y=from.y;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y}]});
 for(let i=1;i<=10;i++){
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+dx*i/10,y}]});
 }
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await cdp.detach();
};

const headCentre=async(page,sheet)=>{
 const h=await sheet.locator('.layers-head, .sheet-head').first().boundingBox();
 return {x:h.x+h.width/2,y:h.y+Math.min(h.height/2,12)};
};

for(const lang of ['en','es']){
 test(`${lang}: a rightward swipe of 80 px closes an open Layers sheet`,async({page})=>{
  await page.goto(`/?lang=${lang}`);
  await page.locator('#layersBtn').click();
  const sheet=sheetOf(page);
  await expect(sheet).toHaveCount(1);
  await touchSwipe(page,await headCentre(page,sheet),90);
  await expect(sheetOf(page)).toHaveCount(0);
 });

 test(`${lang}: a rightward swipe of 80 px closes an open Properties sheet`,async({page})=>{
  await page.goto(`/?lang=${lang}`);
  await page.locator('#propertiesBtn').click();
  const sheet=sheetOf(page);
  await expect(sheet).toHaveCount(1);
  await touchSwipe(page,await headCentre(page,sheet),90);
  await expect(sheetOf(page)).toHaveCount(0);
 });
}

test('a short rightward swipe leaves the sheet open',async({page})=>{
 await page.goto('/?lang=en');
 await page.locator('#layersBtn').click();
 const sheet=sheetOf(page);
 await touchSwipe(page,await headCentre(page,sheet),40);
 await expect(sheetOf(page)).toHaveCount(1);
});

test('with Properties open, the rail Layers button is hit-testable and swaps the sheet',async({page})=>{
 await page.goto('/?lang=en');
 await page.locator('#propertiesBtn').click();
 await expect(sheetOf(page)).toHaveCount(1);
 const hit=await page.locator('#layersBtn').evaluate(el=>{
  const r=el.getBoundingClientRect();
  const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
  return !!top&&(top===el||el.contains(top));
 });
 expect(hit,'Layers button is the element at its centre').toBe(true);
 await page.locator('#layersBtn').click();
 await expect(page.locator('.layout>aside.panel.sheet-open')).toHaveCount(1);
 await expect(page.locator('#layersSheet.sheet-open')).toHaveCount(1);
 await expect(page.locator('#inspector.sheet-open')).toHaveCount(0);
});

test('tapping the dimmed area closes the open sheet',async({page})=>{
 await page.goto('/?lang=en');
 await page.locator('#layersBtn').click();
 await expect(sheetOf(page)).toHaveCount(1);
 await page.locator('.sheet-scrim').click({position:{x:300,y:150}});
 await expect(sheetOf(page)).toHaveCount(0);
});

// Regression guard: the landscape-only scrim offset must not reach portrait, where the scrim has to cover the full
// width so a tap on its left strip still dismisses the open bottom sheet.
test.describe('portrait phone',()=>{
 test.use({viewport:{width:390,height:844},hasTouch:true});
 test('tapping the left strip of the scrim closes the open portrait sheet',async({page})=>{
  await page.goto('/?lang=en');
  await page.locator('#phoneMenu').click();
  await page.locator('#menuLayers').click();
  await expect(sheetOf(page)).toHaveCount(1);
  const scrim=await page.locator('.sheet-scrim').boundingBox();
  expect(scrim.x,'portrait scrim starts at the left edge').toBe(0);
  await page.locator('.sheet-scrim').click({position:{x:20,y:100}});
  await expect(sheetOf(page)).toHaveCount(0);
 });
});
