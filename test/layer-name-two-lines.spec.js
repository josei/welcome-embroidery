import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

// On a desktop the Layers column is narrow, so a long layer name must stop at two lines with an ellipsis, and the Hide and Lock
// buttons must not push the name around when they appear on hover.

test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 page.on('dialog',d=>d.accept());
});

const LONG={
 en:'Centre of the flower with a very long layer name that keeps on going and going',
 es:'Centro de la flor con un nombre de capa muy largo',
};

async function drawAndRename(page,lang){
 await page.goto(`/?lang=${lang}`);
 await expect(page.locator('header.top')).toBeVisible();
 if(await page.locator('#restoreDialog[open]').count())await page.locator('#restoreNo').click();
 if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
 await page.locator('#rect').click();
 const c=await page.locator('.canvas').boundingBox();
 await page.mouse.move(c.x+c.width*0.3,c.y+c.height*0.3);
 await page.mouse.down();
 await page.mouse.move(c.x+c.width*0.6,c.y+c.height*0.6,{steps:5});
 await page.mouse.up();
 await expect(page.locator('.object-row').first()).toBeVisible();
 await page.locator('.object-row').first().locator('.row-name').dblclick();
 await page.locator('.row-rename').fill(LONG[lang]);
 await page.locator('.row-rename').press('Enter');
 await expect(page.locator('.object-row').first().locator('.row-name')).toHaveText(LONG[lang]);
}

function nameMetrics(){
 const row=document.querySelector('.object-row');
 const name=row.querySelector('.row-name');
 const cs=getComputedStyle(name);
 const lineHeight=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.2;
 const box=name.getBoundingClientRect();
 return {
  lines:Math.round(box.height/lineHeight),
  left:Math.round(box.left),
  width:Math.round(box.width),
  clamped:name.scrollHeight>name.clientHeight,
 };
}

for(const lang of ['en','es']){
 test(`a long layer name stops at two lines with an ellipsis in ${lang} at 1440x900`,async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await drawAndRename(page,lang);
  const m=await page.locator('.object-row').first().evaluate(nameMetrics);
  expect(m.lines,`name lines in ${lang}`).toBeLessThanOrEqual(2);
  expect(m.clamped,`long name is cut with an ellipsis in ${lang}`).toBe(true);
 });

 test(`the Hide and Lock buttons do not move a layer name in ${lang} at 1440x900`,async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await drawAndRename(page,lang);
  const row=page.locator('.object-row').first();
  const before=await row.evaluate(nameMetrics);
  await row.hover();
  const hovered=await row.evaluate(nameMetrics);
  expect(hovered.left,`name position on hover in ${lang}`).toBe(before.left);
  expect(hovered.width,`name width on hover in ${lang}`).toBe(before.width);
  expect(await page.locator('.object-line').first().locator('.row-eye').isVisible()).toBe(true);
  const nameRight=await row.locator('.row-name').evaluate(n=>n.getBoundingClientRect().right-parseFloat(getComputedStyle(n).paddingRight));
  const eyeLeft=await page.locator('.object-line').first().locator('.row-eye').evaluate(b=>b.getBoundingClientRect().left);
  expect(nameRight,`name text ends before the Hide button in ${lang}`).toBeLessThanOrEqual(eyeLeft+1);
 });
}

test('the desktop layer names are captured in both languages at 1440x900',async({page})=>{
 const dir=process.env.SCREENSHOT_DIR;
 test.skip(!dir,'SCREENSHOT_DIR is not set');
 mkdirSync(dir,{recursive:true});
 await page.setViewportSize({width:1440,height:900});
 for(const lang of ['en','es']){
  await drawAndRename(page,lang);
  await page.locator('.object-row').first().hover();
  await page.locator('#objects').screenshot({path:`${dir}/layers-${lang}.png`});
 }
});
