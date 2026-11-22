import {test,expect} from '@playwright/test';

// On a phone and a tablet the 3D overlay's pull control is a word button in the camera presets' segmented style. Its word
// shows in full, its on state is read from aria-pressed and drawn differently from the off state, and its full sentence
// stays as its accessible name and tooltip. Checked in Spanish at the three phone and tablet sizes, with the 3D view open.
test.use({hasTouch:true});
test.setTimeout(240000);
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const SIZES=[[390,844],[844,390],[768,1024]];

// The 3D view is a WebGL2 canvas; without it the overlay never draws, so the checks are skipped as the other 3D tests are.
async function openPreview(page,lang){
 await page.goto(`/?lang=${lang}`);
 await expect(page.locator('.canvas')).toBeVisible();
 const switchView=page.locator('.canvas-views [data-view="preview"]');
 if(await switchView.isVisible())await switchView.click();
 else for(let attempt=0;attempt<2&&!(await page.locator('#preview3d').isVisible());attempt++){
  await page.locator('#phoneMenu').click();
  await page.locator('#menuView-preview').click();
 }
 await expect(page.locator('#preview3d')).toBeVisible();
 await expect(page.locator('#preview3d')).toHaveAttribute('data-instances',/^[1-9]\d*$/,{timeout:8000});
}

for(const [w,h] of SIZES) test(`${w}x${h} es: the pull control shows Tracción as a button with a pressed state`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const webgl=await page.evaluate(()=>Boolean(document.createElement('canvas').getContext('webgl2')));test.skip(!webgl,'WebGL2 is not available in this browser');
 await page.setViewportSize({width:w,height:h});
 await openPreview(page,'es');

 const pull=page.locator('#showPull');
 expect(await pull.evaluate(b=>b.tagName)).toBe('BUTTON');
 await expect(pull).toHaveText('Tracción');
 await expect(pull).toHaveAttribute('aria-label','Mostrar la tracción de la tela');
 await expect(pull).toHaveAttribute('title','Mostrar la tracción de la tela');

 // The word fits on one line inside its box, and the box is inside the screen.
 const fit=await pull.evaluate(b=>{const r=b.getBoundingClientRect();return {
  h:r.height,w:r.width,left:r.left,right:r.right,top:r.top,bottom:r.bottom,vw:innerWidth,vh:innerHeight,
  clipped:b.scrollWidth>b.clientWidth+1};});
 expect(fit.clipped,`${w}x${h}: the word clips`).toBe(false);
 expect(fit.h,`${w}x${h}: the control is a 44 px target`).toBeGreaterThanOrEqual(44);
 expect(fit.left>=0&&fit.right<=fit.vw&&fit.top>=0&&fit.bottom<=fit.vh,`${w}x${h}: the control is inside the screen`).toBe(true);

 // The off and on states differ without hover.
 const canvas=page.locator('#preview3d');
 await expect(pull).toHaveAttribute('aria-pressed','false');
 await expect(canvas).toHaveAttribute('data-pull','off');
 const offStyle=await pull.evaluate(b=>{const cs=getComputedStyle(b);return [cs.backgroundColor,cs.color,cs.fontWeight]});
 await pull.tap();
 await expect(pull).toHaveAttribute('aria-pressed','true');
 await expect(canvas,`${w}x${h}: the control shows the pull`).toHaveAttribute('data-pull','on');
 await expect(page.locator('#pullNote')).toBeVisible();
 const onStyle=await pull.evaluate(b=>{const cs=getComputedStyle(b);return [cs.backgroundColor,cs.color,cs.fontWeight]});
 expect(onStyle,`${w}x${h}: on and off look different`).not.toEqual(offStyle);

 await page.waitForTimeout(400);
 await page.screenshot({path:`test-results/pull-toggle-es-${w}x${h}.png`,fullPage:false});
 await pull.tap();
 await expect(canvas).toHaveAttribute('data-pull','off');
 expect(errors).toEqual([]);
});
