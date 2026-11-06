// @ts-check
// The agent bridge: exposes the open document to a connected MCP agent, applies its edits as normal transactions, and
// keeps the Agent dialog's status text in step with the connection.
import {documentNow, setDocument} from './documentState.js';
import {setSelection} from './selectionState.js';
import {clone, forWorker} from './appHelpers.js';
import {applyOperations, validateDocument} from './engine.js';
import {createAgentBridge} from './agent.js';
import {configureAgentDialog} from './agentDialog.js';
import {referenceForAgent} from './referencePicture.js';
import {setAgentLink} from './agentLinkState.js';
import {t} from './i18n.js';
import {transact} from './documentCommands.js';
import {editor} from './editorContext.js';

/** @type {Record<string, string>} */
const AGENT_TEXTS = {idle: 'Not connected.', waiting: 'Connected. Waiting for an agent to use the link.', active: 'Agent active.', error: 'Connection problem.', unavailable: 'Agent relay unavailable.'};

/** Mounts the bridge and resumes any saved session. */
export function mountAgentBridge() {
  /**
   * @param {any[]} operations
   * @param {number} expected
   */
  function applyRemote(operations, expected) {
    if (expected !== documentNow().doc.revision) {
      return {error: 'stale_revision', revision: documentNow().doc.revision, message: `Revision conflict: expected ${expected}, current ${documentNow().doc.revision}. Inspect and retry.`};
    }
    try {
      const trial = clone(documentNow().doc);
      applyOperations(trial, operations);
      validateDocument(trial);
    } catch (error) {
      return {error: 'invalid_operation', revision: documentNow().doc.revision, message: /** @type {any} */ (error).message};
    }
    editor.edit(operations);
    editor.toast(`Agent applied ${operations.length} edit${operations.length === 1 ? '' : 's'}.`);
    return {revision: documentNow().doc.revision, document: forWorker(documentNow().doc)};
  }

  /**
   * @param {any} layer
   * @param {number} expected
   */
  function addLayerRemote(layer, expected) {
    if (expected !== documentNow().doc.revision) {
      return {error: 'stale_revision', revision: documentNow().doc.revision, message: `Revision conflict: expected ${expected}, current ${documentNow().doc.revision}. Inspect and retry.`};
    }
    try {
      const trial = clone(documentNow().doc);
      trial.objects.push(layer);
      validateDocument(trial);
    } catch (error) {
      return {error: 'invalid_import', revision: documentNow().doc.revision, message: /** @type {any} */ (error).message};
    }
    if (!transact(() => {
      setDocument({doc: {...documentNow().doc, objects: [...documentNow().doc.objects, layer]}});
      setSelection({selected: layer.id});
    })) {
      return {error: 'invalid_import', revision: documentNow().doc.revision, message: 'The editor rejected the imported layer.'};
    }
    editor.toast(`Agent imported ${layer.source.fileName}.`);
    return {revision: documentNow().doc.revision};
  }

  const bridge = createAgentBridge({
    getReference: object => referenceForAgent(object),
    getDocument: () => {
      const document = clone(documentNow().doc);
      if (document.reference) {
        document.reference = {
          ...document.reference,
          data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          pictureOmitted: true,
        };
      }
      return document;
    },
    applyRemote,
    addLayerRemote,
    onChange: state => {
      setAgentLink({
        statusText: `${t(AGENT_TEXTS[state.status] || '')}${state.status === 'active' ? ` ${t(state.agentCalls === 1 ? '1 request so far.' : `${state.agentCalls} requests so far.`)}` : ''} ${state.message || ''}`.trim(),
        url: state.mcpUrl || '',
        ready: Boolean(state.mcpUrl),
        waiting: state.status === 'waiting' || state.status === 'active',
        active: state.status === 'active',
      });
    },
  });
  configureAgentDialog({bridge, toast: editor.toast});
  bridge.resume();
}
