import {test,expect} from '@playwright/test';

// At every size, a layer row's selected highlight covers the whole row, including its Hide and Lock buttons. The type and
// stitch count are separated by the same " · " everywhere, and on a landscape tablet at 1024 by 768 they wrap to two lines at most.

// A tablet's touch screen is a coarse pointer; a laptop's mouse is a fine one.
async function openPage(browser,w,h,touch){
 const context=await browser.newContext({viewport:{width:w,height:h},hasTouch:touch,baseURL:test.info().project.use.baseURL});
 const page=await context.newPage();
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 page.on('dialog',d=>d.accept());
 return {page,context};
}

// Draws one rectangle, then opens the Layers list.
async function drawRect(page,lang){
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
 await expect(page.locator('#remove')).toBeEnabled();
 // A portrait tablet keeps the Layers panel on screen, so only a layout that hides it opens the Menu.
 if(!(await page.locator('.object-row').first().isVisible())&&await page.locator('#phoneMenu').isVisible()){
  await page.locator('#phoneMenu').click();
  await page.locator('#menuLayers').click();
 }
 await expect(page.locator('.object-row').first()).toBeVisible();
 await expect(page.locator('.row-count').first()).toBeVisible();
}

// The selected row's line (the row and its buttons), and the separator's width.
function measureSelected(){
 const row=document.querySelector('.object-row.selected');
 const line=row.parentElement;
 const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right};};
 const sep=row.querySelector('.row-sep');
 return {
  paints:getComputedStyle(line).backgroundColor,
  line:box(line),
  row:box(row),
  lock:box(line.querySelector('.row-lock')),
  eye:box(line.querySelector('.row-eye')),
  sepText:sep.textContent,
  sepWhiteSpace:getComputedStyle(sep).whiteSpace,
  sepWidth:sep.getBoundingClientRect().width,
 };
}

const SIZES=[[390,844,true],[844,390,false],[768,1024,false],[844,390,true],[768,1024,true],[1024,768,true],[1440,900,false]];

for(const [w,h,touch] of SIZES){
 for(const lang of ['en','es']){
  test(`selected row highlight spans the whole row at ${w}x${h} ${touch?'with touch':'with a mouse'} (${lang})`,async({browser})=>{
   test.setTimeout(120000);
   const {page,context}=await openPage(browser,w,h,touch);
   try{
    await drawRect(page,lang);
    const m=await page.evaluate(measureSelected);
    expect(m.paints,'the selected line is painted').not.toBe('rgba(0, 0, 0, 0)');
    expect(m.line.left,"highlight starts at the row's left edge").toBeLessThanOrEqual(m.row.left+0.5);
    expect(m.line.right,"highlight reaches the Lock button's right edge").toBeGreaterThanOrEqual(m.lock.right-0.5);
    expect(m.lock.right,'Lock sits at the end of the row').toBeGreaterThanOrEqual(m.eye.right-0.5);
   }finally{await context.close();}
  });
 }
}

test('the stitch type and count are separated by a spaced dot on the desktop and on the tablet and phone sizes',async({browser})=>{
 test.setTimeout(240000);
 const seps={};
 for(const [key,w,h,touch] of [['desktop',1440,900,false],['tablet-portrait',768,1024,true],['landscape',844,390,true]]){
  const {page,context}=await openPage(browser,w,h,touch);
  try{
   for(const lang of ['en','es']){
    await drawRect(page,lang);
    seps[`${key}-${lang}`]=await page.evaluate(measureSelected);
   }
  }finally{await context.close();}
 }
 for(const lang of ['en','es']){
  for(const key of ['tablet-portrait','landscape']){
   const s=seps[`${key}-${lang}`];
   expect(s.sepText,`separator text at ${key} in ${lang}`).toBe(' · ');
   expect(s.sepWhiteSpace,`separator keeps its spaces at ${key} in ${lang}`).toBe('pre');
   expect(Math.abs(s.sepWidth-seps[`desktop-${lang}`].sepWidth),`separator width at ${key} in ${lang}`).toBeLessThanOrEqual(1);
  }
 }
});

test('the stitch type and count wrap to two lines at most on a landscape tablet at 1024 by 768, in English and Spanish',async({browser})=>{
 test.setTimeout(120000);
 const {page,context}=await openPage(browser,1024,768,true);
 try{
  for(const lang of ['en','es']){
   await drawRect(page,lang);
   const lines=await page.evaluate(()=>[...document.querySelectorAll('.object-row')].filter(r=>r.offsetParent).map(r=>{
    const tag=r.querySelector('.row-tag');
    return {text:tag.textContent,height:tag.getBoundingClientRect().height,lineHeight:parseFloat(getComputedStyle(tag).lineHeight)||parseFloat(getComputedStyle(tag).fontSize)*1.2};
   }));
   expect(lines.length,`${lang} rows`).toBeGreaterThan(0);
   for(const row of lines){
    expect(Math.round(row.height/row.lineHeight),`"${row.text}" in ${lang} lines`).toBeLessThanOrEqual(2);
   }
  }
 }finally{await context.close();}
});
