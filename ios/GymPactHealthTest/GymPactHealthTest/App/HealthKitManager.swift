import HealthKit
import SwiftUI

@MainActor
final class HealthKitManager: ObservableObject {
    private let healthStore = HKHealthStore()
    private let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount)!

    @Published private(set) var stepCount: Int?
    @Published private(set) var isLoading = false
    @Published private(set) var statusText = "HealthKit status: Not connected"
    @Published private(set) var detailText: String?

    var isAvailable: Bool {
        HKHealthStore.isHealthDataAvailable()
    }

    var statusIcon: String {
        if isLoading { return "arrow.triangle.2.circlepath" }
        return stepCount == nil ? "heart.slash" : "checkmark.circle.fill"
    }

    var statusColor: Color {
        stepCount == nil ? .secondary : .green
    }

    func prepare() {
        guard isAvailable else {
            statusText = "HealthKit status: Unavailable"
            return
        }

        statusText = "HealthKit status: Ready to request Steps"
        detailText = "Tap Connect Apple Health to request Step Count access."
    }

    func requestStepAccessAndLoadToday() async {
        guard isAvailable else {
            statusText = "HealthKit status: Unavailable"
            return
        }

        isLoading = true
        statusText = "HealthKit status: Requesting access"
        detailText = nil

        do {
            // This app requests read access only for Apple Health step-count data.
            try await healthStore.requestAuthorization(toShare: [], read: [stepType])
            await loadTodaySteps(keepLoadingState: true)
        } catch {
            statusText = "HealthKit status: Request failed"
            detailText = error.localizedDescription
        }

        isLoading = false
    }

    private func loadTodaySteps(keepLoadingState: Bool = false) async {
        guard isAvailable else { return }
        if !keepLoadingState { isLoading = true }

        let startOfToday = Calendar.current.startOfDay(for: .now)
        let predicate = HKQuery.predicateForSamples(
            withStart: startOfToday,
            end: .now,
            options: .strictStartDate
        )

        do {
            let total = try await cumulativeStepCount(predicate: predicate)
            stepCount = Int(total)
            // HealthKit intentionally doesn't reveal a per-type read decision.
            // A completed query is the privacy-safe status this proof can show.
            statusText = "HealthKit status: Step data loaded"
            detailText = "Steps recorded from midnight to now."
        } catch {
            statusText = "HealthKit status: Unable to read steps"
            detailText = error.localizedDescription
        }

        isLoading = false
    }

    private func cumulativeStepCount(predicate: NSPredicate) async throws -> Double {
        try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: stepType,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum
            ) { _, result, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                let total = result?.sumQuantity()?.doubleValue(for: .count()) ?? 0
                continuation.resume(returning: total)
            }

            healthStore.execute(query)
        }
    }
}
