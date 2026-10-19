// Reproducible AI-client acceptance example. All design edits use the public MCP.
// MCP_URL=https://<your-host>/mcp node scripts/create-mcp-example.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const endpoint=new URL(process.env.MCP_URL||'http://127.0.0.1:8787/mcp');
const output=process.env.WELCOME_EVIDENCE_DIR||'/tmp/welcom-mcp-example';
const neon=process.env.WELCOME_EXAMPLE_FONT==='neon';
const client=new Client({name:'welcome-supervisor-design-agent',version:'1.0.0'});
async function call(name,args){
 const result=await client.callTool({name,arguments:args});
 assert.ok(!result.isError,`${name}: ${JSON.stringify(result.content)}`);
 assert.ok(result.structuredContent,`${name} omitted structured result`);
 return result.structuredContent;
}
try{
 await client.connect(new StreamableHTTPClientTransport(endpoint));
 const listed=await client.listTools();
 const created=await call('document_create',{name:'Agent garden badge',hoop:110});
 const documentId=created.documentId;
 const operations=[{op:'set_settings',spacing:.45,angle:35,underlay:true,compensation:.15}];
 // Same-thread foliage first, then petals, center, lettering: explicit sewing order.
 operations.push({op:'add_shape',id:'stem',kind:'rect',name:'Stem',x:-.7,y:-4,width:1.4,height:22,thread:'#527461',stitch:'fill'});
 operations.push({op:'add_shape',id:'leaf-left',kind:'ellipse',name:'Left leaf',x:-18,y:4,width:17,height:7,thread:'#527461',stitch:'fill'});
 operations.push({op:'add_shape',id:'leaf-right',kind:'ellipse',name:'Right leaf',x:1,y:9,width:17,height:7,thread:'#527461',stitch:'fill'});
 const petals=[[-8,-31],[-19,-21],[3,-21],[-14,-10],[-2,-10]];
 for(let i=0;i<petals.length;i++)operations.push({op:'add_shape',id:`petal-${i}`,kind:'ellipse',name:`Coral petal ${i+1}`,x:petals[i][0],y:petals[i][1],width:16,height:16,thread:'#d9897e',stitch:'fill'});
 operations.push({op:'add_shape',id:'center',kind:'ellipse',name:'Honey center',x:-6,y:-18,width:12,height:12,thread:'#d3ad61',stitch:'fill'});
 operations.push(neon
  ? {op:'add_text',id:'word',text:'BLOOM',font:'neon-blinking/1',x:-35,y:35,width:70,height:20,thread:'#527461'}
  : {op:'add_text',id:'word',text:'WELCOM',x:-21,y:32,width:42,height:8,thread:'#527461'});
 const edited=await call('document_apply',{documentId,expectedRevision:created.revision,operations});
 const revision=edited.revision;
 const plan=await call('embroidery_compile',{documentId,expectedRevision:revision});
 assert.ok(plan.count>100);assert.deepEqual(plan.errors,[]);
 await fs.mkdir(output,{recursive:true});
 const artifacts={};
 for(const format of ['jef','vp3']){
  const artifact=await call('embroidery_export',{documentId,expectedRevision:revision,format});
  const url=new URL(artifact.artifactUrl,endpoint);
  const response=await fetch(url);assert.equal(response.status,200);
  const bytes=new Uint8Array(await response.arrayBuffer());assert.ok(bytes.length>500);
  await fs.writeFile(`${output}/agent-garden.${format}`,bytes);
  artifacts[format]=url.href;
 }
 const saved=await call('document_save',{documentId});
 const sourceUrl=new URL(saved.artifactUrl,endpoint);
 const response=await fetch(sourceUrl);assert.equal(response.status,200);
 const source=await response.json();assert.equal(source.objects.length,10);
 await fs.writeFile(`${output}/agent-garden.welcome`,JSON.stringify(source,null,2));
 const result={endpoint:endpoint.href,toolCount:listed.tools.length,documentId,revision,stitches:plan.count,bounds:plan.bounds,artifacts,source:sourceUrl.href,openUrl:saved.openUrl?new URL(saved.openUrl,endpoint).href:null};
 await fs.writeFile(`${output}/result.json`,JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
}finally{await client.close();}
