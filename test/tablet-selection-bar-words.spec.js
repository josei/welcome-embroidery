import {test,expect} from '@playwright/test';

// Each control on the tablet selection bar shows a word under its glyph, as the phone bar does, so a first-time Spanish user
// can read it without hovering. The word is measured over its text: it sits inside its button and the bar, on one line, unclipped.
// Each control keeps its full name in aria-label and title. With two or more objects selected the bar gains its boolean and
// align controls, so the same checks run again there: the bar must still fit the viewport.

const SIZE=[768,1024];
const CONTROLS=['selectToggle','barDuplicate','barDelete','arrangeBtn'];
const WORDS={
 en:{selectToggle:'Several',barDuplicate:'Duplicate',barDelete:'Delete',arrangeBtn:'Arrange'},
 es:{selectToggle:'Varios',barDuplicate:'Duplicar',barDelete:'Eliminar',arrangeBtn:'Organizar'},
};

test.use({hasTouch:true});
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function checkWords(page,lang){
 const bar=page.locator('.canvas .floating').first();
 await expect(bar).toBeVisible();
 const barBox=await bar.boundingBox();
 const viewport=page.viewportSize();
 expect(barBox.x>=0 && barBox.x+barBox.width<=viewport.width,'the bar stays inside the viewport across').toBe(true);
 expect(barBox.y>=0 && barBox.y+barBox.height<=viewport.height,'the bar stays inside the viewport down').toBe(true);
 expect(await bar.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'the bar does not overflow').toBe(true);

 for(const id of CONTROLS){
  const button=page.locator(`#${id}`);
  const word=button.locator('.bar-word');
  await expect(button,`${id} is shown`).toBeVisible();
  await expect(word,`${id} shows its word`).toBeVisible();
  await expect(word).toHaveText(WORDS[lang][id]);
  const name=await button.getAttribute('aria-label');
  expect(name,`${id} keeps its full name`).toBeTruthy();
  await expect(button).toHaveAttribute('title',name);

  const buttonBox=await button.boundingBox();
  const m=await word.evaluate(el=>{
   const range=document.createRange();range.selectNodeContents(el);
   const r=range.getBoundingClientRect();
   const rects=[...range.getClientRects()];
   return {
    left:r.left,right:r.right,top:r.top,bottom:r.bottom,
    lines:rects.length?new Set(rects.map(q=>Math.round(q.top))).size:0,
    scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,
   };
  });
  expect(m.left>=buttonBox.x-0.5 && m.right<=buttonBox.x+buttonBox.width+0.5,`${id} word lies inside its button`).toBe(true);
  expect(m.left>=barBox.x-0.5 && m.right<=barBox.x+barBox.width+0.5,`${id} word lies inside the bar`).toBe(true);
  expect(m.top>=buttonBox.y-0.5 && m.bottom<=buttonBox.y+buttonBox.height+0.5,`${id} word lies inside its button vertically`).toBe(true);
  expect(m.scrollWidth<=m.clientWidth+1,`${id} word is not clipped`).toBe(true);
  expect(m.lines,`${id} word is one line`).toBe(1);
 }
}

test('the tablet selection bar shows its words in es-ES with one object selected at 768x1024', async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept().catch(()=>{}));
 await page.setViewportSize({width:SIZE[0],height:SIZE[1]});
 await page.goto('/?lang=es');
 await page.locator('#rect').click();
 await checkWords(page,'es');
 expect(errors).toEqual([]);
});

test('the tablet selection bar shows its words in en-US with one object selected at 768x1024', async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept().catch(()=>{}));
 await page.setViewportSize({width:SIZE[0],height:SIZE[1]});
 await page.goto('/');
 await page.locator('#rect').click();
 await checkWords(page,'en');
 expect(errors).toEqual([]);
});

for(const lang of ['en','es']){
 test(`the tablet selection bar keeps its words and stays on screen with several objects selected in ${lang} at 768x1024`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept().catch(()=>{}));
  await page.setViewportSize({width:SIZE[0],height:SIZE[1]});
  await page.goto(lang==='en'?'/':`/?lang=${lang}`);
  await page.locator('#rect').click();
  await page.keyboard.press('Control+a');
  await checkWords(page,lang);
  expect(errors).toEqual([]);
 });
}
