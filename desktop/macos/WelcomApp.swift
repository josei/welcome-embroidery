import SwiftUI
import WebKit
import AppKit
import Combine

@MainActor
final class LocalService: ObservableObject {
    @Published var ready = false
    @Published var message = "Starting Welcom…"
    @Published var url = URL(string: "http://127.0.0.1:8787/")!
    private var child: Process?

    func start() async {
        if let remote = ProcessInfo.processInfo.environment["WELCOM_URL"],
           let remoteURL = URL(string: remote), !remoteURL.isFileURL {
            url = remoteURL
            ready = true
            return
        }
        if await isHealthy() { ready = true; return } // Reuse the user’s existing service.
        guard let home = projectDirectory() else { message = "Choose the Welcom project folder to start its local service."; return }
        guard FileManager.default.fileExists(atPath: home.appendingPathComponent("server.js").path),
              FileManager.default.fileExists(atPath: home.appendingPathComponent("node_modules").path) else {
            message = "This folder needs server.js and installed Node dependencies. Run npm ci in the project folder once, then reopen the app."
            return
        }
        guard let node = nodeExecutable() else { message = "Node.js was not found. Install Node 22 or set WELCOM_NODE."; return }
        let process = Process()
        process.executableURL = node
        process.arguments = ["server.js"]
        process.currentDirectoryURL = home
        var env = ProcessInfo.processInfo.environment
        env["HOST"] = "127.0.0.1"
        env["PORT"] = "8787"
        env["PATH"] = "\(node.deletingLastPathComponent().path):\(env["PATH"] ?? "/usr/bin:/bin")"
        process.environment = env
        process.standardOutput = FileHandle(forWritingAtPath: "/dev/null")
        process.standardError = FileHandle(forWritingAtPath: "/dev/null")
        do { try process.run(); child = process }
        catch { message = "Could not start the local service: \(error.localizedDescription)"; return }
        message = "Starting the local service…"
        for _ in 0..<80 {
            if await isHealthy() { ready = true; message = "Welcom is ready."; return }
            if !process.isRunning { message = "The Node service exited. Check Node 22 and the project’s installed dependencies."; child = nil; return }
            try? await Task.sleep(for: .milliseconds(250))
        }
        message = "The local service did not become ready on port 8787. Check whether that port is already in use."
        stop()
    }

    func stop() {
        guard let process = child else { return }
        if process.isRunning { process.terminate() }
        child = nil
    }

    private func isHealthy() async -> Bool {
        guard let requestURL = URL(string: "http://127.0.0.1:8787/health") else { return false }
        var request = URLRequest(url: requestURL)
        request.timeoutInterval = 0.8
        do { let (data, response) = try await URLSession.shared.data(for: request); guard (response as? HTTPURLResponse)?.statusCode == 200, let result = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return false }; return result["service"] as? String == "welcom" }
        catch { return false }
    }

    private func projectDirectory() -> URL? {
        let env = ProcessInfo.processInfo.environment["WELCOM_HOME"]
        let saved = UserDefaults.standard.string(forKey: "welcomProjectDirectory")
        for path in [env, saved].compactMap({ $0 }) {
            let folder = URL(fileURLWithPath: path, isDirectory: true)
            if FileManager.default.fileExists(atPath: folder.appendingPathComponent("server.js").path) { return folder }
        }
        let panel = NSOpenPanel()
        panel.title = "Choose the Welcom project folder"
        panel.message = "Welcom starts the local Node service from this project folder."
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.canCreateDirectories = false
        guard panel.runModal() == .OK, let folder = panel.url else { return nil }
        UserDefaults.standard.set(folder.path, forKey: "welcomProjectDirectory")
        return folder
    }

    private func nodeExecutable() -> URL? {
        let env = ProcessInfo.processInfo.environment
        var candidates = [env["WELCOM_NODE"]].compactMap({ $0 })
        candidates += (env["PATH"] ?? "").split(separator: ":").map { "\($0)/node" }
        candidates += ["/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node"]
        if let home = env["HOME"] {
            let nvm = URL(fileURLWithPath: home).appendingPathComponent(".nvm/versions/node")
            if let versions = try? FileManager.default.contentsOfDirectory(at: nvm, includingPropertiesForKeys: nil) {
                candidates += versions.map { $0.appendingPathComponent("bin/node").path }
            }
        }
        return candidates.map { URL(fileURLWithPath: $0) }.first { FileManager.default.isExecutableFile(atPath: $0.path) }
    }
}

@main
struct WelcomApp: App {
    @StateObject private var service = LocalService()
    var body: some Scene {
        WindowGroup("Welcom Embroidery") {
            Group {
                if service.ready { WelcomWebView(url: service.url) }
                else VStack(spacing: 12) {
                    ProgressView()
                    Text(service.message).multilineTextAlignment(.center).frame(maxWidth: 420)
                    Button("Try again") { Task { await service.start() } }
                }.frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .frame(minWidth: 1120, minHeight: 720)
            .task { await service.start() }
            .onDisappear { service.stop() }
        }
    }
}

struct WelcomWebView: NSViewRepresentable {
    let url: URL
    func makeNSView(context: Context) -> WKWebView {
        let view = WKWebView(frame: .zero)
        view.load(URLRequest(url: url))
        return view
    }
    func updateNSView(_ view: WKWebView, context: Context) {}
}
