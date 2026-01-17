import Cocoa
import Quartz
import WebKit

@objc(PreviewViewController)
final class PreviewViewController: NSViewController, QLPreviewingController, WKNavigationDelegate {
    private var webView: WKWebView!
    private var backgroundView: NSVisualEffectView!
    private let logger = QuickLookLogger()

    override func loadView() {
        logger.log("loadView start")
        let background = NSVisualEffectView()
        background.material = .hudWindow
        background.blendingMode = .behindWindow
        background.state = .active
        background.translatesAutoresizingMaskIntoConstraints = false
        backgroundView = background

        let config = WKWebViewConfiguration()
        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.setValue(false, forKey: "drawsBackground")
        webView.navigationDelegate = self
        self.webView = webView

        let container = NSView()
        container.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(background)
        container.addSubview(webView)

        NSLayoutConstraint.activate([
            background.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            background.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            background.topAnchor.constraint(equalTo: container.topAnchor),
            background.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            webView.topAnchor.constraint(equalTo: container.topAnchor),
            webView.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        ])

        view = container
        logger.log("loadView complete")
    }

    func preparePreviewOfFile(at url: URL, completionHandler handler: @escaping (Error?) -> Void) {
        let start = CFAbsoluteTimeGetCurrent()
        logger.log("preparePreview start url=\(url.path)")
        DispatchQueue.global(qos: .userInitiated).async {
            let read_start = CFAbsoluteTimeGetCurrent()
            let markdown = (try? String(contentsOf: url, encoding: .utf8)) ?? ""
            self.logger.log("read file ms=\(Int((CFAbsoluteTimeGetCurrent() - read_start) * 1000)) bytes=\(markdown.utf8.count)")
            let html_start = CFAbsoluteTimeGetCurrent()
            let html = self.makeHTML(markdown: markdown)
            self.logger.log("render html ms=\(Int((CFAbsoluteTimeGetCurrent() - html_start) * 1000))")
            DispatchQueue.main.async {
                self.webView.loadHTMLString(html, baseURL: url.deletingLastPathComponent())
                self.logger.log("loadHTMLString queued total_ms=\(Int((CFAbsoluteTimeGetCurrent() - start) * 1000))")
                handler(nil)
            }
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        logger.log("webView didFinish")
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        logger.log("webView didFail error=\(error.localizedDescription)")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        logger.log("webView didFailProvisional error=\(error.localizedDescription)")
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        logger.log("webView content process terminated")
    }

    private func makeHTML(markdown: String) -> String {
        let parts = Self.splitFrontmatter(from: markdown)
        let markdownJSON = Self.jsonString(for: parts.body)
        let css = Self.loadResource(named: "preview", extension: "css")
        let markdownIt = Self.loadResource(named: "markdown-it.min", extension: "js")
        let domPurify = Self.loadResource(named: "purify.min", extension: "js")
        let mermaid = Self.loadResource(named: "mermaid.min", extension: "js")
        let highlightJS = Self.loadResource(named: "highlight.min", extension: "js")
        let highlightLight = Self.loadResource(named: "highlight-light", extension: "css")
        let highlightDark = Self.loadResource(named: "highlight-dark", extension: "css")
        let frontmatterHTML = Self.frontmatterHTML(from: parts.frontmatter)

        if css.isEmpty || markdownIt.isEmpty || domPurify.isEmpty || mermaid.isEmpty || highlightJS.isEmpty {
            let escaped = Self.escapeHTML(parts.body)
            return """
            <!doctype html>
            <html>
            <head>
                <meta charset=\"utf-8\">
                <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
                <style>\(css)</style>
            </head>
            <body>
                \(frontmatterHTML)
                <pre>\(escaped)</pre>
            </body>
            </html>
            """
        }

        return """
        <!doctype html>
        <html>
        <head>
            <meta charset=\"utf-8\">
            <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
            <style>\(css)</style>
            <style>\(highlightLight)</style>
            <style>@media (prefers-color-scheme: dark) {\(highlightDark)}</style>
        </head>
        <body>
            \(frontmatterHTML)
            <div id=\"content\" class=\"markdown-body\"></div>
            <script>\(markdownIt)</script>
            <script>\(domPurify)</script>
            <script>\(mermaid)</script>
            <script>\(highlightJS)</script>
            <script>
            (() => {
                const source = \(markdownJSON);
                const md = window.markdownit({
                    html: true,
                    linkify: true,
                    typographer: true
                });
                const originalFence = md.renderer.rules.fence || function(tokens, idx, options, env, self) {
                    return self.renderToken(tokens, idx, options);
                };
                md.renderer.rules.fence = function(tokens, idx, options, env, self) {
                    const token = tokens[idx];
                    const info = (token.info || '').trim().toLowerCase();
                    if (info === 'mermaid') {
                        return '<div class=\"mermaid\">' + token.content + '</div>';
                    }
                    if (info) {
                        const lang = info.split(/\\s+/)[0];
                        if (lang) {
                            token.attrJoin('class', 'language-' + lang);
                            token.attrJoin('class', 'hljs');
                        }
                    }
                    return originalFence(tokens, idx, options, env, self);
                };

                const raw = md.render(source);
                const sanitized = DOMPurify.sanitize(raw, {
                    USE_PROFILES: { html: true, svg: true, svgFilters: true }
                });
                const container = document.getElementById('content');
                container.innerHTML = sanitized;

                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                mermaid.initialize({
                    startOnLoad: false,
                    securityLevel: 'strict',
                    theme: prefersDark ? 'dark' : 'default'
                });
                mermaid.run({ querySelector: '.mermaid' }).catch(() => {
                    const warning = document.createElement('div');
                    warning.className = 'mermaid-error';
                    warning.textContent = 'Mermaid failed to render.';
                    container.prepend(warning);
                });

                const blocks = container.querySelectorAll('pre code');
                blocks.forEach((block) => {
                    if (block.className.includes('language-')) {
                        if (window.hljs) {
                            window.hljs.highlightElement(block);
                        }
                        return;
                    }
                    if (window.hljs) {
                        const result = window.hljs.highlightAuto(block.textContent);
                        block.innerHTML = result.value;
                        block.classList.add('hljs');
                        if (result.language) {
                            block.classList.add('language-' + result.language);
                        }
                    }
                });
            })();
            </script>
        </body>
        </html>
        """
    }

    private static func loadResource(named name: String, extension ext: String) -> String {
        let bundle = Bundle(for: PreviewViewController.self)
        guard let url = bundle.url(forResource: name, withExtension: ext),
              let data = try? Data(contentsOf: url),
              let content = String(data: data, encoding: .utf8) else {
            return ""
        }
        return content
    }

    private static func splitFrontmatter(from value: String) -> (frontmatter: String?, body: String) {
        guard value.hasPrefix("---") else {
            return (nil, value)
        }
        let lines = value.split(separator: "\n", omittingEmptySubsequences: false)
        guard lines.count > 2, lines[0].trimmingCharacters(in: .whitespaces) == "---" else {
            return (nil, value)
        }
        for idx in 1..<lines.count {
            if lines[idx].trimmingCharacters(in: .whitespaces) == "---" {
                let frontmatter = lines[1..<idx].joined(separator: "\n")
                let body = lines[(idx + 1)...].joined(separator: "\n")
                return (frontmatter, body)
            }
        }
        return (nil, value)
    }

    private static func frontmatterHTML(from frontmatter: String?) -> String {
        guard let frontmatter, !frontmatter.isEmpty else {
            return ""
        }
        let escaped = escapeHTML(frontmatter)
        return """
        <section class=\"frontmatter\">
            <div class=\"frontmatter-title\">Frontmatter</div>
            <pre>---\n\(escaped)\n---</pre>
        </section>
        """
    }

    private static func escapeHTML(_ value: String) -> String {
        return value
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
    }

    private static func jsonString(for value: String) -> String {
        if let data = try? JSONEncoder().encode(value),
           let json = String(data: data, encoding: .utf8) {
            return json
        }

        let escaped = value
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\n", with: "\\n")
            .replacingOccurrences(of: "\r", with: "\\r")
        return "\"\(escaped)\""
    }
}

final class QuickLookLogger {
    private let isEnabled: Bool
    private let logURL: URL?

    init() {
        let envValue = ProcessInfo.processInfo.environment["PEEKDOWN_QL_DEBUG"]
        let envEnabled = envValue == "1" || envValue?.lowercased() == "true"
        let defaultsEnabled = UserDefaults.standard.bool(forKey: "QLDebug")
        isEnabled = envEnabled || defaultsEnabled

        if isEnabled {
            let cacheURL = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
            logURL = cacheURL?.appendingPathComponent("quicklook-extension.log")
        } else {
            logURL = nil
        }
    }

    func log(_ message: String) {
        guard isEnabled, let logURL else {
            return
        }
        let timestamp = ISO8601DateFormatter().string(from: Date())
        let line = "[\(timestamp)] \(message)\n"
        if let data = line.data(using: .utf8) {
            if FileManager.default.fileExists(atPath: logURL.path) {
                if let handle = try? FileHandle(forWritingTo: logURL) {
                    try? handle.seekToEnd()
                    try? handle.write(contentsOf: data)
                    try? handle.close()
                }
            } else {
                try? data.write(to: logURL)
            }
        }
    }
}
