import {test,expect} from '@playwright/test';

// At phone and tablet widths the grid and snap chips are not on the canvas. Grid, Snap and
// Snap to objects are in the View menu (the phone Menu, or the View menu on a desktop-style header), and each toggle reports its
// state with aria-pressed. At 1280 px the desktop toolbar keeps its chips.
const SIZES=[{width:844,height:390},{width:768,height:1024}];
const CHIPS=['#gridCycle','#snap','#snapObj','#grid'];

async function openView(page){
 // The header shows the phone Menu at phone widths and on portrait tablets; the desktop-style header shows the View menu.
 if(await page.locator('#phoneMenu').count()) await page.locator('#phoneMenu').click();
 else await page.locator('#viewMenu').click();
}

for(const lang of ['en','es']){
 for(const {width,height} of SIZES){
  test(`no grid or snap chip on the canvas at ${width}x${height} (${lang}), and View menu toggles`,async({page})=>{
   const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.setViewportSize({width,height});
   await page.goto(lang==='es'?'/?lang=es':'/');await expect(page.locator('#count')).toBeVisible();
   for(const sel of CHIPS) await expect(page.locator(sel)).toHaveCount(0);
   // The View menu holds the controls; each toggles aria-pressed and the canvas grid class.
   await openView(page);
   const grid=page.locator('#menuGrid'), snap=page.locator('#menuSnap'), obj=page.locator('#menuSnapObjects');
   await expect(grid).toHaveAttribute('aria-pressed','false');
   await expect(snap).toHaveAttribute('aria-pressed','false');
   await expect(obj).toHaveAttribute('aria-pressed','true');
   await grid.click();
   await openView(page);
   await expect(page.locator('#menuGrid')).toHaveAttribute('aria-pressed','true');
   await expect(page.locator('.canvas')).toHaveClass(/grid-shown/);
   await page.locator('#menuGrid').click();
   await openView(page);
   await expect(page.locator('#menuGrid')).toHaveAttribute('aria-pressed','false');
   await expect(page.locator('.canvas')).not.toHaveClass(/grid-shown/);
   await page.locator('#menuSnap').click();
   await openView(page);
   await expect(page.locator('#menuSnap')).toHaveAttribute('aria-pressed','true');
   await expect(page.locator('.canvas')).toHaveClass(/snapping/);
   await page.locator('#menuSnapObjects').click();
   await openView(page);
   await expect(page.locator('#menuSnapObjects')).toHaveAttribute('aria-pressed','false');
   expect(errors).toEqual([]);
  });
 }
}

test('desktop toolbar keeps its grid and snap chips at 1280x800',async({page})=>{
 await page.setViewportSize({width:1280,height:800});
 await page.goto('/');await expect(page.locator('#count')).toBeVisible();
 await expect(page.locator('#gridCycle')).toBeVisible();
 await expect(page.locator('#snap')).toBeVisible();
 await expect(page.locator('#snapObj')).toBeVisible();
 await expect(page.locator('#viewMenu')).toHaveCount(0);
});
