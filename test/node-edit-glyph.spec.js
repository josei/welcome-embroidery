import {test,expect} from '@playwright/test';

// On a portrait tablet with a whole path selected, the rail's pen tool and the selection bar's Edit nodes control are on
// screen together. They must not draw the same glyph, so the test compares the drawn path data, not only the sprite ids.

test.use({hasTouch:true});
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function drawPath(page){
 const m=await page.evaluate(()=>{const m=document.querySelector('#art').getScreenCTM();return {a:m.a,d:m.d,e:m.e,f:m.f};});
 const at=(x,y)=>({x:m.a*x+m.e,y:m.d*y+m.f});
 await page.locator('#path').click();
 for(const [x,y] of [[-20,-20],[20,-20],[0,20]]){const p=at(x,y);await page.mouse.click(p.x,p.y);}
 const first=at(-20,-20);await page.mouse.click(first.x,first.y);
 await expect(page.locator('.object-row.selected')).toHaveCount(1);
 await page.keyboard.press('Escape');
 await expect(page.locator('.path-node')).toHaveCount(0);
}

// The drawn shapes of a sprite symbol, in order: every path's d and every circle or rect's attributes.
function symbolShapes(page,id){
 return page.evaluate((id)=>{
  const sym=document.getElementById(id);
  return sym?Array.from(sym.children,el=>el.tagName+' '+(el.getAttribute('d')||['cx','cy','r','x','y','width','height'].map(a=>el.getAttribute(a)).join(' '))):null;
 },id);
}

test('768x1024 es: the pen tool and Editar nodos draw different glyphs with a path selected',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width:768,height:1024});
 await page.goto('/?lang=es');
 await drawPath(page);

 const editBtn=page.locator('#editNodes');
 await expect(editBtn).toBeVisible();
 await expect(editBtn.locator('svg use')).toHaveAttribute('href','#i-node-edit');
 await expect(page.locator('#pen use')).toHaveAttribute('href','#i-pen');

 const pen=await symbolShapes(page,'i-pen');
 const nodeEdit=await symbolShapes(page,'i-node-edit');
 expect(pen).not.toBeNull();
 expect(nodeEdit).not.toBeNull();
 expect(nodeEdit,'the node-edit glyph is not the pen glyph').not.toEqual(pen);
 expect(errors).toEqual([]);
});
