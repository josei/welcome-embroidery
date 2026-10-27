import {useSyncExternalStore} from 'react';
import type {ButtonHTMLAttributes} from 'react';
import {actionState} from '../actionState.js';
import type {ActionFlags} from '../actionState.js';
// A button that is disabled while its action is unavailable (see actionState). Its other props go to the button unchanged.
export function ActionButton({flag, ...props}: ButtonHTMLAttributes<HTMLButtonElement> & {flag: keyof ActionFlags}) {
 const flags = useSyncExternalStore(actionState.subscribe, actionState.get);
 return <button {...props} disabled={flags[flag]} />;
}
