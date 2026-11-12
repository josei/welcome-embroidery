import {test,expect} from '@playwright/test';

// Issue #473 (part of #468, section 4 of docs/mobile-editor-design.md): at phone size Layers and Properties open as sheets from the
// dock (portrait) or the rail (landscape). No large mode buttons remain. A sheet has no Close button: it closes by a downward drag on
// its grab handle or title row, a tap on the dimmed area, Escape, or the system back action. Portrait sheets have three detents
// (peek 120 px, half 50%, full below the top bar), and a dock open starts at half. Only one sheet is open at a time, and opening Menu
// closes it. Focus moves to the sheet's first control on open and returns to the opener on close.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const LAYOUTS=[
 {name:'portrait 390x844',width:390,height:844,options:{}},
 {name:'landscape 844x390',width:844,height:390,options:{hasTouch:true}},
];

// The Menu button: the phone Menu, at every phone size.
const menuSelector=()=>'#phoneMenu';

// Opens a sheet as a user does: at portrait Layers and Properties are in Menu > View (the dock has no sheet buttons); a landscape
// phone has them on the rail.
const openSheet=async(page,sheet)=>{
 const portrait=await page.evaluate(()=>matchMedia('(max-width:600px) and (orientation:portrait)').matches);
 if(portrait){
  await page.locator('#phoneMenu').click();
  await page.locator(sheet==='layers'?'#menuLayers':'#menuProperties').click();
 }else{
  await page.locator(sheet==='layers'?'#layersBtn':'#propertiesBtn').click();
 }
};

// The control focus returns to when a sheet closes: the dock button on a landscape phone, the Menu button in portrait.
const opener=(layout,sheet)=>layout.height>=layout.width?'#phoneMenu':(sheet==='layers'?'#layersBtn':'#propertiesBtn');

const sheetOf=page=>page.locator('.layout>aside.panel.sheet-open');
const scrim=page=>page.locator('.sheet-scrim');

