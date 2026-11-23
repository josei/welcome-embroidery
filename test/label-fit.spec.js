import {test,expect} from '@playwright/test';

// Translated labels must fit their controls. Every visible control's own text must not overflow its box
// (scrollWidth <= clientWidth), in English and Spanish, at 1280 and 1024 px, with no selection and with a rectangle selected.
// Measured regions: the top bar, the floating canvas toolbar, the canvas tool rail, both sidebars, and the footer (status bar).
// Ignored: .sr-only text, and width-1 .icon-label text (visually hidden labels). Inline elements are skipped: they have no clientWidth to clip.
// Dropdowns (inspector selects and the hoop preset) are measured per option: every option's text must fit inside the field, and
// the field must not cover any text or control beside it in its row (its label, or the hoop's width field).
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

// Runs in the page: tries every option of every visible inspector dropdown and reports any option whose text does not fit,
// or whose field box overlaps the text or a control next to it.
function findDropdownCovers(){
 const out=[];
 const selects=[...document.querySelectorAll('.layout > aside select, .footer.hoop-edit select')]
  .filter(s=>!s.classList.contains('sr-only')&&!s.closest('[hidden], dialog:not([open])'));
 const ctx=document.createElement('canvas').getContext('2d');
 const rectsOf=node=>{
  if(node.nodeType===3){
   if(!node.textContent.trim())return [];
   const range=document.createRange();range.selectNodeContents(node);
   return [...range.getClientRects()];
  }
  if(node.nodeType!==1)return [];
  if(getComputedStyle(node).display==='none')return [];
  return [node.getBoundingClientRect()];
 };
 const overlaps=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>0.5&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>0.5;
 for(const s of selects){
  const row=s.closest('label')||s.parentElement;
  const label=s.id?`#${s.id}`:'select';
  const original=s.value;
  for(const opt of s.options){
   s.value=opt.value;
   const sr=s.getBoundingClientRect();
   if(sr.width===0||sr.height===0)continue;
   const cs=getComputedStyle(s);
   ctx.font=`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
   const textWidth=ctx.measureText(opt.text).width;
   // The arrow takes about 18 px at the field's right edge; the rest is the text box.
   const available=sr.width-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)-18;
   if(textWidth>available){
    out.push({label,text:opt.text,problem:`option text ${Math.round(textWidth)} px does not fit in ${Math.round(available)} px`});
   }
   for(const node of row.childNodes){
    if(node===s||s.contains(node))continue;
    if(node.nodeType===1&&node.classList.contains('sr-only'))continue;
    for(const r of rectsOf(node)){
     if(overlaps(r,sr)){
      out.push({label,text:opt.text,problem:`field covers "${(node.textContent||node.tagName).trim().slice(0,40)}"`});
      break;
     }
    }
   }
  }
  s.value=original;
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
    const covers=await page.evaluate(findDropdownCovers);
    for(const c of covers)lines.push(`dropdown ${c.label} option "${c.text}" in ${locale} at ${width}px: ${c.problem}`);
    expect(lines,`overflowing controls in ${locale} at ${width}px`).toEqual([]);
    expect(errors).toEqual([]);
   });
  }
 }
}
