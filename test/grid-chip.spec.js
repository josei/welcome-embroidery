import {test,expect} from '@playwright/test';

// Issue #431: the grid chip shows only the spacing and unit, so in Spanish "Cuadrícula" no longer clips the 30 px chip.
// At 1280 and 1024 px in es-ES, every spacing from 0.1 to 5 mm fits: .grid-label's scrollWidth is at most its clientWidth.
const SPACINGS=['0.1','0.25','0.5','1','2','5'];

// Issue #492: at 1024 px the grid chips are in the View menu, not on the canvas, so the chip check runs at desktop widths only.
for(const width of [1280]){
 test(`grid chip label fits its 30 px box in es-ES at ${width}px for every spacing`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.setViewportSize({width,height:800});
  await page.goto('/?lang=es');await expect(page.locator('#count')).toContainText('puntadas');
  const label=page.locator('#gridCycle .grid-label');
  for(const v of SPACINGS){
   await page.locator('#grid').selectOption(v);
   const m=await label.evaluate(e=>({scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}));
   expect(m.scrollWidth,`label for ${v} mm`).toBeLessThanOrEqual(m.clientWidth);
   await expect(label).toHaveText(`${v} mm`);
  }
  expect(errors).toEqual([]);
 });
}
