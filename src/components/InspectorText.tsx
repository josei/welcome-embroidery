import {useSyncExternalStore} from 'react';
import {inspectorTextState} from '../inspectorTextState.js';
// The inspector heading and the design summary line, rendered by React. Ids match the markup they replaced, because app.js looks them up by id.
export function SelectionHeading() {
 const {heading} = useSyncExternalStore(inspectorTextState.subscribe, inspectorTextState.get);
 return <h3 id="selected">{heading}</h3>;
}

export function DesignSummary() {
 const {summary} = useSyncExternalStore(inspectorTextState.subscribe, inspectorTextState.get);
 return <p id="stats">{summary}</p>;
}
