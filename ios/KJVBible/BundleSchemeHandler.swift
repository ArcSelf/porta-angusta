//
//  BundleSchemeHandler.swift
//  KJVBible
//
//  WKURLSchemeHandler that serves the bundled React build over a
//  custom `bibleapp://` scheme. Mapping is direct:
//
//      bibleapp://app/index.html           -> WebApp/index.html
//      bibleapp://app/assets/index-XYZ.js  -> WebApp/assets/index-XYZ.js
//      bibleapp://app/data/kjv_bible.csv   -> WebApp/data/kjv_bible.csv
//
//  Everything is loaded synchronously from the app bundle — there is
//  no network traffic, ever, which satisfies the App Store's
//  "executable code must be bundled" rule and means the app works
//  offline from first launch.
//

import Foundation
import WebKit
import UniformTypeIdentifiers

final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {

    /// Locate the file inside `WebApp/` that a given `bibleapp://` URL refers to.
    private func bundleFileURL(for url: URL) -> URL? {
        guard let webAppRoot = Bundle.main.url(forResource: "WebApp", withExtension: nil) else {
            return nil
        }
        var relativePath = url.path
        if relativePath.hasPrefix("/") { relativePath.removeFirst() }
        if relativePath.isEmpty { relativePath = "index.html" }
        // Defence against path-traversal — collapse any `..` segments.
        let safe = (relativePath as NSString).standardizingPath
        let target = webAppRoot.appendingPathComponent(safe)
        // Make sure the resolved target stays inside WebApp/.
        let resolved = target.standardized.path
        guard resolved.hasPrefix(webAppRoot.standardized.path) else { return nil }
        return target
    }

    private func mimeType(forPathExtension ext: String) -> String {
        switch ext.lowercased() {
        case "html", "htm": return "text/html; charset=utf-8"
        case "css":         return "text/css; charset=utf-8"
        case "js", "mjs":   return "application/javascript; charset=utf-8"
        case "json":        return "application/json; charset=utf-8"
        case "csv":         return "text/csv; charset=utf-8"
        case "txt":         return "text/plain; charset=utf-8"
        case "svg":         return "image/svg+xml"
        case "png":         return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp":        return "image/webp"
        case "gif":         return "image/gif"
        case "ico":         return "image/x-icon"
        case "woff":        return "font/woff"
        case "woff2":       return "font/woff2"
        case "ttf":         return "font/ttf"
        case "otf":         return "font/otf"
        case "wasm":        return "application/wasm"
        case "map":         return "application/json; charset=utf-8"
        default:
            if #available(iOS 14.0, *), let t = UTType(filenameExtension: ext) {
                return t.preferredMIMEType ?? "application/octet-stream"
            }
            return "application/octet-stream"
        }
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let requestURL = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }

        guard let fileURL = bundleFileURL(for: requestURL) else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
            return
        }

        let data: Data
        do {
            data = try Data(contentsOf: fileURL, options: [.mappedIfSafe])
        } catch {
            // Useful 404 for the React app to surface — it has its own fallback paths.
            let body = "Not found: \(requestURL.path)".data(using: .utf8) ?? Data()
            let resp = HTTPURLResponse(
                url: requestURL,
                statusCode: 404,
                httpVersion: "HTTP/1.1",
                headerFields: ["Content-Type": "text/plain; charset=utf-8",
                               "Content-Length": "\(body.count)"]
            )!
            urlSchemeTask.didReceive(resp)
            urlSchemeTask.didReceive(body)
            urlSchemeTask.didFinish()
            return
        }

        let headers: [String: String] = [
            "Content-Type": mimeType(forPathExtension: fileURL.pathExtension),
            "Content-Length": "\(data.count)",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store"
        ]

        let response = HTTPURLResponse(
            url: requestURL,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: headers
        )!

        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // Synchronous responses — nothing to cancel.
    }
}
