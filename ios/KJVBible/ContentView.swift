//
//  ContentView.swift
//  KJVBible
//
//  Root SwiftUI view. Just hosts the BibleWebView edge-to-edge over a
//  midnight background so the safe-area transition feels native.
//

import SwiftUI

struct ContentView: View {
    var body: some View {
        ZStack {
            // Background matches the React app's base colour so there's no
            // white flash while the webview is initialising.
            Color(red: 15.0 / 255.0, green: 23.0 / 255.0, blue: 42.0 / 255.0)
                .ignoresSafeArea()

            BibleWebView()
                .ignoresSafeArea()
        }
    }
}

#Preview {
    ContentView()
}
