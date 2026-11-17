import {test,expect} from '@playwright/test';

// On a tablet the selection bar is a strip of buttons on the canvas. In portrait it is a row on the canvas's right, below the 2D /
// Stitches / 3D switch and above the hoop, away from the tool palette. In landscape it is a column on the right edge, as on the
// desktop. Its buttons and icons share one centre line (vertical in portrait, horizontal in landscape), its first button has no
// divider before it, and it stays clear of the rulers.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

for(const [width,height] of [[768,1024],[1024,768]]) test(`the tablet selection bar has one centre line, no leading divider and clears the rulers at ${width}x${height}`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto('/');
 await page.locator('#rect').click();
 await expect(page.locator('.floating')).toBeVisible();

 const geometry=await page.evaluate(()=>{
  const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,cx:r.left+r.width/2,cy:r.top+r.height/2};};
  const portrait=window.innerHeight>window.innerWidth;
  const bar=document.querySelector('.floating');
  const buttons=[...bar.querySelectorAll(':scope > button, :scope > span > button')].filter(b=>b.getBoundingClientRect().width>0);
  const icons=buttons.map(b=>b.querySelector('svg')).filter(Boolean);
  return {
   bar:box(bar),
   canvas:box(document.querySelector('.canvas')),
   buttonCentres:buttons.map(b=>box(b)[portrait?'cy':'cx']),
   iconCentres:icons.map(i=>box(i)[portrait?'cy':'cx']),
   firstDividerHidden:getComputedStyle(buttons[0],'::before').display==='none',
   rulerTop:box(document.querySelector('#rulerTop')),
   rulerLeft:box(document.querySelector('#rulerLeft')),
  };
 });

 expect(geometry.buttonCentres.length,'the bar has buttons').toBeGreaterThan(1);
 const spread=xs=>Math.max(...xs)-Math.min(...xs);
 expect(spread(geometry.buttonCentres),'every button shares one centre line').toBeLessThanOrEqual(1);
 expect(spread(geometry.iconCentres),'every icon shares one centre line').toBeLessThanOrEqual(1);
 expect(geometry.firstDividerHidden,'no divider at the top of the bar').toBe(true);
 expect(geometry.bar.top,'the bar starts below the top ruler').toBeGreaterThanOrEqual(geometry.rulerTop.bottom);
 expect(geometry.bar.left,'the bar starts right of the left ruler').toBeGreaterThanOrEqual(geometry.rulerLeft.right);
 if(height>width) expect(geometry.bar.right,'in portrait the bar is held to the canvas’s right edge, away from the tool palette').toBeGreaterThan(geometry.canvas.right-24);
 expect(errors).toEqual([]);
});
