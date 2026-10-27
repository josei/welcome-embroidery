// The sewing order panel, rendered by React. Ids match the markup it replaced, because app.js wires them by id.
export function SewingOrder() {
 return (
  <details id="secOrder" className="sec-fold" data-sec="" hidden><summary>Sewing order</summary>
<div className="btn-row"><button id="ordBack" title="Sew first">To back</button><button id="ordBackward" title="Sew earlier">Earlier</button><button id="ordForward" title="Sew later">Later</button><button id="ordFront" title="Sew last">To front</button><button id="ordSort" title="Group objects by thread colour to minimise colour changes">Sort by colour</button></div>
</details>
 );
}
