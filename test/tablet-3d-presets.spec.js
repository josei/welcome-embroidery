import {test,expect} from '@playwright/test';

// A tablet's canvas is narrow enough that the 3D camera presets cannot sit beside the 2D / Stitches / 3D
// switch. They drop below it, so every camera view is its own touch target in English and Spanish and a tap
// never lands on the switch. On a phone the switch is in the Menu and the presets keep the top-left corner;
// the desktop has room for both rows.

test.use({hasTouch:true});
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const PRESETS={en:['Front ¾','Close-up','Turntable','Loupe 8×'],es:['Frontal ¾','Primer plano','Giro','Lupa 8×']};
const VIEWS={en:['2D','Stitches','3D'],es:['2D','Puntadas','3D']};

const box=async(page,sel)=>{const b=await page.locator(sel).first().boundingBox();return {left:b.x,top:b.y,right:b.x+b.width,bottom:b.y+b.height};};
const presetBoxes=page=>page.locator('#previewView button').evaluateAll(bs=>bs.map(b=>{
 const r=b.getBoundingClientRect();return {name:b.textContent.trim(),left:r.left,top:r.top,right:r.right,bottom:r.bottom};
}));
const intersects=(a,b)=>a.left<b.right-0.5&&b.left<a.right-0.5&&a.top<b.bottom-0.5&&b.top<a.bottom-0.5;
const inside=(a,b)=>a.left>=b.left-0.5&&a.right<=b.right+0.5&&a.top>=b.top-0.5&&a.bottom<=b.bottom+0.5;

async function open3d(page,{phone=false}={}){
 if(phone){
  await page.locator('#phoneMenu').click();
  await page.locator('#menuView-preview').click();
 }else await page.locator('.canvas-views button[data-view="preview"]').click();
 await expect(page.locator('#preview3d')).toHaveAttribute('data-instances',/^[1-9]\d*$/,{timeout:8000});
}

async function goto(page,width,height,lang){
 await page.setViewportSize({width,height});
 await page.goto(`/?lang=${lang}`);
}

