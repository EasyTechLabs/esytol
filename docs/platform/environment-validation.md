# Environment Validation

> Re-validated 2026-08-05 after the installation work in VYORA-PLATFORM-002 Phase 1.
> Supersedes the VYORA-PLATFORM-001 inventory. Setup steps: `environment-setup.md`.

---

## 1. Status table

| Prerequisite               | Status         | Detected                                                            |
| -------------------------- | -------------- | ------------------------------------------------------------------- |
| Git                        | ✅ **PASS**    | `2.55.0.windows.3`                                                  |
| Node.js                    | ✅ **PASS**    | `v24.19.0` — LTS                                                    |
| npm                        | ✅ **PASS**    | `11.17.0`                                                           |
| **Java JDK 21**            | ✅ **PASS**    | `openjdk 21.0.12 2026-07-21 LTS` (Temurin)                          |
| **javac**                  | ✅ **PASS**    | `javac 21.0.12`                                                     |
| `JAVA_HOME`                | ✅ **PASS**    | `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot`           |
| `ANDROID_HOME`             | ✅ **PASS**    | `C:\Users\dell\AppData\Local\Android\Sdk`                           |
| `ANDROID_SDK_ROOT`         | ✅ **PASS**    | same                                                                |
| PATH entries               | ✅ **PASS**    | JDK `bin`, `platform-tools`, `emulator`, `cmdline-tools\latest\bin` |
| Android Studio             | ✅ **PASS**    | `AI-261.26222.65.2613.15948027`                                     |
| **SDK command-line tools** | ✅ **PASS**    | `sdkmanager 12.0`, `avdmanager` — installed this milestone          |
| **SDK licences**           | ✅ **PASS**    | _"All SDK package licenses accepted"_ (7 of 7)                      |
| **Android SDK API 35**     | ✅ **PASS**    | `platforms;android-35` installed this milestone                     |
| Android Build Tools        | ✅ **PASS**    | `35.0.0` (installed this milestone) + `36.0.0`                      |
| **System image API 35**    | ✅ **PASS**    | `system-images;android-35;google_apis;x86_64`                       |
| Android Platform-Tools     | ✅ **PASS**    | `adb 1.0.41` (`37.0.1`), resolves on PATH                           |
| Android Emulator binary    | ✅ **PASS**    | `37.1.11`                                                           |
| **AVD created**            | ✅ **PASS**    | `vyora_api35` (Pixel 7, API 35, x86_64)                             |
| Gradle wrapper             | ✅ **PASS**    | n/a — projects use `gradlew`                                        |
| winget                     | ✅ **PASS**    | available                                                           |
| **AVD boots**              | ❌ **BLOCKED** | _"x86_64 emulation currently requires hardware acceleration"_       |
| **Hypervisor driver**      | ❌ **BLOCKED** | AEHD 2.2 downloaded to `extras\`; **service not installed**         |
| **Docker Desktop**         | ❌ **BLOCKED** | not installed                                                       |
| **PostgreSQL / psql**      | ❌ **BLOCKED** | not installed (fallback only — Docker preferred)                    |

**20 PASS · 4 BLOCKED.** Previous state was 6 PASS · 4 PARTIAL · 7 BLOCKED.

## 2. What changed

**Java is no longer a blocker.** The machine had **JRE 1.8.0_501 only** — no compiler. JDK 21
(Temurin) was installed via winget; `java --version` and `javac --version` both report 21.0.12 LTS.

**The whole Android SDK chain is now provisioned.** The command-line tools download had timed out
twice in earlier attempts; a third attempt with a 15-minute allowance completed (153,583,359 bytes).
That unblocked everything downstream in one pass: `sdkmanager` → all 7 licences accepted
non-interactively → API 35, build-tools 35.0.0 and the `google_apis;x86_64` system image installed →
`avdmanager` created AVD `vyora_api35`.

**All environment variables are set** at **User** scope, so they persist across reboots.

> Verification note: shells started **before** these variables were set will not see them — Windows
> reads the environment once at process start. Verified in this session both by invoking the binaries
> via absolute path and by separately reading the persisted User-scope values. Both agree.

**Node.js is PASS, not PARTIAL.** The earlier report marked `v24.19.0` as "Current, not LTS". That
was wrong — 24.x is an LTS line. Corrected here.

## 3. What is still blocked

### 3.1 The emulator will not boot — hardware acceleration missing

The AVD exists and is correctly configured. Boot fails at the acceleration check:

```
ERROR | x86_64 emulation currently requires hardware acceleration!
CPU acceleration status: Android Emulator hypervisor driver is not installed on this machine
```

Confirmed independently: `Win32_ComputerSystem.HypervisorPresent` is `False`, and
`sc query aehd` returns error 1060 — _the specified service does not exist_.

The fix is the **Android Emulator Hypervisor Driver (AEHD)**. Its package was installed to
`%ANDROID_HOME%\extras\google\Android_Emulator_Hypervisor_Driver\`, but its `silent_install.bat`
registers a **kernel-mode driver** and sets boot configuration (`bcdedit`). That requires an
elevated shell and a **reboot** — deliberately not attempted from this non-interactive session.

> This is the only Android gap left, and it is one command plus a reboot. Everything it depends on
> is already in place.

### 3.2 No database stack

Neither Docker Desktop nor native PostgreSQL is installed. Docker Desktop needs elevation, a licence
acceptance on first run, and a reboot; Hyper-V is currently off, so it will need WSL2 or Hyper-V
enabled as well.

### 3.3 Why these two were not automated

| Blocker        | Reason it needs the founder                                                      |
| -------------- | -------------------------------------------------------------------------------- |
| AEHD driver    | Kernel driver install + `bcdedit` + reboot; shell is **not elevated** (verified) |
| Docker Desktop | Elevation + interactive licence + reboot + likely WSL2/Hyper-V enablement        |
| PostgreSQL     | Fallback path only. Install **only** if Docker cannot be enabled.                |

Commands for both are in `environment-setup.md` §3.

## 4. Re-validation command set

Run from a **newly opened** terminal:

```powershell
java --version                     # 21.0.12 LTS                    [PASS]
javac --version                    # 21.0.12                        [PASS]
$env:JAVA_HOME                     #                                [PASS]
$env:ANDROID_HOME                  #                                [PASS]
adb version                        # 1.0.41                         [PASS]
sdkmanager --list_installed        # includes platforms;android-35  [PASS]
emulator -list-avds                # vyora_api35                    [PASS]
emulator -avd vyora_api35          # boots                          [BLOCKED — 3.1]
adb devices                        # one "device"                   [BLOCKED — 3.1]
docker compose version             #                                [BLOCKED — 3.2]
```

`adb devices` currently returns an empty list, as expected while §3.1 is unresolved.

## 5. Overall

# ⚠️ PARTIALLY UNBLOCKED

**Backend work is unblocked.** Node, npm and Git are PASS, so `vyora-api/` can be scaffolded and the
web app continues to build and test normally. **PostgreSQL is still required before any persistence
work begins.**

**Mobile work is one reboot away.** The JDK, SDK, licences, API 35, system image and AVD are all in
place. Only the hypervisor driver stands between this machine and a bootable emulator — so this is
no longer a provisioning problem, just a pending elevated action.

**Neither blocker affects this milestone.** VYORA-PLATFORM-002 is documentation only; the
architecture and migration design in this directory required no runtime to produce.
