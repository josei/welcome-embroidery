import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeEmbroidery} from '../src/readers.js';

const archive = readFileSync(new URL('../fixtures/embroidepy/samples.zip', import.meta.url));
const oracle = JSON.parse(readFileSync(new URL('../scripts/reader-parity.json', import.meta.url), 'utf8'));
const sha = b => createHash('sha256').update(b).digest('hex');
const canonical = v => JSON.stringify(v);

function zipEntries(bytes, accept=name=>/\.(jef|vp3)$/i.test(name)) {
  let eocd=-1;
  for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--) if(bytes.readUInt32LE(p)===0x06054b50){eocd=p;break;}
  assert.notEqual(eocd,-1,'fixture ZIP has end-of-central-directory record');
  const count=bytes.readUInt16LE(eocd+10), central=bytes.readUInt32LE(eocd+16), entries=new Map(); let p=central;
  for(let i=0;i<count;i++){
    assert.equal(bytes.readUInt32LE(p),0x02014b50,'valid ZIP central directory');
    const method=bytes.readUInt16LE(p+10), compressed=bytes.readUInt32LE(p+20), nameLen=bytes.readUInt16LE(p+28), extraLen=bytes.readUInt16LE(p+30), commentLen=bytes.readUInt16LE(p+32), local=bytes.readUInt32LE(p+42);
    const name=bytes.subarray(p+46,p+46+nameLen).toString('utf8');
    if(accept(name)){
      assert.equal(bytes.readUInt32LE(local),0x04034b50,'valid ZIP local record');
      const localName=bytes.readUInt16LE(local+26),localExtra=bytes.readUInt16LE(local+28),start=local+30+localName+localExtra;
      const packed=bytes.subarray(start,start+compressed);
      const data=method===0?Buffer.from(packed):method===8?inflateRawSync(packed):assert.fail(`unsupported ZIP compression ${method}`);
      entries.set(name,new Uint8Array(data));
    }
    p+=46+nameLen+extraLen+commentLen;
  }
  return entries;
}
const files=zipEntries(archive);
const round = n => Math.round(n*10000)/10000;
const cmdList = d => d.stitches.map(s=>[Math.round(s.x*10000),Math.round(s.y*10000),s.cmd]);

function secondBlockOrigin(bytes, x, y) {
  const out=Buffer.from(bytes); let p=6;
  const skip16=()=>{const n=out.readUInt16BE(p);p+=2+n;};
  skip16();p+=7;skip16();p+=32;
  const centerX=out.readInt32BE(p)/100;p+=4;
  const centerY=-out.readInt32BE(p)/100;p+=4;
  p+=27;skip16();p+=24;skip16();
  const count=out.readUInt16BE(p);p+=2;assert.ok(count>=2,'fixture has multiple color blocks');
  const firstLength=out.readUInt32BE(p+3), second=p+7+firstLength;
  assert.deepEqual([...out.subarray(second,second+3)],[0,5,0],'second VP3 block marker');
  out.writeInt32BE(Math.round((x-centerX)*100),second+7);
  out.writeInt32BE(Math.round((centerY-y)*100),second+11);
  return new Uint8Array(out);
}

test('all 43 pinned JEF and VP3 fixtures match corrected pystitch command and coordinate digests',()=>{
  assert.equal(oracle.schema,'welcom/reader-parity/1');
  assert.equal(oracle.commit,'b72b557f2ebb1fdc51f30edc3c73ff6a851ea015');
  assert.equal(files.size,43);
  assert.equal(oracle.fixtures.length,43);
  for(const fixture of oracle.fixtures){
    const bytes=files.get(fixture.path); assert.ok(bytes,fixture.path);
    assert.equal(sha(bytes),fixture.sha256,`${fixture.path} fixture pin`);
    const decoded=decodeEmbroidery(bytes,fixture.format);
    assert.equal(decoded.stitches.length,fixture.stitchCount,`${fixture.path} command count`);
    assert.equal(sha(Buffer.from(canonical(cmdList(decoded)))),fixture.commandsSha256,`${fixture.path} command/coordinate parity`);
    assert.equal(fixture.originCorrectionDiffers,fixture.rawCommandsSha256!==fixture.commandsSha256,`${fixture.path} documents raw VP3-origin divergence`);
    assert.deepEqual(decoded.bounds.map(round),fixture.bounds,`${fixture.path} stitch bounds`);
    assert.deepEqual(decoded.threads.map(t=>t.color),fixture.threads,`${fixture.path} thread colors/order`);
  }
});

