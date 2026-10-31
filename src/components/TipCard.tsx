import {useSyncExternalStore} from 'react';
import {t} from '../i18n.js';
import {sewTipActions, sewTipsState} from '../sewTipsState.js';
// The sewing tips card under the selection heading, rendered by React. Ids match the markup it replaced, because the tests and styles use them.
export function TipCard() {
 const {tips} = useSyncExternalStore(sewTipsState.subscribe, sewTipsState.get);
 return (
  <div id="sewTips" className="sew-tips" role="status" hidden={tips.length === 0}>
   {tips.length > 0 && <b>{t('Sewing tips')}</b>}
   {tips.map(tip => (
    <div className="tip-item" key={tip.key}>
     <p>{t(tip.message)}</p>
     <div className="tip-actions">
      {tip.canFix && <button type="button" className="tip-fix" onClick={() => sewTipActions.fix(tip.key)}>{t('Fix tip')}</button>}
      <button type="button" className="tip-ignore" onClick={() => sewTipActions.ignore(tip.key)}>{t('Ignore')}</button>
     </div>
    </div>
   ))}
  </div>
 );
}
