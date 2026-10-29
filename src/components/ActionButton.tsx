import {useSyncExternalStore} from 'react';
import type {ButtonHTMLAttributes} from 'react';
import {actionState} from '../actionState.js';
import type {ActionFlags} from '../actionState.js';
// A button that is disabled while its action is unavailable (see actionState). Its other props go to the button unchanged.
// With hideWhenDisabled, the button is hidden instead: the contextual toolbar shows only the actions that apply.
export function ActionButton({flag, hideWhenDisabled = false, ...props}: ButtonHTMLAttributes<HTMLButtonElement> & {flag: keyof ActionFlags; hideWhenDisabled?: boolean}) {
 const flags = useSyncExternalStore(actionState.subscribe, actionState.get);
 return hideWhenDisabled ? <button {...props} hidden={flags[flag]} /> : <button {...props} disabled={flags[flag]} />;
}