for(const lang of ['en','es']){
 test(`768x1024 ${lang}: no camera preset shares a box with the view switch`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await goto(page,768,1024,lang);
  await open3d(page);
  const canvas=await box(page,'.canvas');
  const viewSwitch=await box(page,'.canvas-views');
  const presets=await presetBoxes(page);
  expect(presets.map(p=>p.name),'the camera presets are listed in order').toEqual(PRESETS[lang]);
  for(const preset of presets){
   expect(intersects(preset,viewSwitch),`${preset.name} overlaps the view switch`).toBe(false);
   expect(inside(preset,canvas),`${preset.name} stays inside the canvas`).toBe(true);
  }
  // A point in the middle of each preset belongs to that preset, not to a control drawn over it.
  const hits=await page.evaluate(()=>[...document.querySelectorAll('#previewView button')].map(b=>{
   const r=b.getBoundingClientRect(),el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
   return {name:b.textContent.trim(),own:el===b||b.contains(el),hit:el?el.textContent.trim():'none'};
  }));
  for(const hit of hits) expect(hit.own,`the centre of ${hit.name} hits ${hit.hit}`).toBe(true);
  // The pull estimate moved down with the presets instead of covering them.
  const row=await box(page,'#previewView');
  expect(intersects(await box(page,'#previewPull'),row),'the pull estimate overlaps the preset row').toBe(false);
  // The switch keeps its 44 px targets, its labels and its order, and stays inside the canvas.
  const views=await page.locator('.canvas-views .segmented button').evaluateAll(bs=>bs.map(b=>{
   const r=b.getBoundingClientRect();return {label:b.textContent.trim(),width:r.width,height:r.height};
  }));
  expect(views.map(v=>v.label),'the switch keeps its labels and order').toEqual(VIEWS[lang]);
  for(const view of views){
   expect(view.width,`${view.label} is at least 44 px wide`).toBeGreaterThanOrEqual(44);
   expect(view.height,`${view.label} is at least 44 px tall`).toBeGreaterThanOrEqual(44);
  }
  expect(inside(viewSwitch,canvas),'the switch stays inside the canvas').toBe(true);
  expect(errors).toEqual([]);
 });

 test(`768x1024 ${lang}: a touch on each camera preset keeps 3D active`,async({page})=>{
  await goto(page,768,1024,lang);
  await open3d(page);
  const threeD=page.locator('.canvas-views button[data-view="preview"]');
  const presets=page.locator('#previewView button');
  expect(await presets.count()).toBe(PRESETS[lang].length);
  for(const [index,name] of PRESETS[lang].entries()){
   await expect(presets.nth(index)).toHaveText(name);
   const r=await presets.nth(index).boundingBox();
   await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);
   await expect(presets.nth(index),`${name} is the highlighted preset after a tap`).toHaveAttribute('aria-pressed','true');
   await expect(threeD,'3D is still the view after tapping '+name).toHaveAttribute('aria-pressed','true');
   await expect(page.locator('#preview3d')).toBeVisible();
  }
 });

 test(`1440x900 ${lang}: the desktop camera presets stay clear of the switch and all work`,async({page})=>{
  await goto(page,1440,900,lang);
  await open3d(page);
  const viewSwitch=await box(page,'.canvas-views');
  const presets=page.locator('#previewView button');
  expect(await presets.count()).toBe(PRESETS[lang].length);
  for(const [index,name] of PRESETS[lang].entries()){
   const preset=(await presetBoxes(page))[index];
   expect(intersects(preset,viewSwitch),`${name} overlaps the view switch on the desktop`).toBe(false);
   await presets.nth(index).click();
   await expect(presets.nth(index),`${name} highlights when clicked`).toHaveAttribute('aria-pressed','true');
   await expect(page.locator('.canvas-views button[data-view="preview"]'),'3D stays the view').toHaveAttribute('aria-pressed','true');
  }
 });

 test(`1024x768 ${lang}: the camera presets sit below the switch and every label is whole`,async({page})=>{
  await goto(page,1024,768,lang);
  await open3d(page);
  const viewSwitch=await box(page,'.canvas-views');
  const canvas=await box(page,'.canvas');
  const presets=await presetBoxes(page);
  expect(presets.map(p=>p.name),'the camera presets are listed in order').toEqual(PRESETS[lang]);
  for(const preset of presets){
   expect(intersects(preset,viewSwitch),`${preset.name} overlaps the view switch`).toBe(false);
   expect(inside(preset,canvas),`${preset.name} stays inside the canvas`).toBe(true);
  }
  const labels=await page.locator('#previewView button').evaluateAll(bs=>bs.map(b=>({
   name:b.textContent.trim(),clipped:b.scrollWidth>b.clientWidth+0.5,
  })));
  for(const label of labels) expect(label.clipped,`${label.name} is cut off`).toBe(false);
  const hits=await page.evaluate(()=>[...document.querySelectorAll('#previewView button')].map(b=>{
   const r=b.getBoundingClientRect(),el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
   return {name:b.textContent.trim(),own:el===b||b.contains(el),hit:el?el.textContent.trim():'none'};
  }));
  for(const hit of hits) expect(hit.own,`the centre of ${hit.name} hits ${hit.hit}`).toBe(true);
  for(const [index,name] of PRESETS[lang].entries()){
   const r=await page.locator('#previewView button').nth(index).boundingBox();
   await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);
   await expect(page.locator('#previewView button').nth(index),`${name} is the highlighted preset after a tap`).toHaveAttribute('aria-pressed','true');
   await expect(page.locator('.canvas-views button[data-view="preview"]'),'3D is still the view').toHaveAttribute('aria-pressed','true');
  }
 });

 test(`390x844 ${lang}: the phone camera presets keep the top-left corner`,async({page})=>{
  await goto(page,390,844,lang);
  await open3d(page,{phone:true});
  expect(await page.locator('.canvas-views').isVisible(),'the switch is in the Menu on a phone').toBe(false);
  const canvas=await box(page,'.canvas');
  const row=await box(page,'#previewView');
  expect(Math.round(row.left-canvas.left),'the preset row keeps its left inset').toBe(12);
  const strip=await box(page,'.save-status:visible');
  expect(row.top,'the preset row starts below the autosave strip, not under it').toBeGreaterThanOrEqual(strip.bottom);
  for(const preset of await presetBoxes(page)) expect(inside(preset,canvas),`${preset.name} stays inside the canvas`).toBe(true);
 });

 test(`768x1024 ${lang}: orbit clears the preset highlight and a double-click resets it`,async({page})=>{
  await goto(page,768,1024,lang);
  await open3d(page);
  const canvas=page.locator('#preview3d');
  const front=page.locator('#previewView button').first();
  const turntable=page.locator('#previewView button').nth(2);
  await expect(front).toHaveAttribute('aria-pressed','true');
  const b=await canvas.boundingBox();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);
  await page.mouse.down();
  await page.mouse.move(b.x+b.width/2+50,b.y+b.height/2+10,{steps:4});
  await page.mouse.up();
  await expect(front,'orbiting clears the chosen preset').toHaveAttribute('aria-pressed','false');
  await expect(turntable).toHaveAttribute('aria-pressed','false');
  await canvas.dblclick();
  await expect(canvas,'a double-click resets the camera').toHaveAttribute('data-yaw','0.000');
  await expect(front,'a double-click returns to the Front ¾ preset').toHaveAttribute('aria-pressed','true');
 });
}
