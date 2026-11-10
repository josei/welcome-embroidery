import {useSyncExternalStore} from 'react';
import {layoutState} from '../layoutState.js';
import {stitchRowsState} from '../stitchRowsState.js';
import {arrayState, createArray, setArrayFields, setArrayMode} from '../arrayState.js';
import type {ArrayMode} from '../arrayState.js';
import {batchState, setBatchFields} from '../batchState.js';
import {exportBatch, syncBatchInfo} from '../batchExport.js';
// The array panel, rendered by React. Ids match the markup it replaced, because tests and the editor look them up by id.
// The mode, the copies and the steps come from arrayState, and the batch from batchState; the button actions edit the document.
export function ArrayPanel() {
 const layout = useSyncExternalStore(layoutState.subscribe, layoutState.get);
 const rows = useSyncExternalStore(stitchRowsState.subscribe, stitchRowsState.get);
 const fields = useSyncExternalStore(arrayState.subscribe, arrayState.get);
 const batch = useSyncExternalStore(batchState.subscribe, batchState.get);
 const radial = fields.mode === 'radial';
 const along = fields.mode === 'along';
 return (
  <details id="secArray" className="sec-fold" data-sec="" hidden={layout.secArray}><summary>Array</summary>
   <div className="tool-grid">
    <label>Mode<select id="arrMode" value={fields.mode} onChange={e => setArrayMode(e.target.value as ArrayMode)}>
     <option value="linear">Linear</option>
     <option value="radial">Radial (around a point)</option>
     <option value="along">Along a path</option>
    </select></label><span></span>
    <label>Copies (incl. original)<input id="arrCount" type="number" min="2" max="60" value={fields.count}
     onChange={e => {setArrayFields({count: e.target.value}); syncBatchInfo();}} /></label><span></span>
    <label>Batch format<select id="batchFormat" value={batch.format}
     onChange={e => setBatchFields({format: e.target.value})}>
     <option value="jef">JEF</option>
     <option value="vp3">VP3</option>
     <option value="dst">DST</option>
     <option value="sew">SEW</option>
     <option value="exp">EXP</option>
     <option value="pec">PEC</option>
     <option value="pes">PES</option>
     <option value="pes6">PES v6</option>
     <option value="u01">U01</option>
     <option value="xxx">XXX</option>
     <option value="tbf">TBF</option>
    </select></label><span></span>
    <p id="batchInfo" className="sel-hint" style={{gridColumn: '1 / -1'}}>{batch.info}</p>
    <label id="batchNamesRow" style={{gridColumn: '1 / -1'}}>Name drop: names, one per line (each name replaces the
     lettering marked for name drop, or the first lettering if none is marked)
     <textarea id="batchNames" rows={3} style={{width: '100%'}} placeholder="Leave empty for plain copies"
      value={batch.names} onChange={e => {setBatchFields({names: e.target.value}); syncBatchInfo();}} />
    </label>
    <button id="batchExport" type="button" style={{gridColumn: '1 / -1'}} onClick={() => void exportBatch()}>
     Export batch
    </button>
    <label id="arrALabel" hidden={along}>{radial ? 'Center X (mm)' : 'Step X (mm)'}
     <input id="arrA" type="number" step="1" value={fields.stepX} onChange={e => setArrayFields({stepX: e.target.value})} />
    </label>
    <label id="arrBLabel" hidden={along}>{radial ? 'Center Y (mm)' : 'Step Y (mm)'}
     <input id="arrB" type="number" step="1" value={fields.stepY} onChange={e => setArrayFields({stepY: e.target.value})} />
    </label>
    <label id="arrAngleRow" hidden={rows.arrAngleRow}>Total angle (°)
     <input id="arrAngle" type="number" step="15" value={fields.angle} onChange={e => setArrayFields({angle: e.target.value})} />
    </label><span></span>
   </div>
   <div className="btn-row">
    <button id="arrBtn" onClick={() => createArray()}
     title="Linear and radial use the selected object; along-path needs the motif and the path selected">Create array</button>
   </div>
  </details>
 );
}
