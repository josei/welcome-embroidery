import {test,expect} from '@playwright/test';

// The Stitch type grid is a set of labelled cards. Its last row never holds a lone card, its rows share one height,
// and keyboard focus moves through the cards in the order they appear on screen.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const SIZES=[[1440,900],[390,844]];
for(const [width,height] of SIZES) for(const lang of ['en','es']){
 test(`Stitch type grid has no lone card on its last row at ${width}x${height} (${lang})`,async({page})=>{
  await page.setViewportSize({width,height});
  await page.goto(lang==='en'?'/':`/?lang=${lang}`);
  await page.locator('#rect').click();
  if(width<=600){
   await page.locator('#barProperties').click();
   await expect(page.locator('#inspector')).toHaveClass(/sheet-open/);
  }
  await page.locator('#type').selectOption('fill');
  const cards=page.locator('.icon-seg.labelled[data-select="type"] button');
  await expect(cards).toHaveCount(7);
  const boxes=await cards.evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return {top:Math.round(r.top),h:Math.round(r.height)};}));
  const rows=[...new Set(boxes.map(b=>b.top))].sort((a,b)=>a-b);
  const lastRow=boxes.filter(b=>b.top===rows[rows.length-1]);
  expect(lastRow.length,'the last row holds more than one card').toBeGreaterThan(1);
  for(const row of rows) expect(new Set(boxes.filter(b=>b.top===row).map(b=>b.h)).size,'cards in a row match height').toBe(1);
  expect(new Set(boxes.map(b=>b.h)).size,'every row matches height').toBe(1);
 });
}

test('Tab order through the Stitch type grid follows the on-screen order',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/');
 await page.locator('#rect').click();
 await page.locator('#type').selectOption('fill');
 const cards=page.locator('.icon-seg.labelled[data-select="type"] button:not([disabled])');
 const count=await cards.count();
 const visual=await cards.evaluateAll(bs=>bs
  .map((b,i)=>{const r=b.getBoundingClientRect();return {i,top:Math.round(r.top),left:Math.round(r.left)};})
  .sort((a,b)=>a.top-b.top||a.left-b.left).map(b=>b.i));
 const visited=[];
 await cards.nth(visual[0]).focus();
 for(let n=0;n<count;n++){
  visited.push(await page.evaluate(()=>document.activeElement.dataset.value));
  if(n<count-1) await page.keyboard.press('Tab');
 }
 const expected=await cards.evaluateAll((bs,order)=>order.map(i=>bs[i].dataset.value),visual);
 expect(visited).toEqual(expected);
});