const sewParity=JSON.parse(readFileSync(new URL('../scripts/sew-parity.json', import.meta.url),'utf8'));
test('all 15 pinned SEW samples decode to the pyembroidery command and coordinate digests',()=>{
  assert.equal(sewParity.schema,'welcom/sew-parity/1');
  const sewFiles=zipEntries(archive,name=>/\.sew$/i.test(name));
  assert.equal(sewFiles.size,15);
  assert.equal(sewParity.fixtures.length,15);
  for(const fixture of sewParity.fixtures){
    const bytes=sewFiles.get(fixture.path); assert.ok(bytes,fixture.path);
    assert.equal(sha(bytes),fixture.sha256,`${fixture.path} fixture pin`);
    const decoded=decodeEmbroidery(bytes,'sew');
    const counts={};for(const s of decoded.stitches)counts[s.cmd]=(counts[s.cmd]||0)+1;
    assert.deepEqual(counts,fixture.commandCounts,`${fixture.path} command counts`);
    assert.equal(decoded.threads.length,fixture.threads,`${fixture.path} thread count`);
    assert.equal(sha(Buffer.from(canonical(decoded.stitches.map(s=>[Math.round(s.x*10),Math.round(s.y*10),s.cmd])))),fixture.commandsSha256,`${fixture.path} command/coordinate parity`);
  }
});

const pecParity=JSON.parse(readFileSync(new URL('../scripts/pec-parity.json', import.meta.url),'utf8'));
test('all 25 pinned PEC samples decode to the pyembroidery command, thread and coordinate digests',()=>{
  assert.equal(pecParity.schema,'welcom/pec-parity/1');
  const pecFiles=zipEntries(archive,name=>/\.pec$/i.test(name));
  assert.equal(pecFiles.size,25);
  assert.equal(pecParity.fixtures.length,25);
  for(const fixture of pecParity.fixtures){
    const bytes=pecFiles.get(fixture.path); assert.ok(bytes,fixture.path);
    assert.equal(sha(bytes),fixture.sha256,`${fixture.path} fixture pin`);
    const decoded=decodeEmbroidery(bytes,'pec');
    const counts={};for(const s of decoded.stitches)counts[s.cmd]=(counts[s.cmd]||0)+1;
    assert.deepEqual(counts,fixture.commandCounts,`${fixture.path} command counts`);
    assert.equal(decoded.threads.length,fixture.threads,`${fixture.path} thread count`);
    assert.equal(sha(Buffer.from(canonical(decoded.stitches.map(s=>[Math.round(s.x*10),Math.round(s.y*10),s.cmd])))),fixture.commandsSha256,`${fixture.path} command/coordinate parity`);
  }
});

const pesParity=JSON.parse(readFileSync(new URL('../scripts/pes-parity.json', import.meta.url),'utf8'));
test('all 73 pinned PES samples (versions 1 to 10) decode to the pyembroidery command, thread and coordinate digests',()=>{
  assert.equal(pesParity.schema,'welcom/pes-parity/1');
  const pesFiles=zipEntries(archive,name=>/\.pes$/i.test(name));
  assert.equal(pesFiles.size,73);
  assert.equal(pesParity.fixtures.length,73);
  for(const fixture of pesParity.fixtures){
    const bytes=pesFiles.get(fixture.path); assert.ok(bytes,fixture.path);
    assert.equal(sha(bytes),fixture.sha256,`${fixture.path} fixture pin`);
    const decoded=decodeEmbroidery(bytes,'pes');
    const counts={};for(const s of decoded.stitches)counts[s.cmd]=(counts[s.cmd]||0)+1;
    assert.deepEqual(counts,fixture.commandCounts,`${fixture.path} command counts`);
    assert.equal(decoded.threads.length,fixture.threads,`${fixture.path} thread count`);
    assert.equal(sha(Buffer.from(canonical(decoded.stitches.map(s=>[Math.round(s.x*10),Math.round(s.y*10),s.cmd])))),fixture.commandsSha256,`${fixture.path} command/coordinate parity`);
  }
});
assert.throws(()=>decodeEmbroidery(new Uint8Array(12),'pes'),/signature/);
const expParity=JSON.parse(readFileSync(new URL('../scripts/exp-parity.json', import.meta.url),'utf8'));
test('all 35 pinned EXP samples decode to the pyembroidery command, colour block and coordinate digests',()=>{
  assert.equal(expParity.schema,'welcom/exp-parity/1');
  const expFiles=zipEntries(archive,name=>/\.exp$/i.test(name));
  assert.equal(expFiles.size,35);
  assert.equal(expParity.fixtures.length,35);
  for(const fixture of expParity.fixtures){
    const bytes=expFiles.get(fixture.path); assert.ok(bytes,fixture.path);
    assert.equal(sha(bytes),fixture.sha256,`${fixture.path} fixture pin`);
    const decoded=decodeEmbroidery(bytes,'exp');
    const counts={};for(const s of decoded.stitches)counts[s.cmd]=(counts[s.cmd]||0)+1;
    assert.deepEqual(counts,fixture.commandCounts,`${fixture.path} command counts`);
    assert.equal(decoded.threads.length,fixture.threads,`${fixture.path} colour block count`);
    assert.equal(sha(Buffer.from(canonical(decoded.stitches.map(s=>[Math.round(s.x*10),Math.round(s.y*10),s.cmd])))),fixture.commandsSha256,`${fixture.path} command/coordinate parity`);
  }
});

