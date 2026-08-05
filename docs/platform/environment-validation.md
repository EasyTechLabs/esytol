# Environment Validation — VYORA-PLATFORM-001 Phase 1

> Inventory taken 2026-08-05 on the founder's Windows 10 machine (build 19045).
> **No software was installed during this inventory.** Installation requires the founder actions
> listed in §3.

---

## 1. Status table

| Prerequisite                 | Status         | Detected                            | Required                                  |
| ---------------------------- | -------------- | ----------------------------------- | ----------------------------------------- |
| Git                          | ✅ **PASS**    | `2.55.0.windows.3`                  | any recent                                |
| Node.js                      | ⚠️ **PARTIAL** | `v24.19.0`                          | **LTS (22.x)** — 24.x is Current, not LTS |
| npm                          | ✅ **PASS**    | `11.17.0`                           | —                                         |
| **Java JDK 21**              | ❌ **BLOCKED** | **JRE 1.8.0_501 only — no `javac`** | JDK 21                                    |
| Android Studio               | ✅ **PASS**    | `AI-261.26222.65.2613.15948027`     | —                                         |
| Android SDK Platform         | ⚠️ **PARTIAL** | `android-37.0`                      | **API 35** not installed                  |
| Android Build Tools          | ✅ **PASS**    | `36.0.0`                            | —                                         |
| Android Platform-Tools / adb | ⚠️ **PARTIAL** | `adb.exe` present in SDK            | **not on PATH**                           |
| Android Emulator             | ✅ **PASS**    | `emulator.exe` present              | AVD profile not yet created               |
| **SDK command-line tools**   | ❌ **BLOCKED** | `cmdline-tools/` **empty**          | required by RN/Gradle                     |
| Gradle wrapper               | ✅ **PASS**    | n/a — projects use `gradlew`        | no global install needed                  |
| **Docker Desktop**           | ❌ **BLOCKED** | not installed                       | required for local PostgreSQL             |
| **PostgreSQL 16+**           | ❌ **BLOCKED** | not installed                       | required                                  |
| **psql CLI**                 | ❌ **BLOCKED** | not installed                       | required                                  |
| `JAVA_HOME`                  | ❌ **BLOCKED** | not set                             | required                                  |
| `ANDROID_HOME`               | ❌ **BLOCKED** | not set                             | required                                  |
| winget                       | ✅ **PASS**    | available                           | —                                         |

**Summary: 6 PASS · 4 PARTIAL · 7 BLOCKED.**

## 2. Detail

**Java is the hardest blocker.** `java -version` reports `1.8.0_501` and `javac` is absent — this is
a **JRE, not a JDK**. `C:\Program Files\Java` contains only `jre1.8.0_501`. React Native and Gradle
require **JDK 21**. Nothing Android-related can be built until this is fixed.

**Android SDK is partially provisioned.** Studio is installed and the SDK has `build-tools/36.0.0`,
`platform-tools`, `emulator` and `platforms/android-37.0`. Two gaps: **API 35 is not installed**
(only 37.0), and **`cmdline-tools/` is empty** — `sdkmanager` and `avdmanager` are unavailable, so
SDK components cannot be managed from the command line.

**No database stack at all.** Neither Docker Desktop nor a native PostgreSQL install is present.
Phase 3 cannot start without one.

**No environment variables set.** `JAVA_HOME`, `ANDROID_HOME` and `ANDROID_SDK_ROOT` are all unset
at both User and Machine scope.

## 3. Founder actions required — these cannot be automated

| #   | Action                                                                                       | Why it needs you                                                                                       |
| --- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | **Install JDK 21** — `winget install EclipseAdoptium.Temurin.21.JDK`                         | Elevation prompt                                                                                       |
| 2   | **Install Docker Desktop** — `winget install Docker.DockerDesktop`                           | Elevation, **licence agreement on first run**, and a **reboot**. May require enabling WSL2 or Hyper-V. |
| 3   | **Accept Android SDK licences** — Android Studio → SDK Manager                               | Interactive licence acceptance; cannot be scripted without `sdkmanager`, which is missing              |
| 4   | **Install API 35 + command-line tools** — Studio → SDK Manager → SDK Platforms / SDK Tools   | Same                                                                                                   |
| 5   | **Create an AVD** — Studio → Device Manager                                                  | GUI-only                                                                                               |
| 6   | **Decide on PostgreSQL** — Docker (recommended) or `winget install PostgreSQL.PostgreSQL.16` | Docker choice depends on #2                                                                            |

**Recommended order:** 1 → 3 → 4 → 5 → 2 → 6. Java first unblocks the most; Docker last because it
needs a reboot.

## 4. After the founder's actions — validation to run

```powershell
java -version                      # expect 21.x
javac -version                     # expect 21.x
echo $env:JAVA_HOME
echo $env:ANDROID_HOME
adb --version
sdkmanager --list_installed
emulator -list-avds
docker --version
docker compose version
psql --version
```

Every one must succeed before Phase 3 begins.

## 5. Environment variables to set (after JDK 21 is installed)

```powershell
[Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Eclipse Adoptium\jdk-21...", "User")
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
# append to User PATH:
#   %ANDROID_HOME%\platform-tools
#   %ANDROID_HOME%\emulator
#   %ANDROID_HOME%\cmdline-tools\latest\bin
#   %JAVA_HOME%\bin
```

Exact JDK path must be confirmed after install — do not guess the version suffix.

## 6. Overall

# ❌ BLOCKED

**Phases 3–6 cannot start.** There is no JDK, no Docker, and no PostgreSQL — so no backend, no
database, and no Android build is possible on this machine today.

Phases 0 and 2 (audit and design documentation) are unaffected and can proceed, since they require
no runtime.
