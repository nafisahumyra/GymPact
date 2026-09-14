# GymPact Health Test

This is an isolated native iPhone proof of concept. It does not connect to the GymPact web app or Supabase, and it does not change workout or Pact data.

## What it tests

- Requests read access only for Apple Health Step Count.
- Reads the cumulative number of steps recorded from local midnight until now.
- Shows that number on a simple test screen.
- Opens a standalone Safari test page with the retrieved count in a client-side URL fragment.

## Run on an iPhone

1. Install the latest Xcode from the Mac App Store.
2. Open `GymPactHealthTest.xcodeproj` in Xcode.
3. In **Signing & Capabilities**, select your Apple ID's Personal Team and choose a unique bundle identifier if Xcode asks.
4. Confirm that the **HealthKit** capability appears in Signing & Capabilities.
5. Connect your iPhone by cable, unlock it, and select it from Xcode's device menu.
6. Click Run.
7. On the phone, tap **Connect Apple Health** and allow GymPact Health Test to read **Steps**.

The Health permission sheet is shown by iOS after the button is tapped. Apple does not reveal a per-data-type read-permission result to apps, so this proof uses a successful Step Count query as the practical verification.

## Verify the result

Open Apple Health on the iPhone, go to **Browse → Activity → Steps**, and compare its **Today** total with the value shown in this app. Both use the current local day's total and may change as Health finishes syncing sources.

## Safari bridge proof

After the native app displays a step count, tap **Open Safari step test**. iOS opens the unlinked `apple-health-bridge-test.html` test page on GymPact's GitHub Pages site. The native app sends the number as `#steps=...`, and the page reads that fragment in browser JavaScript and displays it.

The fragment is not sent to GitHub Pages, Supabase, or the existing GymPact web app. This proves a simple, user-initiated native-to-Safari handoff only; it is not a background sync or a production health-data transport.

## Privacy and scope

The only requested type is HealthKit's Step Count. The project has the HealthKit entitlement and an `NSHealthShareUsageDescription`; it does not request write permission or access to workouts, heart rate, calories, weight, location, or any other Health data.
