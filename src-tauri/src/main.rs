#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

struct LocalServer(Mutex<Option<Child>>);

fn free_port() -> Option<u16> {
    TcpListener::bind("127.0.0.1:0").ok()?.local_addr().ok().map(|a| a.port())
}

fn start_server(dir: &PathBuf, data: &PathBuf, port: u16) -> Option<Child> {
    std::fs::create_dir_all(data).ok()?;
    let mut child = Command::new("node")
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
        .setup(|app| {
            let bundled = app.path().resource_dir()?.join("welcome");
            let staged = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources").join("welcome");
            let dir = if bundled.join("server.js").exists() { bundled } else { staged };
            let data = app.path().app_data_dir()?;
            let started = match free_port() {
                Some(port) if dir.join("server.js").exists() => start_server(&dir, &data, port).map(|child| (child, port)),
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
            if let RunEvent::Exit = event {
                if let Some(mut child) = app.state::<LocalServer>().0.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        });
}
