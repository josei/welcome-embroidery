// @ts-check
// What the agent link can reach depends on the address the server listens on. A desktop app binds to loopback, so only
// programs on this computer can connect. A self-hosted server bound to a wider address (such as 0.0.0.0 in Docker) can be
// reached from other machines, and the wording the user reads has to say so.

const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost', '::1'];

/**
 * 'loopback' when the server listens only on this computer, 'wide' when it listens on any other address.
 * @param {string} [host] the HOST the server listens on, as given to the process (the server's default is 127.0.0.1)
 * @returns {'loopback' | 'wide'}
 */
export function bindScope(host = '127.0.0.1') {
  const name = String(host).trim().replace(/^\[(.*)\]$/, '$1').toLowerCase();
  return LOOPBACK_HOSTS.includes(name) ? 'loopback' : 'wide';
}

/**
 * The sentence about where the link can be used, for a bind scope.
 * @param {'loopback' | 'wide'} scope
 */
export function agentReachNote(scope) {
  return scope === 'wide'
    ? 'This server listens on the network, so the link can be reached from other machines. The design goes to any agent that connects.'
    : 'The link works only with an MCP client running on this computer; web-based assistants cannot reach it.';
}

/**
 * The bind scope the server reported on the page. A page without the mark (the static build, or a desktop app that
 * serves no bind mark) is treated as loopback: that is the desktop app's own address.
 * @param {Document} [doc]
 * @returns {'loopback' | 'wide'}
 */
export function pageBindScope(doc = document) {
  return doc.querySelector('meta[name="welcome-bind"]')?.getAttribute('content') === 'wide' ? 'wide' : 'loopback';
}
