import {test,expect} from '@playwright/test';

// The phone and tablet Menu lists each command once. A portrait tablet leaves out Layers, Properties and the 2D, Stitches and 3D
// switch, since they stay on screen there. The phone Menu opens with only the selection actions unfolded.
const PHONE=[390,844], TABLET=[768,1024];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openMenu(page,[width,height],path='/'){
 page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto(path);
 await page.locator('#rect').click();
 await page.locator('#phoneMenu').click();
}

// Unfolds every group, so the rows of all of them are in the DOM.
async function expandAll(page){
 for(;;){
  const folded=page.locator('#phoneMenuList .menu-section[aria-expanded="false"]').first();
  if(!(await folded.count())) return;
  await folded.click();
 }
}

async function menuIds(page){
 return page.locator('#phoneMenuList [role="menuitem"]').evaluateAll(els=>els.map(e=>e.id));
}

for(const [name,size] of [['phone',PHONE],['tablet',TABLET]]) test(`the ${name} Menu lists each command once`,async({page})=>{
 await openMenu(page,size);
 await expandAll(page);
 const ids=await menuIds(page);
 expect(ids.filter((id,i)=>ids.indexOf(id)!==i),'commands listed twice').toEqual([]);
});

test('the tablet Menu leaves out the Layers, Properties and view rows that stay on screen',async({page})=>{
 await openMenu(page,TABLET);
 await expandAll(page);
 const ids=await menuIds(page);
 for(const id of ['menuLayers','menuProperties','menuView-design','menuView-stitches','menuView-preview']) expect(ids,`${id} is not listed`).not.toContain(id);
 const headings=await page.locator('#phoneMenuList .menu-heading').allTextContents();
 expect(headings.map(h=>h.trim())).not.toContain('View');
 // The rows the tablet Menu does keep, such as the grid and zoom commands, are still there.
 expect(ids).toEqual(expect.arrayContaining(['menuGrid','menuSnap','menuSnapObjects','menuFitHoop','menuSave','menuUndo']));
});

test('with an object selected, the phone Menu keeps Layers and the view switch at the top',async({page})=>{
 await openMenu(page,PHONE);
 const ids=(await menuIds(page)).filter(id=>!id.startsWith('menuSection-'));
 expect(ids.slice(0,5)).toEqual(['menuCommandPalette','menuLayers','menuView-design','menuView-stitches','menuView-preview']);
});

test('the phone Menu is under 2,000 px tall in English as it opens',async({page})=>{
 await openMenu(page,PHONE,'/');
 const height=await page.locator('#phoneMenuList').evaluate(e=>e.scrollHeight);
 expect(height,'Menu list height in px').toBeLessThan(2000);
});

test('Grid, Snap and Snap to objects each show a different icon',async({page})=>{
 await openMenu(page,PHONE);
 await expandAll(page);
 const hrefs=await Promise.all(['menuGrid','menuSnap','menuSnapObjects'].map(id=>page.locator(`#${id} svg use`).getAttribute('href')));
 const drawings=await page.evaluate(refs=>refs.map(h=>document.querySelector(h)?.innerHTML ?? ''),hrefs);
 expect(drawings.every(d=>d.length>0),'each icon is in the sprite').toBe(true);
 expect(new Set(drawings).size,'distinct icon drawings').toBe(3);
});