// Every control drawn in a sheet (screen-reader-only and hidden ones are skipped).
const sheetControls=sheet=>sheet.evaluate(root=>{
 const out=[];
 // A checkbox is measured by its label row (the pressed control), as the page-wide touch-target check does.
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

// The Close labels and close-icon buttons that a sheet's title row could carry.
const closeButtonsIn=sheet=>sheet.evaluate(root=>[...root.querySelectorAll('button')].filter(b=>{
 const label=(b.getAttribute('aria-label')||b.textContent||'').trim().toLowerCase();
 if(b.getClientRects().length===0)return false;
 return /^(close|done|dismiss|×|✕|x)$/.test(label)||/close/.test(b.className);
}).map(b=>b.className||b.textContent));

const grab=async(page,sheet,dy)=>{
 const h=await sheet.locator('.sheet-grip, .sheet-head, .layers-head').first().boundingBox();
 await page.mouse.move(h.x+h.width/2,h.y+Math.min(h.height/2,12));
 await page.mouse.down();
 for(let i=1;i<=8;i++)await page.mouse.move(h.x+h.width/2,h.y+Math.min(h.height/2,12)+dy*i/8);
 await page.mouse.up();
};

for(const layout of LAYOUTS){
 test.describe(layout.name,()=>{
  test.use({viewport:{width:layout.width,height:layout.height},...layout.options});

  test('Menu, Layers and Properties open in turn; a tap outside each closes it',async({page})=>{
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   for(const lang of ['en','es']){
    await page.goto(`/?lang=${lang}`);
    await expect(page.locator(menuSelector()).first()).toBeVisible();
    // No large mode buttons: the old bar under the canvas is gone.
    await expect(page.locator('.sheet-bar')).toHaveCount(0);
    // Menu opens below the top bar, so a tap on the top bar (outside the sheet) dismisses it. No Close button (Issue #481).
    const menu=page.locator(menuSelector()).first();
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded','true');
    await expect(page.locator('#phoneMenuList .menu-close')).toHaveCount(0);
    const vw=page.viewportSize();
    await page.mouse.click(Math.round(vw.width/2),22);
    await expect(page.locator('#phoneMenuList')).toHaveCount(0);
    await expect(menu).toHaveAttribute('aria-expanded','false');
    // Layers: a tap on the dimmed area closes it.
    await openSheet(page,'layers');
    await expect(sheetOf(page)).toHaveAttribute('id','layersSheet');
    await expect(scrim(page)).toBeVisible();
    await scrim(page).click({position:{x:4,y:4}});
    await expect(sheetOf(page)).toHaveCount(0);
    // Properties: the same.
    await openSheet(page,'properties');
    await expect(sheetOf(page)).toHaveAttribute('id','inspector');
    await scrim(page).click({position:{x:4,y:4}});
    await expect(sheetOf(page)).toHaveCount(0);
   }
   expect(errors).toEqual([]);
  });

  for(const lang of ['en','es']){
   test(`a sheet has no Close control in its title row (${lang})`,async({page})=>{
    await page.goto(`/?lang=${lang}`);
    await openSheet(page,'layers');
    await expect(sheetOf(page)).toHaveAttribute('id','layersSheet');
    expect(await closeButtonsIn(sheetOf(page)),'Layers close buttons').toEqual([]);
    await scrim(page).click({position:{x:4,y:4}});
    await page.locator('#rect').click();
    await openSheet(page,'properties');
    await expect(sheetOf(page)).toHaveAttribute('id','inspector');
    expect(await closeButtonsIn(sheetOf(page)),'Properties close buttons').toEqual([]);
   });
  }

  test('the sheets open from the dock and only one is open at a time',async({page})=>{
   await page.goto('/?lang=en');
   await openSheet(page,'layers');
   await expect(sheetOf(page)).toHaveAttribute('id','layersSheet');
   // The open sheet covers the dock, so a tap outside it (the dimmed area) closes it before the other opens.
   await scrim(page).click({position:{x:4,y:4}});
   await openSheet(page,'properties');
   await expect(sheetOf(page)).toHaveCount(1);
   await expect(sheetOf(page)).toHaveAttribute('id','inspector');
   // Opening Menu closes whichever sheet is open (the phone Menu at portrait; the File menu on a landscape phone).
   await page.locator(menuSelector()).first().click();
   await expect(sheetOf(page)).toHaveCount(0);
   await page.keyboard.press('Escape');
  });

  test('Escape closes an open sheet',async({page})=>{
   await page.goto('/?lang=en');
   await openSheet(page,'layers');
   await expect(sheetOf(page)).toHaveCount(1);
   await page.keyboard.press('Escape');
   await expect(sheetOf(page)).toHaveCount(0);
  });

  test('focus moves to the first control on open and back to the opener on close',async({page})=>{
   await page.goto('/?lang=en');
   if(layout.height>=layout.width){
    await openSheet(page,'properties');
   }else{
    await page.locator('#propertiesBtn').focus();
    await page.keyboard.press('Enter');
   }
   await expect(sheetOf(page)).toHaveAttribute('id','inspector');
   const insideSheet=await page.evaluate(()=>!!document.activeElement?.closest('#inspector'));
   expect(insideSheet,'focus is inside the Properties sheet').toBe(true);
   await page.keyboard.press('Escape');
   await expect(page.locator(opener(layout,'properties'))).toBeFocused();
   // The same for Layers, opened with a pointer.
   await openSheet(page,'layers');
   expect(await page.evaluate(()=>!!document.activeElement?.closest('#layersSheet')),'focus is inside Layers').toBe(true);
   await scrim(page).click({position:{x:4,y:4}});
   await expect(page.locator(opener(layout,'layers'))).toBeFocused();
  });

  test('the system back action closes an open sheet before leaving the page',async({page})=>{
   await page.goto('/?lang=en');
   const before=page.url();
   await openSheet(page,'layers');
   await expect(sheetOf(page)).toHaveCount(1);
   await page.goBack();
   await expect(sheetOf(page)).toHaveCount(0);
   expect(page.url()).toBe(before);
   await expect(page.locator(opener(layout,'layers'))).toBeVisible();
  });

  for(const lang of ['en','es']){
   test(`every control in a sheet is at least 44x44 CSS px (${lang})`,async({page})=>{
    await page.goto(`/?lang=${lang}`);
    await page.locator('#rect').click();
    for(const id of ['layers','properties']){
     await openSheet(page,id);
     const sheet=sheetOf(page);
     await expect(sheet).toBeVisible();
     const small=(await sheetControls(sheet)).filter(c=>c.w<44||c.h<44).map(c=>`${c.name} ${Math.round(c.w)}x${Math.round(c.h)}`);
     expect(small,`controls under 44 px in ${id} (${lang})`).toEqual([]);
     await page.keyboard.press('Escape');
    }
   });
  }

  test('the sheet stays inside the screen and the canvas shows above a portrait sheet',async({page})=>{
   await page.goto('/?lang=en');
   await openSheet(page,'layers');
   const box=await sheetOf(page).boundingBox();
   // A landscape sheet (#478) runs from the top bar to the status line, so it stops 44 px above the bottom edge.
   expect(Math.round(box.y+box.height),'sheet bottom edge').toBe(layout.width>layout.height?layout.height-44:layout.height);
   expect(box.x,'sheet left edge').toBe(layout.width>layout.height?layout.width-320:0);
   expect(box.width).toBe(layout.width>layout.height?320:layout.width);
  });
 });
}

test.describe('portrait detents and swipe',()=>{
 test.use({viewport:{width:390,height:844}});

 test('a dock open starts at half; a swipe down steps to peek, then closes',async({page})=>{
  await page.goto('/?lang=en');
  await openSheet(page,'layers');
  const sheet=sheetOf(page);
  await expect(sheet).toHaveAttribute('data-detent','half');
  // The detents animate their height, so each is read once it settles.
  await expect.poll(async()=>Math.round((await sheet.boundingBox()).height)).toBe(422);
  // Swipe down on the grab handle, 80 px: half to peek.
  await grab(page,sheet,80);
  await expect(sheet).toHaveAttribute('data-detent','peek');
  await expect.poll(async()=>Math.round((await sheet.boundingBox()).height),'peek detent height').toBe(120);
  // Swipe down on the title row, 80 px more: peek closes the sheet.
  await grab(page,sheet,80);
  await expect(sheetOf(page)).toHaveCount(0);
  await expect(page.locator('#phoneMenu')).toBeFocused();
 });

 test('a swipe up on the title row steps to full, and a short drag snaps back',async({page})=>{
  await page.goto('/?lang=en');
  await openSheet(page,'properties');
  const sheet=sheetOf(page);
  await grab(page,sheet,-80);
  await expect(sheet).toHaveAttribute('data-detent','full');
  await expect.poll(async()=>Math.round((await sheet.boundingBox()).y),'full detent starts below the 52 px top bar').toBe(52);
  // A 20 px drag is too short to change the detent.
  await grab(page,sheet,20);
  await expect(sheet).toHaveAttribute('data-detent','full');
  await page.keyboard.press('Escape');
 });
});
