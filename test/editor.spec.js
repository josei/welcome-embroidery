import {test,expect} from '@playwright/test';
import {pinnedMachineFixture,readMachineFixtures} from './fixture-archive.js';
import {decodeEmbroidery} from '../src/readers.js';
import {initialDocument,importStitchLayer,applyOperations,compile,geometry} from '../src/engine.js';

test('browser design, settings, history, local project and offline compilation/export',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/');expect((await page.request.get('/server.js')).status()).toBe(404);expect((await page.request.get('/fonts/neon_blinking/glyphs.json')).status()).toBe(200);await expect(page.locator('.object-row')).toHaveCount(5);
 await page.route('**/mcp',route=>route.abort()); // editor compilation must stay local even when MCP is unavailable
 await page.locator('#rect').click();await expect(page.locator('.object-row')).toHaveCount(6);
 await page.locator('#type').selectOption('run');await page.locator('#thread').selectOption('#d9897e');
 const shapeId=await page.locator('.object-row.selected').getAttribute('data-id'),shape=page.locator(`#shapes [data-id="${shapeId}"]`);
 await page.locator('#type').selectOption('fill');const before=await shape.getAttribute('x');await page.locator('#posX').fill('-6');await page.locator('#posX').press('Tab');
 const after=await page.locator(`#shapes [data-id="${shapeId}"]`).getAttribute('x');
 await page.locator('#undo').click();const undone=await page.locator(`#shapes [data-id="${shapeId}"]`).getAttribute('x');
 await page.locator('#redo').click();const redone=await page.locator(`#shapes [data-id="${shapeId}"]`).getAttribute('x');
 expect(after).not.toBe(before);expect(undone).toBe(before);expect(redone).toBe(after);
 const box=await shape.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+18,box.y+box.height/2+9,{steps:3});await page.mouse.up();
 const draggedX=await shape.getAttribute('x');console.log({shapeId,draggedX,redone,selected:await page.locator('#selected').textContent(),posX:await page.locator('#posX').inputValue()});expect(draggedX).not.toBe(redone);await page.locator('#undo').click();expect(await shape.getAttribute('x')).toBe(redone);await page.locator('#redo').click();expect(await shape.getAttribute('x')).toBe(draggedX);
 await page.locator('#rotation').fill('30');await page.locator('#rotation').press('Tab');
 await expect(page.locator(`#shapes [data-id="${shapeId}"]`)).toHaveAttribute('transform',/rotate\(30 /);
 await page.locator('#letter').click();await page.locator('#letteringText').fill('WELCOM');await page.locator('#letteringText').press('Tab');
 await expect(page.locator('#selected')).toContainText('WELCOM');
 {const m0=await ctm(page),empty=toScreen(m0,60,60);await page.mouse.click(empty.x,empty.y);}await page.locator('#spacing').fill('0.35');await page.locator('#spacing').press('Tab');
 await page.locator('#name').fill('Garden badge');await page.locator('#name').press('Tab');
 await page.locator('button[data-view="stitches"]').click();await expect(page.locator('#count')).toContainText('stitches');
 await page.locator('button[data-view=design]').click();await page.screenshot({path:'/tmp/welcom-browser-workspace.png'});
 const projectDownload=page.waitForEvent('download');await page.locator('#save').click();const saved=await projectDownload;const projectPath='/tmp/welcom-browser-project.welcome';await saved.saveAs(projectPath);
 const source=JSON.parse(await (await import('node:fs/promises')).readFile(projectPath,'utf8'));expect(source.schema).toBe('welcom/1');expect(source.name).toBe('Garden badge');expect(source.objects.length).toBe(7);
 const artifactId='123e4567-e89b-42d3-a456-426614174000';const linked=await page.context().newPage();await linked.route(`**/artifacts/${artifactId}.welcome`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(source)}));await linked.goto(`/?open=${artifactId}`);await expect(linked.locator('#name')).toHaveValue('Garden badge');await expect(linked.locator('.object-row')).toHaveCount(7);await expect(linked.locator('#toast')).toHaveText('Project opened locally.');await linked.close();
 await page.locator('#new').click();await expect(page.locator('.object-row')).toHaveCount(0);
 await page.locator('#file').setInputFiles({name:'bad.welcome',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...source,objects:[{...source.objects[0],kind:'triangle'}]}))});await expect(page.locator('.object-row')).toHaveCount(0);await expect(page.locator('#toast')).toContainText('unsupported kind');
 await page.locator('#file').setInputFiles({name:'reopened.welcome',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(source))});await expect(page.locator('.object-row')).toHaveCount(7);await expect(page.locator('#name')).toHaveValue('Garden badge');
 await page.locator('#rect').click();await expect(page.locator('#saved')).toHaveText('Unsaved');
 for(const format of ['jef','vp3']){const download=page.waitForEvent('download');await page.locator('#export').click();await page.locator('#format').selectOption(format);await page.locator('#download').click();const file=await download;await file.saveAs(`/tmp/welcom-browser.${format}`);expect(file.suggestedFilename()).toContain(`.${format}`);await expect(page.locator('#saved')).toHaveText('Unsaved');}
 expect(errors).toEqual([]);
});

test('bundled embroidery font and bounded SVG import are editable',async({page})=>{await page.goto('/');await page.locator('#new').click();await page.locator('#letter').click();await page.locator('#font').selectOption('neon-blinking/1');await page.locator('#letteringText').fill('WELCOM 123!');await page.locator('#letteringText').press('Tab');await expect(page.locator('#font')).toHaveValue('neon-blinking/1');await expect(page.locator('#letteringHeight')).toHaveAttribute('min','20');await page.locator('#count').click();await expect(page.locator('#count')).toContainText('stitches');await page.locator('#file').setInputFiles({name:'badge.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="40" height="30" fill="#527461"/><ellipse cx="70" cy="80" rx="5" ry="4" fill="#89a377"/><path d="M20 70 C30 50 40 90 80 60" stroke="#d9897e" fill="none"/></svg>')});await expect(page.locator('.object-row')).toHaveCount(3);await page.locator('.object-row').filter({hasText:'Imported path'}).click();await expect(page.locator('.path-node')).toHaveCount(0);await page.keyboard.press('Enter');await expect(page.locator('.path-node').first()).toBeAttached();const node=page.locator('.path-node').last(),nodeBefore=await node.getAttribute('cx'),nodeBox=await node.boundingBox();await page.mouse.move(nodeBox.x+nodeBox.width/2,nodeBox.y+nodeBox.height/2);await page.mouse.down();await page.mouse.move(nodeBox.x+nodeBox.width/2+18,nodeBox.y+nodeBox.height/2+5,{steps:3});await page.mouse.up();const nodeAfter=await page.locator('.path-node').last().getAttribute('cx');expect(nodeAfter).not.toBe(nodeBefore);await page.locator('#undo').click();await expect(page.locator('.path-node').last()).toHaveAttribute('cx',nodeBefore);await page.locator('#redo').click();await expect(page.locator('.path-node').last()).toHaveAttribute('cx',nodeAfter);await page.locator('.object-row').filter({hasText:'Imported ellipse'}).click();await expect(page.locator('#posX')).toHaveValue('16.5');await page.locator('#file').setInputFiles({name:'unsafe.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g transform="translate(10 5)"><rect x="0" y="0" width="20" height="20"/></g></svg>')});await expect(page.locator('.object-row')).toHaveCount(3);await expect(page.locator('#toast')).toContainText('attribute transform is unsupported');});


test('stitch simulation is visible, scrubbable, replayable, and stops on edits',async({page})=>{
 await page.goto('/');await expect(page.locator('#play')).toBeHidden();await expect(page.locator('#seek')).toBeHidden();await page.locator('button[data-view="stitches"]').click();await expect(page.locator('#play')).toBeVisible();await page.locator('#play').click();await expect(page.locator('button[data-view="stitches"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#play')).toHaveAccessibleName('Pause stitch simulation');await expect(page.locator('#play')).toHaveClass(/playing/);
 await expect(page.locator('#stitches path')).not.toHaveCount(0,{timeout:5000});await expect(page.locator('#needleMarker')).toBeVisible();await expect(page.locator('#playbackProgress')).toContainText('/');await expect(page.locator('#needlePosition')).toContainText('Needle');
 await page.locator('#play').click();await expect(page.locator('#play')).toHaveAccessibleName('Play stitch simulation');const paused=await page.locator('#playbackProgress').textContent();await page.waitForTimeout(150);expect(await page.locator('#playbackProgress').textContent()).toBe(paused);
 await page.locator('#seek').evaluate(el=>{el.value='60';el.dispatchEvent(new Event('input',{bubbles:true}));});await expect(page.locator('#seek')).toHaveValue('60');await expect(page.locator('#needleMarker')).toBeVisible();await expect(page.locator('#needlePosition')).toContainText('Needle');
 await page.locator('#resetPlayback').click();await expect(page.locator('#seek')).toHaveValue('0');await expect(page.locator('#playbackProgress')).toContainText('0 /');await expect(page.locator('#needleMarker')).toHaveCount(0);
 const maximum=await page.locator('#seek').getAttribute('max');await page.locator('#seek').evaluate((el,n)=>{el.value=n;el.dispatchEvent(new Event('input',{bubbles:true}));},maximum);await expect(page.locator('#playbackProgress')).toContainText('100%');await page.locator('#play').click();await expect(page.locator('#seek')).toHaveValue('0');await expect(page.locator('#play')).toHaveAccessibleName('Pause stitch simulation');
 await page.locator('#rect').click();await expect(page.locator('#play')).not.toHaveClass(/playing/);await expect(page.locator('#play')).toHaveAccessibleName('Compile and play stitch simulation');await expect(page.locator('#playbackProgress')).toHaveText('Ready to simulate');await expect(page.locator('#stitches')).toBeEmpty();await page.waitForTimeout(150);await expect(page.locator('#playbackProgress')).toHaveText('Ready to simulate');
});

test('pinned JEF import renders a stitch layer, saves source commands, transforms with history, and preserves failures',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const fixture=pinnedMachineFixture('jef'),bytes=Buffer.from(fixture.bytes);await page.goto('/');page.on('dialog',dialog=>dialog.accept());await page.locator('#new').click();await expect(page.locator('.object-row')).toHaveCount(0);await page.locator('#importMachine').click();await page.locator('#machineFile').setInputFiles({name:'sample.jef',mimeType:'application/octet-stream',buffer:bytes});
 await expect(page.locator('.object-row')).toHaveCount(1);const layer=page.locator('.object-row').last();await expect(layer).toContainText('machine stitches');await expect(page.locator('#sourceInfo')).toContainText('201 commands');const id=await layer.getAttribute('data-id');
 const unchanged=page.waitForEvent('download');await page.locator('#export').click();await page.locator('#format').selectOption('jef');await page.locator('#download').click();const originalExport=await unchanged;const originalPath='/tmp/welcom-import-original.jef';await originalExport.saveAs(originalPath);expect(Buffer.compare(await (await import('node:fs/promises')).readFile(originalPath),bytes)).toBe(0);
 const x=Number(await page.locator('#posX').inputValue());await page.locator('#posX').fill(String(x+2));await page.locator('#posX').press('Tab');await page.locator('#rotation').fill('2');await page.locator('#rotation').press('Tab');await page.locator('#thread').selectOption('#d9897e');await expect(page.locator('#saved')).toHaveText('Unsaved');
 await page.locator('#undo').click();await page.locator('#redo').click();await expect(page.locator('.object-row').last()).toHaveAttribute('data-id',id);const saved=page.waitForEvent('download');await page.locator('#save').click();const projectFile=await saved,projectPath='/tmp/welcom-import-project.welcome';await projectFile.saveAs(projectPath);const fs=await import('node:fs/promises'),projectText=await fs.readFile(projectPath,'utf8'),project=JSON.parse(projectText),savedLayer=project.objects.find(o=>o.id===id);expect(savedLayer.kind).toBe('stitch_layer');expect(savedLayer.stitches).toHaveLength(201);expect(savedLayer.source.originalBytesBase64.length).toBeGreaterThan(0);await page.locator('#file').setInputFiles({name:'reopened.welcome',mimeType:'application/json',buffer:Buffer.from(projectText)});await expect(page.locator('#sourceInfo')).toContainText('201 commands');
 await page.locator('#machineFile').setInputFiles({name:'broken.jef',mimeType:'application/octet-stream',buffer:Buffer.from([1,2,3])});await expect(page.locator('.object-row')).toHaveCount(1);await expect(page.locator('#toast')).toContainText('Invalid embroidery file');expect(errors).toEqual([]);
 const changedDownload=page.waitForEvent('download');await page.locator('#export').click();await page.locator('#download').click();const changed=await changedDownload,changedPath='/tmp/welcom-import-edited.jef';await changed.saveAs(changedPath);const decoded=decodeEmbroidery(new Uint8Array(await fs.readFile(changedPath)),'jef');expect(decoded.stitches.filter(s=>s.cmd==='stitch')).toHaveLength(30);
});


test('inline icon controls are accessible and rotated stitch-layer preview matches the compile plan',async({page})=>{
 const fixture=pinnedMachineFixture('vp3'),doc=initialDocument(),layer=importStitchLayer(fixture.bytes,'vp3');doc.objects=[layer];applyOperations(doc,[{op:'transform',id:layer.id,rotation:17}]);const firstNeedle=compile(doc).stitches.find(s=>s.cmd==='stitch');
 await page.goto('/');page.on('dialog',dialog=>dialog.accept());await expect(page.getByRole('button',{name:'New design'})).toHaveAttribute('data-tooltip','New design');await expect(page.getByRole('button',{name:'Add ellipse'})).toHaveAttribute('title','Add ellipse');await expect(page.getByRole('button',{name:'Undo'})).toBeDisabled();
 await page.locator('#new').click();await page.locator('#machineFile').setInputFiles({name:'rotated.vp3',mimeType:'application/octet-stream',buffer:Buffer.from(fixture.bytes)});await expect(page.locator('#sourceInfo')).toContainText('VP3 stitch layer');await expect(page.locator('.object-row')).toHaveCount(1);await page.locator('#rotation').fill('17');await page.locator('#rotation').press('Tab');await expect(page.locator('#rotation')).toHaveValue('17');
 const importedId=await page.locator('.object-row').last().getAttribute('data-id'),group=page.locator(`#shapes [data-id="${importedId}"]`);expect(await group.count()).toBe(1);expect(await group.getAttribute('transform')).toBeNull();const paths=await group.locator('path').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('d'))),coordinates=paths.flatMap(d=>[...d.matchAll(/[ML](-?(?:\d+\.?\d*|\.\d+))\s+(-?(?:\d+\.?\d*|\.\d+))/g)].map(m=>[Number(m[1]),Number(m[2])]));expect(coordinates.some(([x,y])=>Math.abs(x-firstNeedle.x)<=.06&&Math.abs(y-firstNeedle.y)<=.06)).toBe(true);const saved=page.waitForEvent('download');await page.locator('#save').click();const output=await saved,path='/tmp/welcom-rotated-import.welcome';await output.saveAs(path);const project=JSON.parse(await (await import('node:fs/promises')).readFile(path,'utf8'));expect(project.objects[0].rotation).toBe(17);
});

test('browser reopens a maximum-command saved stitch project below the advertised 32 MiB project cap',async({page})=>{
 const needleCount=249999,offset=124,source=Buffer.alloc(offset+needleCount*2+4);source.writeUInt32LE(offset,0);source.writeUInt32LE(1,24);source.writeUInt32LE(needleCount,28);source.writeUInt32LE(1,116);source[offset+needleCount*2]=0x80;source[offset+needleCount*2+1]=0x10;
 const project=initialDocument();project.name='Maximum supported machine layer';project.objects=[importStitchLayer(new Uint8Array(source),'jef',{fileName:'maximum.jef'})];const savedOutput=Buffer.from(JSON.stringify(project));expect(savedOutput.length).toBeLessThan(33_554_432);await page.goto('/');await page.locator('#file').setInputFiles({name:'maximum.welcome',mimeType:'application/json',buffer:savedOutput});await expect(page.locator('.object-row')).toHaveCount(1,{timeout:15000});await expect(page.locator('#sourceInfo')).toContainText('250,000 commands');await expect(page.locator('#name')).toHaveValue('Maximum supported machine layer');
});

