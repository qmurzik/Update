#!/usr/bin/env bash
# Offline build of the LiteTok APK using Debian/Ubuntu's packaged Android
# tools (aapt, aidl, dalvik-exchange/dx, zipalign, apksigner) instead of
# Gradle + the Android SDK Manager, which need dl.google.com.
#
# Requires (Ubuntu/Debian): aapt aidl apksigner zipalign android-sdk-platform-23
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$PROJECT_DIR/app/src/main"
BUILD_DIR="$PROJECT_DIR/build-offline"
PACKAGE_NAME="ru.qmurzik.litetok"

ANDROID_JAR="/usr/lib/android-sdk/platforms/android-23/android.jar"
DX_JAR="/usr/lib/android-sdk/build-tools/debian/lib/dx.jar"

if [ ! -f "$ANDROID_JAR" ]; then
    echo "android.jar not found at $ANDROID_JAR - install android-sdk-platform-23" >&2
    exit 1
fi

GEN_DIR="$BUILD_DIR/gen"
OBJ_DIR="$BUILD_DIR/obj"
DEX_DIR="$BUILD_DIR/dex"
APK_DIR="$BUILD_DIR/apk"
KEYSTORE="$BUILD_DIR/debug.keystore"

rm -rf "$BUILD_DIR"
mkdir -p "$GEN_DIR" "$OBJ_DIR" "$DEX_DIR" "$APK_DIR"

echo "==> Generating R.java from resources"
aapt package -f -m \
    -J "$GEN_DIR" \
    -M "$APP_DIR/AndroidManifest.xml" \
    -S "$APP_DIR/res" \
    -I "$ANDROID_JAR"

echo "==> Compiling Java sources"
JAVA_SOURCES="$BUILD_DIR/java-sources.txt"
find "$APP_DIR/java" "$GEN_DIR" -name "*.java" > "$JAVA_SOURCES"
javac -encoding UTF-8 -source 8 -target 8 -nowarn -Xlint:-options \
    -bootclasspath "$ANDROID_JAR" \
    -d "$OBJ_DIR" \
    @"$JAVA_SOURCES"

echo "==> Converting classes to Dalvik bytecode (classes.dex)"
java -jar "$DX_JAR" --dex --min-sdk-version=21 --output="$DEX_DIR/classes.dex" "$OBJ_DIR"

echo "==> Packaging unsigned APK"
UNSIGNED_APK="$APK_DIR/litetok-unsigned.apk"
aapt package -f \
    -M "$APP_DIR/AndroidManifest.xml" \
    -S "$APP_DIR/res" \
    -I "$ANDROID_JAR" \
    -F "$UNSIGNED_APK" \
    --min-sdk-version 21 \
    --target-sdk-version 23 \
    --version-code 1 \
    --version-name "1.0" \
    "$DEX_DIR"

echo "==> Zip-aligning APK"
ALIGNED_APK="$APK_DIR/litetok-aligned.apk"
zipalign -f 4 "$UNSIGNED_APK" "$ALIGNED_APK"

echo "==> Creating a debug signing key (if missing)"
if [ ! -f "$KEYSTORE" ]; then
    keytool -genkeypair -v \
        -keystore "$KEYSTORE" \
        -storepass android -keypass android \
        -alias litetok-debug \
        -keyalg RSA -keysize 2048 -validity 10000 \
        -dname "CN=LiteTok Debug, OU=Dev, O=qmurzik, L=Local, S=Local, C=RU" \
        > /dev/null
fi

echo "==> Signing APK"
SIGNED_APK="$PROJECT_DIR/litetok-debug.apk"
apksigner sign \
    --ks "$KEYSTORE" --ks-pass pass:android --key-pass pass:android \
    --out "$SIGNED_APK" \
    "$ALIGNED_APK"

echo "==> Verifying signature"
apksigner verify --verbose "$SIGNED_APK"

echo ""
echo "Built: $SIGNED_APK"
aapt dump badging "$SIGNED_APK" | head -5
