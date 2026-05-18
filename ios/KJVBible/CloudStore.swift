//
//  CloudStore.swift
//  KJVBible
//
//  Wraps NSUbiquitousKeyValueStore (iCloud key-value store) and exposes
//  it to the WKWebView's React code via a WKScriptMessageHandler bridge.
//
//  The React side calls window.webkit.messageHandlers.cloudStore.postMessage(...)
//  with an envelope { op, key, value?, id } and we reply by invoking a
//  global JS callback window.__cloudStoreReply(id, value).
//
//  We also subscribe to NSUbiquitousKeyValueStore.didChangeExternallyNotification
//  so changes arriving from another device (or after a fresh install on the
//  same iCloud account) propagate into the running web app immediately via
//  window.__cloudStoreExternalChange(keys).
//
//  Why NSUbiquitousKeyValueStore and not CloudKit:
//  - Built for this exact use case (small, key-value, device-syncing prefs).
//  - 1 MB total / 1024 keys / 1 MB per value — comfortably more than
//    we need for journals, bookmarks, and pinned searches.
//  - Free, no container setup, no quota management.
//  - Available everywhere iCloud is available, falls back silently
//    when iCloud is signed out.
//

import Foundation
import WebKit

final class CloudStore: NSObject, WKScriptMessageHandler {

    static let messageName = "cloudStore"

    private let store = NSUbiquitousKeyValueStore.default
    private weak var webView: WKWebView?

    init(webView: WKWebView) {
        self.webView = webView
        super.init()

        // Subscribe to external-change notifications: another device
        // wrote something, or this device just pulled fresh data on
        // launch / after a sign-in.
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(externalChange(_:)),
            name: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
            object: store
        )

        // Ask iCloud to pull the latest at startup. The actual fetch is
        // async; we'll be notified via didChangeExternallyNotification
        // when new data arrives.
        store.synchronize()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - WKScriptMessageHandler

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == Self.messageName,
              let body = message.body as? [String: Any],
              let op = body["op"] as? String,
              let key = body["key"] as? String,
              let id = body["id"] as? Int
        else { return }

        switch op {
        case "get":
            let value = store.string(forKey: key)
            replyToJS(id: id, value: value)

        case "set":
            if let value = body["value"] as? String {
                store.set(value, forKey: key)
                store.synchronize()
                replyToJS(id: id, value: nil)
            } else {
                replyToJS(id: id, value: nil)
            }

        case "remove":
            store.removeObject(forKey: key)
            store.synchronize()
            replyToJS(id: id, value: nil)

        default:
            replyToJS(id: id, value: nil)
        }
    }

    // MARK: - Replies to JS

    /// Send the result of a get (a value or nil) back to the awaiting
    /// JS Promise. Set/remove also reply with `nil` so the JS side knows
    /// the round-trip completed.
    private func replyToJS(id: Int, value: String?) {
        let payload: [String: Any] = [
            "id": id,
            "value": value as Any,
        ]
        let envelope = encodeJSON(payload) ?? "{\"id\":\(id),\"value\":null}"
        let js = "window.__cloudStoreReply && window.__cloudStoreReply(\(envelope));"
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    /// Tell JS that one or more keys changed externally.
    @objc private func externalChange(_ notification: Notification) {
        let info = notification.userInfo
        let keys = (info?[NSUbiquitousKeyValueStoreChangedKeysKey] as? [String]) ?? []
        let json = encodeJSON(keys) ?? "[]"
        let js = "window.__cloudStoreExternalChange && window.__cloudStoreExternalChange(\(json));"
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    // MARK: - Helpers

    private func encodeJSON(_ object: Any) -> String? {
        guard JSONSerialization.isValidJSONObject(object) || object is [Any] else {
            // Plain strings, numbers, etc. — wrap and unwrap to get a JSON literal.
            if let data = try? JSONSerialization.data(
                withJSONObject: [object],
                options: [.fragmentsAllowed]
            ), let str = String(data: data, encoding: .utf8) {
                // Strip the surrounding []
                let trimmed = str.dropFirst().dropLast()
                return String(trimmed)
            }
            return nil
        }
        guard let data = try? JSONSerialization.data(
            withJSONObject: object,
            options: []
        ) else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }
}
