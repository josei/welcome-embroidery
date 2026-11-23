import {test,expect} from '@playwright/test';
import {revealMenuRow} from './menu-reveal.js';

// The Settings dialog on phones and tablets: in landscape the card is capped at 480 px and centred, its title and Close
// stay in view while the groups scroll, a tap on the backdrop closes it, and the groups and language pair use the same
// border and control styles as the desktop dialog.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openSettings(page,lang){
 await page.goto(`/?lang=${lang}`);
 await expect(page.locator('.canvas')).toBeVisible();
 const headerButton=page.locator('#settingsBtn');
 if(await headerButton.isVisible()) await headerButton.click();
 else{
  await page.locator('#phoneMenu').click();
  await (await revealMenuRow(page.locator('#phoneMenuList'),'menuSettings')).click();
 }
 await expect(page.locator('#settingsDialog[open]')).toHaveCount(1);
}

const PHONE_LANDSCAPE={width:844,height:390};
const PHONE_PORTRAIT={width:390,height:844};
const TABLET_PORTRAIT={width:768,height:1024};

for(const lang of ['en','es']){
 test(`landscape phone ${lang}: the card is 480 px wide, centred, with title and Close in view`,async({page})=>{
  await page.setViewportSize(PHONE_LANDSCAPE);
  await openSettings(page,lang);
  const box=await page.locator('#settingsDialog').boundingBox();
  expect(Math.abs(box.width-480),'width is about 480 px').toBeLessThanOrEqual(1);
  expect(Math.abs(box.x+box.width/2-PHONE_LANDSCAPE.width/2),'centred horizontally').toBeLessThanOrEqual(2);
  const view=await page.evaluate(()=>{
   const d=document.getElementById('settingsDialog');
   const close=d.querySelector('[data-close-control]').getBoundingClientRect();
   const title=d.querySelector('h2').getBoundingClientRect();
   return {closeH:close.height,closeBottom:close.bottom,titleTop:title.top,innerH:innerHeight,innerW:innerWidth};
  });
  expect(view.closeH,'Close is at least 44 px tall').toBeGreaterThanOrEqual(44);
  expect(view.closeBottom,'Close sits inside the viewport without scrolling').toBeLessThanOrEqual(view.innerH);
  expect(view.titleTop,'title is inside the viewport').toBeGreaterThanOrEqual(0);
 });
}

test('landscape phone: the groups scroll inside the card while the title and Close stay put',async({page})=>{
 await page.setViewportSize(PHONE_LANDSCAPE);
 await openSettings(page,'en');
 const body=page.locator('#settingsDialog .settings-body');
 const scrolls=await body.evaluate(e=>e.scrollHeight>e.clientHeight);
 expect(scrolls,'the groups overflow the landscape card').toBe(true);
 const before=await page.locator('#settingsDialog h2').boundingBox();
 await body.evaluate(e=>{e.scrollTop=e.scrollHeight;});
 const after=await page.locator('#settingsDialog h2').boundingBox();
 expect(after.y,'title does not scroll away').toBe(before.y);
 await expect(page.locator('#settingsDialog [data-close-control]')).toBeInViewport();
});

for(const [name,size] of [['phone portrait',PHONE_PORTRAIT],['tablet portrait',TABLET_PORTRAIT],['phone landscape',PHONE_LANDSCAPE]]){
 test(`${name}: a tap on the backdrop closes Settings`,async({page})=>{
  await page.setViewportSize(size);
  await openSettings(page,'en');
  await page.mouse.click(4,4);
  await expect(page.locator('#settingsDialog')).toBeHidden();
 });

 test(`${name}: a tap inside the card keeps Settings open`,async({page})=>{
  await page.setViewportSize(size);
  await openSettings(page,'en');
  await page.locator('#settingsDialog h2').click();
  await expect(page.locator('#settingsDialog')).toBeVisible();
 });
}

test('desktop groups and the language pair use the same head and control styles as phones',async({page})=>{
 const styles=async(size)=>{
  await page.setViewportSize(size);
  await page.goto('/?lang=en');
  await expect(page.locator('.canvas')).toBeVisible();
  if(await page.locator('#settingsBtn').isVisible()) await page.locator('#settingsBtn').click();
  else{
   await page.locator('#phoneMenu').click();
   await (await revealMenuRow(page.locator('#phoneMenuList'),'menuSettings')).click();
  }
  await expect(page.locator('#settingsDialog')).toBeVisible();
  const out=await page.evaluate(()=>{
   const g=getComputedStyle(document.querySelector('#settingsDialog .settings-group .section-heading'));
   const en=getComputedStyle(document.getElementById('langEn'));
   const es=getComputedStyle(document.getElementById('langEs'));
   return {
    groupHead:[g.textTransform,g.fontSize,g.letterSpacing,g.color].join(' '),
    groupBorder:getComputedStyle(document.querySelector('#settingsDialog .settings-group')).borderTopWidth,
    langEnBorder:en.borderTopWidth,
    langEsBorder:es.borderTopWidth,
   };
  });
  await page.keyboard.press('Escape');
  return out;
 };
 const desktop=await styles({width:1280,height:800});
 const phone=await styles(PHONE_PORTRAIT);
 expect(phone.groupHead,'group heads match desktop').toBe(desktop.groupHead);
 expect(desktop.groupHead).toContain('uppercase');
 expect(desktop.groupBorder,'groups carry no bordered fieldset').toBe('0px');
 expect(phone.groupBorder,'groups carry no bordered fieldset on phones').toBe('0px');
 expect(phone.langEnBorder,'language buttons carry no border of their own').toBe('0px');
 expect(desktop.langEnBorder,'language buttons carry no border of their own on desktop').toBe('0px');
 expect(phone.langEsBorder).toBe(desktop.langEsBorder);
});
