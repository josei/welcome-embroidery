import {test,expect} from '@playwright/test';

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