test('browser VP3 import round-trips supported files and names unsupported travel before export',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());const supported=pinnedMachineFixture('vp3');await page.goto('/');await page.locator('#new').click();await page.locator('#importMachine').click();await page.locator('#machineFile').setInputFiles({name:'sample.vp3',mimeType:'application/octet-stream',buffer:Buffer.from(supported.bytes)});await expect(page.locator('#sourceInfo')).toContainText('80 commands');
 const original=page.waitForEvent('download');await page.locator('#export').click();await page.locator('#format').selectOption('vp3');await page.locator('#download').click();const rawExport=await original,rawPath='/tmp/welcom-import-original.vp3';await rawExport.saveAs(rawPath);expect(Buffer.compare(await (await import('node:fs/promises')).readFile(rawPath),Buffer.from(supported.bytes))).toBe(0);
 const x=Number(await page.locator('#posX').inputValue());await page.locator('#posX').fill(String(x+1));await page.locator('#posX').press('Tab');const changed=page.waitForEvent('download');await page.locator('#export').click();await page.locator('#download').click();const changedExport=await changed,changedPath='/tmp/welcom-import-edited.vp3';await changedExport.saveAs(changedPath);expect(decodeEmbroidery(new Uint8Array(await (await import('node:fs/promises')).readFile(changedPath)),'vp3').stitches.filter(s=>s.cmd==='stitch')).toHaveLength(60);
 await page.locator('#new').click();const unsupported=[...readMachineFixtures()].find(([name])=>name.endsWith('/random1.vp3'));await page.locator('#importMachine').click();await page.locator('#machineFile').setInputFiles({name:'travel.vp3',mimeType:'application/octet-stream',buffer:Buffer.from(unsupported[1])});await expect(page.locator('#sourceInfo')).toContainText('51 commands');const moved=Number(await page.locator('#posX').inputValue());await page.locator('#posX').fill(String(moved+1));await page.locator('#posX').press('Tab');let downloaded=false;page.on('download',()=>{downloaded=true;});await page.locator('#export').click();await page.locator('#format').selectOption('vp3');await page.locator('#download').click();await expect(page.locator('#toast')).toContainText('intra-block travel, trim, or stop commands');expect(downloaded).toBe(false);expect(errors).toEqual([]);
});

test('opening a project fits the real geometry (rotated stitches, text outlines) in view; later edits never move the view',async({page})=>{
 const doc=initialDocument();doc.objects.find(o=>o.kind==='text').y=60;doc.objects.find(o=>o.kind==='text').rotation=15;
 for(let i=0;i<4;i++)applyOperations(doc,[{op:'add_shape',id:`badge-${i}`,kind:'rect',name:`Badge ${i}`,x:(i-1.5)*18,y:(i%2?12:-12),width:8,height:6,thread:'#527461'}]);
 const fixture=pinnedMachineFixture('jef'),layer=importStitchLayer(fixture.bytes,'jef');layer.x=-12;layer.y=-10;layer.rotation=29;doc.objects.push(layer);expect(doc.objects).toHaveLength(10);
 let x0=-55,y0=-55,x1=55,y1=55;for(const object of doc.objects)for(const line of geometry(object))for(const [x,y] of line){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 await page.goto('/');await page.locator('#file').setInputFiles({name:'auto-fit.welcome',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});await expect(page.locator('.object-row')).toHaveCount(10);
 const view=async()=>(await page.locator('#art').getAttribute('viewBox')).split(' ').map(Number);let [vx,vy,vw,vh]=await view();
 expect(vx).toBeLessThanOrEqual(x0);expect(vy).toBeLessThanOrEqual(y0);expect(vx+vw).toBeGreaterThanOrEqual(x1);expect(vy+vh).toBeGreaterThanOrEqual(y1);
 expect(Math.max((x1-x0)/vw,(y1-y0)/vh)).toBeGreaterThan(.55);
 // moving something far outside the hoop must not change the view
 const before=await view();await page.locator('.object-row').first().click();await page.locator('#posX').fill('300');await page.locator('#posX').press('Tab');expect(await view()).toEqual(before);
});

test('oversized imported bounds stay visible and block machine export with an explicit hoop diagnostic',async({page})=>{
 const steps=12,offset=124,source=Buffer.alloc(offset+steps*2+4);source.writeUInt32LE(offset,0);source.writeUInt32LE(1,24);source.writeUInt32LE(steps,28);source.writeUInt32LE(1,116);for(let i=0;i<steps;i++)source[offset+i*2]=127;source[offset+steps*2]=0x80;source[offset+steps*2+1]=0x10;await page.goto('/');await page.locator('#new').click();await page.locator('#machineFile').setInputFiles({name:'oversized.jef',mimeType:'application/octet-stream',buffer:source});await expect(page.locator('#stats')).toContainText('exceeds the selected 110 mm hoop');expect(await page.locator('#art').getAttribute('viewBox')).not.toBe('-60 -60 120 120');await page.locator('button[data-view="stitches"]').click();await expect(page.locator('#stitches path')).not.toHaveCount(0);let downloaded=false;page.on('download',()=>{downloaded=true;});await page.locator('#export').click();await page.locator('#format').selectOption('jef');await page.locator('#download').click();await expect(page.locator('#toast')).toContainText('exceeds the selected 110 mm hoop');expect(downloaded).toBe(false);
});

test('worker load failure reports a recoverable editor error instead of leaving requests pending',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));let downloaded=false;page.on('download',()=>{downloaded=true;});await page.route('**/src/worker.js',route=>route.fulfill({status:404,contentType:'text/javascript',body:'not found'}));await page.goto('/');await page.locator('#count').click();await expect(page.locator('#toast')).toContainText('Stitch worker failed to load or run');
 await page.locator('button[data-view="stitches"]').click();await page.locator('#play').click({timeout:3000});await expect(page.locator('#toast')).toContainText('Reload the editor and try again');await page.locator('#machineFile').setInputFiles({name:'failed.jef',mimeType:'application/octet-stream',buffer:Buffer.from(pinnedMachineFixture('jef').bytes)});await expect(page.locator('#toast')).toContainText('Reload the editor and try again');await expect(page.locator('#objects .object-row')).toHaveCount(5);
 await page.locator('#export').click();await page.locator('#format').selectOption('jef');await page.locator('#download').click();await expect(page.locator('#toast')).toContainText('Reload the editor and try again');await expect(page.locator('#objects .object-row')).toHaveCount(5);expect(downloaded).toBe(false);expect(errors).toEqual([]);
});

test('single top bar and vector editing: polygon, nodes, snap, align, distribute, border and thread preview',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.locator('#new').click().catch(()=>{});page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await expect(page.locator('nav')).toHaveCount(0);await expect(page.locator('header.top button[data-view="preview"]')).toBeVisible();await expect(page.locator('header.top #undo')).toBeVisible();
 const m=await page.evaluate(()=>{const m=document.querySelector('#art').getScreenCTM();return {a:m.a,d:m.d,e:m.e,f:m.f};}),at=(mx,my)=>({x:m.a*mx+m.e,y:m.d*my+m.f});
 await page.locator('#snap').click();await expect(page.locator('#snap')).toHaveClass(/active-tool/);
 await page.locator('#path').click();for(const [x,y] of [[-20,-20],[20.4,-20.3],[0,20]]){const p=at(x,y);await page.mouse.click(p.x,p.y);}const first=at(-20,-20);await page.mouse.click(first.x,first.y);
 await expect(page.locator('.object-row')).toHaveCount(1);await expect(page.locator('#pathClosed')).toBeChecked();await expect(page.locator('#type')).toHaveValue('fill');
 const polyPoints=await page.locator('#shapes polyline.shape').getAttribute('points');expect(polyPoints.split(' ').length).toBe(4);expect(polyPoints).toContain('20,-20');
 await page.locator('#border').check();await page.locator('#pathSmooth').check();expect((await page.locator('#shapes polyline.shape').getAttribute('points')).split(' ').length).toBeGreaterThan(20);
 await page.locator('#pathSmooth').uncheck();
 const mid=at(0,-20);await page.mouse.dblclick(mid.x,mid.y);
 await expect(page.locator('.path-node')).toHaveCount(4);await page.locator('#nodeDel').click();await expect(page.locator('.path-node')).toHaveCount(3);
 await page.locator('#rect').click();await page.locator('#rect').click();await page.locator('#rect').click();await expect(page.locator('.object-row')).toHaveCount(4);
 const rows=page.locator('.object-row');await rows.nth(1).click();await rows.nth(2).click({modifiers:['Shift']});await rows.nth(3).click({modifiers:['Shift']});
 await page.locator('#posX').fill('-30');await page.locator('#posX').press('Tab');
 await page.locator('[data-align="left"]').click();const xs=await page.locator('#shapes rect.shape').evaluateAll(els=>els.map(e=>e.getAttribute('x')));expect(new Set(xs).size).toBe(1);
 await expect(page.locator('[data-distribute="horizontal"]')).toBeEnabled();
 await page.locator('button[data-view="preview"]').click();await expect.poll(()=>page.evaluate(()=>Boolean(document.querySelector('#preview3d:not([hidden])[data-instances]')||document.querySelector('#stitches .thread-body')&&document.querySelector('#stitches .thread-sheen'))),{timeout:8000}).toBe(true);
 await page.screenshot({path:'/tmp/welcom-vector-editing.png'});expect(errors).toEqual([]);
});

test('Bézier handles: smooth node shows draggable handles that reshape the curve, corner removes them',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 const m=await page.evaluate(()=>{const m=document.querySelector('#art').getScreenCTM();return {a:m.a,d:m.d,e:m.e,f:m.f};}),at=(x,y)=>({x:m.a*x+m.e,y:m.d*y+m.f});
 await page.locator('#path').click();for(const [x,y] of [[-20,0],[0,0],[20,0]]){const p=at(x,y);await page.mouse.click(p.x,p.y);}await page.keyboard.press('Enter');
 await expect(page.locator('.object-row')).toHaveCount(1);const poly=page.locator('#shapes polyline.shape'),before=await poly.getAttribute('points');
 await page.locator('.path-node').nth(1).click({force:true});await expect(page.locator('#nodeSmooth')).toBeEnabled();await page.locator('#nodeSmooth').click();
 await expect(page.locator('.path-handle')).toHaveCount(2);const h=page.locator('.path-handle').nth(1),hb=await h.boundingBox(),from={x:hb.x+hb.width/2,y:hb.y+hb.height/2};
 await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(from.x+10,from.y-40,{steps:4});await page.mouse.up();
 const after=await poly.getAttribute('points');expect(after).not.toBe(before);expect(after.split(' ').length).toBeGreaterThan(8);
 await page.locator('#undo').click();await expect(page.locator('#nodeCorner')).toBeEnabled();await page.locator('#nodeCorner').click();await expect(page.locator('.path-handle')).toHaveCount(0);expect(errors).toEqual([]);
});

test('grouping selects and drags members together; ungroup releases them',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#rect').click();await page.locator('#ellipse').click();await page.locator('#rect').click();const rows=page.locator('.object-row');await expect(rows).toHaveCount(3);
 await rows.nth(0).click();await rows.nth(1).click({modifiers:['Shift']});await page.locator('#group').click();
 await rows.nth(2).click();await rows.nth(0).click();await expect(page.locator('.object-row.selected')).toHaveCount(2);
 await page.keyboard.press('Control+Shift+G');await rows.nth(2).click();await rows.nth(0).click();await expect(page.locator('.object-row.selected')).toHaveCount(1);expect(errors).toEqual([]);
});

test('sidebar tools: select, line, polygon, star and pen with curve handles, plus shortcuts',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 const m=await page.evaluate(()=>{const m=document.querySelector('#art').getScreenCTM();return {a:m.a,d:m.d,e:m.e,f:m.f};}),at=(x,y)=>({x:m.a*x+m.e,y:m.d*y+m.f});
 for(const id of ['select','line','polygon','star','pen','rect','ellipse','path','letter'])await expect(page.locator('#'+id)).toBeVisible();await expect(page.locator('#select')).toHaveClass(/active-tool/);
 await page.locator('#line').click();await expect(page.locator('#line')).toHaveClass(/active-tool/);let a=at(-30,-30),b=at(30,-10);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:4});await page.mouse.up();
 await expect(page.locator('.object-row')).toHaveCount(1);await expect(page.locator('.object-row').first()).toContainText('Line');await expect(page.locator('#select')).toHaveClass(/active-tool/);
 await page.locator('#polygon').click();await page.locator('#sides').fill('6');await page.locator('#sides').evaluate(e=>e.blur());a=at(-20,20);b=at(-8,20);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:3});await page.mouse.up();
 await expect(page.locator('.object-row').last()).toContainText('Polygon 6');expect((await page.locator('#shapes polyline.shape').last().getAttribute('points')).split(' ').length).toBe(7);
 await page.keyboard.press('s');await expect(page.locator('#star')).toHaveClass(/active-tool/);a=at(20,20);b=at(32,20);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:3});await page.mouse.up();
 await expect(page.locator('.object-row').last()).toContainText('Star 6');expect((await page.locator('#shapes polyline.shape').last().getAttribute('points')).split(' ').length).toBe(13);
 await page.keyboard.press('p');await expect(page.locator('#pen')).toHaveClass(/active-tool/);a=at(-25,40);const c=at(0,40),d=at(25,40);
 await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.up();await page.mouse.move(c.x,c.y);await page.mouse.down();await page.mouse.move(c.x+25,c.y-30,{steps:4});await page.mouse.up();await page.mouse.click(d.x,d.y);await page.keyboard.press('Enter');
 await expect(page.locator('.object-row').last()).toContainText('Drawn path');const pen=await page.locator('#shapes polyline.shape').last().getAttribute('points');expect(pen.split(' ').length).toBeGreaterThan(10);
 await page.keyboard.press('l');await page.keyboard.press('Escape');await expect(page.locator('#select')).toHaveClass(/active-tool/);expect(errors).toEqual([]);
});

test('hoop is editable: custom size resizes the canvas, flags overflow, keeps undo, and exports within JEF limits',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await expect(page.locator('#hoopW')).toHaveValue('110');await expect(page.locator('#hoopH')).toHaveValue('110');
 await page.locator('#rect').click();await page.locator('#hoopW').fill('80');await page.locator('#hoopW').press('Tab');await page.locator('#hoopH').fill('60');await page.locator('#hoopH').press('Tab');
 await expect(page.locator('#hoopRing')).toHaveAttribute('width','80');await expect(page.locator('#hoopRing')).toHaveAttribute('height','60');
 await page.locator('#hoopW').fill('50');await page.locator('#hoopW').press('Tab');await page.locator('#hoopH').fill('50');await page.locator('#hoopH').press('Tab');await expect(page.locator('#hoopW')).toHaveValue('50');await page.locator('#posX').fill('40');await page.locator('#posX').press('Tab');
 await page.locator('button[data-view="stitches"]').click();await expect(page.locator('#count')).toContainText('exceeds the selected 50 mm hoop');
 await page.locator('#undo').click();await page.locator('#undo').click();await page.locator('#undo').click();await expect(page.locator('#hoopW')).toHaveValue('80');
 await page.locator('#hoopW').fill('140');await page.locator('#hoopW').press('Tab');await page.locator('#hoopH').fill('200');await page.locator('#hoopH').press('Tab');const download=page.waitForEvent('download');await page.locator('#export').click();await page.locator('#format').selectOption('vp3');await page.locator('#download').click();await download;
 await page.locator('#hoopW').fill('5');await page.locator('#hoopW').press('Tab');await expect(page.locator('#toast')).toContainText('between 10 and 400');expect(errors).toEqual([]);
});

test('the last hoop size is remembered for new documents and reloads',async({page})=>{
 await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#hoopW').fill('90');await page.locator('#hoopW').press('Tab');await page.locator('#hoopH').fill('70');await page.locator('#hoopH').press('Tab');
 await page.locator('#new').click();await expect(page.locator('#hoopW')).toHaveValue('90');await page.reload();await expect(page.locator('#hoopW')).toHaveValue('90');await expect(page.locator('#hoopH')).toHaveValue('70');
});

