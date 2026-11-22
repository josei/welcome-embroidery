import {test,expect} from '@playwright/test';

// The editor's icon sprite holds one symbol per id. A second symbol with the same id would be ignored by the browser, so
// a reference would resolve to whichever definition came first rather than the glyph the code intends.
test('the icon sprite has exactly one symbol per id',async({page})=>{
 await page.setViewportSize({width:1280,height:800});
 await page.goto('/');
 await expect(page.locator('header.top #name')).toBeVisible();
 const ids=await page.evaluate(()=>[...document.querySelectorAll('symbol[id]')].map(s=>s.id));
 expect(ids.length).toBeGreaterThan(0);
 const counts={};for(const id of ids)counts[id]=(counts[id]??0)+1;
 expect(Object.entries(counts).filter(([,n])=>n>1)).toEqual([]);
 expect(ids.filter(id=>id==='i-fit')).toHaveLength(1);
});
