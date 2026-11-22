import {test,expect} from '@playwright/test';

// The zoom bar's glyph buttons share one state style. A pressed control must read differently from a hovered one, so a
// tap or click shows feedback before it is released. The selected tool and keyboard focus use the same shared style.
// Checked from computed styles at a phone and a desktop size, in both languages.
const SIZES=[[390,844],[1600,1000]];
const BUTTONS=['#zoomIn','#zoomOut'];
// The top bar's Open glyph is hidden on phones, so the top-bar case runs at the desktop size only.
const TOP_BAR_SIZE=[1600,1000];

for(const lang of ['en','es'])for(const [w,h] of SIZES)for(const id of BUTTONS){
 test(`a pressed ${id} differs from its hover at ${w}x${h} (${lang})`,async({page})=>{
  await page.setViewportSize({width:w,height:h});
  await page.goto(lang==='en'?'/':`/?lang=${lang}`);
  const button=page.locator(id);
  await expect(button).toBeVisible();
  const background=()=>button.evaluate(el=>getComputedStyle(el).backgroundColor);

  await button.hover();
  const hovered=await background();
  await page.mouse.down();
  const pressed=await background();
  await page.mouse.up();

  expect(hovered,'hover fill').not.toBe('rgba(0, 0, 0, 0)');
  expect(pressed,'pressed fill').not.toBe(hovered);
 });

 if(id===BUTTONS[0]) test(`a selected tool differs from its hover at ${w}x${h} (${lang})`,async({page})=>{
  await page.setViewportSize({width:w,height:h});
  await page.goto(lang==='en'?'/':`/?lang=${lang}`);
  const hand=page.locator('#handTool');
  await expect(hand).toBeVisible();
  await hand.click();
  await page.mouse.move(0,0);
  const rest=await hand.evaluate(el=>getComputedStyle(el).backgroundColor);
  await hand.hover();
  const hovered=await hand.evaluate(el=>getComputedStyle(el).backgroundColor);
  expect(rest,'selected fill').not.toBe('rgba(0, 0, 0, 0)');
  expect(hovered,'selected hover fill').not.toBe(rest);
 });
}

for(const lang of ['en','es'])for(const [w,h] of SIZES){
 test(`keyboard focus on the zoom bar draws an outline at ${w}x${h} (${lang})`,async({page})=>{
  await page.setViewportSize({width:w,height:h});
  await page.goto(lang==='en'?'/':`/?lang=${lang}`);
  const button=page.locator('#zoomIn');
  await expect(button).toBeVisible();
  const outline=()=>button.evaluate(el=>getComputedStyle(el).outlineStyle);
  const rest=await outline();
  await button.focus();
  const focused=await outline();
  expect(rest).toBe('none');
  expect(focused).not.toBe(rest);
 });

 test(`keyboard focus on a top-bar glyph draws an outline at ${w}x${h} (${lang})`,async({page})=>{
  test.skip(w!==TOP_BAR_SIZE[0],'top bar glyph is hidden at phone width');
  await page.setViewportSize({width:w,height:h});
  await page.goto(lang==='en'?'/':`/?lang=${lang}`);
  const button=page.locator('#open');
  await expect(button).toBeVisible();
  const outline=()=>button.evaluate(el=>getComputedStyle(el).outlineStyle);
  const rest=await outline();
  await button.focus();
  const focused=await outline();
  expect(rest).toBe('none');
  expect(focused).not.toBe(rest);
 });
}

for(const lang of ['en','es']) test(`a pressed top-bar glyph differs from its hover at ${TOP_BAR_SIZE[0]}x${TOP_BAR_SIZE[1]} (${lang})`,async({page})=>{
 await page.setViewportSize({width:TOP_BAR_SIZE[0],height:TOP_BAR_SIZE[1]});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 const button=page.locator('#open');
 await expect(button).toBeVisible();
 const background=()=>button.evaluate(el=>getComputedStyle(el).backgroundColor);
 await button.hover();
 const hovered=await background();
 await page.mouse.down();
 const pressed=await background();
 await page.mouse.up();
 expect(hovered,'hover fill').not.toBe('rgba(0, 0, 0, 0)');
 expect(pressed,'pressed fill').not.toBe(hovered);
});

// The bold, italic and align toggles sit in the lettering panel and stay disabled until a lettering font is chosen.
// Opens a fresh design with a line of lettering set in a font that allows bold and italic.
const openLettering=async(page,lang,w,h)=>{
 await page.setViewportSize({width:w,height:h});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 if(await page.locator('#restoreDialog[open]').count())await page.locator('#restoreNo').click();
 const menu=page.locator('#phoneMenu');
 if(await menu.count()&&await menu.isVisible()){await menu.click();if(await page.locator('#menuSection-File[aria-expanded="false"]').count())await page.locator('#menuSection-File').click();await page.locator('#menuNew').click();}
 else await page.locator('#new').click();
 if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
 await page.locator('.tool-rail #letter').click();
 // The phone opens the text box as #canvasText on the canvas; the desktop panel uses #letteringText.
 const field=page.locator('#canvasText:visible, #letteringText:visible').first();
 await expect(field).toBeVisible();
 await field.fill('HI');
 await field.press('Tab');
 // The phone keeps the font button in a sheet that is not on screen at this point, so the font is set on the field itself.
 if(await page.locator('#fontButton').isVisible()){
  await page.locator('#fontButton').click();
  await page.locator('#fontSearch').fill('pacifico');
  await page.locator('#fontSearch').press('Enter');
  await expect(page.locator('#fontPanel')).toBeHidden();
 }else await page.locator('#font').evaluate(el=>{el.value='ttf/pacifico';el.dispatchEvent(new Event('change',{bubbles:true}));});
 // On a phone the lettering controls live in the Properties sheet, opened from the Menu.
 if(await page.locator('#phoneMenu').isVisible()){
  await page.locator('#phoneMenu').click();
  await page.locator('#menuProperties').click();
  await expect(page.locator('#inspector')).toHaveClass(/sheet-open/);
 }
 await expect(page.locator('#textBold')).toBeEnabled();
};

for(const lang of ['en','es'])for(const [w,h] of SIZES){
 test(`a pressed style-row toggle differs from its hover at ${w}x${h} (${lang})`,async({page})=>{
  await openLettering(page,lang,w,h);
  const toggle=page.locator('#textBold');
  const background=()=>toggle.evaluate(el=>getComputedStyle(el).backgroundColor);
  await toggle.hover();
  const hovered=await background();
  await page.mouse.down();
  const pressed=await background();
  await page.mouse.up();
  expect(hovered,'hover fill').not.toBe('rgba(0, 0, 0, 0)');
  expect(pressed,'pressed fill').not.toBe(hovered);
 });

 test(`an aria-pressed toggle shows selected against rest at ${w}x${h} (${lang})`,async({page})=>{
  await openLettering(page,lang,w,h);
  const toggle=page.locator('#textItalic');
  const background=()=>toggle.evaluate(el=>getComputedStyle(el).backgroundColor);
  await page.mouse.move(0,0);
  const rest=await background();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  await page.mouse.move(0,0);
  const selected=await background();
  expect(rest,'rest fill').not.toBe(selected);
  expect(selected,'selected fill').not.toBe('rgba(0, 0, 0, 0)');
 });
}