test('agent relay: the Agent dialog creates a private link and an MCP client edits the open document live; revoke locks it out',async({page})=>{
 const {spawn}=await import('node:child_process'),{Client}=await import('@modelcontextprotocol/sdk/client/index.js'),{StreamableHTTPClientTransport}=await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
 const port=18794,origin=`http://127.0.0.1:${port}`,child=spawn(process.execPath,['server.js'],{env:{...process.env,HOST:'127.0.0.1',PORT:String(port),WELCOME_SESSION_FILE:''},stdio:'ignore'});
 try{
  for(let i=0;i<100;i++){try{if((await fetch(origin+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
  await page.locator('#copyEndpoint').click();await expect(page.locator('#agentDialog')).toBeVisible();await expect(page.locator('#agentUrl')).toHaveValue(/\/mcp\/[A-Za-z0-9_-]{32,}$/);await expect(page.locator('#agentStatus')).toContainText('Waiting for an agent');
  const link=await page.locator('#agentUrl').inputValue();await page.locator('#agentDialog button:not([type=button])').click();await expect(page.locator('#copyEndpoint')).toHaveClass(/agent-on/);
  const client=new Client({name:'e2e-agent',version:'1'});await client.connect(new StreamableHTTPClientTransport(new URL(link)));
  const call=(name,args)=>client.callTool({name,arguments:args});const inspect=await call('document_inspect',{documentId:'live'});expect(inspect.structuredContent.objects).toHaveLength(0);
  const applied=await call('document_apply',{documentId:'live',expectedRevision:inspect.structuredContent.revision,operations:[{op:'add_shape',id:'agent-rect',kind:'rect',x:-15,y:-10,width:30,height:20,thread:'#d9897e'},{op:'add_text',id:'agent-text',text:'HI',x:-8,y:14,height:8}]});expect(applied.isError).toBeFalsy();
  await expect(page.locator('.object-row')).toHaveCount(2);await expect(page.locator('#shapes [data-id="agent-rect"]')).toBeAttached();await expect(page.locator('#saved')).toHaveText('Unsaved');
  await page.locator('#undo').click();await expect(page.locator('.object-row')).toHaveCount(0);const stale=await call('document_apply',{documentId:'live',expectedRevision:applied.structuredContent.revision,operations:[{op:'delete',id:'agent-rect'}]});expect(stale.isError).toBe(true);
  const plan=await call('embroidery_compile',{documentId:'live',expectedRevision:(await call('document_inspect',{documentId:'live'})).structuredContent.revision});expect(plan.isError).toBe(true);
  await expect(page.locator('#copyEndpoint')).toHaveClass(/agent-active/);
  {const bytes=Buffer.from(pinnedMachineFixture('jef').bytes),rev=(await call('document_inspect',{documentId:'live'})).structuredContent.revision,imported=await call('document_import_embroidery',{documentId:'live',expectedRevision:rev,fileName:'agent.jef',format:'jef',dataBase64:bytes.toString('base64')});expect(imported.isError).toBeFalsy();await expect(page.locator('.object-row').last()).toContainText('machine stitches');await expect(page.locator('#sourceInfo')).toContainText('201 commands');}
  await page.locator('#copyEndpoint').click();await page.locator('#agentRevoke').click();await expect(page.locator('#agentUrl')).not.toHaveValue(link);await expect(page.locator('#agentUrl')).toHaveValue(/\/mcp\/[A-Za-z0-9_-]{32,}$/);
  const dead=await fetch(link,{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})});expect(dead.status).toBe(401);
  expect(errors).toEqual([]);await client.close().catch(()=>{});
 }finally{child.kill('SIGTERM');}
});

test('satin column: path stitch type, width control, thick design stroke and compiled zigzag',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#line').click();const m=await page.evaluate(()=>{const m=document.querySelector('#art').getScreenCTM();return {a:m.a,d:m.d,e:m.e,f:m.f};}),at=(x,y)=>({x:m.a*x+m.e,y:m.d*y+m.f}),a=at(-25,0),b=at(25,0);
 await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:4});await page.mouse.up();
 await expect(page.locator('#satinRow')).toBeHidden();await page.locator('#type').selectOption('satin');await expect(page.locator('#satinRow')).toBeVisible();await page.locator('#satinWidth').fill('6');await page.locator('#satinWidth').press('Tab');
 expect(await page.locator('#shapes polyline.shape').evaluate(el=>getComputedStyle(el).strokeWidth)).toBe('6px');
 await page.locator('button[data-view="stitches"]').click();await expect(page.locator('#count')).toContainText('stitches');const count=Number((await page.locator('#count').textContent()).replace(/,/g,'').match(/(\d+) stitches/)[1]);expect(count).toBeGreaterThan(90);
 await page.locator('#rect').click();expect(await page.locator('#type option[value=satin]').evaluate(o=>o.disabled)).toBe(true);expect(errors).toEqual([]);
});

test('subtract makes a hole (even-odd render, fewer stitches) and ties add lock stitches',async({page})=>{
 const n=async()=>Number(((await page.locator('#count').textContent())||'').replace(/,/g,'').match(/(\d+) stitches/)?.[1]||0);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#rect').click();await page.locator('#posX').fill('-20');await page.locator('#posX').press('Tab');await page.locator('#posY').fill('-20');await page.locator('#posY').press('Tab');await page.locator('#sizeW').fill('40');await page.locator('#sizeW').press('Tab');await page.locator('#sizeH').fill('40');await page.locator('#sizeH').press('Tab');
 await page.locator('#ellipse').click();await page.locator('#posX').fill('-8');await page.locator('#posX').press('Tab');await page.locator('#posY').fill('-8');await page.locator('#posY').press('Tab');await page.locator('#sizeW').fill('16');await page.locator('#sizeW').press('Tab');await page.locator('#sizeH').fill('16');await page.locator('#sizeH').press('Tab');
 await expect(page.locator('#subtract')).toBeDisabled();await page.locator('.object-row').first().click();await page.locator('.object-row').last().click({modifiers:['Shift']});await expect(page.locator('#subtract')).toBeEnabled();
 await page.locator('button[data-view="stitches"]').click();await expect.poll(n).toBeGreaterThan(0);const before=await n();
 await page.locator('#subtract').click();await expect(page.locator('.object-row')).toHaveCount(1);await expect(page.locator('#shapes path.shape')).toHaveAttribute('fill-rule','evenodd');
 await page.locator('button[data-view="stitches"]').click();await page.locator('#count').click();await expect.poll(async()=>{const v=await n();return v>0&&v<before;}).toBe(true);const holed=await n();
 await page.locator('#secDoc summary').click();await page.locator('#ties').check();await page.locator('#count').click();await expect.poll(async()=>(await n())>holed).toBe(true);expect(errors).toEqual([]);
});

test('WebGL thread preview renders stitches, orbits, zooms and resets; fabric shows in preview only',async({page})=>{
 await page.goto('/');const webgl=await page.evaluate(()=>Boolean(document.createElement('canvas').getContext('webgl2')));test.skip(!webgl,'WebGL2 is not available in this browser');
 await expect(page.locator('#preview3d')).toBeHidden();await page.locator('button[data-view="preview"]').click();const canvas=page.locator('#preview3d');await expect(canvas).toBeVisible();await expect(canvas).toHaveAttribute('data-instances',/^[1-9]\d+$/,{timeout:8000});
 const box=await canvas.boundingBox();expect(box.width).toBeGreaterThan(300);
 const dark=await page.evaluate(()=>{const c=document.querySelector('#preview3d'),t=document.createElement('canvas');t.width=c.width;t.height=c.height;const x=t.getContext('2d');x.drawImage(c,0,0);const d=x.getImageData(0,0,t.width,t.height).data;const set=new Set();for(let i=0;i<d.length;i+=4*97)set.add(`${d[i]>>5}${d[i+1]>>5}${d[i+2]>>5}`);return set.size;});expect(dark).toBeGreaterThan(6);
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+80,box.y+box.height/2+30,{steps:5});await page.mouse.up();
 await expect(canvas).not.toHaveAttribute('data-yaw','0.000');await page.mouse.wheel(0,-300);await expect.poll(async()=>Number(await canvas.getAttribute('data-zoom'))).toBeGreaterThan(1);await canvas.dblclick();await expect(canvas).toHaveAttribute('data-yaw','0.000');await expect(canvas).toHaveAttribute('data-zoom','1.000');
 await page.locator('button[data-view="design"]').click();await expect(canvas).toBeHidden();await expect(page.locator('#art')).toBeVisible();
});

test('union merges overlapping shapes; lettering can be put on a path and detached',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#rect').click();await page.locator('#ellipse').click();await page.locator('#posX').fill('-4');await page.locator('#posX').press('Tab');
 await page.locator('.object-row').first().click();await page.locator('.object-row').last().click({modifiers:['Shift']});await expect(page.locator('#union')).toBeEnabled();await expect(page.locator('#intersect')).toBeEnabled();
 await page.locator('#union').click();await expect(page.locator('.object-row')).toHaveCount(1);await expect(page.locator('#shapes path.shape, #shapes polyline.shape')).toHaveCount(1);
 await page.locator('#new').click();
 await page.locator('#line').click();const m=await page.evaluate(()=>{const m=document.querySelector('#art').getScreenCTM();return {a:m.a,d:m.d,e:m.e,f:m.f};}),at=(x,y)=>({x:m.a*x+m.e,y:m.d*y+m.f}),a=at(-30,10),b=at(30,-10);
 await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:4});await page.mouse.up();
 await page.locator('#letter').click();await expect(page.locator('#textOnPath')).toBeDisabled();
 await page.locator('.object-row').first().click();await page.locator('.object-row').last().click({modifiers:['Shift']});await expect(page.locator('#textOnPath')).toBeEnabled();
 const before=await page.locator('#shapes g.shape polyline').first().getAttribute('points');await page.locator('#textOnPath').click();await expect(page.locator('#alongRow')).toBeVisible();
 const after=await page.locator('#shapes g.shape polyline').first().getAttribute('points');expect(after).not.toBe(before);
 await page.locator('#alongOffset').fill('8');await page.locator('#alongOffset').press('Tab');expect(await page.locator('#shapes g.shape polyline').first().getAttribute('points')).not.toBe(after);
 await page.locator('#textOffPath').click();await expect(page.locator('#alongRow')).toBeHidden();expect(await page.locator('#shapes g.shape polyline').first().getAttribute('points')).toBe(before);expect(errors).toEqual([]);
});

test('DST can be exported from the dialog',async({page})=>{
 await page.goto('/');const download=page.waitForEvent('download');await page.locator('#export').click();await page.locator('#format').selectOption('dst');await page.locator('#download').click();const file=await download;expect(file.suggestedFilename()).toMatch(/\.dst$/);
 const path=await file.path(),bytes=await (await import('node:fs/promises')).readFile(path);expect(bytes.subarray(0,3).toString()).toBe('LA:');expect(bytes[bytes.length-3+2]).toBe(0xF3);
});

test('Inkscape-style tools: offset, array, sewing order, per-object fill, SVG export and node snapping',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 const stitches=async()=>Number(((await page.locator('#count').textContent())||'').replace(/,/g,'').match(/(\d+) stitches/)?.[1]||0);
 await page.locator('#rect').click();const rowId=await page.locator('.object-row.selected').getAttribute('data-id');
 await openFolds(page);await page.locator('#offsetMm').fill('3');await page.locator('#offsetBtn').click();await expect(page.locator('#sizeW')).toHaveValue('30.0');await expect(page.locator('#sizeH')).toHaveValue('22.0');
 await page.locator('#arrMode').selectOption('linear');await page.locator('#arrCount').fill('3');await page.locator('#arrA').fill('0');await page.locator('#arrB').fill('30');await page.locator('#arrBtn').click();await expect(page.locator('.object-row')).toHaveCount(3);
 await page.locator('#arrMode').selectOption('radial');await expect(page.locator('#arrAngleRow')).toBeVisible();await page.locator('#arrMode').selectOption('along');await expect(page.locator('#arrALabel')).toBeHidden();
 await page.locator('.object-row').first().click();await page.locator('#thread').selectOption('#d9897e');await page.locator('.object-row').nth(1).click();await page.locator('#thread').selectOption('#527461');await page.locator('.object-row').nth(2).click();await page.locator('#thread').selectOption('#d9897e');
 await page.locator('#ordSort').click();const colors=await page.locator('.object-row .swatch').evaluateAll(els=>els.map(e=>e.style.background));expect(colors[0]).toBe(colors[1]);expect(colors[1]).not.toBe(colors[2]);
 await page.locator('.object-row').first().click();await page.locator('#ordFront').click();await expect(page.locator('.object-row').last()).toHaveClass(/selected/);
 await page.locator('.object-row').first().click();await page.locator('#spacing').fill('0.25');await page.locator('#spacing').press('Tab');await expect(page.locator('#fillReset')).toBeVisible();await page.locator('#fillResetBtn').click();await expect(page.locator('#fillReset')).toBeHidden();
 await page.locator('#selectSame').click();expect(await page.locator('.object-row.selected').count()).toBeGreaterThanOrEqual(1);
 await page.keyboard.press('Control+a');await expect(page.locator('.object-row.selected')).toHaveCount(3);
 const download=page.waitForEvent('download');await page.locator('#export').click();await page.locator('#format').selectOption('svg');await page.locator('#download').click();const file=await download;expect(file.suggestedFilename()).toMatch(/\.svg$/);const svg=await (await import('node:fs/promises')).readFile(await file.path(),'utf8');expect(svg).toMatch(/<svg [^>]*viewBox="-55 -55 110 110"/);expect((svg.match(/<path /g)||[]).length).toBe(3);
 await page.locator('#new').click();await page.locator('#snap').click();await page.locator('#line').click();
 const m=await page.evaluate(()=>{const m=document.querySelector('#art').getScreenCTM();return {a:m.a,d:m.d,e:m.e,f:m.f};}),at=(x,y)=>({x:m.a*x+m.e,y:m.d*y+m.f});
 const a=at(-20,0),b=at(20,0);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:3});await page.mouse.up();
 await page.locator('#line').click();const c=at(20.9,0.8),d=at(30,25);await page.mouse.move(c.x,c.y);await page.mouse.down();await page.mouse.move(d.x,d.y,{steps:3});await page.mouse.up();
 const second=await page.locator('#shapes polyline.shape').last().getAttribute('points');expect(second.startsWith('20,0')).toBe(true);expect(errors).toEqual([]);
});

test('font picker: searchable list with live previews, categories, keyboard, text options and fonts loaded from a file',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#letter').click();await page.locator('#letteringText').fill('Fox 123');await page.locator('#letteringText').press('Tab');
 await page.locator('#fontButton').click();await expect(page.locator('#fontPanel')).toBeVisible();await expect(page.locator('.font-row').first()).toBeVisible();expect(await page.locator('.font-row').count()).toBeGreaterThan(150);
 await expect(page.locator('.font-row svg path').first()).toBeAttached({timeout:8000});
 await page.locator('#fontSearch').fill('lato');expect(await page.locator('.font-row').count()).toBeGreaterThanOrEqual(2);expect(await page.locator('.font-row').count()).toBeLessThan(8);
 await expect(page.locator('.font-row').first().locator('svg path').first()).toBeAttached({timeout:8000});
 await page.locator('#fontSearch').fill('');await page.locator('#fontChips [data-cat=satin]').click();const satinCount=await page.locator('.font-row').count();expect(satinCount).toBeGreaterThan(20);await page.locator('#fontChips [data-cat=tt]').click();const ttCount=await page.locator('.font-row').count();expect(ttCount).toBe(78);
 await page.locator('#fontSearch').fill('pacifico');await page.locator('#fontSearch').press('Enter');await expect(page.locator('#fontPanel')).toBeHidden();await expect(page.locator('#font')).toHaveValue('ttf/pacifico');await expect(page.locator('#fontButtonName')).toHaveText('Pacifico');
 await expect(page.locator('#shapes g.shape path[fill-rule="evenodd"]').first()).toBeAttached({timeout:8000});await expect(page.locator('#textStitchRow')).toBeVisible();
 const width=async()=>Number(await page.locator('#sizeW').inputValue());const w0=await width();
 await page.locator('#tracking').fill('4');await page.locator('#tracking').press('Tab');await expect.poll(width).toBeGreaterThan(w0+20);
 await page.locator('#textItalic').click();await expect(page.locator('#textItalic')).toHaveAttribute('aria-pressed','true');await page.locator('#textBold').click();await expect(page.locator('#textBold')).toHaveAttribute('aria-pressed','true');
 const bh=async()=>(await page.locator('#shapes g.shape').first().boundingBox()).height,h0=await bh();await page.locator('#letteringText').fill('Fox\nJump');await page.locator('#letteringText').press('Tab');await expect.poll(bh).toBeGreaterThan(h0*1.5);
 await page.locator('#alignCenter').click();await expect(page.locator('#alignCenter')).toHaveAttribute('aria-pressed','true');await page.locator('#lineHeight').fill('1.4');await page.locator('#lineHeight').press('Tab');
 await page.locator('button[data-view="stitches"]').click();await expect.poll(async()=>Number(((await page.locator('#count').textContent())||'').replace(/,/g,'').match(/(\d+) stitches/)?.[1]||0),{timeout:15000}).toBeGreaterThan(300);
 await page.locator('#textStitch').selectOption('run');await expect(page.locator('#textStitch')).toHaveValue('run');
 // a Ink/Stitch satin font, switched through the picker with the keyboard
 await page.locator('#fontButton').click();await page.locator('#fontSearch').fill('emilio');await page.locator('#fontSearch').press('ArrowDown');await page.locator('#fontSearch').press('ArrowUp');await page.locator('#fontSearch').press('Enter');await expect(page.locator('#font')).toHaveValue(/inkstitch\/emilio_20/);
 await expect.poll(async()=>await page.locator('#letteringHeight').getAttribute('max')).toBe('67.9');
 // saved projects keep the font and reopen it
 const saved=page.waitForEvent('download');await page.locator('#save').click();const file=await saved,fs=await import('node:fs/promises'),project=JSON.parse(await fs.readFile(await file.path(),'utf8'));expect(project.objects.at(-1).font).toBe('inkstitch/emilio_20');expect(project.objects.at(-1).align).toBe('center');
 // a font from a local file travels inside the project
 await page.locator('#fontButton').click();await page.locator('#fontFile').setInputFiles('test/fixtures/BebasNeue-Regular.ttf');await expect(page.locator('#toast')).toContainText('Loaded');await expect(page.locator('#font')).toHaveValue(/custom\/BebasNeue-Regular/);
 await expect(page.locator('#fontButtonName')).toHaveText('BebasNeue-Regular');const saved2=page.waitForEvent('download');await page.locator('#save').click();const project2=JSON.parse(await fs.readFile(await (await saved2).path(),'utf8'));expect(Object.keys(project2.customFonts)).toHaveLength(1);expect(project2.objects.at(-1).font).toMatch(/^custom\//);
 await page.locator('#new').click();await page.locator('#file').setInputFiles({name:'font.welcome',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project2))});await expect(page.locator('.object-row')).toHaveCount(1);await expect(page.locator('#shapes g.shape path').first()).toBeAttached({timeout:8000});expect(errors).toEqual([]);
});

