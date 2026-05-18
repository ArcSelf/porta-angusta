//
//  BibleWebView.swift
//  KJVBible
//
//  SwiftUI wrapper around WKWebView. The webview is configured with a
//  custom URL scheme (`bibleapp://`) that serves files from the
//  `WebApp/` folder inside the app bundle. This is the key piece that
//  lets the React build run entirely from the binary — no network at
//  any point — while still getting a real Web origin so `localStorage`
//  (used for bookmarks) and `fetch()` (used for the KJV CSV) behave
//  exactly the same as they would on a real domain.
//

import SwiftUI
import WebKit

struct BibleWebView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()

        // Route every `bibleapp://` request through our bundle handler.
        config.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: "bibleapp")

        // Allow the React app's audio (text-to-speech) and any future
        // inline media to start without an explicit user gesture.
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        // Persist `localStorage` (saved verses) across launches.
        config.websiteDataStore = .default()

        let prefs = WKWebpagePreferences()
        prefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = prefs

        let webView = WKWebView(frame: .zero, configuration: config)

        // Tuned for a single-page app inside an iOS shell.
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black

        // Boot the bundled SPA.
        if let url = URL(string: "bibleapp://app/index.html") {
            webView.load(URLRequest(url: url))
        }

        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        // Nothing dynamic to update — the SPA owns its own state.
    }
}
