import {test,expect} from '@playwright/test';

// The phone and tablet Menu lists the same command groups as the desktop menu bar, in the same order: File, Edit and Arrange.
// Each group holds the same commands as its desktop menu, so a command found on one size is found on every size.
const DESKTOP=[1280,800], PHONE=[390,844], TABLET=[768,1024];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openEditor(page,[width,height]){
 page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto('/');
 await page.locator('#rect').click();
}

test('the desktop menu bar has File, Edit and Arrange menus',async({page})=>{
 await openEditor(page,DESKTOP);
 await expect(page.locator('#phoneMenu')).toHaveCount(0);
 const names=await page.locator('.file-menu > button[aria-haspopup]').evaluateAll(els=>els.map(e=>e.textContent.trim()));
 expect(names.slice(0,3)).toEqual(['File','Edit','Arrange']);
});

for(const size of [PHONE,TABLET]) test(`the Menu at ${size[0]}x${size[1]} lists the desktop File, Edit and Arrange groups in order`,async({page})=>{
 await openEditor(page,size);
 await page.locator('#phoneMenu').click();
 const headings=await page.locator('#phoneMenuList .menu-heading').allTextContents();
 expect(headings.slice(0,3)).toEqual(['File','Edit','Arrange']);
});

// Command ids under each desktop menu, keyed by the menu's button id.
const DESKTOP_MENUS={File:'#fileMenu',Edit:'#editMenu',Arrange:'#arrangeMenu'};

// Command ids per group in the phone or tablet Menu, keyed by heading text.
async function phoneGroups(page){
 return page.locator('#phoneMenuList').evaluate(list=>{
  const groups={};let current=null;
  for(const el of list.children){
   if(el.classList.contains('menu-heading')) current=el.textContent.trim();
   else if(current&&el.matches('[role="menuitem"]')) (groups[current]??=[]).push(el.id);
  }
  return groups;
 });
}

// The phone Menu shows the command palette once, at the top, instead of in the File and Edit groups. The phone File group
// also holds the New, Open, Import and Export rows, which the desktop keeps in its toolbar rather than in the File menu.
const PALETTE='menuCommandPalette';
const PHONE_ONLY={File:['menuNew','menuOpen','menuImport','menuExport'],Edit:[],Arrange:[]};

for(const [group,button] of Object.entries(DESKTOP_MENUS)) test(`the ${group} commands match the desktop ${group} menu on a phone`,async({page})=>{
 await openEditor(page,DESKTOP);
 await page.locator(button).click();
 const desktop=await page.locator(`${button}List [role="menuitem"]`).evaluateAll(els=>els.map(e=>e.id));
 await page.keyboard.press('Escape');
 await page.setViewportSize({width:PHONE[0],height:PHONE[1]});
 await page.locator('#phoneMenu').click();
 const phone=(await phoneGroups(page))[group];
 expect(phone.filter(id=>!PHONE_ONLY[group].includes(id))).toEqual(desktop.filter(id=>id!==PALETTE));
 expect(phone.filter(id=>PHONE_ONLY[group].includes(id))).toEqual(PHONE_ONLY[group]);
});

test('the command palette is listed once on a phone, at the top of the Menu',async({page})=>{
 await openEditor(page,PHONE);
 await page.locator('#phoneMenu').click();
 const ids=await page.locator('#phoneMenuList [role="menuitem"]').evaluateAll(els=>els.map(e=>e.id));
 expect(ids.filter(id=>id===PALETTE)).toEqual([PALETTE]);
 expect(ids[0]).toBe(PALETTE);
});
