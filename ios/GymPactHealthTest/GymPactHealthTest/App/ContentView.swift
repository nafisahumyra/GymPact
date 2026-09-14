import SwiftUI
import UIKit

struct ContentView: View {
    @StateObject private var healthKit = HealthKitManager()

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            VStack(spacing: 10) {
                Image(systemName: "heart.text.square.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(.red)

                Text("Apple Health Test")
                    .font(.title.bold())

                Text("GymPact proof of concept")
                    .foregroundStyle(.secondary)
            }

            VStack(alignment: .leading, spacing: 16) {
                Label {
                    Text(healthKit.statusText)
                } icon: {
                    Image(systemName: healthKit.statusIcon)
                }
                .font(.headline)
                .foregroundStyle(healthKit.statusColor)

                Divider()

                Text("Today's steps")
                    .font(.headline)

                Text(healthKit.stepCount.map { $0.formatted() } ?? "—")
                    .font(.system(size: 46, weight: .bold, design: .rounded))
                    .monospacedDigit()

                if let detail = healthKit.detailText {
                    Text(detail)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(22)
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 22))

            Button {
                Task {
                    await healthKit.requestStepAccessAndLoadToday()
                }
            } label: {
                HStack {
                    if healthKit.isLoading {
                        ProgressView()
                            .tint(.white)
                    }
                    Text(healthKit.stepCount == nil ? "Connect Apple Health" : "Refresh steps")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
                .disabled(healthKit.isLoading || !healthKit.isAvailable)

            Button {
                openSafariBridge(with: healthKit.stepCount)
            } label: {
                Label("Open Safari step test", systemImage: "safari")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)
            .disabled(healthKit.stepCount == nil)

            if !healthKit.isAvailable {
                Text("Apple Health is unavailable on this device.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            Spacer()
        }
        .padding(24)
        .task {
            healthKit.prepare()
        }
    }

    private func openSafariBridge(with stepCount: Int?) {
        guard let stepCount,
              let url = URL(string: "https://nafisahumyra.github.io/GymPact/apple-health-bridge-test.html#steps=\(stepCount)")
        else {
            return
        }

        // iOS hands the HTTPS URL to the user's browser. The fragment remains
        // client-side, so the step count isn't sent to the hosting server.
        UIApplication.shared.open(url)
    }
}

#Preview {
    ContentView()
}
