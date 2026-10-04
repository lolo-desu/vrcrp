#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/android"
./gradlew --no-daemon :app:assembleRelease :app:lintRelease
mkdir -p "$ROOT/build"
cp app/build/outputs/apk/release/app-release.apk "$ROOT/build/vrcrp-android.apk"
echo "$ROOT/build/vrcrp-android.apk"
