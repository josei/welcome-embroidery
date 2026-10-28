import {createStore} from './store.js';

/**
 * The agent link's state as the Connect an AI agent dialog and the settings button show it: the status line, the private
 * link, whether the link exists (so Copy and Revoke can be used), and the button's waiting and active marks. app.js sets it
 * from the agent bridge.
 */
export interface AgentLink {
  statusText: string;
  url: string;
  ready: boolean;
  waiting: boolean;
  active: boolean;
}

export const agentLinkState = createStore<AgentLink>({
  statusText: '',
  url: '',
  ready: false,
  waiting: false,
  active: false,
});

/** Changes the agent link state. */
export function setAgentLink(patch: Partial<AgentLink>) {
  agentLinkState.set({...agentLinkState.get(), ...patch});
}
