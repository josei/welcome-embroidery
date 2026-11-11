#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, WindowEvent};

const MAIN_WINDOW: &str = "main";

struct LocalServer(Mutex<Option<Child>>);

/// What the user was asked about: closing the window, or quitting the app.
#[derive(Clone, Copy)]
enum Pending {
    CloseWindow,
    Exit,
}

/// Close guard. `unsaved` mirrors the page's dirty flag (set_unsaved). `asking` is true while the page's confirm is open,
/// so a second close or quit does not prompt twice. `allowed` lets the close or quit through after the user discarded.
#[derive(Default)]
struct CloseGuard {
    unsaved: AtomicBool,
    asking: AtomicBool,
    allowed: AtomicBool,
    pending: Mutex<Option<Pending>>,
}

/// Asks the user whether to discard unsaved work. On macOS this is a native dialog (osascript `display dialog`) with
/// exactly "Discard" and "Cancel" buttons, run on its own thread so the event loop keeps running while it is open.
/// Elsewhere the page's confirm() is used, since no native dialog is wired up there yet. Returns false when the prompt
/// could not be shown, so the window stays open.
fn ask(app: &AppHandle, action: Pending) -> bool {
    let guard = app.state::<CloseGuard>();
    if guard.asking.swap(true, Ordering::SeqCst) {
        return true;
    }
    *guard.pending.lock().unwrap() = Some(action);
    let asked = match app.get_webview_window(MAIN_WINDOW) {
        Some(_) if cfg!(target_os = "macos") => {
            let app = app.clone();
            std::thread::spawn(move || {
                let discard = native_discard_prompt();
                if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                    let _ = window.eval(&format!("window.__welcomeAnswerClose && window.__welcomeAnswerClose({discard})"));
                }
            });
            true
        }
        Some(window) => window.eval("window.__welcomeConfirmClose && window.__welcomeConfirmClose()").is_ok(),
        None => false,
    };
    if !asked {
        guard.asking.store(false, Ordering::SeqCst);
        *guard.pending.lock().unwrap() = None;
    }
    asked
}

/// Shows the macOS "Discard unsaved changes?" dialog and returns true only when the user chose Discard. Cancel, Escape
/// or a failure to run osascript all count as Cancel.
#[cfg(target_os = "macos")]
fn native_discard_prompt() -> bool {
    let script = r#"display dialog "Discard unsaved changes?" buttons {"Cancel", "Discard"} default button "Cancel" cancel button "Cancel" with icon caution"#;
    match Command::new("osascript").arg("-e").arg(script).output() {
        Ok(out) => out.status.success() && String::from_utf8_lossy(&out.stdout).contains("button returned:Discard"),
        Err(_) => false,
    }
}

#[cfg(not(target_os = "macos"))]
fn native_discard_prompt() -> bool {
    false
}

/// What a close or quit does, decided from whether work is unsaved and the user's answer. The window and dialog
/// calls live outside this so the choice can be unit-tested.
#[derive(Debug, PartialEq, Eq)]
enum CloseOutcome {
    /// Clean document: go ahead with no prompt.
    Proceed,
    /// Unsaved and the user chose Cancel: nothing closes, the app keeps running.
    Keep,
    /// Unsaved and the user chose Discard: the autosave copy is flushed (by the page), then the close or quit goes ahead.
    FlushThenProceed,
}

fn close_outcome(unsaved: bool, discard: bool) -> CloseOutcome {
    match (unsaved, discard) {
        (false, _) => CloseOutcome::Proceed,
        (true, false) => CloseOutcome::Keep,
        (true, true) => CloseOutcome::FlushThenProceed,
    }
}

/// True when closing or quitting must wait for the user's answer.
fn needs_prompt(unsaved: bool, allowed: bool) -> bool {
    unsaved && !allowed
}

/// True when closing or quitting must wait for the user's answer.
fn must_ask(app: &AppHandle) -> bool {
    let guard = app.state::<CloseGuard>();
    needs_prompt(guard.unsaved.load(Ordering::SeqCst), guard.allowed.load(Ordering::SeqCst))
        && app.get_webview_window(MAIN_WINDOW).is_some()
}

#[tauri::command]
fn set_unsaved(app: AppHandle, unsaved: bool) {
    app.state::<CloseGuard>().unsaved.store(unsaved, Ordering::SeqCst);
}

/// The page's answer to the confirm. Cancel keeps everything open; Discard performs the close or quit that was asked for.
#[tauri::command]
fn close_decision(app: AppHandle, discard: bool) {
    let guard = app.state::<CloseGuard>();
    guard.asking.store(false, Ordering::SeqCst);
    let action = guard.pending.lock().unwrap().take();
    let unsaved = guard.unsaved.load(Ordering::SeqCst);
    if close_outcome(unsaved, discard) == CloseOutcome::Keep {
        return;
    }
    // `allowed` is never reset: after a discard the window or app is closing, so no later close needs the prompt.
    guard.allowed.store(true, Ordering::SeqCst);
    match action {
        Some(Pending::CloseWindow) => {
            if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                let _ = window.destroy();
            }
        }
        Some(Pending::Exit) => app.exit(0),
        None => {}
    }
}

