import {defineConfig} from 'vite';

// The static build bundles the editor with Vite. scripts/build-static.mjs runs it,
// then embeds the stylesheet and copies the fonts and licence notices.
export default defineConfig({
 base:'./',
 build:{outDir:'dist',emptyOutDir:true,modulePreload:false}
});
