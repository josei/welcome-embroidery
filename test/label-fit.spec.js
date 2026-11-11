import {test,expect} from '@playwright/test';

// Issue #434: translated labels must fit their controls. Every visible control's own text must not overflow its box
// (scrollWidth <= clientWidth), in English and Spanish, at 1280 and 1024 px, with no selection and with a rectangle selected.
// Measured regions: the top bar, the floating canvas toolbar, the canvas tool rail, both sidebars, and the footer (status bar).
// Ignored: .sr-only text, and width-1 .icon-label text (visually hidden labels). Inline elements are skipped: they have no clientWidth to clip.
// EXCEPTIONS: a control may be listed only when its clipping is intended. Each entry gives the selector and a one-line reason.
// Do not add an entry to hide a real overflow; fix the layout or the translation instead.
const EXCEPTIONS=[
 {selector:'span.row-name',reason:'object-list names are user content, ellipsised by design in the narrow sidebar at 1024 px in every language; not a translated label'},
];

const LOCALES=[['en-US','en'],['es-ES','es']];
const WIDTHS=[1280,1024];

// Runs in the page: returns every overflowing control with its locale-independent identity and measurements.
function findOverflows(){
 const regions=[...document.querySelectorAll('header.top, .floating, .tool-rail, .layout > aside, footer')];
 const seen=new Set();
 const out=[];
 for(const region of regions){
  for(const el of region.querySelectorAll('*')){
   if(seen.has(el))continue;
   seen.add(el);
   if(el.closest('.sr-only'))continue;
   if(el.closest('[hidden], dialog:not([open])'))continue;
   const ownText=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
   if(!ownText)continue;
   const cs=getComputedStyle(el);
   if(cs.display==='none'||cs.display==='inline'||cs.visibility==='hidden')continue;
   const r=el.getBoundingClientRect();
   if(r.width===0||r.height===0)continue;
   if(el.classList.contains('icon-label')&&Math.round(r.width)===1)continue;
   if(el.scrollWidth<=el.clientWidth)continue;
   const label=el.id?`#${el.id}`:el.tagName.toLowerCase()+(el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\s+/).join('.'):'');
   out.push({
    label,
    text:el.textContent.trim().replace(/\s+/g,' ').slice(0,60),
    scrollWidth:el.scrollWidth,
    clientWidth:el.clientWidth,
   });
  }
 }
 return out;
}

for(const [locale,lang] of LOCALES){
 for(const width of WIDTHS){
  for(const selected of [false,true]){
   test(`labels fit their controls in ${locale} at ${width}px ${selected?'with a rectangle selected':'with nothing selected'}`,async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await page.setViewportSize({width,height:800});
    await page.goto(`/?lang=${lang}`);
    await expect(page.locator('header.top')).toBeVisible();
    if(selected){
     await page.locator('#rect').click();
     await expect(page.locator('#remove')).toBeEnabled();
    }
    const overflows=await page.evaluate(findOverflows);
    const exceptionLabels=new Set(EXCEPTIONS.map(x=>x.selector));
    const failures=overflows.filter(o=>!exceptionLabels.has(o.label));
    const lines=failures.map(o=>
     `${o.label} "${o.text}" in ${locale} at ${width}px: scrollWidth ${o.scrollWidth} > clientWidth ${o.clientWidth}`);
    expect(lines,`overflowing controls in ${locale} at ${width}px`).toEqual([]);
    expect(errors).toEqual([]);
   });
  }
 }
}
