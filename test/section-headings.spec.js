import {test,expect} from '@playwright/test';

// Issue #323: every section heading in the inspector and side panels uses one text style, and collapsible sections show a
// disclosure triangle while plain headings show none. This lists each visible heading with its computed style and fails when
// one differs from the shared style, so a new heading in a different treatment fails here.
// The selected object's name (#selected) is the inspector title, not a section heading, so it is left out.
const newDesign=async page=>{await page.locator('#new').click();if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();};

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const headings=page=>page.evaluate(()=>{
 const out=[];
 const visible=el=>{for(let e=el;e&&e!==document.body;e=e.parentElement){if(e.hidden||e.closest('[hidden]'))return false;const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden')return false;}const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
 const sel='.panel h3, .panel h4, .panel summary, .layers-head h2';
 for(const el of document.querySelectorAll(sel)){
  if(el.id==='selected'||!visible(el))continue;
  const cs=getComputedStyle(el);
  const marker=getComputedStyle(el,'::before');
  out.push({
   text:el.textContent.replace(/\s+/g,' ').trim().slice(0,40),
   collapsible:el.tagName==='SUMMARY',
   triangle:marker.content!=='none'&&marker.content!=='normal',
   style:{textTransform:cs.textTransform,letterSpacing:cs.letterSpacing,fontSize:cs.fontSize,fontWeight:cs.fontWeight},
  });
 }
 return out;
});

test('section headings share one style and only collapsible ones show a triangle (#323)',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto('/');await newDesign(page);await page.locator('#rect').click();
 for(const sum of await page.locator('details > summary:visible').all())await sum.click().catch(()=>{});
 const list=await headings(page);
 expect(list.length,'the inspector lists headings').toBeGreaterThan(0);
 const shared=list[0].style;
 const offStyle=list.filter(h=>JSON.stringify(h.style)!==JSON.stringify(shared)).map(h=>({text:h.text,style:h.style}));
 expect(offStyle,`headings not in the shared style ${JSON.stringify(shared)}`).toEqual([]);
 const wrongTriangle=list.filter(h=>h.collapsible!==h.triangle).map(h=>h.text);
 expect(wrongTriangle,'collapsible sections show a triangle; plain headings show none').toEqual([]);
 expect(errors).toEqual([]);
});
