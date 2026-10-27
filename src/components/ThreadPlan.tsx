// The thread plan panel, rendered by React. Ids match the markup it replaced, because app.js wires them by id.
export function ThreadPlan() {
 return (
  <details id="secPlan" className="sec-fold"><summary>Thread plan</summary><p id="planEmpty" className="sel-hint">Compile the design to see the thread colours in sewing order.</p><div id="planList" className="plan-list"></div><label className="stock-label">My threads (one hex colour per line)<textarea id="threadStock" rows={3} placeholder={'#c0392b\n#2471a3'} /></label><p id="threadStockInfo" className="sel-hint" role="status"></p><div className="btn-row"><select id="worksheetFormat" aria-label="Worksheet format"><option value="text">Text (.txt)</option><option value="svg">SVG (printable)</option></select><button type="button" id="worksheetDownload">Download sewing worksheet</button><button type="button" id="worksheetCopy" title="Copies the text worksheet to the clipboard">Copy worksheet</button></div></details>
 );
}
