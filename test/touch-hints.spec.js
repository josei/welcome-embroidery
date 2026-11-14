import {test,expect} from '@playwright/test';

// On a touch screen the path and lettering hints say to tap (there is no Enter or Escape key), the Path button reads Done
// while a path is open, a tap leaves no focus ring on a tool button and no keyboard-shortcut tooltip, and the canvas shows
// no browser-default ring. Mouse wording is unchanged. Screenshots of both phone sizes are written to test-results.
const SIZES={portrait:[390,844],landscape:[844,390]};

// New is hidden at phone widths, so the empty design is made at desktop width and the window is then shrunk to the phone size.
const openEmpty=async(page,url,[w,h])=>{
 page.on('dialog',d=>d.accept());
 await page.setViewportSize({width:1280,height:800});
 await page.goto(url);
 await page.locator('#new').click();
 if(await page.locator('#discardDialog[open]').count()) await page.locator('#discardDiscard').click();
 await page.setViewportSize({width:w,height:h});
};

test.describe('touch wording and focus after a tap',()=>{
 test.skip(({browserName})=>browserName!=='chromium','touch points are dispatched through a Chromium CDP session');

 const hints=page=>page.locator('#toast .toast-item');
 const pathLabel=page=>page.locator('#path .rail-label');

 for(const [name,[w,h]] of Object.entries(SIZES)) for(const lang of ['en','es']){
  test.describe(`${name} ${w}×${h} ${lang}`,()=>{
   test.use({viewport:{width:w,height:h},hasTouch:true,isMobile:true});
   const url=lang==='en'?'/':'/?lang=es';

   test(`a tap on Draw path shows the tap wording, and the Path button reads Done until the path ends (${lang})`,async({page})=>{
    await openEmpty(page,url,[w,h]);
    await page.locator('#path').tap();
    const tapHint=lang==='en'
      ?'Tap to add points. Tap the first point to close, or tap Path again to finish.'
      :'Toca para añadir puntos. Toca el primer punto para cerrar, o toca Trazo otra vez para terminar.';
    await expect(hints(page)).toHaveCount(1);
    await expect(hints(page)).toContainText(tapHint);
    await expect(hints(page)).not.toContainText('Click');
    await expect(pathLabel(page)).toHaveText(lang==='en'?'Done':'Listo');
    // Two taps on the canvas add points; tapping the button again finishes the path.
    const art=await page.locator('#art').boundingBox();
    await page.touchscreen.tap(art.x+art.width*0.3,art.y+art.height*0.3);
    await page.touchscreen.tap(art.x+art.width*0.6,art.y+art.height*0.3);
    await page.locator('#path').tap();
    await expect(pathLabel(page)).toHaveText(lang==='en'?'Path':'Trazo');
    await expect(page.locator('.object-row').first()).toContainText(lang==='en'?'Drawn path':'Trazado');
   });

   test(`after a tap on Text, no focus ring stays on the tool button and no shortcut tooltip shows (${lang})`,async({page})=>{
    await openEmpty(page,url,[w,h]);
    await page.locator('#letter').tap();
    await expect(page.locator('#canvasText')).toBeFocused();
    expect(await page.locator('#letter').evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('none');
    expect(await page.locator('#tooltip.show').count()).toBe(0);
    await expect(page.locator('#canvasTextHint')).toContainText(lang==='en'?'Tap outside the box to save the text.':'Toca fuera del cuadro para guardar el texto.');
    await page.screenshot({path:`test-results/touch-hints/${name}-${lang}-lettering.png`});
   });

   test(`a tap on the canvas in path mode draws no browser-default ring on the canvas (${lang})`,async({page})=>{
    await openEmpty(page,url,[w,h]);
    await page.locator('#path').tap();
    const art=await page.locator('#art').boundingBox();
    await page.touchscreen.tap(art.x+art.width*0.4,art.y+art.height*0.4);
    expect(await page.locator('#art').evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('none');
    await page.screenshot({path:`test-results/touch-hints/${name}-${lang}-path.png`});
   });
  });
 }

 test('mouse keeps the click wording, and the Path button keeps its label while drawing',async({page})=>{
  await openEmpty(page,'/',[1280,800]);
  await page.locator('#path').click();
  await expect(hints(page)).toContainText('Click to add points. Click the first point to close a polygon, Enter or double-click to finish.');
  await expect(pathLabel(page)).toHaveText('Path');
 });
});
