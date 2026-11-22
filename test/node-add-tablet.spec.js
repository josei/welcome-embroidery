import {test,expect} from '@playwright/test';

// On a portrait tablet a whole path selected with node editing off offers Edit nodes as the one route into node editing,
// so "Add node" is hidden. With node editing on it is shown and adds a node to the path.

test.use({hasTouch:true});
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function drawPath(page){
 const m=await page.evaluate(()=>{const m=document.querySelector('#art').getScreenCTM();return {a:m.a,d:m.d,e:m.e,f:m.f};});
 const at=(x,y)=>({x:m.a*x+m.e,y:m.d*y+m.f});
 await page.locator('#path').click();
 for(const [x,y] of [[-20,-20],[20,-20],[0,20]]){const p=at(x,y);await page.mouse.click(p.x,p.y);}
 const first=at(-20,-20);await page.mouse.click(first.x,first.y);
 await expect(page.locator('.object-row.selected')).toHaveCount(1);
 // Drawing leaves node editing on; Escape turns it off, so the whole path is selected with editing off.
 await page.keyboard.press('Escape');
 await expect(page.locator('.path-node')).toHaveCount(0);
}

test('768x1024 es: Add node is hidden on a whole path until node editing is on, then shown and adds a node',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width:768,height:1024});
 await page.goto('/?lang=es');
 await drawPath(page);

 await expect(page.locator('#editNodes')).toBeVisible();
 await expect(page.locator('#nodeAdd'),'Añadir nodo is hidden with node editing off').toBeHidden();

 await page.locator('#editNodes').click();
 const add=page.locator('#nodeAdd');
 await expect(add,'Añadir nodo is shown with node editing on').toBeVisible();
 await expect(add).toBeEnabled();
 const before=await page.locator('.path-node').count();
 await add.click();
 await expect(page.locator('.path-node')).toHaveCount(before+1);
 expect(errors).toEqual([]);
});
