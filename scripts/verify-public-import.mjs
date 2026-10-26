// Independent public acceptance: real MCP imports, retained bytes, edited exports.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {pinnedMachineFixture} from '../test/fixture-archive.js';

if (!process.env.MCP_URL) throw new Error('Set MCP_URL to the public /mcp endpoint');
const endpoint = new URL(process.env.MCP_URL);
const evidence = process.env.WELCOME_EVIDENCE_DIR || '/tmp/welcome-public-import';
await fs.mkdir(evidence, {recursive:true});
const client = new Client({name:'welcome-import-acceptance',version:'1.0.0'});
const result = {endpoint:endpoint.href,imports:[]};
async function call(name,args) {
  const response=await client.callTool({name,arguments:args});
  assert.ok(!response.isError,JSON.stringify(response));
  return response.structuredContent;
}
async function download(url,name) {
  const response=await fetch(new URL(url,endpoint));
  assert.equal(response.status,200);
  const bytes=Buffer.from(await response.arrayBuffer());
  await fs.writeFile(path.join(evidence,name),bytes);
  return bytes;
}
try {
  await client.connect(new StreamableHTTPClientTransport(endpoint));
  const listed=await client.listTools();
  assert.ok(listed.tools.some(t=>t.name==='document_import_embroidery'));
  result.tools=listed.tools.length;
  for(const format of ['jef','vp3']) {
    const fixture=pinnedMachineFixture(format);
    const created=await call('document_create',{name:`Agent imported ${format.toUpperCase()} sample`,hoop:110});
    const documentId=created.documentId;
    const imported=await call('document_import_embroidery',{
      documentId,expectedRevision:0,fileName:fixture.fileName,format,
      dataBase64:Buffer.from(fixture.bytes).toString('base64')
    });
    assert.equal(imported.revision,1);
    assert.equal(imported.object.kind,'stitch_layer');
    const untouched=await call('embroidery_export',{documentId,expectedRevision:1,format});
    const retained=await download(untouched.artifactUrl,`untouched.${format}`);
    assert.deepEqual(retained,Buffer.from(fixture.bytes));
    await call('document_apply',{documentId,expectedRevision:1,operations:[{
      op:'transform',id:imported.object.id,x:imported.object.x+1,y:imported.object.y-1,
      width:imported.object.w*.8,height:imported.object.h*.8,rotation:3
    }]});
    const plan=await call('embroidery_compile',{documentId,expectedRevision:2});
    assert.deepEqual(plan.errors,[]);
    const output=await call('embroidery_export',{documentId,expectedRevision:2,format});
    await download(output.artifactUrl,`edited.${format}`);
    await fs.writeFile(path.join(evidence,`edited-${format}-expected.json`),JSON.stringify(plan.stitches.filter(s=>s.cmd==='stitch').map(s=>[s.x,s.y])));
    const saved=await call('document_save',{documentId});
    const source=JSON.parse(await download(saved.artifactUrl,`imported-${format}.welcome`));
    assert.equal(source.objects[0].source.originalBytesBase64,Buffer.from(fixture.bytes).toString('base64'));
    result.imports.push({format,fixture:fixture.fileName,stitches:plan.count,
      byteExactUntouched:true,openUrl:new URL(saved.openUrl,endpoint).href,
      machineUrl:new URL(output.artifactUrl,endpoint).href});
  }
  await fs.writeFile(path.join(evidence,'result.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
} finally { await client.close(); }
