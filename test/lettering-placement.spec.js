import {test,expect} from '@playwright/test';

// A new lettering object goes into free space on the hoop, the same as a new shape: it does not land on the artwork
// already at the centre. A rectangle is added first so the centre is occupied, then the word is typed in.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openEmptyEditor(page){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width:1280,height:800});
 await page.goto('/');
 await page.locator('#new').click();
 if(await page.locator('#discardDialog[open]').count()) await page.locator('#discardDiscard').click();
 await expect(page.locator('.object-row'),'the design starts empty').toHaveCount(0);
 return errors;
}

// Screen-space bounding boxes of every drawn object, keyed by its id.
const objectBoxes=page=>page.evaluate(()=>[...document.querySelectorAll('#shapes [data-id]')].map(el=>{
 const r=el.getBoundingClientRect();
 return {id:el.getAttribute('data-id'),left:r.left,top:r.top,right:r.right,bottom:r.bottom};
}));

const overlaps=(a,b)=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;

test('lettering added beside artwork at the centre does not overlap it (1280x800)',async({page})=>{
 const errors=await openEmptyEditor(page);
 await page.locator('#rect').click();
 await expect(page.locator('.object-row'),'the rectangle is added').toHaveCount(1);
 const artId=await page.locator('.object-row').first().getAttribute('data-id');

 await page.locator('.tool-rail #letter').click();
 await expect(page.locator('#canvasText'),'text box opens').toBeVisible();
 await page.keyboard.press('Control+A');
 await page.keyboard.type('ROSA');
 await page.keyboard.press('Enter');
 await expect(page.locator('#canvasText'),'the box closes').toHaveCount(0);
 await expect(page.locator('.object-row'),'the lettering is added').toHaveCount(2);
 const textId=await page.locator('.object-row').last().getAttribute('data-id');

 const boxes=await objectBoxes(page);
 const art=boxes.find(b=>b.id===artId), text=boxes.find(b=>b.id===textId);
 expect(art,'the artwork is drawn').toBeTruthy();
 expect(text,'the lettering is drawn').toBeTruthy();
 expect(overlaps(text,art),'the lettering box does not overlap the artwork').toBe(false);
 expect(errors).toEqual([]);
});
