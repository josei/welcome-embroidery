import {test,expect} from '@playwright/test';

// Raised fill and Border are on/off buttons: aria-pressed carries the state, and the row shows On or Off in words,
// so the setting reads without colour. The fill pattern choices are named buttons, and the chosen one is pressed.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

test('Raised fill and Border show their on/off state by aria-pressed and in words', async({page})=>{
 page.on('dialog',d=>d.accept());
 await page.goto('/');
 await page.locator('#rect').click();
 await page.locator('#type').selectOption('fill');

 const raised=page.locator('#fillRaised');
 await expect(raised).toHaveAttribute('aria-pressed','false');
 await expect(page.locator('#fillRaisedRow')).toContainText('Off');
 await raised.click();
 await expect(raised).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#fillRaisedRow')).toContainText('On');

 const border=page.locator('#border');
 await expect(border).toHaveAttribute('aria-pressed','false');
 await border.click();
 await expect(border).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#borderRow')).toContainText('On');
});

test('Each fill pattern button shows its name and the chosen pattern is pressed', async({page})=>{
 page.on('dialog',d=>d.accept());
 await page.goto('/');
 await page.locator('#rect').click();
 await page.locator('#type').selectOption('fill');

 const group=page.getByRole('radiogroup',{name:'Fill pattern'});
 await expect(group.getByRole('radio',{name:'Rows (tatami)'})).toHaveText(/Rows \(tatami\)/);
 await expect(group.getByRole('radio',{name:'Spiral'})).toHaveText(/Spiral/);
 await group.getByRole('radio',{name:'Spiral'}).click();
 await expect(group.getByRole('radio',{name:'Spiral'})).toHaveAttribute('aria-pressed','true');
 await expect(group.getByRole('radio',{name:'Rows (tatami)'})).toHaveAttribute('aria-pressed','false');
});

// On a phone the Properties panel is a sheet, and the two toggles read by knob position and word as well as track colour,
// in portrait and in landscape, in English and Spanish.
const PHONES=[[390,844],[844,390]];
for(const [width,height] of PHONES) for(const lang of ['en','es']){
 test(`Raised fill and Border show on and off by knob position at ${width}x${height} (${lang})`,async({page})=>{
  await page.setViewportSize({width,height});
  await page.goto(lang==='en'?'/':`/?lang=${lang}`);
  await page.locator('#rect').click();
  await page.locator('#barProperties').click();
  await expect(page.locator('#inspector')).toHaveClass(/sheet-open/);
  await page.evaluate(()=>{const s=document.getElementById('type');s.value='fill';s.dispatchEvent(new Event('change',{bubbles:true}));});

  // The knob is the track's ::before; it moves 14 px to the right when the toggle is on.
  const knobX=id=>page.locator(`#${id}`).evaluate(b=>{
   const t=b.querySelector('.switch-track');
   return new DOMMatrixReadOnly(getComputedStyle(t,'::before').transform).m41;
  });
  for(const id of ['fillRaised','border']){
   const btn=page.locator(`#${id}`);
   await btn.scrollIntoViewIfNeeded();
   await expect(btn).toHaveAttribute('aria-pressed','false');
   await expect.poll(()=>knobX(id)).toBeCloseTo(0,0);
   await btn.click();
   await expect(btn).toHaveAttribute('aria-pressed','true');
   await expect.poll(()=>knobX(id)).toBeCloseTo(14,0);
   await btn.click();
   await expect(btn).toHaveAttribute('aria-pressed','false');
   await expect.poll(()=>knobX(id)).toBeCloseTo(0,0);
  }
 });
}
