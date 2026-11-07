// @ts-check
// Printable sewing worksheet: the thread blocks of a compiled plan in sewing order, with stitch counts, lengths and the time estimate.
// The engine re-exports sewingWorksheet, so callers keep importing it from engine.js.
import {threadPlan,sewingSeconds,sewingLabel,blockSeconds,blockTimeLabel} from './sewingTime.js';
import {hoopLabel,hoopSize} from './hoops.js';

// Printable sewing worksheet for a compiled plan: the thread blocks in sewing order with stitch counts, and the time estimate. Format 'text' or 'svg'. Threads
// are shown as hex values because the engine has no colour names.
/**
 * @param {{name?: string, hoop: number, hoopH?: number}} doc
 * @param {{stitches: Array<{x: number, y: number, cmd: string, thread: string}>, count: number, revision: number}} plan
 * @param {'text'|'svg'} [format]
 * @returns {string}
 */
export function sewingWorksheet(doc,plan,format='text'){
  if(format!=='text'&&format!=='svg')throw Error(`Unsupported worksheet format: ${format}. Choose text or svg.`);
  const blocks=threadPlan(plan),total=blocks.reduce((n,b)=>n+b.stitches,0),totalMm=blocks.reduce((n,b)=>n+b.mm,0),time=sewingLabel(sewingSeconds(plan)),name=
    doc.name||'Untitled',hoop=hoopLabel(hoopSize(doc)),fmt=/** @type {(n: number) => string} */(n=>n.toLocaleString('en-US')),
    metres=/** @type {(mm: number) => string} */(mm=>(mm/1000).toFixed(2));
  const note=`Estimate: about ${time} (600 stitches a minute, 20 s per colour change or stop, 8 s per trim).`;
  if(format==='text'){const rows=
    blocks.map((b,
    i)=>`${String(i+1).padStart(3)}  ${b.thread.padEnd(9)}  ${fmt(b.stitches).padStart(10)}  ${metres(b.mm).padStart(8)}  ` +
    `${blockTimeLabel(blockSeconds(b)).padStart(6)}`);
    return [`Sewing worksheet: ${name}`,`Hoop: ${hoop}`,`Revision ${plan.revision}`,
      '',`${'No.'.padStart(3)}  ${'Thread'.padEnd(9)}  ${'Stitches'.padStart(10)}  ${'Length (m)'.padStart(10)}  ${'Time'.padStart(6)}`,...rows,
      '',`Threads: ${blocks.length}   Stitches: ${fmt(total)}${blocks.length?`   Length: ${metres(totalMm)} m`:''}`,note,''].join('\n');}
  const esc=/** @type {(t: unknown) => string} */(t=>
    String(
    t).replace(/[&<>"]/g,c=>/** @type {Record<string, string>}
      */({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c])),rowH=8,top=24,H=top+blocks.length*rowH+22;
  const rows=
    blocks.map((b,i)=>
    {const y=top+i*rowH;
    return `<rect x="6" y="${y-4}" width="6" height="6" fill="${esc(b.thread)}" stroke="#333" stroke-width=".2"/><text x="16" y="${y+1}">${i+1}. ` +
    `${esc(b.thread)}</text><text x="98" y="${y+1}" text-anchor="end">${metres(b.mm)} m</text><text x="114" y="${y+1}" ` +
    `text-anchor="end">${fmt(b.stitches)}</text>`;
    }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="120mm" height="${H}mm" viewBox="0 0 120 ${H}" ` +
  `font-family="sans-serif" font-size="4" fill="#111">\n<title>${esc(name)}</title>\n<text x="6" y="8" font-size="5" font-weight="bold">Sewing worksheet: ` +
  `${esc(name)}</text>\n<text x="6" y="14">Hoop: ${esc(hoop)} · Revision ${plan.revision}</text>\n<text x="98" y="${top-4}" text-anchor="end">Length</text>` +
  `<text x="114" y="${top-4}" text-anchor="end">Stitches</text>\n${rows}\n<text x="6" y="${H-12}">Threads: ${blocks.length} · Stitches: ` +
  `${fmt(total)}${blocks.length?` · Length: ${metres(totalMm)} m`:''}</text>\n<text x="6" y="${H-6}">${esc(note)}</text>\n</svg>\n`;
}
