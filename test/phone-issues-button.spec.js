import {test,expect} from '@playwright/test';

// On tablets the status line shows the issues button as a warning sign and count, and the messages button as an icon.
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

for(const lang of ['en','es']) test(`768x1024 ${lang}: the issues button shows the warning sign and count, with the full text as its name`,async({page})=>{
 page.on('dialog',d=>d.accept());
 await page.setViewportSize({width:768,height:1024});
 await page.goto(`/?lang=${lang}`);
 await expect(page.locator('.canvas')).toBeVisible();
 await moveOutOfHoop(page);
 const btn=page.locator('#issuesBtn');
 await expect(btn).toBeVisible();
 const text=(await btn.textContent()).trim();
 expect(text,'visible text is the warning sign and a count').toMatch(/^⚠ \d+$/);
 expect(words(text),'visible text is at most two words').toBeLessThanOrEqual(2);
 const label=await btn.getAttribute('aria-label');
 expect(label).toMatch(lang==='es'?/aviso/:/issue/);
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
