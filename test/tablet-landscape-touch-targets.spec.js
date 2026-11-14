import {test,expect} from '@playwright/test';

// At 1024x768 held sideways with touch, every visible button and field in the header, tool row, layer rows, selection
// bar, hoop fields and menus is 44 px or more, as in the tablet portrait layout. Mouse sizes stay as on the desktop:
// the touch rules are scoped to pointer:coarse, so a mouse at the same size keeps the 24-36 px controls.
test.setTimeout(240000);
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const measure=page=>page.evaluate(()=>{
 const sel='button,input:not([type=hidden]),select,textarea,[role=tab],summary,a[href]';
 const out=[];
 for(const e of document.querySelectorAll(sel)){
  if(e.closest('.sr-only,[hidden],[inert]'))continue;
  const cs=getComputedStyle(e);
  if(cs.visibility==='hidden'||cs.display==='none')continue;
  const r=e.getBoundingClientRect();
  if(r.width<=1||r.height<=1)continue;
  if(r.right<=0||r.bottom<=0||r.left>=innerWidth||r.top>=innerHeight)continue;
  const label=(e.getAttribute('aria-label')||e.textContent||e.id||e.className||e.tagName).trim().replace(/\s+/g,' ').slice(0,40);
  out.push({name:`${e.tagName.toLowerCase()}#${e.id||''} "${label}"`,w:Math.round(r.width*10)/10,h:Math.round(r.height*10)/10});
 }
 return {pointerCoarse:matchMedia('(pointer:coarse)').matches,list:out};
});

for(const lang of ['en','es']){
 test.describe(`touch (${lang})`,()=>{ test.use({hasTouch:true}); test(`landscape tablet 1024x768 with touch: every control is 44 px (${lang})`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.setViewportSize({width:1024,height:768});
  await page.goto(`/?lang=${lang}`);
  await expect(page.locator('.canvas')).toBeVisible();
  await page.locator('#rect').click({timeout:5000}).catch(()=>{});
  const {pointerCoarse,list}=await measure(page);
  expect(pointerCoarse,'touch input is seen as a coarse pointer').toBe(true);
  expect(list.length,'controls found').toBeGreaterThan(40);
  expect(list.filter(c=>c.w<44||c.h<44).map(c=>`${c.name} ${c.w}x${c.h}`),'controls under 44x44').toEqual([]);
  expect(errors).toEqual([]);
 });});
}

test('landscape tablet 1024x768 with a mouse keeps the desktop control sizes', async({page})=>{
 await page.setViewportSize({width:1024,height:768});
 await page.goto('/?lang=en');
 await expect(page.locator('.canvas')).toBeVisible();
 await page.locator('#rect').click({timeout:5000}).catch(()=>{});
 const {pointerCoarse,list}=await measure(page);
 expect(pointerCoarse).toBe(false);
 const hide=list.find(c=>c.name.includes('"Hide '));
 expect(hide?.w,'layer Hide button stays at the desktop size').toBe(24);
});