/// Preferred port for the bundled server. The WebView origin is
/// `http://127.0.0.1:<port>` and localStorage (autosave) is per origin, so a
/// stable port keeps unsaved work restorable across relaunches.
const PREFERRED_PORT: u16 = 47821;

fn free_port() -> Option<u16> {
    TcpListener::bind("127.0.0.1:0").ok()?.local_addr().ok().map(|a| a.port())
}

/// Returns `PREFERRED_PORT` when it can be bound, otherwise any free port.
/// The fallback is only used when the preferred port is taken, so the origin
/// stays the same on every launch that can get it.
fn pick_port() -> Option<u16> {
    if TcpListener::bind(("127.0.0.1", PREFERRED_PORT)).is_ok() {
        return Some(PREFERRED_PORT);
    }
    let port = free_port()?;
    eprintln!("welcome: port {PREFERRED_PORT} is taken; using {port}, autosave will not carry over from other launches");
    Some(port)
}

fn start_server(node: &PathBuf, dir: &PathBuf, data: &PathBuf, port: u16) -> Option<Child> {
    std::fs::create_dir_all(data).ok()?;
    let mut child = Command::new(node)
        .arg("server.js")
        .current_dir(dir)
        .env("PORT", port.to_string())
        .env("HOST", "127.0.0.1")
        .env("DATA_DIR", data)
        .env("WELCOME_DESKTOP", "1")
        .stdin(Stdio::piped())
        .spawn()
        .ok()?;
    let deadline = Instant::now() + Duration::from_secs(15);
    while Instant::now() < deadline {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return Some(child);
        }
        if child.try_wait().ok().flatten().is_some() {
            return None;
        }
        std::thread::sleep(Duration::from_millis(150));
    }
    let _ = child.kill();
    None
}

fn main() {
    tauri::Builder::default()
        .manage(LocalServer(Mutex::new(None)))
        .manage(CloseGuard::default())
        .invoke_handler(tauri::generate_handler![set_unsaved, close_decision])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == MAIN_WINDOW && must_ask(window.app_handle()) {
                    api.prevent_close();
                    ask(window.app_handle(), Pending::CloseWindow);
                }
            }
        })
        .setup(|app| {
            let bundled = app.path().resource_dir()?.join("welcome");
            let staged = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources").join("welcome");
            let dir = if bundled.join("server.js").exists() { bundled } else { staged };
            let data = app.path().app_data_dir()?;
            let node_name = if cfg!(windows) { "node.exe" } else { "node" };
            let bundled_node = dir.join("runtime").join(node_name);
            let node = if bundled_node.exists() { bundled_node } else { PathBuf::from(node_name) };
            let started = match pick_port() {
                Some(port) if dir.join("server.js").exists() => start_server(&node, &dir, &data, port).map(|child| (child, port)),
                _ => None,
            };
            let url = match started {
                Some((child, port)) => {
                    *app.state::<LocalServer>().0.lock().unwrap() = Some(child);
                    WebviewUrl::External(format!("http://127.0.0.1:{port}/").parse::<tauri::Url>()?)
                }
                None => WebviewUrl::App("index.html".into()),
            };
            WebviewWindowBuilder::new(app, "main", url)
                .title("Welcome")
                .inner_size(1280.0, 820.0)
                .min_inner_size(390.0, 640.0)
                .build()?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Welcome")
        .run(|app, event| {
            match event {
                RunEvent::ExitRequested { api, .. } => {
                    if must_ask(app) {
                        api.prevent_exit();
                        ask(app, Pending::Exit);
                    }
                }
                RunEvent::Exit => {
                    if let Some(mut child) = app.state::<LocalServer>().0.lock().unwrap().take() {
                        let _ = child.kill();
                    }
                }
                _ => {}
            }
        });
}

#[cfg(test)]
mod tests {
    use super::{close_outcome, needs_prompt, CloseOutcome};

    #[test]
    fn clean_document_closes_without_a_prompt() {
        assert!(!needs_prompt(false, false));
        assert_eq!(close_outcome(false, false), CloseOutcome::Proceed);
        assert_eq!(close_outcome(false, true), CloseOutcome::Proceed);
    }

    #[test]
    fn dirty_document_asks_before_closing() {
        assert!(needs_prompt(true, false));
        assert!(!needs_prompt(true, true), "after a discard, later closes go straight through");
    }

    #[test]
    fn dirty_and_cancel_keeps_everything_open() {
        assert_eq!(close_outcome(true, false), CloseOutcome::Keep);
    }

    #[test]
    fn dirty_and_discard_flushes_then_closes() {
        assert_eq!(close_outcome(true, true), CloseOutcome::FlushThenProceed);
    }
}
