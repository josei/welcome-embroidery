import {layoutState} from '../layoutState.js';
import {stitchRowsState} from '../stitchRowsState.js';
import {useSyncExternalStore} from 'react';
// The array panel, rendered by React. Ids match the markup it replaced, because app.js wires them by id.
export function ArrayPanel() {
 const layout = useSyncExternalStore(layoutState.subscribe, layoutState.get);
 const rows = useSyncExternalStore(stitchRowsState.subscribe, stitchRowsState.get);
 return (
  <details id="secArray" className="sec-fold" data-sec="" hidden={layout.secArray}><summary>Array</summary>
<div className="tool-grid"><label>Mode<select id="arrMode"><option value="linear">Linear</option><option value="radial">Radial (around a point)</option><option value="along">Along a path</option></select></label><span></span>
<label>Copies (incl. original)<input id="arrCount" type="number" min="2" max="60" defaultValue="5" /></label><span></span>
<label>Batch format<select id="batchFormat"><option value="jef">JEF</option><option value="vp3">VP3</option><option value="dst">DST</option><option value="sew">SEW</option><option value="exp">EXP</option><option value="pec">PEC</option><option value="pes">PES</option><option value="pes6">PES v6</option><option value="u01">U01</option><option value="xxx">XXX</option><option value="tbf">TBF</option></select></label><span></span>
<p id="batchInfo" className="sel-hint" style={{gridColumn: '1 / -1'}}></p><label id="batchNamesRow" style={{gridColumn: '1 / -1'}}>Name drop: names, one per line (each name replaces the lettering marked for name drop, or the first lettering if none is marked)<textarea id="batchNames" rows={3} style={{width: '100%'}} placeholder="Leave empty for plain copies" /></label><button id="batchExport" type="button" style={{gridColumn: '1 / -1'}}>Export batch</button><label id="arrALabel">Step X (mm)<input id="arrA" type="number" step="1" defaultValue="12" /></label><label id="arrBLabel">Step Y (mm)<input id="arrB" type="number" step="1" defaultValue="0" /></label>
<label id="arrAngleRow" hidden={rows.arrAngleRow}>Total angle (°)<input id="arrAngle" type="number" step="15" defaultValue="360" /></label><span></span></div>
<div className="btn-row"><button id="arrBtn" title="Linear and radial use the selected object; along-path needs the motif and the path selected">Create array</button></div>
</details>
 );
}
