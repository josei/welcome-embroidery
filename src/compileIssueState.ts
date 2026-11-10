import {createStore} from './store.js';

/**
 * Why the last compile failed, or null when it succeeded or has not failed. The object list marks the rows named in
 * objectIds and shows the message beside the list; the status run shows the same message.
 */
export interface CompileIssue {
  message: string;
  objectIds: string[];
}

export const compileIssueState = createStore<CompileIssue | null>(null);

/** Replaces the compile failure the object list shows. */
export function setCompileIssue(issue: CompileIssue | null) {
  compileIssueState.set(issue);
}
