import {Fragment, useSyncExternalStore} from 'react';
import {inspectorTextState} from '../inspectorTextState.js';
import {layoutState} from '../layoutState.js';
// The inspector heading, the design summary line and a stitch layer's source details, rendered by React. Ids match the
// markup they replaced, because app.js looked them up by id.
export function SelectionHeading() {
 const {heading} = useSyncExternalStore(inspectorTextState.subscribe, inspectorTextState.get);
 const layout = useSyncExternalStore(layoutState.subscribe, layoutState.get);
 return <h3 id="selected" hidden={layout.objectHeadingHidden}>{heading}</h3>;
}

export function DesignSummary() {
 const {summary} = useSyncExternalStore(inspectorTextState.subscribe, inspectorTextState.get);
 return <p id="stats">{summary}</p>;
}

export function SourceInfo() {
 const {source} = useSyncExternalStore(inspectorTextState.subscribe, inspectorTextState.get);
 return (
  <section id="sourceInfo" hidden={!source}>
   {source && <>
    <strong>{source.format}</strong>
    {source.meta && <><br />{source.meta}</>}
    {source.details.map((line, i) => <Fragment key={i}><br />{line}</Fragment>)}
    {source.warnings.length > 0 && <><br /><em>{source.warnings.map((line, i) => <Fragment key={i}>{i ? <br /> : null}{line}</Fragment>)}</em></>}
   </>}
  </section>
 );
}
