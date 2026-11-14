import {useRef, useSyncExternalStore, type MouseEvent} from 'react';
import {useModalDialog} from './useModalDialog';
import {lang, setLanguage, t} from '../i18n.js';
import {setSettingsOpen, settingsState} from '../settingsState.js';
import {stitchRowsState} from '../stitchRowsState.js';
import {agentLinkState, agentLinkActions} from '../agentLinkState.js';
// The settings dialog, rendered by React. It holds the language and the AI agent link, which the header used to show.
// It opens and closes through settingsState, the same way the shortcuts dialog does.
// Phones and tablets close it on a tap outside the card. The card fills the dialog's box, so a click whose target is the
// dialog itself landed on the backdrop.
const TOUCH_LAYOUT_QUERY = '(max-width: 1024px)';

export function SettingsDialog() {
 const open = useSyncExternalStore(settingsState.subscribe, settingsState.get);
 const rows = useSyncExternalStore(stitchRowsState.subscribe, stitchRowsState.get);
 const agent = useSyncExternalStore(agentLinkState.subscribe, agentLinkState.get);
 const ref = useRef<HTMLDialogElement>(null);
 useModalDialog(ref, open, '#helpBtn');
 const closeOnBackdropTap = (e: MouseEvent<HTMLDialogElement>) => {
  if (e.target !== e.currentTarget || !window.matchMedia(TOUCH_LAYOUT_QUERY).matches) return;
  setSettingsOpen(false);
 };
 return (
  <dialog id="settingsDialog" ref={ref} onClose={() => setSettingsOpen(false)} onClick={closeOnBackdropTap}>
   <form method="dialog">
    <h2>{t('Settings')}</h2>
    <div className="settings-body">
     <fieldset className="settings-group">
      <legend>{t('Language')}</legend>
      <div className="settings-choices">
       <button type="button" id="langEn" aria-pressed={lang === 'en'} onClick={() => setLanguage('en')}>English</button>
       <button type="button" id="langEs" aria-pressed={lang === 'es'} onClick={() => setLanguage('es')}>Español</button>
      </div>
     </fieldset>
     <fieldset className="settings-group">
      <legend>{t('Sewing tips to show')}</legend>
      <div id="tipsList" className="tips-list"></div>
     </fieldset>
     <fieldset className="settings-group" hidden={rows.copyEndpoint}>
      <legend>{t('AI agent')}</legend>
      <p id="agentState" className="agent-state" role="status">{agent.active ? t('Agent connected') : agent.waiting ? t('Waiting for agent') : t('Not connected')}</p>
      <button type="button" id="copyEndpoint" className={[agent.waiting || agent.active ? 'agent-on' : '', agent.active ? 'agent-active' : ''].filter(
        Boolean).join(' ') || undefined} onClick={() => agentLinkActions.open()}>{t('Connect an AI agent')}</button>
     </fieldset>
    </div>
    <button>{t('Close')}</button>
   </form>
  </dialog>
 );
}