const openFolds=page=>page.evaluate(()=>document.querySelectorAll('details.sec-fold').forEach(d=>{d.open=true;}));
const ctm=async page=>page.evaluate(()=>{const m=document.querySelector('#art').getScreenCTM();return {a:m.a,d:m.d,e:m.e,f:m.f};});
const toScreen=(m,x,y)=>({x:m.a*x+m.e,y:m.d*y+m.f});
const viewBox=async page=>(await page.locator('#art').getAttribute('viewBox')).split(' ').map(Number);

test('viewport: wheel zooms at the cursor, space-drag and middle-drag pan, fit buttons, and edits never move the view',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 const v0=await viewBox(page);expect(v0[2]/v0[3]).toBeGreaterThan(1.1);const box=await page.locator('.canvas').boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2;
 await page.mouse.move(cx,cy);await page.mouse.wheel(0,-300);await expect.poll(async()=>(await viewBox(page))[2]).toBeLessThan(v0[2]*.8);const v1=await viewBox(page);await expect(page.locator('#zoomPct')).not.toHaveText('100%');
 await page.locator('#zoomOut').click();await page.locator('#zoomOut').click();expect((await viewBox(page))[2]).toBeGreaterThan(v1[2]);
 await page.keyboard.down('Space');await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+120,cy+60,{steps:4});await page.mouse.up();await page.keyboard.up('Space');const v2=await viewBox(page);expect(v2[0]).toBeLessThan(v1[0]-5);
 await page.mouse.move(cx,cy);await page.mouse.down({button:'middle'});await page.mouse.move(cx-100,cy,{steps:3});await page.mouse.up({button:'middle'});expect((await viewBox(page))[0]).toBeGreaterThan(v2[0]+5);
 await page.locator('#zoomFit').click();const fit=await viewBox(page);expect(Math.abs((fit[0]+fit[2]/2))).toBeLessThan(3);expect(fit[2]).toBeGreaterThan(110);
 await page.locator('#rect').click();await page.locator('#posX').fill('500');await page.locator('#posX').press('Tab');expect(await viewBox(page)).toEqual(fit);
 await page.locator('#zoomAll').click();expect((await viewBox(page))[2]).toBeGreaterThan(fit[2]*2);await page.keyboard.press('Shift+Digit0');await expect(page.locator('#zoomPct')).toHaveText('100%');expect(errors).toEqual([]);
});

test('selection handles: resize with corner and edge handles, proportional resize, rotate, move, marquee select, nudge',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#rect').click();await expect(page.locator('.sel-handle')).toHaveCount(9);const dim=async()=>({w:Number(await page.locator('#sizeW').inputValue()),h:Number(await page.locator('#sizeH').inputValue()),x:Number(await page.locator('#posX').inputValue()),y:Number(await page.locator('#posY').inputValue())});
 const d0=await dim();let m=await ctm(page);
 const drag=async(handle,dx,dy,mods=[])=>{const h=page.locator(`.sel-handle[data-handle="${handle}"]`),b=await h.boundingBox(),sx=b.x+b.width/2,sy=b.y+b.height/2;for(const k of mods)await page.keyboard.down(k);await page.mouse.move(sx,sy);await page.mouse.down();await page.mouse.move(sx+dx,sy+dy,{steps:5});await page.mouse.up();for(const k of mods)await page.keyboard.up(k);};
 await drag('se',m.a*6,m.d*4);let d1=await dim();expect(Math.abs(d1.w-(d0.w+6))).toBeLessThan(.3);expect(Math.abs(d1.h-(d0.h+4))).toBeLessThan(.3);expect(d1.x).toBe(d0.x);
 await drag('e',m.a*-4,0);let d2=await dim();expect(Math.abs(d2.w-(d1.w-4))).toBeLessThan(.3);expect(Math.abs(d2.h-d1.h)).toBeLessThan(.05);
 await drag('nw',m.a*-5,m.d*-1,['Shift']);let d3=await dim();expect(Math.abs(d3.w/d3.h-d2.w/d2.h)).toBeLessThan(.02);expect(d3.w).toBeGreaterThan(d2.w+2);
 await page.locator('#undo').click();await page.locator('#undo').click();await page.locator('#undo').click();expect(await dim()).toEqual(d0);
 const rot=page.locator('.sel-handle[data-handle="rot"]'),rb=await rot.boundingBox(),box=await page.locator('#shapes rect.shape').boundingBox(),c={x:box.x+box.width/2,y:box.y+box.height/2};
 await page.mouse.move(rb.x+rb.width/2,rb.y+rb.height/2);await page.mouse.down();await page.mouse.move(c.x+120,c.y,{steps:6});await page.keyboard.down('Shift');await page.mouse.move(c.x+121,c.y+1);await page.keyboard.up('Shift');await page.mouse.up();expect(Number(await page.locator('#rotation').inputValue())).toBe(90);
 await page.locator('#undo').click();expect(Number(await page.locator('#rotation').inputValue())).toBe(0);
 // move by dragging the body, nudge with the keyboard
 const b2=await page.locator('#shapes rect.shape').boundingBox();await page.mouse.move(b2.x+b2.width/2,b2.y+b2.height/2);await page.mouse.down();await page.mouse.move(b2.x+b2.width/2+m.a*10,b2.y+b2.height/2,{steps:4});await page.mouse.up();expect(Math.abs((await dim()).x-(d0.x+10))).toBeLessThan(.3);
 await page.keyboard.press('ArrowRight');await page.keyboard.press('Shift+ArrowDown');const d4=await dim();expect(Math.abs(d4.x-(d0.x+11))).toBeLessThan(.3);expect(Math.abs(d4.y-(d0.y+5))).toBeLessThan(.3);
 // marquee: drag around two ellipses but not the rectangle
 await page.locator('#ellipse').click();await page.locator('#posX').fill('-40');await page.locator('#posX').press('Tab');await page.locator('#posY').fill('-40');await page.locator('#posY').press('Tab');
 await page.locator('#ellipse').click();await page.locator('#posX').fill('-40');await page.locator('#posX').press('Tab');await page.locator('#posY').fill('20');await page.locator('#posY').press('Tab');m=await ctm(page);const empty=toScreen(m,62,62);await page.mouse.click(empty.x,empty.y);await expect(page.locator('.object-row.selected')).toHaveCount(0);
 m=await ctm(page);const a=toScreen(m,-48,-50),z=toScreen(m,-10,45);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(z.x,z.y,{steps:5});await expect(page.locator('.marquee')).toBeAttached();await page.mouse.up();await expect(page.locator('.object-row.selected')).toHaveCount(2);
 const e0=toScreen(m,60,60);await page.mouse.click(e0.x,e0.y);await expect(page.locator('.object-row.selected')).toHaveCount(0);expect(errors).toEqual([]);
});

test('vertex editing works on any shape: Enter converts a rectangle and an ellipse to paths, nodes drag, insert, delete, and lettering becomes outlines',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#rect').click();await expect(page.locator('.path-node')).toHaveCount(0);await page.keyboard.press('Enter');await expect(page.locator('.path-node')).toHaveCount(4);await expect(page.locator('.object-row').first()).toContainText('fill');
 const node=page.locator('.path-node').nth(2),nb=await node.boundingBox(),before=await node.getAttribute('cx');await page.mouse.move(nb.x+nb.width/2,nb.y+nb.height/2);await page.mouse.down();await page.mouse.move(nb.x+nb.width/2+25,nb.y+nb.height/2+14,{steps:4});await page.mouse.up();expect(await page.locator('.path-node').nth(2).getAttribute('cx')).not.toBe(before);
 await page.keyboard.press('ArrowLeft');await page.keyboard.press('Delete');await expect(page.locator('.path-node')).toHaveCount(3);
 await page.keyboard.press('Escape');await expect(page.locator('.path-node')).toHaveCount(0);await expect(page.locator('.sel-handle').first()).toBeAttached();
 await page.locator('#ellipse').click();await page.keyboard.press('Enter');await expect(page.locator('.path-node')).toHaveCount(4);await page.locator('.path-node').first().click();await page.locator('#nodeCorner').isDisabled();await expect(page.locator('.path-handle')).toHaveCount(2);
 await page.locator('#letter').click();await expect(page.locator('#secText')).toBeVisible();await page.keyboard.press('Control+Shift+C');await expect(page.locator('#secText')).toBeHidden();expect(await page.locator('.object-row').count()).toBeGreaterThan(3);expect(errors).toEqual([]);
});

test('the sidebar only shows what applies to the selection',async({page})=>{
 await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();await expect(page.locator('#selHint')).toBeVisible();for(const id of ['secTransform','secText','secPath','secArray','secOrder'])await expect(page.locator('#'+id)).toBeHidden();
 await page.locator('#rect').click();await expect(page.locator('#secTransform')).toBeVisible();await expect(page.locator('#secText')).toBeHidden();await expect(page.locator('#secPath')).toBeVisible();await expect(page.locator('#selHint')).toBeHidden();
 await page.locator('#letter').click();await expect(page.locator('#secText')).toBeVisible();await expect(page.locator('#secPath')).toBeHidden();await expect(page.locator('#type')).toBeHidden();
 await page.locator('.object-row').first().click();await expect(page.locator('#secText')).toBeHidden();await page.keyboard.press('Control+a');await expect(page.locator('#selected')).toHaveText('2 objects selected');await expect(page.locator('#secText')).toBeHidden();
});

test('element tree: groups appear as collapsible parents, visibility and lock toggles, rename, drag to reorder, context menu, copy and paste',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 for(let i=0;i<3;i++){await page.locator('#rect').click();await page.locator('#posX').fill(String(-40+i*30));await page.locator('#posX').press('Tab');await page.locator('#posY').fill('-10');await page.locator('#posY').press('Tab');}
 await expect(page.locator('.object-row')).toHaveCount(3);await page.locator('.object-row').nth(0).click();await page.locator('.object-row').nth(1).click({modifiers:['Shift']});await page.keyboard.press('Control+g');
 await expect(page.locator('.group-row')).toHaveCount(1);await expect(page.locator('.group-row')).toContainText('2 objects');await expect(page.locator('.group-row.selected')).toHaveCount(1);
 await page.locator('.group-caret').click();await expect(page.locator('.object-row')).toHaveCount(1);await page.locator('.group-caret').click();await expect(page.locator('.object-row')).toHaveCount(3);
 const row=page.locator('.object-row').nth(2);await row.hover();await row.locator('.row-eye').click();await expect(page.locator('.object-row.is-hidden')).toHaveCount(1);await row.locator('.row-eye').click();await expect(page.locator('.object-row.is-hidden')).toHaveCount(0);
 await page.locator('.object-row').nth(2).hover();await page.locator('.object-row').nth(2).locator('.row-lock').click();await expect(page.locator('.object-row.is-locked')).toHaveCount(1);
 let m=await ctm(page),lockedAt=toScreen(m,-40+60+12,-2);await page.mouse.click(lockedAt.x,lockedAt.y);await expect(page.locator('.object-row.selected')).toHaveCount(0);await page.locator('.object-row').nth(2).locator('.row-lock').click();
 await page.locator('.object-row').nth(2).locator('.row-name').dblclick();await page.locator('.row-rename').fill('Tail piece');await page.locator('.row-rename').press('Enter');await expect(page.locator('.object-row').nth(2)).toContainText('Tail piece');
 const from=page.locator('.object-row').nth(2),to=page.locator('.object-row').nth(0);const ids=await page.locator('.object-row').evaluateAll(els=>els.map(e=>e.dataset.id));await from.dragTo(to,{targetPosition:{x:20,y:2}});const after=await page.locator('.object-row').evaluateAll(els=>els.map(e=>e.dataset.id));expect(after[0]).toBe(ids[2]);
 // context menu
 m=await ctm(page);const at=toScreen(m,-40+15,-2);await page.mouse.click(at.x,at.y,{button:'right'});await expect(page.locator('#ctxMenu')).toBeVisible();await expect(page.locator('#ctxMenu button',{hasText:'Group'}).first()).toBeVisible();await page.locator('#ctxMenu button',{hasText:/^Copy\s*Ctrl\+C/}).click();await page.keyboard.press('Control+v');expect(await page.locator('.object-row').count()).toBeGreaterThan(3);
 await page.mouse.click(toScreen(m,70,60).x,toScreen(m,70,60).y,{button:'right'});await expect(page.locator('#ctxMenu button',{hasText:'Select all'})).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#ctxMenu')).toHaveCount(0);expect(errors).toEqual([]);
});

test('compiling is automatic: stitches reappear after edits, issues are listed and clickable, errors stay visible',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());
 await page.locator('button[data-view="stitches"]').click();await expect(page.locator('#stitches path').first()).toBeAttached({timeout:8000});const n0=await page.locator('#count').textContent();
 await page.locator('.object-row').first().click();await page.locator('#sizeW').fill('40');await page.locator('#sizeW').press('Tab');
 await expect(page.locator('#count')).not.toHaveText(n0,{timeout:8000});await expect(page.locator('#stitches path').first()).toBeAttached();
 await page.locator('#posX').fill('300');await page.locator('#posX').press('Tab');await expect(page.locator('#issuesBtn')).toBeVisible({timeout:8000});await expect(page.locator('#count')).toHaveClass(/error/);
 await page.locator('.object-row').nth(1).click();await page.locator('#issuesBtn').click();await expect(page.locator('.object-row.selected')).toHaveCount(1);await expect(page.locator('#posX')).toHaveValue('300.0');
 await page.locator('#editNodes').click();await expect(page.locator('.path-node').first()).toBeAttached();await page.locator('#flipH').click();
 await page.locator('#remove').click();await expect(page.locator('#issuesBtn')).toBeHidden({timeout:8000});expect(errors).toEqual([]);
});

test('double-click edits: nodes on a rectangle, text focus on lettering, node insert on a path',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#rect').click();let m=await ctm(page);const c=toScreen(m,0,0);await page.mouse.dblclick(c.x,c.y);await expect(page.locator('.path-node')).toHaveCount(4);
 const top=toScreen(m,0,-8);await page.mouse.dblclick(top.x,top.y);await expect(page.locator('.path-node')).toHaveCount(5);await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 await page.locator('#letter').click();const t=page.locator('#shapes g.shape').first(),tb=await t.boundingBox();await page.mouse.dblclick(tb.x+tb.width/2,tb.y+tb.height/2);await expect(page.locator('#canvasText')).toBeFocused();expect(errors).toEqual([]);
});

test('several nodes at once: box-select, shift-click, drag together, nudge, delete',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#star').click();let m=await ctm(page);const c=toScreen(m,0,0),r=toScreen(m,22,0);await page.mouse.move(c.x,c.y);await page.mouse.down();await page.mouse.move(r.x,r.y,{steps:4});await page.mouse.up();
 await page.keyboard.press('Enter');const count=await page.locator('.path-node').count();expect(count).toBe(10);
 const a=toScreen(m,-30,-30),z=toScreen(m,30,-3);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(z.x,z.y,{steps:5});await expect(page.locator('.marquee')).toBeAttached();await page.mouse.up();
 const picked=await page.locator('.path-node.selected-node').count();expect(picked).toBeGreaterThan(2);expect(picked).toBeLessThan(10);
 const first=page.locator('.path-node.selected-node').first(),fb=await first.boundingBox(),xs=await page.locator('.path-node').evaluateAll(els=>els.map(e=>e.getAttribute('cx')));
 await page.mouse.move(fb.x+fb.width/2,fb.y+fb.height/2);await page.mouse.down();await page.mouse.move(fb.x+fb.width/2+m.a*6,fb.y+fb.height/2,{steps:4});await page.mouse.up();
 const xs2=await page.locator('.path-node').evaluateAll(els=>els.map(e=>e.getAttribute('cx')));const movedCount=xs.filter((v,i)=>Math.abs(Number(v)-Number(xs2[i]))>3).length;expect(movedCount).toBe(picked);
 await page.keyboard.press('ArrowDown');await page.keyboard.press('Delete');await expect(page.locator('.path-node')).toHaveCount(10-picked);await page.keyboard.press('Control+z');await expect(page.locator('.path-node')).toHaveCount(10);
 await page.mouse.click(toScreen(m,58,58).x,toScreen(m,58,58).y);await expect(page.locator('.path-node')).toHaveCount(0);expect(errors).toEqual([]);
});

test('a rotated rectangle keeps an oriented selection frame and resizes along its own axes',async({page})=>{
 await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();await page.locator('#rect').click();await page.locator('#rotation').fill('90');await page.locator('#rotation').press('Tab');
 const w0=Number(await page.locator('#sizeW').inputValue()),h0=Number(await page.locator('#sizeH').inputValue());
 // with 90° rotation the local "east" handle sits at the bottom of the screen box
 const handle=page.locator('.sel-handle[data-handle="e"]'),hb=await handle.boundingBox(),m=await ctm(page);
 await page.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await page.mouse.down();await page.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2+m.d*6,{steps:5});await page.mouse.up();
 const w1=Number(await page.locator('#sizeW').inputValue()),h1=Number(await page.locator('#sizeH').inputValue());expect(Math.abs(w1-(w0+6))).toBeLessThan(.4);expect(Math.abs(h1-h0)).toBeLessThan(.05);expect(Number(await page.locator('#rotation').inputValue())).toBe(90);
 await expect(page.locator('.object-row').first()).toContainText('fill');expect(await page.locator('#shapes rect.shape').count()).toBe(1);
});

