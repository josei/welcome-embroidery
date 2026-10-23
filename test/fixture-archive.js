import {readFileSync} from 'node:fs';
import {inflateRawSync} from 'node:zlib';

const archive=readFileSync(new URL('../fixtures/embroidepy/samples.zip',import.meta.url));
export function readMachineFixtures(){
  let eocd=-1;
  for(let p=archive.length-22;p>=Math.max(0,archive.length-65557);p--)if(archive.readUInt32LE(p)===0x06054b50){eocd=p;break;}
  if(eocd<0)throw Error('Pinned fixture ZIP has no central directory.');
  const count=archive.readUInt16LE(eocd+10),central=archive.readUInt32LE(eocd+16),files=new Map();let p=central;
  for(let i=0;i<count;i++){
    if(archive.readUInt32LE(p)!==0x02014b50)throw Error('Pinned fixture ZIP central directory is corrupt.');
    const method=archive.readUInt16LE(p+10),packedLength=archive.readUInt32LE(p+20),nameLength=archive.readUInt16LE(p+28),extraLength=archive.readUInt16LE(p+30),commentLength=archive.readUInt16LE(p+32),local=archive.readUInt32LE(p+42),name=archive.subarray(p+46,p+46+nameLength).toString('utf8');
    if(/\.(jef|vp3|sew|pec|exp)$/i.test(name)){
      if(archive.readUInt32LE(local)!==0x04034b50)throw Error(`Pinned fixture entry is corrupt: ${name}`);
      const start=local+30+archive.readUInt16LE(local+26)+archive.readUInt16LE(local+28),slice=archive.subarray(start,start+packedLength);
      const bytes=method===0?Buffer.from(slice):method===8?inflateRawSync(slice):null;if(!bytes)throw Error(`Unsupported fixture compression method ${method}.`);
      files.set(name,new Uint8Array(bytes));
    }
    p+=46+nameLength+extraLength+commentLength;
  }
  return files;
}
export function pinnedMachineFixture(format='jef'){
  const item=[...readMachineFixtures()].find(([name])=>name.toLowerCase().endsWith(`.${format}`));
  if(!item)throw Error(`No pinned ${format.toUpperCase()} fixture is available.`);
  return {fileName:item[0],bytes:item[1]};
}