test('PEC signature, label and truncated headers are rejected',()=>{
  assert.throws(()=>decodeEmbroidery(new Uint8Array(0x217),'pec'),/truncated/);
  assert.throws(()=>decodeEmbroidery(new Uint8Array(0x218),'pec'),/signature/);
});

test('SEW colour count and truncated headers are rejected',()=>{
  assert.throws(()=>decodeEmbroidery(new Uint8Array(0x1D78-1),'sew'),/truncated/);
  const none=new Uint8Array(0x1D78);
  assert.throws(()=>decodeEmbroidery(none,'sew'),/colour count/);
  none[0]=1;
  assert.throws(()=>decodeEmbroidery(none,'sew'),/no stitch commands|no sewable/);
});

test('validates input type, format, truncation, size, and malformed control data',()=>{
  assert.throws(()=>decodeEmbroidery(new Uint8Array(0),'jef'),/truncated/);
  assert.throws(()=>decodeEmbroidery(new Uint8Array(10),'vp3'),/truncated/);
  assert.throws(()=>decodeEmbroidery(new Uint8Array(32),'emb'),/format/);
  assert.throws(()=>decodeEmbroidery(new ArrayBuffer(0),'jef'),/truncated/);
  assert.throws(()=>decodeEmbroidery(new Array(8),'jef'),/Uint8Array/);
  assert.throws(()=>decodeEmbroidery(new Uint8Array(64*1024*1024+1),'jef'),/64 MiB/);
});

test('JEF null palette entries become STOP commands and leave no corpus STOPs undocumented',()=>{
  assert.ok(oracle.fixtures.filter(f=>f.format==='jef').every(f=>!f.commandCounts.stop),'pinned corpus has no genuine STOP entries');
  const fixture=oracle.fixtures.find(f=>f.path.endsWith('/random1-ew.jef'));
  const synthetic=Buffer.from(files.get(fixture.path));
  synthetic.writeUInt32LE(0,120); // second JEF palette ID: force a color-change STOP
  const design=decodeEmbroidery(synthetic,'jef');
  assert.equal(design.stitches.filter(s=>s.cmd==='stop').length,1);
  assert.equal(design.threads.length,fixture.threads.length-1,'null STOP entry is removed from ordered threads');
});

test('VP3 second block origin resets both axes to zero and preserves no-op moves',()=>{
  const fixture=oracle.fixtures.find(f=>f.path.endsWith('/random1-me.vp3'));
  const synthetic=secondBlockOrigin(files.get(fixture.path),0,0);
  const design=decodeEmbroidery(synthetic,'vp3');
  const colorIndex=design.stitches.findIndex(s=>s.cmd==='color');
  assert.ok(colorIndex>=0,'the fixture contains a second color block');
  assert.notDeepEqual([design.stitches[colorIndex].x,design.stitches[colorIndex].y],[0,0],'first block ends away from the origin');
  assert.deepEqual([design.stitches[colorIndex+1].cmd,design.stitches[colorIndex+1].x,design.stitches[colorIndex+1].y],['jump',0,0],'second block move_abs returns to both zero axes');
  const hasNoOp=oracle.fixtures.filter(f=>f.format==='vp3').some(f=>{
    const d=decodeEmbroidery(files.get(f.path),'vp3');
    return d.stitches.some((s,i)=>s.cmd==='color'&&d.stitches[i+1]?.cmd==='jump'&&s.x===d.stitches[i+1].x&&s.y===d.stitches[i+1].y);
  });
  assert.ok(hasNoOp,'block-origin move_abs is retained as a no-op jump when position is unchanged');
});
