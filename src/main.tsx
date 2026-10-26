// Import order matters. mount.tsx renders the markup first. app.js and i18n.js then read the DOM
// and register their start-up on DOMContentLoaded, which must still be ahead of them.
import './mount';
import './app.js';
