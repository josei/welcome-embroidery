> **Superseded.** The desktop app is now Electron (`desktop/electron/`): it bundles Node, so it needs no separate install and no Swift compilation. This SwiftUI/WebKit shell is kept only for reference and is not maintained.

# macOS WebKit desktop shell (source)

This source-only SwiftUI app wraps Welcome in a native WKWebView window. On launch it reuses a healthy local Welcome service or starts `node server.js` from the configured project folder. It stops only a service process that it started when the window closes. Set `WELCOME_HOME` or choose the project folder on first launch. Node 22 and that checkout's dependencies (`npm ci`) must already be installed. Set `WELCOME_NODE` if Node is outside the app's inherited `PATH` and common Homebrew/NVM locations. Set `WELCOME_URL` to open an existing non-file URL instead.

Build on macOS with Xcode Command Line Tools:

```sh
desktop/macos/build-app.sh
open desktop/macos/build/Welcome.app
```

Pass a different `.app` output path as the first build-script argument if needed.

This is not a bundled Node runtime, installer, signed/notarized release, or validated macOS binary. Mac packaging and lifecycle behavior still need validation on macOS.
