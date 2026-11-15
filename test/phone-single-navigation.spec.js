import {test,expect} from '@playwright/test';

// Unfolds every Menu group, so the rows of a folded group are in the DOM.
async function expandMenuGroups(page){
 for(;;){
  const folded=page.locator('#phoneMenuList .menu-section[aria-expanded="false"]').first();
  if(!(await folded.count())) return;
  await folded.click();
 }
}

// On a phone the Menu is the one navigation model. The bottom bar keeps only the tool palette and the view-mode control, no command
// button in it repeats a Menu row, no More tools panel is rendered, and every command the removed controls offered is a Menu row.
const SIZES=[[390,844],[844,390]];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openEditor(page,width,height,lang='en'){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.locator('#rect').click();
 return errors;
}

// Every control in the bottom bar: the tool dock under the canvas and the playback strip above it (portrait), or the tool
// rail at the left edge on a landscape phone. The Layers and Properties sheets open from the Menu at every phone size.
const bottomBarIds=page=>page.evaluate(()=>{
 const bars=[...document.querySelectorAll('.layout main .tool-rail, .layout main .phone-playback')];
 return bars.flatMap(bar=>[...bar.querySelectorAll('button[id], input[id]')]
  .filter(e=>e.getBoundingClientRect().width>0).map(e=>e.id));
});

// Every Menu row's id, opening the Menu first.
async function menuIds(page){
 const list=page.locator('#phoneMenuList');
 if(!(await list.isVisible())) await page.locator('#phoneMenu').click();
 await expect(list).toBeVisible();
 await expandMenuGroups(page);
 const ids=await list.locator('[role="menuitem"]').evaluateAll(els=>els.map(e=>e.id));
 await page.keyboard.press('Escape');
 await expect(list).toHaveCount(0);
 return ids;
}

// The commands the phone bottom bar and More tools panel offered before this change, with the Menu row that now holds each.
const OLD_COMMANDS={
 selectToggle:'menuSelectAdd', barDuplicate:'menuDuplicate', barDelete:'menuDelete', group:'menuGroup', ungroup:'menuUngroup',
 clipBtn:'menuClip', unclipBtn:'menuUnclip', textOnPath:'menuTextOnPath', textOffPath:'menuTextOffPath', editNodes:'menuEditNodes',
 nodeAdd:'menuNodeAdd', nodeDel:'menuNodeDelete', nodeSmooth:'menuNodeSmooth', nodeCorner:'menuNodeCorner',
 ellipse:'menuEllipse', polygon:'menuPolygon', star:'menuStar', traceBtn:'menuTrace', photo:'menuPhoto', pen:'menuPen',
 moreLayers:'menuLayers', moreProperties:'menuProperties',
};
// The align, flip and boolean buttons of the bar had Menu rows already.
const ARRANGE_ROWS=['menuAlignLeft','menuAlignHCenter','menuAlignRight','menuAlignTop','menuAlignVCenter','menuAlignBottom',
 'menuFlipH','menuFlipV','menuSubtract','menuUnion','menuIntersect'];

for(const [width,height] of SIZES){
 test(`no command button in the bottom bar repeats a Menu row at ${width}x${height}`,async({page})=>{
  const errors=await openEditor(page,width,height,'en');
  const bar=await bottomBarIds(page);
  const menu=await menuIds(page);
  expect(bar.length,'the bottom bar has controls').toBeGreaterThan(0);
  const duplicates=bar.filter(id=>menu.includes(id));
  expect(duplicates,'bottom-bar controls that also appear in the Menu').toEqual([]);
  // Only the tool palette and the view-mode and playback controls are in the bottom bar.
  const allowed=new Set(['select','rect','path','letter','line','measure','play','resetPlayback','seek']);
  const extra=bar.filter(id=>!allowed.has(id));
  expect(extra,'bottom bar holds no command controls').toEqual([]);
  expect(errors).toEqual([]);
 });

 test(`no More tools panel or button is rendered at ${width}x${height}`,async({page})=>{
  const errors=await openEditor(page,width,height,'en');
  await expect(page.locator('#moreToolsSheet')).toHaveCount(0);
  await expect(page.locator('#toolMore')).toHaveCount(0);
  expect(errors).toEqual([]);
 });

 test(`every command the removed controls offered is a Menu row at ${width}x${height}`,async({page})=>{
  const errors=await openEditor(page,width,height,'en');
  const menu=await menuIds(page);
  const missing=Object.entries(OLD_COMMANDS).filter(([, row])=>!menu.includes(row)).map(([old])=>old);
  expect(missing,'old controls with no Menu row').toEqual([]);
  for(const row of ARRANGE_ROWS) expect(menu,`${row} is in the Menu`).toContain(row);
  expect(errors).toEqual([]);
 });
}

test('the canvas keeps at least half the 390 px height at 844x390',async({page})=>{
 const errors=await openEditor(page,844,390,'en');
 const h=await page.locator('.layout main>.canvas').evaluate(e=>e.getBoundingClientRect().height);
 expect(h,'canvas height').toBeGreaterThanOrEqual(195);
 expect(errors).toEqual([]);
});
