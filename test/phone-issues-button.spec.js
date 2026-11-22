import {test,expect} from '@playwright/test';

// On tablets the status line shows the issues button as the Issues icon and count, and the messages button as an icon.
// Each control keeps its full text as its accessible name and tooltip. The desktop status line keeps the words.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

// Moves an object outside the hoop, which the editor reports as an issue.
async function moveOutOfHoop(page){
 await page.locator('button[data-view="stitches"]').click();
 await page.locator('.object-row').first().click();
 await page.locator('#posX').fill('300');
 await page.locator('#posX').press('Tab');
 await expect(page.locator('#count')).toHaveClass(/error/);
}

const words=s=>s.trim().split(/\s+/).filter(Boolean).length;

// The messages button has no text on tablets and phones in landscape, so its word is its name.
for(const lang of ['en','es']) for(const [w,h] of [[844,390],[768,1024]]){
 test(`${w}x${h} ${lang}: the messages button shows only its icon, with the word as its name`,async({page})=>{
  await page.setViewportSize({width:w,height:h});
  await page.goto(`/?lang=${lang}`);
  await expect(page.locator('.canvas')).toBeVisible();
  const btn=page.locator('#messagesBtn');
  await expect(btn).toBeVisible();
  expect(words(await btn.textContent()),'visible text is at most two words').toBeLessThanOrEqual(2);
  const word=lang==='es'?'Mensajes':'Messages';
  expect(await btn.getAttribute('aria-label')).toBe(word);
  expect(await btn.getAttribute('title')).toBe(word);
  await expect(btn.locator('svg use')).toHaveAttribute('href','#i-msg');
 });
}

// On a 390-wide phone in portrait the design view's status line shows only the count, so the messages button is
// hidden there by the existing layout. This records that rather than changing it.
test('390x844 en: the messages button is hidden in the phone design view', async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?lang=en');
 await expect(page.locator('.canvas')).toBeVisible();
 await expect(page.locator('#messagesBtn')).toBeHidden();
});

for(const lang of ['en','es']) test(`768x1024 ${lang}: the issues button shows a count, with the full text as its name`,async({page})=>{
 page.on('dialog',d=>d.accept());
 await page.setViewportSize({width:768,height:1024});
 await page.goto(`/?lang=${lang}`);
 await expect(page.locator('.canvas')).toBeVisible();
 await moveOutOfHoop(page);
 const btn=page.locator('#issuesBtn');
 await expect(btn).toBeVisible();
 const text=(await btn.textContent()).trim();
 expect(text,'visible text is a count').toMatch(/^\d+$/);
 expect(words(text),'visible text is at most two words').toBeLessThanOrEqual(2);
 const label=await btn.getAttribute('aria-label');
 expect(label,'the accessible name does not start with a text glyph').not.toMatch(/^⚠/);
 expect(label).toMatch(lang==='es'?/aviso/:/issue/);
 const box=await btn.boundingBox();
 expect(box.width,'hit area width').toBeGreaterThanOrEqual(44);
 expect(box.height,'hit area height').toBeGreaterThanOrEqual(44);
 expect(await btn.getAttribute('title')).toContain(label);
 await expect(btn).toHaveClass(/issues-btn/);
});

test('1280x800 en: the issues button and messages button keep their words', async({page})=>{
 page.on('dialog',d=>d.accept());
 await page.setViewportSize({width:1280,height:800});
 await page.goto('/?lang=en');
 await expect(page.locator('.canvas')).toBeVisible();
 await moveOutOfHoop(page);
 await expect(page.locator('#issuesBtn')).toContainText('issue');
 await expect(page.locator('#messagesBtn')).toHaveText('Messages');
});

// Restores a design with one square placed past the 400 mm hoop, from the autosave the editor offers back.
async function openSquareOutsideHoop(page, lang){
 const {initialDocument,applyOperations}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];doc.hoop=400;doc.name='Probe';doc.revision=1;
 applyOperations(doc,[{op:'add_shape',id:'s0',kind:'rect',x:300,y:0,width:20,height:15.1,thread:'#cc3333',stitch:'fill'}]);
 await page.goto(`/?lang=${lang}`);
 await page.evaluate(d=>localStorage.setItem('welcome.autosave:'+sessionStorage.getItem('welcome.tabId'),JSON.stringify({doc:d,clean:false,savedAt:Date.now()})),doc);
 await page.goto(`/?lang=${lang}`);
 await page.locator('#restoreYes').click();
 await expect(page.locator('.object-row')).toHaveCount(1);
}

// One object past the hoop is both an issue and a sewing tip. The chip counts that object once, and each tap keeps the
// selection on it, since there is no other object to move to.
for(const [w,h] of [[390,844],[768,1024]]) test(`${w}x${h} es: one object past the hoop gives a chip total of 1 and stays on that object`,async({page})=>{
 page.on('dialog',d=>d.accept());
 await page.setViewportSize({width:w,height:h});
 await openSquareOutsideHoop(page,'es');
 const btn=page.locator('#issuesBtn');
 await expect(btn).toBeVisible();
 await expect(btn).toHaveText('1');
 const selected=page.locator('.object-row.selected');
 await btn.click();
 await expect(selected).toHaveCount(1);
 const before=await selected.first().textContent();
 await btn.click();
 await expect(selected).toHaveCount(1);
 expect(await selected.first().textContent()).toBe(before);
 await expect(btn).toHaveText('1');
});
