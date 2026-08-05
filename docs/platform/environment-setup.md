# Development Environment Setup — Windows

> Records what was installed and configured on 2026-08-05, and what remains.
> Status per prerequisite: `environment-validation.md`.

---

## 1. Installed and configured in this milestone

### 1.1 JDK 21

```powershell
winget install --id EclipseAdoptium.Temurin.21.JDK --silent --accept-package-agreements --accept-source-agreements
```

Result: `openjdk 21.0.12 2026-07-21 LTS`, `javac 21.0.12`, at
`C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot`.

The machine previously had **JRE 1.8.0_501 only** — a runtime with no compiler.

### 1.2 Environment variables

Set at **User** scope, so they persist across reboots:

```
JAVA_HOME        = C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot
ANDROID_HOME     = C:\Users\dell\AppData\Local\Android\Sdk
ANDROID_SDK_ROOT = C:\Users\dell\AppData\Local\Android\Sdk
```

PATH additions (User scope):

```
%JAVA_HOME%\bin
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\emulator
%ANDROID_HOME%\cmdline-tools\latest\bin
```

> **Note:** terminals opened _before_ these were set will not see them — Windows reads the
> environment once at process start. Open a new terminal before verifying.

### 1.3 Android SDK command-line tools

`cmdline-tools\` was empty, so `sdkmanager` and `avdmanager` did not exist. The download from
Google's CDN timed out twice at 10 minutes; a third attempt with a 15-minute allowance completed
(153,583,359 bytes).

```powershell
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
Invoke-WebRequest "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip" `
  -OutFile "$env:TEMP\clt.zip" -TimeoutSec 900
Expand-Archive "$env:TEMP\clt.zip" "$env:TEMP\clt" -Force
New-Item -ItemType Directory -Force "$sdk\cmdline-tools\latest" | Out-Null
Copy-Item "$env:TEMP\clt\cmdline-tools\*" "$sdk\cmdline-tools\latest" -Recurse -Force
```

Verified: `sdkmanager --version` → `12.0`.

> `sdkmanager` prints _"This version only understands SDK XML versions up to 3 but an SDK XML file of
> version 4 was encountered."_ This is expected — the standalone tools release lags the SDK shipped
> with Studio. It is a warning, not an error; every install below succeeded.

### 1.4 Licences

```powershell
yes | sdkmanager --licenses      # Git Bash; PowerShell piping does not feed this prompt
```

Result: **"All SDK package licenses accepted"** — 7 of 7.

### 1.5 SDK packages

```powershell
sdkmanager "platforms;android-35" "build-tools;35.0.0" "system-images;android-35;google_apis;x86_64"
```

Installed set is now:

| Package                                       | Version |
| --------------------------------------------- | ------- |
| `platforms;android-35`                        | 2       |
| `platforms;android-37.0`                      | 2       |
| `build-tools;35.0.0`                          | 35.0.0  |
| `build-tools;36.0.0`                          | 36.0.0  |
| `platform-tools`                              | 37.0.1  |
| `emulator`                                    | 37.1.11 |
| `system-images;android-35;google_apis;x86_64` | 9       |

### 1.6 Emulator profile

```powershell
avdmanager create avd -n vyora_api35 -k "system-images;android-35;google_apis;x86_64" -d pixel_7
emulator -list-avds        # vyora_api35
```

The AVD exists and is correctly configured. **It does not boot yet** — see §3.1.

## 2. Already present, unchanged

| Tool           | Version                       |
| -------------- | ----------------------------- |
| Git            | 2.55.0.windows.3              |
| Node.js        | v24.19.0                      |
| npm            | 11.17.0                       |
| Android Studio | AI-261.26222.65.2613.15948027 |

Gradle is intentionally not installed globally — React Native projects use the Gradle **wrapper**.

## 3. Remaining — founder interaction required

Both remaining items need an **elevated** shell and a **reboot**. This session's shell is not
elevated (verified), so neither was attempted.

### 3.1 Android Emulator Hypervisor Driver — unblocks the emulator

Boot currently fails with:

```
ERROR | x86_64 emulation currently requires hardware acceleration!
CPU acceleration status: Android Emulator hypervisor driver is not installed on this machine
```

The driver package is **already downloaded** to
`%ANDROID_HOME%\extras\google\Android_Emulator_Hypervisor_Driver\`. It needs registering:

1. Open **PowerShell as Administrator**
2. Run:

```powershell
cd "$env:LOCALAPPDATA\Android\Sdk\extras\google\Android_Emulator_Hypervisor_Driver"
.\silent_install.bat
```

3. **Reboot**
4. Verify from a normal terminal:

```powershell
sc.exe query aehd            # expect RUNNING (currently: error 1060, service not found)
emulator -avd vyora_api35    # expect a window
adb devices                  # expect one "device"
```

**Prerequisite:** hardware virtualisation (Intel VT-x / AMD-V) must be enabled in BIOS/UEFI. If
`silent_install.bat` reports a virtualisation error, enable it there first.

> Alternative: Windows Hyper-V (`HypervisorPresent` is currently `False`). AEHD is the lighter option
> and does not conflict with other virtualisation software, so it is the recommended path.

### 3.2 Docker Desktop — unblocks PostgreSQL

Not installed and not attempted: it needs elevation, a licence acceptance on first run, WSL2 or
Hyper-V enablement, and a reboot. None of that is possible from a non-interactive shell.

```powershell
winget install --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
```

Then launch Docker Desktop, accept the licence, complete WSL2 setup if prompted, reboot, and verify:

```powershell
docker --version
docker compose version
```

**Fallback if Docker cannot be enabled:**

```powershell
winget install --id PostgreSQL.PostgreSQL.16
psql --version
```

Install **one or the other**, not both.

> If §3.1 is done via Hyper-V rather than AEHD, do it in the same reboot as Docker — Docker Desktop
> can enable Hyper-V itself, which satisfies both.

## 4. Secrets

No `.env` files were created. When the API exists, `vyora-api/.env.example` will hold placeholders
only — never real credentials, connection strings, or tokens. `.gitignore` must cover `.env`,
`.env.local`, database dumps and Android SDK artefacts before any of those exist.
