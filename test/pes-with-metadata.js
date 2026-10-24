// Writes PES header metadata (name, category, author, keywords, comments) into a version 4+ sample. The five empty fields sit at bytes 16 to 20, so the PEC block moves by the difference in length and its offset in bytes 8 to 11 is updated to match.
export function withPesMetadata(bytes, fields){
  if(!Array.isArray(bytes)&&!(bytes instanceof Uint8Array))throw Error('PES bytes expected');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(bytes.subarray(16,21).some(v=>v!==0))throw Error('the sample does not have five empty metadata fields at bytes 16 to 20');
  const meta=[];
  for(const key of ['name','category','author','keywords','comments']){const b=new TextEncoder().encode(fields[key]||'');meta.push(b.length,...b);}
  const out=new Uint8Array(bytes.length-5+meta.length);
  out.set(bytes.subarray(0,16),0);out.set(meta,16);out.set(bytes.subarray(21),16+meta.length);
  new DataView(out.buffer).setUint32(8,view.getUint32(8,true)+meta.length-5,true);
  return out;
}
