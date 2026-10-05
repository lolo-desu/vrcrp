#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/android"
export VRCRP_ANDROID_KEYSTORE="${VRCRP_ANDROID_KEYSTORE:-$ROOT/android/.signing/debug.keystore}"
if test ! -f "$VRCRP_ANDROID_KEYSTORE"; then
  mkdir -p "$(dirname "$VRCRP_ANDROID_KEYSTORE")"
  keytool -genkeypair -keystore "$VRCRP_ANDROID_KEYSTORE" -storepass android -keypass android \
    -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 \
    -dname 'CN=Android Debug,O=Android,C=US' >/dev/null 2>&1
fi
mkdir -p "$ROOT/build/android-read-checks"
javac -d "$ROOT/build/android-read-checks" app/src/main/java/com/vrcrp/app/ChatReadState.java "$ROOT/scripts/android/ChatReadStateChecks.java"
java -cp "$ROOT/build/android-read-checks" com.vrcrp.app.ChatReadStateChecks
./gradlew --no-daemon :app:assembleRelease :app:lintRelease
mkdir -p "$ROOT/build"
cp app/build/outputs/apk/release/app-release.apk "$ROOT/build/vrcrp-android.apk"
echo "$ROOT/build/vrcrp-android.apk"