test('rulers and guides: drag from a ruler, move and delete a guide, smart snapping to guides and objects, undoable',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await expect(page.locator('#rulerTop')).toBeVisible();await expect(page.locator('#rulerLeft')).toBeVisible();let m=await ctm(page);
 const rl=await page.locator('#rulerLeft').boundingBox();const gx=toScreen(m,-20,0);await page.mouse.move(rl.x+9,gx.y);await page.mouse.down();await page.mouse.move(gx.x,gx.y,{steps:5});await expect(page.locator('.guide-preview')).toBeAttached();await page.mouse.up();
 await expect(page.locator('#guides .guide')).toHaveCount(1);expect(Number(await page.locator('#guides .guide').getAttribute('x1'))).toBeCloseTo(-20,0);
 await page.locator('#rect').click();const b=await page.locator('#shapes rect.shape').boundingBox(),start={x:b.x+b.width/2,y:b.y+b.height/2};
 // drag so the rectangle's left edge ends within a few pixels of the guide: it snaps exactly
 const target=toScreen(m,-20,0),dxPx=(target.x-b.x)+2;await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+dxPx,start.y,{steps:6});await expect(page.locator('.smart').first()).toBeAttached();await page.mouse.up();
 expect(Number(await page.locator('#posX').inputValue())).toBeCloseTo(-20,1);
 // Ctrl bypasses snapping
 await page.keyboard.down('Control');await page.mouse.move(start.x+dxPx,start.y);await page.mouse.down();await page.mouse.move(start.x+dxPx+m.a*3.3,start.y,{steps:4});await page.mouse.up();await page.keyboard.up('Control');expect(Number(await page.locator('#posX').inputValue())).toBeGreaterThan(-19.5);
 // move the guide, then drag it back onto the ruler to delete it
 m=await ctm(page);const gl=page.locator('#guides .guide-hit').first(),mid=toScreen(m,-20,30);await page.mouse.move(mid.x,mid.y);await page.mouse.down();await page.mouse.move(mid.x+m.a*8,mid.y,{steps:4});await page.mouse.up();expect(Number(await page.locator('#guides .guide').getAttribute('x1'))).toBeCloseTo(-12,0);
 const mid2=toScreen(m,-12,30);await page.mouse.move(mid2.x,mid2.y);await page.mouse.down();await page.mouse.move(rl.x+8,mid2.y,{steps:4});await page.mouse.up();await expect(page.locator('#guides .guide')).toHaveCount(0);
 await page.keyboard.press('Control+z');await expect(page.locator('#guides .guide')).toHaveCount(1);expect(errors).toEqual([]);
});

test('lettering is edited on the canvas: live outlines while typing, Enter commits as one undo step, Escape cancels',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#letter').click();const text=page.locator('#shapes g.shape').first();let before=await text.boundingBox();const b=before;
 await page.mouse.dblclick(b.x+b.width/2,b.y+b.height/2);await expect(page.locator('#canvasText')).toBeFocused();await page.keyboard.type('ROSES AND MORE');await expect.poll(async()=>(await text.boundingBox()).width).toBeGreaterThan(before.width*1.6);
 await expect(page.locator('#saved')).toHaveText('Unsaved');await page.keyboard.press('Enter');await expect(page.locator('#canvasText')).toHaveCount(0);await expect(page.locator('.object-row').first()).toContainText('ROSES AND MORE');
 await page.keyboard.press('Control+z');await expect(page.locator('.object-row').first()).toContainText('BLOOM');expect((await text.boundingBox()).width).toBeCloseTo(before.width,0);
 await page.locator('.object-row').first().click();await page.keyboard.press('Enter');await page.keyboard.type('X');await page.keyboard.press('Escape');await expect(page.locator('.object-row').first()).toContainText('BLOOM');await expect(page.locator('#canvasText')).toHaveCount(0);expect(errors).toEqual([]);
});

test('keyboard resize and rotate: Ctrl+Arrows change size, Ctrl+Alt+Left/Right rotate',async({page})=>{
 await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();await page.locator('#rect').click();await page.locator('.object-row').first().click();
 const w0=Number(await page.locator('#sizeW').inputValue()),h0=Number(await page.locator('#sizeH').inputValue());
 await page.keyboard.press('Control+ArrowRight');expect(Math.abs(Number(await page.locator('#sizeW').inputValue())-(w0+1))).toBeLessThan(.15);await page.keyboard.press('Control+Shift+ArrowDown');expect(Math.abs(Number(await page.locator('#sizeH').inputValue())-(h0+5))).toBeLessThan(.15);
 await page.keyboard.press('Control+Alt+ArrowRight');expect(Number(await page.locator('#rotation').inputValue())).toBe(1);await page.keyboard.press('Control+Alt+Shift+ArrowLeft');expect(Number(await page.locator('#rotation').inputValue())).toBe(-14);
});

test('rename compatibility: projects saved as .welcom still open, new saves use .welcome, branding says Welcome',async({page})=>{
 await page.goto('/');page.on('dialog',d=>d.accept());await expect(page).toHaveTitle('Welcome Embroidery');await expect(page.locator('header.top .logo')).toHaveAttribute('aria-label','Welcome');
 await page.locator('#new').click();await page.locator('#rect').click();const saved=page.waitForEvent('download');await page.locator('#save').click();const file=await saved;expect(file.suggestedFilename()).toMatch(/\.welcome$/);
 const fs=await import('node:fs/promises'),text=await fs.readFile(await file.path(),'utf8');await page.locator('#new').click();
 await page.locator('#file').setInputFiles({name:'legacy.welcom',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('.object-row')).toHaveCount(1);
 await page.locator('#file').setInputFiles({name:'new.welcome',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('.object-row')).toHaveCount(1);
});

test.describe('language detection',()=>{
 test.use({locale:'es-ES'});
 test('Spanish browser gets Spanish UI, including dynamic text, and can switch to English',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#export')).toHaveText('Exportar');
  await expect(page.locator('html')).toHaveAttribute('lang','es');
  await expect(page.locator('#undo')).toHaveAttribute('aria-label','Deshacer');
  await page.locator('#rect').click();
  await expect(page.locator('#secStitch h4')).toHaveText('Puntadas');
  await expect(page.locator('#stats')).toContainText('puntadas');
  await expect(page.locator('#langEs')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#langEn')).toBeHidden();
  await page.locator('#langEs').click();await expect(page.locator('#langEn')).toBeVisible();await page.locator('#langEn').click();
  await expect(page.locator('#export')).toHaveText('Export');
  expect(errors).toEqual([]);
 });
});
test.describe('English default',()=>{
 test.use({locale:'fr-FR'});
 test('unsupported locales fall back to English',async({page})=>{await page.goto('/');await expect(page.locator('#export')).toHaveText('Export');});
});

test('hovering a selected object shows the guides it already lines up with, and they clear when the pointer leaves',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#rect').click();const b=await page.locator('#shapes rect.shape').boundingBox();
 await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await expect(page.locator('.smart').first()).toBeAttached();
 await page.mouse.move(5,5);await expect(page.locator('.smart')).toHaveCount(0);expect(errors).toEqual([]);
});
test('dragging a clipping mask moves its cut in the clipped objects while dragging',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#rect').click();await page.locator('#ellipse').click();await page.keyboard.press('Control+a');await expect(page.locator('#clipBtn')).toBeEnabled();await page.locator('#clipBtn').click();
 await expect(page.locator('#shapes .mask-shape')).toHaveCount(1);const maskId=await page.locator('#shapes .mask-shape').getAttribute('data-id');
 await page.keyboard.press('Escape');const mb=await page.locator('#shapes .mask-shape').boundingBox(),start={x:mb.x+mb.width/2,y:mb.y+mb.height/2};
 const clipMove=()=>page.evaluate(id=>document.querySelector(`#clip-${id} > *`)?.getAttribute('transform')??'',maskId);
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+40,start.y,{steps:6});
 await expect.poll(clipMove).toContain('translate');await page.mouse.up();
 await expect.poll(clipMove).toBe('');expect(errors).toEqual([]);
});
test('resizing and rotating a clipping mask previews its cut while dragging',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#rect').click();await page.locator('#ellipse').click();await page.keyboard.press('Control+a');await expect(page.locator('#clipBtn')).toBeEnabled();await page.locator('#clipBtn').click();
 await expect(page.locator('#shapes .mask-shape')).toHaveCount(1);const maskId=await page.locator('#shapes .mask-shape').getAttribute('data-id');
 await page.keyboard.press('Escape');const mb=await page.locator('#shapes .mask-shape').boundingBox();await page.mouse.click(mb.x+mb.width/2,mb.y+mb.height/2);
 const clipMove=()=>page.evaluate(id=>document.querySelector(`#clip-${id} > *`)?.getAttribute('transform')??'',maskId);
 const se=await page.locator('[data-handle="se"]').boundingBox();await page.mouse.move(se.x+se.width/2,se.y+se.height/2);await page.mouse.down();await page.mouse.move(se.x+se.width/2+30,se.y+se.height/2+30,{steps:6});
 await expect.poll(clipMove).toContain('scale');await page.mouse.up();await expect.poll(clipMove).toBe('');
 const rot=await page.locator('[data-handle="rot"]').boundingBox();await page.mouse.move(rot.x+rot.width/2,rot.y+rot.height/2);await page.mouse.down();await page.mouse.move(rot.x+rot.width/2+60,rot.y+rot.height/2,{steps:6});
 await expect.poll(clipMove).toContain('rotate');await page.mouse.up();await expect.poll(clipMove).toBe('');expect(errors).toEqual([]);
});
test('dragging a node of a clipping mask redraws its cut while dragging',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#rect').click();await page.locator('#rect').click();await page.keyboard.press('Control+a');await expect(page.locator('#clipBtn')).toBeEnabled();await page.locator('#clipBtn').click();
 await expect(page.locator('#shapes .mask-shape')).toHaveCount(1);const maskId=await page.locator('#shapes .mask-shape').getAttribute('data-id');
 await page.keyboard.press('Escape');const mb=await page.locator('#shapes .mask-shape').boundingBox();await page.mouse.dblclick(mb.x+mb.width/2,mb.y+mb.height/2);await expect(page.locator('.path-node')).toHaveCount(4);
 const cutD=()=>page.evaluate(id=>document.getElementById('clip-'+id)?.firstElementChild?.getAttribute('d')??'',maskId);
 const before=await cutD(),nb=await page.locator('.path-node').first().boundingBox();
 await page.mouse.move(nb.x+nb.width/2,nb.y+nb.height/2);await page.mouse.down();await page.mouse.move(nb.x+nb.width/2+25,nb.y+nb.height/2+25,{steps:6});
 await expect.poll(cutD).not.toBe(before);await page.mouse.up();await expect(page.locator('#count')).toContainText('stitches');expect(errors).toEqual([]);
});
test('dragging a Bézier handle of a clipping mask redraws its cut while dragging',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#rect').click();await page.locator('#rect').click();await page.keyboard.press('Control+a');await expect(page.locator('#clipBtn')).toBeEnabled();await page.locator('#clipBtn').click();
 await expect(page.locator('#shapes .mask-shape')).toHaveCount(1);const maskId=await page.locator('#shapes .mask-shape').getAttribute('data-id');
 await page.keyboard.press('Escape');const mb=await page.locator('#shapes .mask-shape').boundingBox();await page.mouse.dblclick(mb.x+mb.width/2,mb.y+mb.height/2);await expect(page.locator('.path-node')).toHaveCount(4);
 await page.locator('.path-node').nth(1).click({force:true});await page.locator('#nodeSmooth').click();await expect(page.locator('.path-handle')).toHaveCount(2);
 const cutD=()=>page.evaluate(id=>document.getElementById('clip-'+id)?.firstElementChild?.getAttribute('d')??'',maskId);
 const before=await cutD(),hb=await page.locator('.path-handle').nth(1).boundingBox();
 await page.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await page.mouse.down();await page.mouse.move(hb.x+hb.width/2+30,hb.y+hb.height/2-30,{steps:6});
 await expect.poll(cutD).not.toBe(before);const live=await cutD();await page.mouse.up();await expect(page.locator('#count')).toContainText('stitches');
 expect(await cutD()).toBe(live);expect(errors).toEqual([]);
});
test('start and end points: arm, click the canvas, markers appear, they follow the object and clear',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();await page.locator('#rect').click();
 await expect(page.locator('#pinRow')).toBeVisible();
 const w=await page.locator('#sizeW').inputValue(),h=await page.locator('#sizeH').inputValue(),x=Number(await page.locator('#posX').inputValue()),y=Number(await page.locator('#posY').inputValue());
 const m=await ctm(page);
 await page.locator('#pinStart').click();const s=toScreen(m,x,y);await page.mouse.click(s.x,s.y);
 await expect(page.locator('#controls .pin.start')).toHaveCount(1);
 await page.locator('#pinEnd').click();const e=toScreen(m,x+Number(w),y+Number(h));await page.mouse.click(e.x,e.y);
 await expect(page.locator('#controls .pin.end')).toHaveCount(1);
 await expect(page.locator('#count')).toContainText('stitches');
 await page.locator('#posX').fill(String(x+10));await page.locator('#posX').press('Tab');
 const cx=Number(await page.locator('#controls .pin.start').getAttribute('cx'));expect(Math.abs(cx-(x+10))).toBeLessThan(.5);
 await page.locator('#pinClear').click();await expect(page.locator('#controls .pin')).toHaveCount(0);
 await page.locator('#letter').click();await expect(page.locator('#pinRow')).toBeHidden();
 expect(errors).toEqual([]);
});

test('a fresh page compiles by itself, the 3D preview renders, and the sides field only shows for polygon and star tools',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await expect(page.locator('#count')).toContainText('stitches · compiled');
 await expect(page.locator('.sides-row')).toBeHidden();
 await page.locator('#star').click();await expect(page.locator('.sides-row')).toBeVisible();
 await page.locator('#polygon').click();await expect(page.locator('.sides-row')).toBeVisible();
 await page.locator('#select').click();await expect(page.locator('.sides-row')).toBeHidden();
 await page.locator('[data-view=preview]').click();await expect(page.locator('#preview3d')).toBeVisible();
 await page.waitForTimeout(800);
 const lit=await page.locator('#preview3d').evaluate(c=>{const t=document.createElement('canvas');t.width=c.width;t.height=c.height;const x=t.getContext('2d');x.drawImage(c,0,0);const d=x.getImageData(0,0,t.width,t.height).data;const seen=new Set();for(let i=0;i<d.length;i+=4*97)seen.add(d[i]+','+d[i+1]+','+d[i+2]);return seen.size;});
 expect(lit).toBeGreaterThan(20);
 expect(errors).toEqual([]);
});

test('fill patterns: spiral, meander and guided recompile, and the guide is drawn on the canvas',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();await page.locator('#rect').click();
 await expect(page.locator('#count')).toContainText('compiled');
 for(const m of ['spiral','meander','contour']){await page.locator('#fillMethod').selectOption(m);await expect(page.locator('#count')).toContainText('compiled');await expect(page.locator('#angle')).toBeHidden();}
 await page.locator('#fillMethod').selectOption('guided');await expect(page.locator('#guideRow')).toBeVisible();
 const x=Number(await page.locator('#posX').inputValue()),y=Number(await page.locator('#posY').inputValue()),w=Number(await page.locator('#sizeW').inputValue()),h=Number(await page.locator('#sizeH').inputValue()),m=await ctm(page);
 await page.locator('#guideDraw').click();for(const [u,v] of [[0,.7],[.5,.3],[1,.7]]){const s=toScreen(m,x+u*w,y+v*h);await page.mouse.click(s.x,s.y);}
 await expect(page.locator('#controls .guide-line')).toHaveCount(1);await page.locator('#guideDraw').click();
 await expect(page.locator('#guideClear')).toBeEnabled();await expect(page.locator('#count')).toContainText('compiled');
 await page.locator('#guideClear').click();await expect(page.locator('#guideClear')).toBeDisabled();
 await page.locator('#fillMethod').selectOption('rows');await expect(page.locator('#guideRow')).toBeHidden();
 expect(errors).toEqual([]);
});

test('playing the simulation keeps the 3D preview visible and draws it progressively',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('#count')).toContainText('compiled');
 await page.locator('[data-view=preview]').click();await expect(page.locator('#preview3d')).toBeVisible();
 await page.locator('#seek').evaluate(e=>{e.value=String(Math.floor(Number(e.max)/3));e.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect(page.locator('#preview3d')).toBeVisible();await expect(page.locator('[data-view=preview]')).toHaveClass(/active/);
 await expect(page.locator('#playbackProgress')).toContainText('%');
 await page.locator('#play').click();await page.waitForTimeout(600);
 await expect(page.locator('#preview3d')).toBeVisible();await expect(page.locator('[data-view=preview]')).toHaveClass(/active/);
 await page.locator('#play').click();
 expect(errors).toEqual([]);
});

