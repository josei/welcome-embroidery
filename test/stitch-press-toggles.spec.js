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
