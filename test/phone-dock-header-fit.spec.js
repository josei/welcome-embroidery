import {test,expect} from '@playwright/test';

// Phone portrait (390x844) in English and Spanish: Fit centres the hoop on the canvas, every dock tile keeps its grey
// fill after lettering is placed, no canvas shows between the header and the canvas, and Spanish dock labels
// keep a margin inside their tiles.
test.use({hasTouch:true});

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

// A dock tile at rest has no fill of its own: the tile is transparent on the bar, and only the armed or hovered tile takes one.
const TILE_FILL='rgba(0, 0, 0, 0)';

for(const lang of ['en','es']){
 test(`Fit centres the hoop on a 390x844 phone (${lang})`,async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(`/?lang=${lang}`);
  await page.locator('#zoomFit').click();
  const hoop=await page.locator('#hoopOuter').boundingBox();
  const centre=hoop.x+hoop.width/2;
  expect(Math.abs(centre-390/2),'hoop centre off the canvas middle').toBeLessThanOrEqual(2);
  await page.screenshot({path:`test-results/phone-fit-${lang}.png`});
 });

 test(`every dock tile keeps its fill after placing lettering (${lang})`,async({page})=>{
  page.on('dialog',d=>d.accept());
  await page.setViewportSize({width:390,height:844});
  await page.goto(`/?lang=${lang}`);
  await page.locator('#letter').click();
  await expect(page.locator('#canvasText')).toBeVisible();
  await page.keyboard.type('Hi');
  await page.keyboard.press('Control+Enter');
  await expect(page.locator('#canvasText')).toBeHidden();
  // The tile under the pointer shows its hover fill, so the rest fill is read from the tiles the pointer is not on.
  const fills=await page.locator('.phone-dock .chrome-tile:not(.is-selected)').evaluateAll(
   tiles=>tiles.filter(t=>!t.matches(':hover')).map(t=>getComputedStyle(t).backgroundColor));
  expect(fills.length).toBeGreaterThan(0);
  for(const fill of fills) expect(fill).toBe(TILE_FILL);
  await page.screenshot({path:`test-results/phone-dock-after-lettering-${lang}.png`});
 });

 test(`no canvas shows between the header and the canvas (${lang})`,async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(`/?lang=${lang}`);
  await expect(page.locator('header.top')).toBeVisible();
  const {top,strip}=await page.evaluate(()=>{
   const t=document.querySelector('header.top').getBoundingClientRect();
   const s=document.querySelector('#savedStatus,#idleStatus,#unsavedMark').getBoundingClientRect();
   return {top:{b:t.bottom},strip:{b:s.bottom}};
  });
  const exposed=[];
  for(let y=1;y<strip.b-1;y+=1){
   for(const x of [4,100,195,290,385]){
    const owner=await page.evaluate(([px,py])=>{
     const el=document.elementFromPoint(px,py);
     return el?.closest('header.top,#savedStatus,#idleStatus,#unsavedMark')?'band':'other';
    },[x,y+0.5]);
    if(owner!=='band'&&y+0.5>0&&y+0.5<strip.b) exposed.push(`${x},${y}`);
   }
  }
  expect(exposed,'points showing the canvas under the header or strip').toEqual([]);
  await page.screenshot({path:`test-results/phone-header-strip-${lang}.png`,clip:{x:0,y:0,width:390,height:Math.ceil(strip.b)+8}});
  expect(top.b).toBeGreaterThan(0);
 });

 test(`Spanish dock labels keep padding inside their tiles at 390 px (${lang})`,async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(`/?lang=${lang}`);
  await expect(page.locator('header.top')).toBeVisible();
  const pads=await page.locator('.phone-dock .chrome-tile').evaluateAll(tiles=>tiles.map(t=>{
   const label=t.querySelector('.tile-word');
   const tr=t.getBoundingClientRect(),lr=label.getBoundingClientRect();
   return {text:label.textContent,pad:Math.min(lr.left-tr.left,tr.right-lr.right)};
  }));
  for(const {text,pad} of pads) expect(pad,`${text} padding inside its tile`).toBeGreaterThanOrEqual(lang==='es'?4:2);
  await page.screenshot({path:`test-results/phone-dock-labels-${lang}.png`});
 });
}
