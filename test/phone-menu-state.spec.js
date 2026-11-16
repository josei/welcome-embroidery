import {test,expect} from '@playwright/test';

// Unfolds every Menu group, so the rows of a folded group are in the DOM.
async function expandMenuGroups(page){
 for(;;){
  const folded=page.locator('#phoneMenuList .menu-section[aria-expanded="false"]').first();
  if(!(await folded.count())) return;
  await folded.click();
 }
}

// The phone and tablet Menu shows whether each toggle is on, gives each toggle its own icon, names the reason each disabled row
// is unavailable, and keeps a tablet's list at the desktop menu width instead of stretching it across the screen.
const PHONE=[390,844], TABLET=[768,1024];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openEditor(page,[width,height]){
 page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto('/');
 await page.locator('#rect').click();
}

async function openMenu(page){
 await page.locator('#phoneMenu').click();
 await expect(page.locator('#phoneMenuList')).toBeVisible();
 await expandMenuGroups(page);
}

test('each on/off row in the phone Menu shows its state as text and sets aria-pressed',async({page})=>{
 await openEditor(page,PHONE);
 await openMenu(page);
 const snap=page.locator('#menuSnap');
 const snapObjects=page.locator('#menuSnapObjects');
 await expect(snap).toHaveAttribute('aria-pressed','false');
 await expect(snap).toContainText('Off');
 await expect(snapObjects).toHaveAttribute('aria-pressed','true');
 await expect(snapObjects).toContainText('On');
 await snap.click();
 await openMenu(page);
 await expect(page.locator('#menuSnap')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#menuSnap')).toContainText('On');
});

test('Grid, Snap and Snap to objects each have their own icon',async({page})=>{
 await openEditor(page,PHONE);
 await openMenu(page);
 const icon=async id=>page.locator(`#${id} use`).getAttribute('href');
 const grid=await icon('menuGrid'), snap=await icon('menuSnap'), snapObjects=await icon('menuSnapObjects');
 expect(new Set([grid,snap,snapObjects]).size).toBe(3);
});

test('a disabled Ungroup says it is not a group, not that nothing is selected',async({page})=>{
 await openEditor(page,PHONE);
 await openMenu(page);
 const row=page.locator('#menuUngroup');
 await expect(row).toBeDisabled();
 await expect(row.locator('.menu-reason')).toHaveText('Not a group');
});

test('each disabled path, clip and text row names its own reason with a leaf selected',async({page})=>{
 await openEditor(page,PHONE);
 await openMenu(page);
 const reasons={
  menuUnclip:'Not clipped',
  menuTextOffPath:'Not text on a path',
  menuNodeDelete:'Not a path',
  menuNodeSmooth:'Not a path',
  menuNodeCorner:'Not a path',
 };
 for(const [id,text] of Object.entries(reasons)){
  await expect(page.locator(`#${id}`),id).toBeDisabled();
  await expect(page.locator(`#${id} .menu-reason`),id).toHaveText(text);
 }
});

test('the phone Menu lists the drawing tools under Tools and the node commands under Nodes',async({page})=>{
 await openEditor(page,PHONE);
 await openMenu(page);
 const groups=await page.locator('#phoneMenuList').evaluate(list=>{
  const out={};let current=null;
  for(const el of list.children){
   if(el.classList.contains('menu-heading')) current=el.textContent.trim();
   else if(current&&el.matches('[role="menuitem"]')) (out[current]??=[]).push(el.id);
  }
  return out;
 });
 expect(groups.Tools).toEqual(['menuSelectAdd','menuEllipse','menuPolygon','menuStar','menuPen','menuTrace','menuPhoto']);
 expect(groups.Nodes).toEqual(['menuEditNodes','menuNodeAdd','menuNodeDelete','menuNodeSmooth','menuNodeCorner']);
});

test('the tablet Menu is the desktop menu width, not the full screen width',async({page})=>{
 await openEditor(page,TABLET);
 await openMenu(page);
 const box=await page.locator('#phoneMenuList').boundingBox();
 expect(box.width).toBeLessThanOrEqual(420);
});

for(const lang of ['en','es']){
 const size=TABLET;
 test(`no reason or label in the tablet Menu is cut off (${lang} portrait tablet)`,async({page})=>{
  await page.addInitScript(l=>localStorage.setItem('welcome.lang',l),lang);
  await openEditor(page,size);
  await openMenu(page);
  const cut=await page.locator('#phoneMenuList').evaluate(list=>{
   const bad=[];
   for(const el of list.querySelectorAll('.menu-item > span, .menu-item > small.menu-reason')){
    if(el.getClientRects().length&&el.scrollWidth>el.clientWidth) bad.push(el.textContent.trim());
   }
   return bad;
  });
  expect(cut).toEqual([]);
 });
}

test('the phone Menu still fills the screen width',async({page})=>{
 await openEditor(page,PHONE);
 await openMenu(page);
 const box=await page.locator('#phoneMenuList').boundingBox();
 expect(box.width).toBe(PHONE[0]);
});

// On a fresh profile the Menu opens with File unfolded, so New, Open and Export are one tap away. Once an object is selected, the
// Menu opens with Arrange unfolded instead, since its rows act on the selection.
async function openBareEditor(page,[width,height]){
 page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto('/');
}

async function drawRect(page){
 await page.locator('#rect').click();
 const box=await page.locator('body').boundingBox();
 await page.mouse.move(box.x+box.width/2-40,box.y+box.height/2-40);
 await page.mouse.down();
 await page.mouse.move(box.x+box.width/2+40,box.y+box.height/2+40,{steps:5});
 await page.mouse.up();
}

for(const size of [PHONE,TABLET]){
 test(`the Menu opens with File unfolded and Arrange folded when nothing is selected at ${size.join('x')}`,async({page})=>{
  await openBareEditor(page,size);
  await page.locator('#phoneMenu').click();
  await expect(page.locator('#phoneMenuList')).toBeVisible();
  await expect(page.locator('#menuSection-File')).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('#menuSection-Arrange')).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('#menuNew')).toBeVisible();
 });

 test(`the Menu opens with Arrange unfolded once an object is selected at ${size.join('x')}`,async({page})=>{
  await openBareEditor(page,size);
  await drawRect(page);
  await page.locator('#phoneMenu').click();
  await expect(page.locator('#phoneMenuList')).toBeVisible();
  await expect(page.locator('#menuSection-Arrange')).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('#menuSection-File')).toHaveAttribute('aria-expanded','false');
 });
}

// From a fresh profile, a phone or tablet user can start a design, add lettering and export a DST file in 7 actions or fewer:
// the Menu, New, the lettering tool, a tap to place the text, typing it, the top bar's Export, and Download.
for(const size of [PHONE,TABLET]){
 test(`a new design with lettering exports a DST file in 7 actions or fewer at ${size.join('x')}`,async({page})=>{
  page.on('dialog',d=>d.accept());
  await page.setViewportSize({width:size[0],height:size[1]});
  await page.goto('/');
  let actions=0;
  const tap=async loc=>{actions++;await loc.click();};
  await tap(page.locator('#phoneMenu'));
  await tap(page.locator('#menuNew'));
  await tap(page.locator('.tool-rail #letter'));
  await tap(page.locator('.canvas'));
  await page.keyboard.type('WE');
  actions++;
  await tap(page.locator('#export'));
  await expect(page.locator('#exportDialog')).toBeVisible();
  await expect(page.locator('#format')).toHaveValue('dst');
  const download=page.waitForEvent('download');
  await tap(page.locator('#download'));
  expect((await download).suggestedFilename()).toMatch(/\.dst$/);
  expect(actions).toBeLessThanOrEqual(7);
 });
}