test('lettering density: stitch spacing is available for lettering and a lower value sews more stitches; the logo is a vector wordmark',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');page.on('dialog',d=>d.accept());await expect(page.locator('.logo-mark')).toBeVisible();
 await page.locator('#new').click();await page.locator('#letter').click();
 await page.locator('#fontButton').click();await page.locator('#fontSearch').fill('emilio 20');await page.locator('.font-row').first().click();
 await expect(page.locator('#spacing')).toBeVisible();await expect(page.locator('#count')).toContainText('stitches');
 const n=async()=>Number(((await page.locator('#count').textContent()).match(/^([\d,]+) stitches/)||[,'0'])[1].replace(/,/g,''));
 await page.locator('#spacing').fill('0.7');await page.locator('#spacing').press('Tab');await expect(page.locator('#count')).toContainText('stitches');const sparse=await n();
 await page.locator('#spacing').fill('0.3');await page.locator('#spacing').press('Tab');await expect.poll(n).toBeGreaterThan(sparse);
 expect(errors).toEqual([]);
});

test('vector basics in the sidebar: corner radius, round corners, border width, satin taper, lettering that follows a path',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#rect').click();await expect(page.locator('#radiusRow')).toBeVisible();
 await page.locator('#radius').fill('4');await page.locator('#radius').press('Tab');
 const id=await page.locator('.object-row.selected').getAttribute('data-id');await expect(page.locator(`#shapes [data-id="${id}"]`)).toHaveAttribute('rx','4');
 await page.locator('#border').check();await expect(page.locator('#borderWidthRow')).toBeVisible();await expect(page.locator('#count')).toContainText('stitches');
 const n=async()=>Number(((await page.locator('#count').textContent()).match(/^([\d,]+) stitches/)||[,'0'])[1].replace(/,/g,''));
 await expect.poll(n).toBeGreaterThan(0);const plain=await n();
 await page.locator('#borderWidth').fill('2');await page.locator('#borderWidth').press('Tab');await expect.poll(n).toBeGreaterThan(plain+100);
 await openFolds(page);await page.locator('#roundMm').fill('3');await page.locator('#roundBtn').click();await expect(page.locator(`#shapes [data-id="${id}"]`)).toHaveAttribute('rx','3');
 // a satin path tapers
 await page.locator('#path').click();const m=await ctm(page);for(const [x,y] of [[-30,30],[0,25],[30,30]]){const s=toScreen(m,x,y);await page.mouse.click(s.x,s.y);}await page.keyboard.press('Enter');
 await expect(page.locator('.object-row')).toHaveCount(2);await page.locator('#type').selectOption('satin');await expect(page.locator('#satinEndRow')).toBeVisible();
 await page.locator('#satinWidthEnd').fill('1');await page.locator('#satinWidthEnd').press('Tab');await expect(page.locator('#count')).toContainText('stitches');
 await page.locator('#roundBtn').click();
 // lettering follows the path
 await page.locator('#letter').click();await expect(page.locator('#followRow')).toBeVisible();
 await page.locator('#followPath').selectOption({index:1});await expect(page.locator('#alongRow')).toBeVisible();
 await page.locator('#followPath').selectOption('');await expect(page.locator('#alongRow')).toBeHidden();
 expect(errors).toEqual([]);
});

test('roadmap tools: object snapping, clipping masks, caps/joins/node widths and colour blend',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 const n=async()=>Number(((await page.locator('#count').textContent()).match(/^([\d,]+) stitches/)||[,'0'])[1].replace(/,/g,''));
 // colour blend
 await page.locator('#rect').click();await expect.poll(n).toBeGreaterThan(0);await expect(page.locator('#blendRow')).toBeVisible();await expect(page.locator('#blendRange')).toBeHidden();
 await page.locator('#blendThread').selectOption('#d9897e');await expect(page.locator('#blendRange')).toBeVisible();await expect(page.locator('#count')).toContainText('stitches');
 const id=await page.locator('.object-row.selected').getAttribute('data-id');await expect(page.locator(`#shapes [data-id="${id}"]`)).toHaveAttribute('fill',new RegExp('^url\\(#blend-'));
 await page.locator('#blendThread').selectOption('');await expect(page.locator('#blendRange')).toBeHidden();
 // colour palette: threads chosen in order, a lone colour is refused
 await page.locator('#blendPalette0').selectOption('#527461');await page.locator('#blendPalette1').selectOption('#d9897e');await expect(page.locator('#blendRange')).toBeVisible();await expect(page.locator('#blendThread')).toHaveValue('');
 const pid=await page.locator('.object-row.selected').getAttribute('data-id');await expect(page.locator(`#shapes [data-id="${pid}"]`)).toHaveAttribute('fill',new RegExp('^url\\(#blend-'));
 await page.locator('#blendPalette1').selectOption('');await expect(page.locator('#toast')).toContainText('colour');await expect(page.locator('#blendPalette0')).toHaveValue('#527461');
 await page.locator('#blendThread').selectOption('#d3ad61');await expect(page.locator('#blendPalette0')).toHaveValue('');await expect(page.locator('#blendRange')).toBeVisible();
 await page.locator('#blendThread').selectOption('');await expect(page.locator('#blendRange')).toBeHidden();
 // snapping: a path point near the rectangle's corner lands exactly on it
 const rx=Number(await page.locator('#posX').inputValue()),ry=Number(await page.locator('#posY').inputValue()),m=await ctm(page);
 await page.locator('#path').click();const c=toScreen(m,rx,ry);await page.mouse.click(c.x+3,c.y+2);const far=toScreen(m,rx-20,ry-20);await page.mouse.click(far.x,far.y);await page.keyboard.press('Enter');
 await expect(page.locator('.object-row')).toHaveCount(2);expect(Number(await page.locator('#posX').inputValue())).toBeCloseTo(rx-20,0);
 const pathPts=await page.evaluate(()=>[...document.querySelectorAll('#shapes polyline.shape')].map(e=>e.getAttribute('points')));expect(pathPts.some(p=>p.startsWith(`${rx},${ry}`))).toBeTruthy();
 // satin path with caps, joins and node widths
 await page.locator('#type').selectOption('satin');await expect(page.locator('#capRow')).toBeVisible();await expect(page.locator('#joinRow')).toBeVisible();const before=await n();
 await page.locator('#cap').selectOption('round');await expect.poll(n).not.toBe(before);await page.locator('#join').selectOption('bevel');await expect(page.locator('#count')).toContainText('stitches');
 await page.keyboard.press('Enter');const nodes=page.locator('.path-node');await expect(nodes).toHaveCount(2);await nodes.first().click();await expect(page.locator('#nodeWidthRow')).toBeVisible();
 await page.locator('#nodeWidth').fill('8');await page.locator('#nodeWidth').press('Tab');await expect(page.locator('#widthClearRow')).toBeVisible();await page.locator('#widthClear').click();await expect(page.locator('#widthClearRow')).toBeHidden();
 // clipping mask
 await page.keyboard.press('Escape');await page.locator('#ellipse').click();await page.keyboard.press('Control+a');await expect(page.locator('#count')).toContainText('compiled');const full=await n();
 await expect(page.locator('#clipBtn')).toBeEnabled();await page.locator('#clipBtn').click();await expect(page.locator('#shapes .mask-shape')).toHaveCount(1);await expect.poll(n).toBeLessThan(full);
 await page.locator('#unclipBtn').click();await expect(page.locator('#shapes .mask-shape')).toHaveCount(0);
 expect(errors).toEqual([]);
});

test('embroidery options in the sidebar: cross stitch, appliqué, bean run, length variation, per-object compensation',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 const n=async()=>Number(((await page.locator('#count').textContent()).match(/^([\d,]+) stitches/)||[,'0'])[1].replace(/,/g,''));
 await page.locator('#rect').click();await expect.poll(n).toBeGreaterThan(0);await expect(page.locator('#varianceRow')).toBeVisible();await expect(page.locator('#compRow')).toBeVisible();const rows=await n();
 await page.locator('#lengthVariance').fill('30');await page.locator('#lengthVariance').press('Tab');await expect(page.locator('#count')).toContainText('stitches');
 await page.locator('#compensation').fill('0.8');await page.locator('#compensation').press('Tab');await expect(page.locator('#count')).toContainText('stitches');
 await page.locator('.icon-seg button[data-value=cross]').click();await expect(page.locator('#crossRow')).toBeVisible();await expect.poll(n).toBeLessThan(rows);await expect(page.locator('#varianceRow')).toBeHidden();
 await page.locator('.icon-seg button[data-value=rows]').click();
 await page.locator('#applique').check();await expect(page.locator('#appliqueWidthRow')).toBeVisible();await expect(page.locator('#count')).toContainText('stitches');
 await page.locator('#applique').uncheck();await expect(page.locator('#appliqueWidthRow')).toBeHidden();
 await page.locator('#type').selectOption('run');await expect(page.locator('#runStyleRow')).toBeVisible();await expect(page.locator('#stitchLenRow')).toBeVisible();await expect.poll(n).toBeGreaterThan(0);const single=await n();
 await page.locator('.icon-seg button[data-value=bean]').click();await expect.poll(n).toBeGreaterThan(single*2);
 expect(errors).toEqual([]);
});

import zlib from 'node:zlib';
const pngBytes=(w,h,fn)=>{const raw=Buffer.alloc((w*3+1)*h);for(let y=0;y<h;y++){raw[y*(w*3+1)]=0;for(let x=0;x<w;x++){const c=fn(x,y),[r,g,b]=Array.isArray(c)?c:[c,c,c],o=y*(w*3+1)+1+x*3;raw[o]=r;raw[o+1]=g;raw[o+2]=b;}}
 const crcTable=[...Array(256)].map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;}),crc=b=>{let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
 const chunk=(t,d)=>{const len=Buffer.alloc(4);len.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]),c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([len,td,c]);};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);};
test('photo stitch from a picture, ripple centre, blend direction, underpath and select mask',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 const n=async()=>Number(((await page.locator('#count').textContent()).match(/^([\d,]+) stitches/)||[,'0'])[1].replace(/,/g,''));
 await page.locator('#photoFile').setInputFiles({name:'ramp.png',mimeType:'image/png',buffer:pngBytes(60,40,(x,y)=>Math.round(255*x/59))});
 await expect(page.locator('.object-row').first()).toContainText('Photo');await expect(page.locator('#photoBox')).toBeVisible();await expect.poll(n).toBeGreaterThan(1500);const dense=await n();
 await page.locator('#photoSpacing').fill('1.4');await page.locator('#photoSpacing').press('Tab');await expect.poll(n).toBeLessThan(dense*.7);
 await page.locator('#photoInvert').check();await expect(page.locator('#count')).toContainText('stitches');
 // ripple + centre marker, blend direction
 await page.locator('#new').click();await page.locator('#ellipse').click();await expect.poll(n).toBeGreaterThan(0);
 await page.locator('.icon-seg button[data-value=ripple]').click();await expect(page.locator('#pinCenter')).toBeVisible();await expect(page.locator('#count')).toContainText('stitches');
 const x=Number(await page.locator('#posX').inputValue()),y=Number(await page.locator('#posY').inputValue()),m=await ctm(page);await page.locator('#pinCenter').click();const sp=toScreen(m,x+4,y+4);await page.mouse.click(sp.x,sp.y);await expect(page.locator('#controls .pin.center')).toHaveCount(1);
 await page.locator('#blendThread').selectOption('#d9897e');await expect(page.locator('#blendAngle')).toBeVisible();await page.locator('#blendAngle').fill('0');await page.locator('#blendAngle').press('Tab');await expect(page.locator('#count')).toContainText('stitches');
 await page.locator('.icon-seg button[data-value=rows]').click();await expect(page.locator('#underpathRow')).toBeVisible();await page.locator('#underpath').uncheck();await expect(page.locator('#count')).toContainText('stitches');
 // select mask
 await page.locator('#rect').click();await page.locator('.object-row').first().click();await page.locator('.object-row').nth(1).click({modifiers:['Shift']});await expect(page.locator('#clipBtn')).toBeEnabled();await page.locator('#clipBtn').click();
 await page.locator('.object-row').first().click();await expect(page.locator('#maskRow')).toBeVisible();await page.locator('#selectMask').click();await expect(page.locator('.object-row.selected')).toHaveCount(1);
 expect(errors).toEqual([]);
});

test('trace a picture into filled shapes with holes, grouped, one thread colour per region',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#traceBtn').click();await expect(page.locator('#traceDialog')).toBeVisible();await page.locator('#traceGo').click();await expect(page.locator('#traceInfo')).toContainText('Choose a picture');
 const png=pngBytes(80,60,(x,y)=>{if(Math.hypot(x-62,y-20)<9)return [20,40,200];const d=Math.hypot(x-30,y-30);return d<8?[255,255,255]:d<20?[200,30,30]:[255,255,255];});
 await page.locator('#traceFile').setInputFiles({name:'logo.png',mimeType:'image/png',buffer:png});await page.locator('#traceColors').fill('4');await page.locator('#traceGo').click();
 await expect(page.locator('#traceDialog')).toBeHidden();await expect(page.locator('.object-row')).toHaveCount(2);await expect(page.locator('#toast')).toContainText('Traced 2 shapes');
 await expect(page.locator('#count')).toContainText('stitches');
 const fills=await page.evaluate(()=>[...document.querySelectorAll('#shapes .shape')].map(e=>({tag:e.tagName,fill:e.getAttribute('fill')})));expect(new Set(fills.map(f=>f.fill)).size).toBe(2);expect(fills.some(f=>f.tag==='path')).toBeTruthy();   // the ring has a hole, so it is drawn as a path
 expect(errors).toEqual([]);
});

test('trace line art: strokes become satin and running paths',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#traceBtn').click();await page.locator('#traceMode').selectOption('lines');await expect(page.locator('#traceColorsRow')).toBeHidden();
 const png=pngBytes(100,80,(x,y)=>{const d=Math.hypot(x-30,y-40);return (d>18&&d<22)||(x>=62&&x<=65&&y>=15&&y<=65)||(y>=38&&y<=41&&x>=58&&x<=90)?[10,10,10]:[255,255,255];});
 await page.locator('#traceFile').setInputFiles({name:'lines.png',mimeType:'image/png',buffer:png});await page.locator('#traceGo').click();
 await expect(page.locator('#traceDialog')).toBeHidden();await expect(page.locator('.object-row').first()).toContainText('Traced line');expect(await page.locator('.object-row').count()).toBeGreaterThanOrEqual(3);await expect(page.locator('#toast')).toContainText('strokes');
 await expect(page.locator('#count')).toContainText('stitches');
 expect(errors).toEqual([]);
});

test('reference image: load a picture, draw on top of it, adjust, move, hide, remove; it is never sewn',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await expect(page.locator('#refLayer image')).toHaveCount(0);
 await page.locator('#secRef summary').click();await expect(page.locator('#refEmpty')).toBeVisible();
 await page.locator('#refFile').setInputFiles({name:'sketch.png',mimeType:'image/png',buffer:pngBytes(120,80,(x,y)=>(x+y)%20<3?[30,30,30]:[240,230,210])});
 await expect(page.locator('#refLayer image')).toHaveCount(1);await expect(page.locator('#refControls')).toBeVisible();
 const w0=Number(await page.locator('#refW').inputValue());expect(w0).toBeGreaterThan(80);
 await page.locator('#refOpacity').fill('80');await expect(page.locator('#refLayer image')).toHaveAttribute('opacity','0.8');
 // drawing on top works and the picture adds no stitches
 await page.locator('#rect').click();await expect(page.locator('.object-row')).toHaveCount(1);await expect.poll(async()=>Number(((await page.locator('#count').textContent()).match(/^([\d,]+) stitches/)||[,'0'])[1].replace(/,/g,''))).toBeGreaterThan(0);
 // move on canvas
 const x0=Number(await page.locator('#refX').inputValue());await page.locator('#refMove').click();const m=await ctm(page),a=toScreen(m,0,-50);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(a.x+60,a.y+20,{steps:5});await page.mouse.up();
 await expect.poll(async()=>Number(await page.locator('#refX').inputValue())).toBeGreaterThan(x0+3);await page.locator('#refMove').click();
 await page.locator('#refW').fill('50');await page.locator('#refW').press('Tab');await expect(page.locator('#refLayer image')).toHaveAttribute('width','50');
 await page.locator('#refLocked').check();await expect(page.locator('#refMove')).toBeDisabled();
 await page.locator('#refVisible').uncheck();await expect(page.locator('#refLayer image')).toHaveCount(0);await page.locator('#refVisible').check();await expect(page.locator('#refLayer image')).toHaveCount(1);
 await page.locator('[data-view=preview]').click();await expect(page.locator('#refLayer image')).toHaveCount(0);await page.locator('[data-view=design]').click();await expect(page.locator('#refLayer image')).toHaveCount(1);
 await page.locator('#refRemove').click();await expect(page.locator('#refLayer image')).toHaveCount(0);await expect(page.locator('#refEmpty')).toBeVisible();
 expect(errors).toEqual([]);
});

