import {test,expect} from '@playwright/test';

// Type scale (issue #210, from audit #162): the editor uses a small set of named font sizes and two weights, all defined once
// as CSS variables in styles.css. This counts what the main screen actually computes, so a stray size fails here.
const newDesign=async page=>{await page.locator('#new').click();if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();};

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

test('main screen uses four or fewer font sizes and two weights',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto('/');await newDesign(page);await page.locator('#rect').click();
 const styles=await page.evaluate(()=>{
  const sizes=new Set(),weights=new Set();
  for(const el of document.querySelectorAll('body *')){
   if(el.closest('[hidden],dialog:not([open]),.sr-only'))continue;
   const cs=getComputedStyle(el);
   if(cs.display==='none'||cs.visibility==='hidden')continue;
   if(!Array.from(el.childNodes).some(n=>n.nodeType===3&&n.textContent.trim()))continue;
   sizes.add(cs.fontSize);weights.add(cs.fontWeight);
  }
  return {sizes:[...sizes].sort(),weights:[...weights].sort()};
 });
 expect(styles.sizes.length,`distinct font sizes: ${styles.sizes.join(', ')}`).toBeLessThanOrEqual(4);
 expect(styles.weights.length,`distinct font weights: ${styles.weights.join(', ')}`).toBeLessThanOrEqual(2);
 const gridPx=parseFloat(await page.locator('#gridCycle .grid-label').evaluate(e=>getComputedStyle(e).fontSize));
 expect(gridPx,'Grid 1 mm control font size').toBeGreaterThanOrEqual(Math.min(...styles.sizes.map(s=>parseFloat(s))));
 expect(errors).toEqual([]);
});
