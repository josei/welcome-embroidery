import path from 'node:path';
import fs from 'node:fs/promises';

// Design exports (machine files, SVG, worksheets, previews) written to the artifacts folder expire this many days
// after they were written. Override with WELCOME_EXPORT_RETENTION_DAYS (a positive number of days).
// Saved documents (document_save, *.welcome) are never matched by the sweep: they may be the user's own work.
export const DEFAULT_EXPORT_RETENTION_DAYS=7;

export const exportRetentionDays=raw=>{const days=Number(raw);return raw!==undefined&&raw!==''&&Number.isFinite(days)&&days>0?days:DEFAULT_EXPORT_RETENTION_DAYS;};

// Only UUID-named export files. Saved documents (.welcome) are deliberately absent from this list.
const EXPORT_NAME=/^[0-9a-f-]{36}\.(jef|vp3|dst|sew|svg|txt)$/;

// Deletes export files whose mtime is older than maxAgeMs. Returns the names it removed.
export const sweepExports=async(dir,{maxAgeMs,now=Date.now()})=>{
 const removed=[];
 for(const name of await fs.readdir(dir).catch(()=>[])){
  if(!EXPORT_NAME.test(name))continue;
  const file=path.join(dir,name);
  const st=await fs.stat(file).catch(()=>null);
  if(!st?.isFile()||now-st.mtimeMs<=maxAgeMs)continue;
  if(await fs.unlink(file).then(()=>true,()=>false))removed.push(name);
 }
 return removed;
};

// Sweeps once now (startup) and then hourly while the process runs. The timer is unref'd so it never keeps the process alive.
export const startExportSweep=(dir,{days=DEFAULT_EXPORT_RETENTION_DAYS,intervalMs=60*60*1000}={})=>{
 const maxAgeMs=days*24*60*60*1000;
 const run=()=>sweepExports(dir,{maxAgeMs}).catch(error=>console.error(`Export sweep failed: ${error.message}`));
 const first=run();
 const timer=setInterval(run,intervalMs);
 timer.unref();
 return {first,timer};
};