test('agents can see the reference picture: annotated view with grid, hoop and shapes, raw view, and its placement',async({page})=>{
 const {spawn}=await import('node:child_process'),{Client}=await import('@modelcontextprotocol/sdk/client/index.js'),{StreamableHTTPClientTransport}=await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
 const port=18795,origin=`http://127.0.0.1:${port}`,child=spawn(process.execPath,['server.js'],{env:{...process.env,HOST:'127.0.0.1',PORT:String(port),WELCOME_SESSION_FILE:''},stdio:'ignore'});
 try{
  for(let i=0;i<100;i++){try{if((await fetch(origin+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
  await page.locator('#copyEndpoint').click();await expect(page.locator('#agentUrl')).toHaveValue(/\/mcp\/[A-Za-z0-9_-]{32,}$/);const link=await page.locator('#agentUrl').inputValue();await page.locator('#agentDialog button:not([type=button])').click();
  const client=new Client({name:'ref-agent',version:'1'});await client.connect(new StreamableHTTPClientTransport(new URL(link)));const call=(name,args)=>client.callTool({name,arguments:args});
  const none=await call('reference_image',{documentId:'live'});expect(none.content[0].text).toContain('no reference picture');
  await page.locator('#secRef summary').click();await page.locator('#refFile').setInputFiles({name:'sketch.png',mimeType:'image/png',buffer:pngBytes(120,80,(x,y)=>(x+y)%20<3?[30,30,30]:[240,230,210])});await expect(page.locator('#refLayer image')).toHaveCount(1);
  const inspect=await call('document_inspect',{documentId:'live'});expect(inspect.structuredContent.reference.w).toBeGreaterThan(80);expect(JSON.stringify(inspect.structuredContent)).not.toContain('data:image');
  const doc=await call('document_apply',{documentId:'live',expectedRevision:inspect.structuredContent.revision,operations:[{op:'add_shape',id:'ref-rect',kind:'rect',x:-10,y:-10,width:20,height:20,thread:'#d9897e'}]});expect(doc.isError,JSON.stringify(doc.content)).toBeFalsy();
  const ann=await call('reference_image',{documentId:'live'});const meta=JSON.parse(ann.content[0].text);expect(meta.imageBox.pixelsPerMm).toBeGreaterThan(3);expect(meta.placement.w).toBeGreaterThan(80);expect(ann.content[1].type).toBe('image');expect(ann.content[1].mimeType).toBe('image/png');
  const bytes=Buffer.from(ann.content[1].data,'base64');expect(bytes.subarray(1,4).toString()).toBe('PNG');expect(bytes.readUInt32BE(16)).toBeGreaterThan(300);
  // the coloured shape outline is part of the annotated picture only when asked for
  const without=await call('reference_image',{documentId:'live',includeShapes:false});expect(Buffer.from(without.content[1].data,'base64').equals(bytes)).toBe(false);
  const raw=await call('reference_image',{documentId:'live',view:'raw'});expect(raw.content[1].mimeType).toBe('image/jpeg');expect(JSON.parse(raw.content[0].text).placement.x).toBeCloseTo(meta.placement.x,1);
  expect(errors).toEqual([]);await client.close().catch(()=>{});
 }finally{child.kill('SIGTERM');}
});

test('DST files import as stitch layers (a DST written by Welcome comes back)',async({page})=>{
 const {encode,compile:compileDoc,initialDocument:initDoc}=await import('../src/engine.js'),{registerFont}=await import('../src/fonts.js'),fs=await import('node:fs/promises');
 registerFont('ttf/greatvibes',JSON.parse(await fs.readFile(new URL('../fonts/ttf/greatvibes.json',import.meta.url),'utf8')));
 const d=initDoc(),bytes=Buffer.from(encode(compileDoc(d),'dst',undefined,d.hoop,d));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d2=>d2.accept());await page.locator('#new').click();
 await page.locator('#machineFile').setInputFiles({name:'badge.dst',mimeType:'application/octet-stream',buffer:bytes});
 await expect(page.locator('.object-row')).toHaveCount(1);await expect(page.locator('#sourceInfo')).toContainText(/DST/i);await expect(page.locator('#count')).toContainText('stitches');
 expect(errors).toEqual([]);
});

test('agent experience on the live document: summaries, render, clear, snapshot and restore, push a headless design to the browser (undoable)',async({page})=>{
 const {spawn}=await import('node:child_process'),{Client}=await import('@modelcontextprotocol/sdk/client/index.js'),{StreamableHTTPClientTransport}=await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
 const port=18796,origin=`http://127.0.0.1:${port}`,child=spawn(process.execPath,['server.js'],{env:{...process.env,HOST:'127.0.0.1',PORT:String(port),WELCOME_SESSION_FILE:''},stdio:'ignore'});
 try{
  for(let i=0;i<100;i++){try{if((await fetch(origin+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
  await page.locator('#copyEndpoint').click();await expect(page.locator('#agentUrl')).toHaveValue(/\/mcp\/[A-Za-z0-9_-]{32,}$/);const link=await page.locator('#agentUrl').inputValue();await page.locator('#agentDialog button:not([type=button])').click();
  const client=new Client({name:'ux-agent',version:'1'});await client.connect(new StreamableHTTPClientTransport(new URL(link)));const call=(name,args)=>client.callTool({name,arguments:args});
  const list=await call('document_list',{});expect(list.structuredContent.live.documentId).toBe('live');
  let rev=(await call('document_inspect',{documentId:'live'})).structuredContent.revision;
  const ap=await call('document_apply',{documentId:'live',expectedRevision:rev,operations:[{op:'add_shape',id:'x1',kind:'rect',x:-20,y:-10,width:30,height:20,thread:'#d9897e'},{op:'add_shape',id:'x2',kind:'ellipse',x:5,y:5,width:3,height:3}]});
  expect(ap.structuredContent.created.map(o=>o.id)).toEqual(['x1','x2']);expect(ap.structuredContent.warnings.some(w=>w.id==='x2')).toBe(true);await expect(page.locator('.object-row')).toHaveCount(2);
  const view=await call('document_render',{documentId:'live',view:'design',size:500});expect(view.content[1].mimeType).toBe('image/png');
  const snap=await call('document_snapshot',{documentId:'live',label:'two'});rev=(await call('document_inspect',{documentId:'live'})).structuredContent.revision;
  await call('document_apply',{documentId:'live',expectedRevision:rev,operations:[{op:'clear'}]});await expect(page.locator('.object-row')).toHaveCount(0);
  const back=await call('document_restore',{documentId:'live',snapshotId:snap.structuredContent.snapshotId});expect(back.isError).toBeFalsy();await expect(page.locator('.object-row')).toHaveCount(2);
  // a headless design pushed into the browser replaces it, and Undo brings the previous one back
  const made=await call('document_create',{name:'Pushed',hoop:110});const hid=made.structuredContent.documentId;
  await call('document_apply',{documentId:hid,expectedRevision:0,operations:[{op:'add_shape',id:'p1',kind:'rect',x:-10,y:-10,width:20,height:20},{op:'add_shape',id:'p2',kind:'rect',x:15,y:-10,width:10,height:10},{op:'add_shape',id:'p3',kind:'rect',x:-30,y:15,width:10,height:10}]});
  const pushed=await call('document_push_live',{documentId:hid});expect(pushed.isError,JSON.stringify(pushed.content)).toBeFalsy();await expect(page.locator('.object-row')).toHaveCount(3);await expect(page.locator('#name')).toHaveValue('Pushed');
  await page.locator('#undo').click();await expect(page.locator('.object-row')).toHaveCount(2);
  expect(errors).toEqual([]);await client.close().catch(()=>{});
 }finally{child.kill('SIGTERM');}
});

test('tooltips are drawn on top of the panels, inside the window, above the control when there is room and below at the top edge',async({page})=>{
 await page.goto('/');await expect(page.locator('#tooltip')).toHaveCount(1);
 await page.locator('#rect').hover();await expect(page.locator('#tooltip')).toHaveClass(/show/);await expect(page.locator('#tooltip')).toHaveText('Add rectangle');
 const box=async()=>page.evaluate(()=>{const t=document.querySelector('#tooltip').getBoundingClientRect(),vw=document.documentElement.clientWidth,z=getComputedStyle(document.querySelector('#tooltip')),b=document.querySelector('#rect').getBoundingClientRect();return {l:t.left,r:t.right,t:t.top,b:t.bottom,vw,pos:z.position,zi:Number(z.zIndex),above:t.bottom<=b.top+1,below:t.top>=b.bottom-1};});
 let m=await box();expect(m.pos).toBe('fixed');expect(m.zi).toBeGreaterThan(1000);expect(m.l).toBeGreaterThanOrEqual(0);expect(m.r).toBeLessThanOrEqual(m.vw);
 await page.locator('#select').hover();await expect(page.locator('#tooltip')).toContainText('Select');m=await page.evaluate(()=>{const t=document.querySelector('#tooltip').getBoundingClientRect();return {l:t.left,r:t.right,vw:document.documentElement.clientWidth};});expect(m.l).toBeGreaterThanOrEqual(0);
 await page.locator('#export').hover({force:true});await page.locator('#undo').hover({force:true});await expect(page.locator('#tooltip')).toHaveText('Undo');const top=await page.evaluate(()=>{const t=document.querySelector('#tooltip').getBoundingClientRect(),b=document.querySelector('#undo').getBoundingClientRect();return t.top>=b.bottom-1&&t.top>=0;});expect(top).toBe(true);
 await page.mouse.move(700,500);await expect(page.locator('#tooltip')).not.toHaveClass(/show/);
});

test('3D preview drag direction: dragging right turns the fabric right, dragging down looks more from above',async({page})=>{
 await page.goto('/');await expect(page.locator('#count')).toContainText('compiled');await page.locator('[data-view=preview]').click();const canvas=page.locator('#preview3d');await expect(canvas).toBeVisible();await expect(canvas).toHaveAttribute('data-instances',/\d+/);
 const box=await canvas.boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2,num=async n=>Number(await canvas.getAttribute(n));
 const tilt0=await num('data-tilt');await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+100,cy,{steps:5});await page.mouse.up();await expect.poll(()=>num('data-yaw')).toBeLessThan(-.5);
 await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx,cy+60,{steps:5});await page.mouse.up();await expect.poll(()=>num('data-tilt')).toBeLessThan(tilt0-.2);
});

test('thread colours: swatch palette, custom colour, recent colours, None for blends',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();await page.locator('#rect').click();
 const btn=page.locator('#thread + .thread-btn');await expect(btn).toContainText('Forest');await btn.click();await expect(page.locator('#threadPop')).toBeVisible();expect(await page.locator('#threadPop .grid button').count()).toBeGreaterThanOrEqual(48);
 await page.locator('#threadPop .grid button[title="Red"]').click();await expect(page.locator('#threadPop')).toBeHidden();await expect(page.locator('#thread')).toHaveValue('#c8281e');await expect(btn).toContainText('Red');
 const id=await page.locator('.object-row.selected').getAttribute('data-id');await expect(page.locator(`#shapes [data-id="${id}"]`)).toHaveAttribute('fill','#c8281e');
 await btn.click();await page.locator('#threadPop input[type=text]').fill('#123abc');await page.locator('#threadPop input[type=text]').press('Enter');await expect(page.locator('#thread')).toHaveValue('#123abc');await expect(page.locator(`#shapes [data-id="${id}"]`)).toHaveAttribute('fill','#123abc');
 await btn.click();await expect(page.locator('#threadPop h5')).toContainText('Recent');await page.keyboard.press('Escape');await expect(page.locator('#threadPop')).toBeHidden();
 // None for the blend colour
 const blend=page.locator('#blendThread + .thread-btn');await expect(blend).toContainText('None');await blend.click();await page.locator('#threadPop .grid button[title="Gold"]').click();await expect(page.locator('#blendThread')).toHaveValue('#c9962b');await blend.click();await page.locator('#threadPop .none-btn').click();await expect(page.locator('#blendThread')).toHaveValue('');
 await expect(page.locator('#stats')).toContainText('to sew');
 expect(errors).toEqual([]);
});

test('autosave: an edited design is offered back after a reload; starting fresh forgets it',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();await page.locator('#rect').click();await page.locator('#ellipse').click();await expect(page.locator('.object-row')).toHaveCount(2);
 await page.locator('#name').fill('Autosaved badge');await page.locator('#name').press('Enter');await page.waitForTimeout(1200);
 await page.reload();await expect(page.locator('#restoreDialog')).toBeVisible();await expect(page.locator('#restoreInfo')).toContainText('Autosaved badge');await expect(page.locator('#restoreInfo')).toContainText('2 objects');
 await page.locator('#restoreYes').click();await expect(page.locator('#restoreDialog')).toBeHidden();await expect(page.locator('.object-row')).toHaveCount(2);await expect(page.locator('#name')).toHaveValue('Autosaved badge');await expect(page.locator('#saved')).toHaveText('Unsaved');
 await page.reload();await expect(page.locator('#restoreDialog')).toBeVisible();await page.locator('#restoreNo').click();await expect(page.locator('#restoreDialog')).toBeHidden();await expect(page.locator('.object-row')).toHaveCount(5);
 await page.reload();await expect(page.locator('#restoreDialog')).toBeHidden();
 expect(errors).toEqual([]);
});

test('keyboard shortcut list opens with ? and the listed tool keys really work; the thread plan lists colours in sewing order',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');page.on('dialog',d=>d.accept());await expect(page.locator('#count')).toContainText('compiled');
 await page.keyboard.press('?');await expect(page.locator('#keysDialog')).toBeVisible();await expect(page.locator('#keysList')).toContainText('Ctrl+G / Ctrl+Shift+G');await page.keyboard.press('Escape');await expect(page.locator('#keysDialog')).toBeHidden();
 await page.locator('#helpBtn').click();await expect(page.locator('#keysDialog')).toBeVisible();await page.keyboard.press('Escape');
 for(const [key,id] of [['n','path'],['p','pen'],['l','line'],['g','polygon'],['s','star'],['v','select']]){await page.locator('#art').hover();await page.keyboard.press(key);await expect(page.locator('#'+id)).toHaveClass(/active-tool/);}
 await page.locator('#secPlan summary').click();await expect(page.locator('#planList .plan-row')).toHaveCount(10);await expect(page.locator('#planList .plan-row').first()).toContainText('1.');await expect(page.locator('#planEmpty')).toBeHidden();
 expect(errors).toEqual([]);
});

test('copy and paste style between objects',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#rect').click();const a=await page.locator('.object-row.selected').getAttribute('data-id');
 await page.locator('#thread').selectOption('#d9897e');await page.locator('#border').check();await page.locator('#spacing').fill('0.6');await page.locator('#spacing').press('Tab');await page.locator('#angle').fill('10');await page.locator('#angle').press('Tab');
 await page.locator('#ellipse').click();const b=await page.locator('.object-row.selected').getAttribute('data-id');await page.locator('#thread').selectOption('#527461');await page.locator('#border').uncheck().catch(()=>{});await page.locator('#spacing').fill('0.4');await page.locator('#spacing').press('Tab');await page.locator('#angle').fill('32');await page.locator('#angle').press('Tab');await expect(page.locator('#thread')).toHaveValue('#527461');
 await page.keyboard.press('Control+Alt+V');await expect(page.locator('#toast')).toContainText('Copy a style first');
 await page.locator(`.object-row[data-id="${a}"]`).click();await page.keyboard.press('Control+Alt+C');await expect(page.locator('#toast')).toContainText('Style copied');
 await page.locator(`.object-row[data-id="${b}"]`).click();await page.keyboard.press('Control+Alt+V');
 await expect(page.locator('#thread')).toHaveValue('#d9897e');await expect(page.locator('#border')).toBeChecked();await expect(page.locator('#spacing')).toHaveValue('0.6');await expect(page.locator('#angle')).toHaveValue('10');await expect(page.locator(`#shapes [data-id="${b}"]`)).toHaveAttribute('fill','#d9897e');
 // via the context menu
 const box=await page.locator(`#shapes [data-id="${a}"]`).boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2,{button:'right'});await expect(page.locator('#ctxMenu')).toContainText('Copy style');await expect(page.locator('#ctxMenu')).toContainText('Paste style');await page.keyboard.press('Escape');
 expect(errors).toEqual([]);
});

test('sewing tips appear in the editor: the issues button counts them, the selected object explains its tip',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await expect(page.locator('#issuesBtn')).toBeHidden();
 await page.locator('#ellipse').click();await page.locator('#sizeW').fill('3');await page.locator('#sizeW').press('Tab');await page.locator('#sizeH').fill('3');await page.locator('#sizeH').press('Tab');
 await expect(page.locator('#issuesBtn')).toBeVisible();await expect(page.locator('#issuesBtn')).toContainText('1 sewing tip');
 await expect(page.locator('#sewTips')).toBeVisible();await expect(page.locator('#sewTips')).toContainText(/too small for a clean fill|small fill/);
 await page.locator('#rect').click();await expect(page.locator('#sewTips')).toBeHidden();await expect(page.locator('#issuesBtn')).toContainText('1 sewing tip');
 await page.locator('#issuesBtn').click();await expect(page.locator('#sewTips')).toBeVisible();
 await page.locator('#sizeW').fill('12');await page.locator('#sizeW').press('Tab');await page.locator('#sizeH').fill('12');await page.locator('#sizeH').press('Tab');
 await page.locator('.object-row').first().click();await page.locator('#sizeW').fill('14');await page.locator('#sizeW').press('Tab');await page.locator('#sizeH').fill('14');await page.locator('#sizeH').press('Tab');
 await expect(page.locator('#issuesBtn')).toBeHidden();
 expect(errors).toEqual([]);
});

test('no business logic needs the server: design, compile, export JEF/VP3/DST/SVG, save/open, trace, photo and reference all work with every API call blocked',async({page})=>{
 const {decodeEmbroidery}=await import('../src/readers.js');
 const requests=[];page.on('request',r=>{const u=new URL(r.url());requests.push(u.pathname);});
 await page.route(u=>{const p=new URL(u).pathname;return p.startsWith('/api/')||p.startsWith('/mcp')||p.startsWith('/artifacts/');},route=>route.abort());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#rect').click();await page.locator('#ellipse').click();await page.locator('#letter').click();await expect(page.locator('#count')).toContainText('stitches');
 // every export format is generated in the browser and downloaded
 const got={};
 for(const fmt of ['jef','vp3','dst','svg']){await page.locator('#export').click();await page.locator('#format').selectOption(fmt);const [dl]=await Promise.all([page.waitForEvent('download'),page.locator('#download').click()]);const stream=await dl.createReadStream();const chunks=[];for await(const c of stream)chunks.push(c);got[fmt]=Buffer.concat(chunks);expect(dl.suggestedFilename()).toMatch(new RegExp('\\.'+fmt+'$'));}
 for(const fmt of ['jef','vp3']){const d=decodeEmbroidery(new Uint8Array(got[fmt]),fmt);expect(d.stitches.filter(s=>s.cmd==='stitch').length).toBeGreaterThan(300);}
 expect(decodeEmbroidery(new Uint8Array(got.dst),'dst').stitches.length).toBeGreaterThan(300);expect(got.svg.toString()).toContain('<svg');
 // save a project, open it again
 const [save]=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]);const saved=Buffer.concat(await (async()=>{const out=[];for await(const c of await save.createReadStream())out.push(c);return out;})());expect(JSON.parse(saved.toString()).schema).toBe('welcom/1');
 await page.locator('#new').click();await expect(page.locator('.object-row')).toHaveCount(0);await page.locator('#file').setInputFiles({name:'again.welcome',mimeType:'application/json',buffer:saved});await expect(page.locator('.object-row')).toHaveCount(3);
 // tracing, photo stitch, reference picture, import of a machine file
 const png=pngBytes(80,60,(x,y)=>Math.hypot(x-40,y-30)<20?[200,30,30]:[255,255,255]);
 await page.locator('#traceBtn').click();await page.locator('#traceFile').setInputFiles({name:'a.png',mimeType:'image/png',buffer:png});await page.locator('#traceGo').click();await expect(page.locator('#traceDialog')).toBeHidden();
 await page.locator('#photoFile').setInputFiles({name:'p.png',mimeType:'image/png',buffer:png});await expect(page.locator('.object-row').first()).toBeVisible();
 await page.locator('#secRef summary').click();await page.locator('#refFile').setInputFiles({name:'r.png',mimeType:'image/png',buffer:png});await expect(page.locator('#refLayer image')).toHaveCount(1);
 await page.locator('#machineFile').setInputFiles({name:'x.jef',mimeType:'application/octet-stream',buffer:got.jef});await expect(page.locator('#sourceInfo')).toBeAttached();
 // nothing but static files was ever requested
 const apiCalls=requests.filter(p=>p.startsWith('/api/')||p.startsWith('/mcp')||p.startsWith('/artifacts/'));expect(apiCalls).toEqual([]);
 expect(errors).toEqual([]);
});

