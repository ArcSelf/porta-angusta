//
//  KJVBibleApp.swift
//  KJVBible
//
//  App entry point. Hosts a single SwiftUI scene that renders the
//  WKWebView-backed Bible reader full-bleed in dark mode.
//

import SwiftUI

@main
struct KJVBibleApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
                .ignoresSafeArea()
                .statusBarHidden(false)
        }
    }
}
