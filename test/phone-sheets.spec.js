import {test,expect} from '@playwright/test';

// At phone size Layers and Properties open as plain panels from the Menu, in either orientation. Each has a Close button in its
// heading row. There is no grab handle, no drag, and no dimmed backdrop. Escape and the system back action also close a panel.
// Opening a panel puts focus on its heading, never on a field, and closing returns focus to the Menu button.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const LAYOUTS=[
 {name:'portrait 390x844',width:390,height:844,options:{hasTouch:true}},
 {name:'landscape 844x390',width:844,height:390,options:{hasTouch:true}},
];

const openSheet=async(page,sheet)=>{
 await page.locator('#phoneMenu').click();
 await page.locator(sheet==='layers'?'#menuLayers':'#menuProperties').click();
};

const sheetOf=(page,sheet)=>page.locator(sheet==='layers'?'.layout>#layersSheet.sheet-open':'.layout>#inspector.sheet-open');

// Every control drawn in a panel (screen-reader-only and hidden ones are skipped).
const sheetControls=sheet=>sheet.evaluate(root=>{
 const out=[];
 for(const e of root.querySelectorAll('button,input:not([type=hidden]):not([type=checkbox]),select,textarea,summary,a[href],label:has(>input[type=checkbox])')){
  if(e.closest('.sr-only,[hidden],[inert]'))continue;
  const cs=getComputedStyle(e);
  if(cs.visibility==='hidden'||cs.display==='none')continue;
  const r=e.getBoundingClientRect();
  if(r.width<=1||r.height<=1)continue;
  out.push({name:`${e.tagName.toLowerCase()}#${e.id||''} "${(e.getAttribute('aria-label')||e.textContent||e.className||'').trim().replace(/\s+/g,' ').slice(0,30)}"`,w:r.width,h:r.height});
 }
 return out;
});

for(const layout of LAYOUTS){
 test.describe(layout.name,()=>{
  test.use({viewport:{width:layout.width,height:layout.height},...layout.options});

  for(const [sheet,id] of [['layers','layersSheet'],['properties','inspector']]){
   test(`${sheet}: no grab handle, no backdrop, and a Close button closes it (en)`,async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/?lang=en');
    await openSheet(page,sheet);
    const panel=page.locator(`#${id}`);
    await expect(panel).toHaveClass(/sheet-open/);
    await expect(page.locator('.sheet-grip,.sheet-scrim')).toHaveCount(0);
    await expect(panel.locator('[data-sheet-drag]')).toHaveCount(0);
    const close=panel.getByRole('button',{name:'Close'});
    await expect(close).toBeVisible();
    await close.click();
    await expect(page.locator(`.layout>#${id}.sheet-open`)).toHaveCount(0);
    await expect(page.locator('#phoneMenu')).toBeFocused();
    expect(errors).toEqual([]);
   });

   test(`${sheet}: a downward drag on the heading does not close or move the panel`,async({page})=>{
    await page.goto('/?lang=en');
    await openSheet(page,sheet);
    const panel=page.locator(`#${id}`);
    await expect(panel).toHaveClass(/sheet-open/);
    const before=await panel.boundingBox();
    const h=await panel.locator('h2').first().boundingBox();
    await page.mouse.move(h.x+h.width/2,h.y+h.height/2);
    await page.mouse.down();
    for(let i=1;i<=8;i++)await page.mouse.move(h.x+h.width/2,h.y+h.height/2+i*15);
    await page.mouse.up();
    await expect(panel).toHaveClass(/sheet-open/);
    const after=await panel.boundingBox();
    expect(after.y).toBe(before.y);
    expect(after.height).toBe(before.height);
   });

   test(`${sheet}: opening it leaves focus on the heading, not an input (en)`,async({page})=>{
    await page.goto('/?lang=en');
    await openSheet(page,sheet);
    await expect(page.locator(`#${id}`)).toHaveClass(/sheet-open/);
    const active=await page.evaluate(()=>{const a=document.activeElement;return a?{tag:a.tagName,title:a.classList.contains('sheet-title')}:null;});
    expect(active?.tag==='BODY' || (active?.tag==='H2' && active.title),'focus is on the heading or body').toBe(true);
   });

   test(`${sheet}: every control is at least 44x44 CSS px (en)`,async({page})=>{
    await page.goto('/?lang=en');
    await openSheet(page,sheet);
    const panel=page.locator(`#${id}`);
    await expect(panel).toHaveClass(/sheet-open/);
    const small=(await sheetControls(panel)).filter(c=>c.w<43.5||c.h<43.5);
    expect(small,'controls under 44 px').toEqual([]);
   });
  }

  test('Escape closes an open panel',async({page})=>{
   await page.goto('/?lang=en');
   await openSheet(page,'layers');
   await expect(sheetOf(page,'layers')).toHaveCount(1);
   await page.keyboard.press('Escape');
   await expect(sheetOf(page,'layers')).toHaveCount(0);
  });

  test('the system back action closes an open panel before leaving the page',async({page})=>{
   await page.goto('/?lang=en');
   const before=page.url();
   await openSheet(page,'layers');
   await expect(sheetOf(page,'layers')).toHaveCount(1);
   await page.goBack();
   await expect(sheetOf(page,'layers')).toHaveCount(0);
   expect(page.url()).toBe(before);
  });

  test('only one panel is open at a time, and the Menu closes it',async({page})=>{
   await page.goto('/?lang=en');
   await openSheet(page,'layers');
   await openSheet(page,'properties');
   await expect(sheetOf(page,'properties')).toHaveCount(1);
   await expect(sheetOf(page,'layers')).toHaveCount(0);
   await page.locator('#phoneMenu').click();
   await expect(sheetOf(page,'properties')).toHaveCount(0);
  });
 });
}