test('sewing tips are translated in the Spanish interface',async({page})=>{
 await page.goto('/?lang=es');page.on('dialog',d=>d.accept());await page.locator('#new').click();await page.locator('#rect').click();await page.locator('#sizeW').fill('1.5');await page.locator('#sizeW').press('Tab');await page.locator('#sizeH').fill('30');await page.locator('#sizeH').press('Tab');
 await expect(page.locator('#sewTips')).toContainText('demasiado pequeño para un relleno limpio');await expect(page.locator('#issuesBtn')).toContainText('1 consejo');
});

test('hand tool drags the view and the select tool does not',async({page})=>{
 await page.goto('/');const art=await page.locator('#art').boundingBox();const x=art.x+60,y=art.y+60;
 const m0=await ctm(page);await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+50,y+20,{steps:3});await page.mouse.up();
 expect(await ctm(page)).toEqual(m0);
 await page.locator('#handTool').click();await expect(page.locator('#handTool')).toHaveAttribute('aria-pressed','true');
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+90,y+30,{steps:4});await page.mouse.up();
 const m1=await ctm(page);expect(m1.e-m0.e).toBeCloseTo(90,0);expect(m1.f-m0.f).toBeCloseTo(30,0);
 await page.locator('#handTool').click();await expect(page.locator('#handTool')).toHaveAttribute('aria-pressed','false');
});

test.describe('touch gestures',()=>{
 test.use({hasTouch:true});
 test('two fingers pinch to zoom the view',async({page,browserName})=>{
  test.skip(browserName!=='chromium','touch points are dispatched through a Chromium CDP session');
  await page.goto('/');const art=await page.locator('#art').boundingBox();const mx=art.x+art.width/2,my=art.y+art.height*0.3;
  const cdp=await page.context().newCDPSession(page),m0=await ctm(page);
  const pts=d=>[{id:1,x:mx-d,y:my},{id:2,x:mx+d,y:my}];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:pts(40)});
  for(const d of [50,60,70,80])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:pts(d)});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const ratio=(await ctm(page)).a/m0.a;expect(ratio).toBeGreaterThan(1.8);expect(ratio).toBeLessThan(2.2);
 });
});

test('selection handles resize and rotate from the keyboard',async({page})=>{
 await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#rect').click();
 const w0=Number(await page.locator('#sizeW').inputValue());
 await page.locator('[data-handle="e"]').focus();
 await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('Shift+ArrowRight');
 await expect(page.locator('[data-handle="e"]')).toBeFocused();
 await expect.poll(async()=>Number(await page.locator('#sizeW').inputValue())).toBeCloseTo(w0+12,0);
 await page.locator('[data-handle="rot"]').focus();
 await page.keyboard.press('ArrowRight');await page.keyboard.press('Shift+ArrowRight');
 await expect(page.locator('[data-handle="rot"]')).toBeFocused();
 await expect.poll(async()=>Number(await page.locator('#rotation').inputValue())).toBeCloseTo(16,0);
});

test('continue digitizing adds points to the same path instead of starting a new object',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#path').click();const m=await ctm(page);for(const [x,y] of [[-30,30],[0,25],[30,30]]){const s=toScreen(m,x,y);await page.mouse.click(s.x,s.y);}
 const first=toScreen(m,-30,30);await page.mouse.click(first.x,first.y);
 const rows=page.locator('.object-row');const before=await rows.count();await expect(page.locator('.object-row.selected')).toContainText('fill');
 await page.locator('#continueDig').click();const mid=toScreen(m,0,0);await page.mouse.click(mid.x,mid.y);await page.keyboard.press('Enter');
 await expect(rows).toHaveCount(before);await expect(page.locator('.object-row.selected')).toContainText('run');expect(errors).toEqual([]);
});

test('raised satin adds an underlay under a satin column',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#path').click();const m=await ctm(page);for(const [x,y] of [[-20,0],[0,0],[20,0]]){const s=toScreen(m,x,y);await page.mouse.click(s.x,s.y);}await page.keyboard.press('Enter');
 await page.locator('#type').selectOption('satin');await expect(page.locator('#satinRaisedRow')).toBeVisible();
 const count=async()=>Number(((await page.locator('#count').textContent()).match(/^([\d,]+) stitches/)||[,'0'])[1].replace(/,/g,''));
 const flat=await count();await page.locator('#satinRaised').check();
 await expect.poll(count).toBeGreaterThan(flat);expect(errors).toEqual([]);
});

test('redwork run sews the path out and back',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#path').click();const m=await ctm(page);for(const [x,y] of [[-20,0],[0,0],[20,0]]){const s=toScreen(m,x,y);await page.mouse.click(s.x,s.y);}await page.keyboard.press('Enter');
 await expect(page.locator('#runStyleRow')).toBeVisible();
 const count=async()=>Number(((await page.locator('#count').textContent()).match(/^([\d,]+) stitches/)||[,'0'])[1].replace(/,/g,''));
 const single=await count();await page.locator('#runStyle').selectOption('redwork');
 await expect.poll(count).toBeGreaterThan(single*1.8);expect(errors).toEqual([]);
});

test('buttonhole satin adds bar tacks at both ends',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#path').click();const m=await ctm(page);for(const [x,y] of [[-15,0],[15,0]]){const s=toScreen(m,x,y);await page.mouse.click(s.x,s.y);}await page.keyboard.press('Enter');
 await page.locator('#type').selectOption('satin');await expect(page.locator('#satinButtonholeRow')).toBeVisible();
 const count=async()=>Number(((await page.locator('#count').textContent()).match(/^([\d,]+) stitches/)||[,'0'])[1].replace(/,/g,''));
 const plain=await count();await page.locator('#satinButtonhole').check();
 await expect.poll(count).toBeGreaterThan(plain+8);expect(errors).toEqual([]);
});

test('motif loops are a stitch type that loops along the path',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#path').click();const m=await ctm(page);for(const [x,y] of [[-20,0],[20,0]]){const s=toScreen(m,x,y);await page.mouse.click(s.x,s.y);}await page.keyboard.press('Enter');
 const count=async()=>Number(((await page.locator('#count').textContent()).match(/^([\d,]+) stitches/)||[,'0'])[1].replace(/,/g,''));
 const run=await count();await page.locator('#type').selectOption('motif');
 await expect.poll(count).toBeGreaterThan(run*3);expect(errors).toEqual([]);
});

test('paired motif loops follow the width of the path',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#path').click();const m=await ctm(page);for(const [x,y] of [[-20,0],[20,0]]){const s=toScreen(m,x,y);await page.mouse.click(s.x,s.y);}await page.keyboard.press('Enter');
 await page.locator('#type').selectOption('motif');await expect(page.locator('#motifPairRow')).toBeVisible();
 const count=async()=>Number(((await page.locator('#count').textContent()).match(/^([\d,]+) stitches/)||[,'0'])[1].replace(/,/g,''));
 const single=await count();await page.locator('#motifPair').check();
 await expect.poll(count).toBeGreaterThan(single*1.8);expect(errors).toEqual([]);
});

test('motif fill fills a closed shape with loops',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#path').click();const m=await ctm(page);for(const [x,y] of [[-20,-20],[20,-20],[20,20]]){const s=toScreen(m,x,y);await page.mouse.click(s.x,s.y);}
 const first=toScreen(m,-20,-20);await page.mouse.click(first.x,first.y);
 const count=async()=>Number(((await page.locator('#count').textContent()).match(/^([\d,]+) stitches/)||[,'0'])[1].replace(/,/g,''));
 const rows=await count();await page.locator('#fillMethod').selectOption('motif');
 await expect.poll(count).toBeGreaterThan(rows*2);expect(errors).toEqual([]);
});

test('fill pattern buttons include motif loops inside the panel',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#path').click();const m=await ctm(page);for(const [x,y] of [[-20,-20],[20,-20],[20,20]]){const s=toScreen(m,x,y);await page.mouse.click(s.x,s.y);}
 const first=toScreen(m,-20,-20);await page.mouse.click(first.x,first.y);
 const motif=page.locator('#fillMethod + .icon-seg button[data-value=motif]');await expect(motif).toBeVisible();
 const box=await motif.boundingBox();const panel=await page.locator('.layout > aside.panel').last().boundingBox();
 expect(box.x+box.width).toBeLessThanOrEqual(panel.x+panel.width);
 await motif.click();await expect(motif).toHaveAttribute('aria-pressed','true');expect(errors).toEqual([]);
});

test('motif spacing can be changed in the panel and sews more loops when smaller',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#path').click();const m=await ctm(page);for(const [x,y] of [[-20,0],[20,0]]){const s=toScreen(m,x,y);await page.mouse.click(s.x,s.y);}await page.keyboard.press('Enter');
 await page.locator('#type').selectOption('motif');await expect(page.locator('#motifSpacingRow')).toBeVisible();
 const count=async()=>Number(((await page.locator('#count').textContent()).match(/^([\d,]+) stitches/)||[,'0'])[1].replace(/,/g,''));
 const wide=await count();await page.locator('#motifSpacing').fill('2');await page.locator('#motifSpacing').press('Tab');
 await expect.poll(count).toBeGreaterThan(wide*1.6);expect(errors).toEqual([]);
});

test('sequins are a stitch type that sews fixing loops along the path',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#path').click();const m=await ctm(page);for(const [x,y] of [[-20,0],[20,0]]){const s=toScreen(m,x,y);await page.mouse.click(s.x,s.y);}await page.keyboard.press('Enter');
 const count=async()=>Number(((await page.locator('#count').textContent()).match(/^([\d,]+) stitches/)||[,'0'])[1].replace(/,/g,''));
 const run=await count();await page.locator('#type').selectOption('sequin');
 await expect(page.locator('#motifSpacingRow')).toBeVisible();await expect.poll(count).toBeGreaterThan(run*2);expect(errors).toEqual([]);
});

test('beads are a stitch type that sews passes across the path',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#path').click();const m=await ctm(page);for(const [x,y] of [[-20,0],[20,0]]){const s=toScreen(m,x,y);await page.mouse.click(s.x,s.y);}await page.keyboard.press('Enter');
 const count=async()=>Number(((await page.locator('#count').textContent()).match(/^([\d,]+) stitches/)||[,'0'])[1].replace(/,/g,''));
 const run=await count();await page.locator('#type').selectOption('bead');
 await expect(page.locator('#motifSpacingRow')).toBeVisible();await expect.poll(count).toBeGreaterThan(run);expect(errors).toEqual([]);
});

test('bling is a stitch type that sews stones along the path',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#path').click();const m=await ctm(page);for(const [x,y] of [[-20,0],[20,0]]){const s=toScreen(m,x,y);await page.mouse.click(s.x,s.y);}await page.keyboard.press('Enter');
 const count=async()=>Number(((await page.locator('#count').textContent()).match(/^([\d,]+) stitches/)||[,'0'])[1].replace(/,/g,''));
 const run=await count();await page.locator('#type').selectOption('bling');
 await expect(page.locator('#motifSpacingRow')).toBeVisible();await expect.poll(count).toBeGreaterThan(run*2);expect(errors).toEqual([]);
});

test('batch plan in the Array section says how many copies fit one hoop',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#rect').click();await page.locator('#secArray summary').click();
 await expect(page.locator('#batchInfo')).toContainText('copies fit one');
 await page.locator('#arrCount').fill('400');await page.locator('#arrCount').press('Tab');
 await expect(page.locator('#batchInfo')).toContainText('400 copies');
 expect(errors).toEqual([]);
});

test('batch export downloads one JEF file per hoop',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#rect').click();await page.locator('#secArray summary').click();await page.locator('#arrCount').fill('3');await page.locator('#arrCount').press('Tab');
 const download=page.waitForEvent('download');await page.locator('#batchExport').click();
 const file=await download;expect(file.suggestedFilename()).toMatch(/-hoop1\.jef$/);expect(errors).toEqual([]);
});

test('EXP is an export format and downloads as an .exp file',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#rect').click();await page.locator('#export').click();await page.locator('#format').selectOption('exp');
 const download=page.waitForEvent('download');await page.locator('#download').click();
 expect((await download).suggestedFilename()).toMatch(/\.exp$/);expect(errors).toEqual([]);
});

test('PEC is an export format and downloads as a .pec file',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#rect').click();await page.locator('#export').click();await page.locator('#format').selectOption('pec');
 const download=page.waitForEvent('download');await page.locator('#download').click();
 expect((await download).suggestedFilename()).toMatch(/\.pec$/);expect(errors).toEqual([]);
});

test('PES is an export format and downloads as a .pes file',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#rect').click();await page.locator('#export').click();await page.locator('#format').selectOption('pes');
 const download=page.waitForEvent('download');await page.locator('#download').click();
 expect((await download).suggestedFilename()).toMatch(/\.pes$/);expect(errors).toEqual([]);
});

test('paired motif loops can taper with the end width in the panel',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');page.on('dialog',d=>d.accept());await page.locator('#new').click();
 await page.locator('#path').click();const m=await ctm(page);for(const [x,y] of [[-20,0],[20,0]]){const s=toScreen(m,x,y);await page.mouse.click(s.x,s.y);}await page.keyboard.press('Enter');
 await page.locator('#type').selectOption('motif');await page.locator('#motifPair').check();
 await expect(page.locator('#satinEndRow')).toBeVisible();await page.locator('#satinWidthEnd').fill('8');await page.locator('#satinWidthEnd').press('Tab');
 await expect(page.locator('#satinWidthEnd')).toHaveValue('8');expect(errors).toEqual([]);
});
