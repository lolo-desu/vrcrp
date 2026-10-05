#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/android"
mkdir -p "$ROOT/build/android-read-checks"
javac -d "$ROOT/build/android-read-checks" app/src/main/java/com/vrcrp/app/ChatReadState.java "$ROOT/scripts/android/ChatReadStateChecks.java"
java -cp "$ROOT/build/android-read-checks" com.vrcrp.app.ChatReadStateChecks
./gradlew --no-daemon :app:assembleRelease :app:lintRelease
mkdir -p "$ROOT/build"
cp app/build/outputs/apk/release/app-release.apk "$ROOT/build/vrcrp-android.apk"
echo "$ROOT/build/vrcrp-android.apk"
