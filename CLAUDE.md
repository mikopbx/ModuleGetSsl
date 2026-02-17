# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

MikoPBX extension module for automated SSL certificate management via Let's Encrypt (ACME v2). Uses the `getssl` bash script as the ACME client, supports 40+ DNS providers for DNS-01 validation, and provides real-time certificate request progress via nchan Pub/Sub or polling fallback.

## Build Commands

### JavaScript Compilation
Source files live in `public/assets/js/src/`, compiled output goes to `public/assets/js/`:
```bash
/Users/nb/PhpstormProjects/mikopbx/MikoPBXUtils/node_modules/.bin/babel \
  "public/assets/js/src/module-get-ssl-index.js" \
  --out-dir "public/assets/js/" \
  --source-maps inline \
  --presets airbnb
```
Repeat for each source file (`module-get-ssl-index.js`, `module-get-ssl-status-worker.js`).

### PHP Static Analysis
```bash
phpstan analyse
```

## Architecture

### Module Lifecycle
1. **Installation** (`Setup/PbxExtensionSetup.php`): Creates DB table `m_ModuleGetSsl`, sets defaults, detects domain from internet interface
2. **Runtime** (`Lib/GetSslConf.php`): Registers REST API callbacks, cron tasks, reacts to model changes and PBX lifecycle events
3. **Certificate Request** (`Lib/GetSslMain.php`): Generates getssl config, launches async certificate request, streams progress to browser
4. **Uninstall**: Removes symlinks from `/usr/bin/getssl`, `/usr/share/getssl`, `/usr/www/sites/.well-known`

### Key Classes

- **`Lib/GetSslConf.php`** — Module configuration hook. Handles REST API routing (`GET-CERT`, `CHECK-RESULT`), cron task registration (1st/15th at 01:00), and PBX lifecycle events (`onAfterPbxStarted`, `onAfterModuleEnable`)
- **`Lib/GetSslMain.php`** — Core orchestrator. Manages directories, generates getssl config file, launches certificate requests, monitors process completion (120s timeout), pushes real-time updates via nchan, updates SSL keys in PbxSettings DB
- **`Lib/MikoPBXVersion.php`** — Compatibility layer for Phalcon 4 vs 5 class names. Version cutoff at PBX 2024.2.30
- **`Models/ModuleGetSsl.php`** — Phalcon ORM model for `m_ModuleGetSsl` table (fields: `id`, `domainName`, `autoUpdate`)
- **`App/Controllers/ModuleGetSslController.php`** — Web UI controller: renders form, handles save, triggers certificate request on save
- **`App/Forms/ModuleGetSslForm.php`** — Phalcon form definition with Semantic UI integration

### Frontend (ES6 → Babel → ES5)

- **`public/assets/js/src/module-get-ssl-index.js`** — Form controller: validation, module status toggle, triggers API call to start certificate request, handles async response channel
- **`public/assets/js/src/module-get-ssl-status-worker.js`** — Real-time progress: EventSource (PBX ≥2024.2.30) or polling fallback, Ace editor for log display, 4-stage processing pipeline (STAGE_1–4)

### REST API

- `POST /pbxcore/api/modules/ModuleGetSsl/get-cert` — Start certificate request. Supports async via `X-Async-Response-Channel-Id` header
- `GET /pbxcore/api/modules/ModuleGetSsl/check-result` — Poll log file contents (fallback for older PBX versions)

### Real-time Updates

Pub/Sub channel `module-get-ssl-pub` pushes JSON messages with `moduleUniqueId`, `stage`, `stageDetails`, `pid`. Browser subscribes via EventSource on PBX ≥2024.2.30, falls back to polling `check-result` endpoint on older versions.

### Symlinks Created at Runtime
- `/usr/bin/getssl` → `{moduleDir}/bin/getssl`
- `/usr/share/getssl` → `{moduleDir}/bin/utils`
- `/usr/www/sites/.well-known` → `{moduleDir}/db/getssl/.well-known`
- `/usr/bin/nslookup` → busybox

### Cron Auto-Renewal
Runs `getssl -a -U -q -w {confDir}` on 1st and 15th of each month at 01:00. Cron is reloaded whenever module settings change.

## Phalcon Version Compatibility

Always use `MikoPBXVersion` for version-dependent class imports (Di, Validation, Uniqueness, Text, Logger). PBX versions ≥2024.2.30 use Phalcon 5; older versions use Phalcon 4. Do not hardcode Phalcon namespace paths.

## Internationalization

31 language files in `Messages/`. Translation keys prefixed with `module_getssl_`. English (`en.php`) is the reference file.

## Dependencies

- PHP 7.4+ / 8.0+, Phalcon 4 or 5
- MikoPBX Core framework (`MikoPBX\Common`, `MikoPBX\Core`, `MikoPBX\Modules`, `MikoPBX\AdminCabinet`)
- jQuery, Semantic UI, Ace Editor (from MikoPBX core frontend)
- `getssl` ACME client (`bin/getssl`, embedded 142KB bash script)
