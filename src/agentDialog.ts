import {createStore} from './store.js';
import {setSettingsOpen} from './settingsState.js';
import {agentLinkActions, agentLinkState} from './agentLinkState.js';
import {setStitchRow} from './stitchRowsState.js';
import {t} from './i18n.js';

/** Whether the Connect an AI agent dialog is open. The agent pill, the settings button and the copy endpoint row open it. */
export const agentDialogState = createStore<boolean>(false);

/** Sets whether the Connect an AI agent dialog is open. */
export function setAgentDialogOpen(open: boolean) {
  agentDialogState.set(open);
}

/** The parts of the agent bridge the dialog uses. */
interface AgentBridge {
  hasSession(): boolean;
  start(): Promise<boolean>;
  revoke(): Promise<unknown>;
}

/** What the agent dialog needs from the editor, supplied by app.js. */
export interface AgentDialogApi {
  bridge: AgentBridge;
  toast(message: string, kind?: 'status' | 'error'): void;
}

let api: AgentDialogApi | null = null;

/** The wired editor commands. app.js calls configureAgentDialog before the dialog can open. */
function wired(): AgentDialogApi {
  if (!api) throw Error('The agent dialog is not wired.');
  return api;
}

/** Opens the agent dialog and starts the link when this tab has none yet. */
export async function openAgentDialog() {
  setSettingsOpen(false);
  setAgentDialogOpen(true);
  if (!wired().bridge.hasSession()) await wired().bridge.start();
}

/** Copies the private MCP link; false means the browser refused, so the dialog selects the link for copying by hand. */
export async function copyAgentLink(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(agentLinkState.get().url);
    wired().toast(t('Copied the private MCP link.'));
    return true;
  } catch {
    wired().toast(t('Select and copy the link.'));
    return false;
  }
}

/** Revokes the link and makes a new one, after the user confirms: agents using the old one lose access at once. */
export async function revokeAgentLink() {
  if (confirm(t('Revoke this link? Agents using it lose access immediately.'))) await wired().bridge.revoke();
}

/** Wires the agent dialog, once, and the rows that lead to it. */
export function configureAgentDialog(next: AgentDialogApi) {
  api = next;
  agentLinkActions.open = () => {
    void openAgentDialog();
  };
  // The static build has no relay, so the settings dialog does not offer to connect an agent.
  if (document.querySelector('meta[name="welcome-static"]')) setStitchRow('copyEndpoint', true);
}
