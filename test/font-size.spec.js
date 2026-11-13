import {test,expect} from '@playwright/test';

// No visible text is below 11px. This walks every visible element that holds its
// own text and reads its computed font size, so a new 8px label or 10px heading fails here instead of in a manual audit.
const FLOOR=11;
const newDesign=async page=>{await page.locator('#new').click();if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();};

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

// Returns [{text, size}] for visible elements under the document with their own non-blank text, below the floor.
const smallText=page=>page.evaluate(FLOOR=>{
 const out=[];
 const visible=el=>{for(let e=el;e&&e!==document.body;e=e.parentElement){if(e.hidden||e.closest('[hidden]'))return false;const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden')return false;}const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
 for(const el of document.querySelectorAll('body *')){
  if(el.closest('svg')&&el.tagName.toLowerCase()!=='text')continue;
  const own=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(' ').trim();
  if(!own||!visible(el))continue;
  const size=parseFloat(getComputedStyle(el).fontSize);
  if(size<FLOOR)out.push({text:own.slice(0,40),size,id:el.id||String(el.className?.baseVal ?? el.className)});
 }
 return out;
},FLOOR);

test('visible text is at least 11px',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto('/');await newDesign(page);await page.locator('#rect').click();
 // Open the sections that hold the labels this issue names: document stitch settings, object settings, the grid chip.
 for(const sum of await page.locator('details > summary:visible').all())await sum.click().catch(()=>{});
 const small=await smallText(page);
 expect(small,`visible text below ${FLOOR}px`).toEqual([]);
 expect(errors).toEqual([]);
});
