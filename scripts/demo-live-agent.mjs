// End-to-end demo against a running Welcome server: a headless browser tab mints an agent link, an MCP client draws on the live document.
// WELCOME_URL=https://host node scripts/demo-live-agent.mjs [screenshot.png]
import {chromium} from '@playwright/test';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const base=process.env.WELCOME_URL||'http://127.0.0.1:8787',shot=process.argv[2]||'/tmp/welcome-live-agent.png';
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']}),page=await browser.newPage({viewport:{width:1600,height:1000}});
page.on('dialog',d=>d.accept());await page.goto(base+'/',{waitUntil:'networkidle'});await page.locator('#new').click();
await page.locator('#copyEndpoint').click();await page.waitForFunction(()=>document.querySelector('#agentUrl').value.includes('/mcp/'));
const link=await page.locator('#agentUrl').inputValue();const client=new Client({name:'demo-agent',version:'1'});await client.connect(new StreamableHTTPClientTransport(new URL(link)));
const call=async(name,args)=>{const r=await client.callTool({name,arguments:args});if(r.isError)throw Error(r.content[0].text);return r.structuredContent;};
let rev=(await call('document_inspect',{documentId:'live'})).revision;
for(const operations of [
 [{op:'set_hoop',width:100,height:100},{op:'add_shape',id:'petal',name:'Petal',kind:'ellipse',x:-5,y:-31,width:10,height:20,thread:'#d9897e'},{op:'array',id:'petal',mode:'radial',count:10,cx:0,cy:0},{op:'add_shape',id:'core',name:'Core',kind:'ellipse',x:-8,y:-8,width:16,height:16,thread:'#d3ad61'}],
 [{op:'add_path',id:'ring',name:'Ring',x:0,y:0,points:[[38.0,0.0],[37.675,4.96],[36.705,9.835],[35.107,14.542],[32.909,19.0],[30.147,23.133],[26.87,26.87],[23.133,30.147],[19.0,32.909],[14.542,35.107],[9.835,36.705],[4.96,37.675],[0.0,38.0],[-4.96,37.675],[-9.835,36.705],[-14.542,35.107],[-19.0,32.909],[-23.133,30.147],[-26.87,26.87],[-30.147,23.133],[-32.909,19.0],[-35.107,14.542],[-36.705,9.835],[-37.675,4.96],[-38.0,0.0],[-37.675,-4.96],[-36.705,-9.835],[-35.107,-14.542],[-32.909,-19.0],[-30.147,-23.133],[-26.87,-26.87],[-23.133,-30.147],[-19.0,-32.909],[-14.542,-35.107],[-9.835,-36.705],[-4.96,-37.675],[-0.0,-38.0],[4.96,-37.675],[9.835,-36.705],[14.542,-35.107],[19.0,-32.909],[23.133,-30.147],[26.87,-26.87],[30.147,-23.133],[32.909,-19.0],[35.107,-14.542],[36.705,-9.835],[37.675,-4.96]],closed:true,stitch:'run',thread:'#527461'},{op:'stroke_to_shape',id:'ring',width:2.4},{op:'set_object',id:'core',angle:90,spacing:.3}],
 [{op:'offset',id:'core',distance:-2},{op:'sort_by_color'},{op:'set_settings',ties:true,trims:true}]]){rev=(await call('document_apply',{documentId:'live',expectedRevision:rev,operations})).revision;await page.waitForTimeout(700);}
await page.locator('#agentDialog button:not([type=button])').click().catch(()=>{});await page.locator('[data-view=preview]').click();await page.waitForSelector('#preview3d[data-instances], #stitches .thread-body',{timeout:15000});await page.waitForTimeout(500);
const exported=await call('embroidery_export',{documentId:'live',expectedRevision:rev,format:'jef'});await page.screenshot({path:shot});
console.log(JSON.stringify({objects:await page.locator('.object-row').count(),stitches:exported.stitches,artifact:exported.artifactUrl,screenshot:shot}));await client.close();await browser.close();
