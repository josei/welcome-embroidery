import {test,expect} from '@playwright/test';

// On a tablet in landscape (1024x768) the tool palette docks on the canvas's left edge as one column, and Fit hoop keeps the hoop
// clear of it. The Properties toggle is a neutral header button, not a selected tool, and the text-alignment row fits the inspector
// under touch, in both languages.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function open(browser,{lang,touch}){
 const ctx=await browser.newContext({viewport:{width:1024,height:768},hasTouch:touch});
 const page=await ctx.newPage();
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 await page.goto(`/?lang=${lang}`);
 await expect(page.locator('.tool-rail')).toBeVisible();
 return {ctx,page};
}

const box=(page,sel)=>page.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom,w:r.width};},sel);

for(const lang of ['en','es']) for(const touch of [false,true]) test(`tool palette is one column clear of the hoop at 1024x768 (${lang}, ${touch?'touch':'mouse'})`,async({browser})=>{
 const {ctx,page}=await open(browser,{lang,touch});
 await page.getByRole('button',{name:/^(Fit hoop|Ajustar bastidor)$/}).click();
 const rail=await box(page,'.canvas .tool-rail');
 const canvas=await box(page,'.canvas');
 const lefts=await page.evaluate(()=>[...new Set([...document.querySelectorAll('.canvas .tool-rail .icon-button')].map(b=>Math.round(b.getBoundingClientRect().left)))]);
 expect(lefts,'every tool sits in the same column').toHaveLength(1);
 // The palette docks beside the ruler, inside the canvas, and the canvas keeps its full 504 px width at this size.
 expect(rail.l).toBeGreaterThanOrEqual(canvas.l);
 expect(rail.r).toBeLessThanOrEqual(canvas.r);
 expect(canvas.w,'canvas width is not reduced').toBeGreaterThanOrEqual(touch?476:504);
 await ctx.close();
});

for(const lang of ['en','es']) for(const touch of [false,true]) test(`text alignment buttons sit inside the inspector at 1024x768 (${lang}, ${touch?'touch':'mouse'})`,async({browser})=>{
 const {ctx,page}=await open(browser,{lang,touch});
 await page.locator('#letter').click();
 const c=await box(page,'.canvas');
 await page.mouse.click(c.l+(c.r-c.l)/2,c.t+(c.b-c.t)/2);
 await page.keyboard.type('Hi');
 await page.keyboard.press('Escape');
 await page.locator('#objects .object-row').last().click();
 const insp=await box(page,'#inspector');
 const buttons=await page.evaluate(()=>[...document.querySelectorAll('[data-align-text]')].map(e=>{const r=e.getBoundingClientRect();return r.right;}));
 expect(buttons.length).toBe(3);
 for(const r of buttons) expect(r,'alignment button inside the inspector').toBeLessThanOrEqual(insp.r);
 await ctx.close();
});

for(const lang of ['en','es']) test(`Properties toggle is drawn pressed while the inspector is open (${lang})`,async({browser})=>{
 const {ctx,page}=await open(browser,{lang,touch:true});
 const toggle=page.locator('.layers-head .inspector-toggle');
 await expect(toggle).toHaveAttribute('aria-expanded','true');
 await expect(toggle).toHaveAttribute('aria-pressed','true');
 const bg=await toggle.evaluate(e=>getComputedStyle(e).backgroundColor);
 expect(bg,'selected teal fill while open').toBe('rgb(225, 241, 236)');
 await toggle.click();
 await expect(toggle).toHaveAttribute('aria-pressed','false');
 const closedBg=await toggle.evaluate(e=>getComputedStyle(e).backgroundColor);
 expect(closedBg,'no teal fill once folded').not.toBe('rgb(225, 241, 236)');
 await ctx.close();
});

for(const lang of ['en','es']) test(`Properties toggle shows at desktop size and folds the inspector (${lang})`,async({browser})=>{
 const ctx=await browser.newContext({viewport:{width:1440,height:900}});
 const page=await ctx.newPage();
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 await page.goto(`/?lang=${lang}`);
 await expect(page.locator('.tool-rail')).toBeVisible();
 const toggle=page.locator('.layers-head .inspector-toggle');
 await expect(toggle).toBeVisible();
 await expect(toggle).toHaveAttribute('aria-expanded','true');
 const canvasBefore=(await box(page,'.canvas')).w;
 await toggle.click();
 await expect(toggle).toHaveAttribute('aria-expanded','false');
 await expect(page.locator('#inspector')).toBeHidden();
 expect((await box(page,'.canvas')).w,'folding gives the canvas the inspector column').toBeGreaterThan(canvasBefore);
 await toggle.click();
 await expect(page.locator('#inspector')).toBeVisible();
 await ctx.close();
});

for(const lang of ['en','es']) for(const touch of [false,true]) test(`underlay label clears its select at 1024x768 (${lang}, ${touch?'touch':'mouse'})`,async({browser})=>{
 const {ctx,page}=await open(browser,{lang,touch});
 await page.locator('#objects .object-row').first().click();
 await page.locator('#underlayRow').scrollIntoViewIfNeeded();
 const gap=await page.evaluate(()=>{const r=document.querySelector('#underlayRow');const range=document.createRange();range.selectNodeContents(r.firstChild);const textBottom=Math.max(...[...range.getClientRects()].map(x=>x.bottom));return document.querySelector('#underlayType').getBoundingClientRect().top-textBottom;});
 expect(gap,'label text ends above the select').toBeGreaterThanOrEqual(4);
 await ctx.close();
});

for(const lang of ['en','es']) for(const touch of [false,true]) test(`default view leaves the palette clear of the canvas centre at 1024x768 (${lang}, ${touch?'touch':'mouse'})`,async({browser})=>{
 const {ctx,page}=await open(browser,{lang,touch});
 const rail=await box(page,'.canvas .tool-rail');
 const canvas=await box(page,'.canvas');
 expect(rail.r,'palette ends before the canvas centre').toBeLessThan(canvas.l+canvas.w/2);
 await ctx.close();
});
