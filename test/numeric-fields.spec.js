import {test,expect} from '@playwright/test';

// Up and Down step a numeric field by its own step, Shift is 10 times that and Alt a tenth, Ctrl does nothing,
// and dragging a field's label scrubs it. A scrub or a typed value commits once, so one Undo reverts it.
const newDesign=async page=>{await page.locator('#new').click();if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();};

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

test('arrow keys and scrubbing step a numeric field with the modifier multipliers',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto('/');await newDesign(page);await page.locator('#rect').click();
 const w=page.locator('#sizeW');
 // Sizes commit on Enter; sizeW has a 0.1 step.
 await w.fill('2');await w.press('Enter');
 await w.focus();
 await page.keyboard.press('ArrowUp');expect(await w.inputValue()).toBe('2.1');
 await page.keyboard.press('Shift+ArrowUp');expect(await w.inputValue()).toBe('3.1');
 await page.keyboard.press('Alt+ArrowUp');expect(await w.inputValue()).toBe('3.11');
 await page.keyboard.press('Control+ArrowUp');expect(await w.inputValue()).toBe('3.11');
 await w.press('Enter');
 // Scrub: dragging across the W label changes the value, and Shift makes it ten times coarser.
 const before=Number(await w.inputValue());
 const label=page.locator('label:has(#sizeW)');const box=await label.boundingBox();
 const y=box.y+box.height/2,x=box.x+4;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+20,y,{steps:4});await page.mouse.up();
 const scrubbed=Number(await w.inputValue());
 expect(scrubbed).toBeGreaterThan(before);
 // One drag is one undo step: one Undo returns to the value before the scrub.
 await page.keyboard.press('Control+z');
 expect(Number(await page.locator('#sizeW').inputValue())).toBeCloseTo(before,5);
 expect(errors).toEqual([]);
});
