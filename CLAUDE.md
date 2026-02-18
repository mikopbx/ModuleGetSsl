# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

MikoPBX extension module for automated SSL certificate management via Let's Encrypt (ACME v2). Uses the `getssl` bash script as the ACME client with HTTP-01 validation, and provides real-time certificate request progress via nchan Pub/Sub or polling fallback.

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
Config in `phpstan.neon`: level 0, scans `Lib/`, `Models/`, `bin/`, `App/`, `Setup/`. Requires MikoPBX Core sources at `../../Core/src` for class resolution. Ignores Phalcon 4/5 compatibility class-not-found errors.

## Architecture

### PSR-4 Namespace
Root namespace `Modules\ModuleGetSsl\` maps to repository root (see `composer.json`).

### Module Lifecycle
1. **Installation** (`Setup/PbxExtensionSetup.php`): Creates DB table `m_ModuleGetSsl`, sets defaults, detects domain from internet interface
2. **Runtime** (`Lib/GetSslConf.php`): Registers REST API callbacks, cron tasks, reacts to model changes and PBX lifecycle events
3. **Certificate Request** (`Lib/GetSslMain.php`): Generates getssl config, launches async certificate request, streams progress to browser
4. **Port 80 Management** (`Lib/AcmeHttpPort.php`): Temporarily opens port 80 for ACME HTTP-01 validation — creates nginx server block at `/etc/nginx/mikopbx/modules_servers/ModuleGetSsl_acme80.conf`, adds iptables rules when firewall is active, uses a lock file at `/var/run/custom_modules/ModuleGetSsl/acme_port80.lock` with 300s max open time and automatic stale cleanup
5. **Uninstall**: Removes symlinks from `/usr/bin/getssl`, `/usr/share/getssl`, `/usr/www/sites/.well-known`

### Key Classes

- **`Lib/GetSslConf.php`** — Module configuration hook (extends `ConfigClass`). Handles REST API routing (`GET-CERT`, `CHECK-RESULT`), cron task registration, and PBX lifecycle events (`onAfterPbxStarted`, `onAfterModuleEnable`). Wraps cert requests in `AcmeHttpPort::openPort()`/`closePort()` via try/finally
- **`Lib/GetSslMain.php`** — Core orchestrator. Manages directories, generates getssl config file, launches certificate requests, monitors process completion (120s timeout), pushes real-time updates via nchan, updates SSL keys in PbxSettings DB
- **`Lib/AcmeHttpPort.php`** — Port 80 lifecycle manager. Opens/closes nginx + iptables for ACME validation. Includes stale lock cleanup (cron watchdog + PBX startup)
- **`Lib/MikoPBXVersion.php`** — Compatibility layer for Phalcon 4 vs 5 class names. Version cutoff at PBX 2024.2.30
- **`Models/ModuleGetSsl.php`** — Phalcon ORM model for `m_ModuleGetSsl` table (fields: `id`, `domainName`, `autoUpdate`). Source table: `m_ModuleGetSsl`
- **`App/Controllers/ModuleGetSslController.php`** — Web UI controller: renders form, handles save, triggers certificate request on save
- **`App/Forms/ModuleGetSslForm.php`** — Phalcon form definition. Note: `addCheckBox()` helper exists for backward compat and can be removed when `min_pbx_version` ≥ 2024.3.0

### CLI Scripts (`bin/`)

All scripts bootstrap via `require_once('Globals.php')` which loads the MikoPBX DI container.

- **`cronRenewCert.php`** — Cron entry point: opens port 80, runs `getssl -a -U -q`, installs cert, closes port 80
- **`reloadCmd.php`** — Called by getssl after successful cert issuance; installs cert/key into PbxSettings
- **`reloadCron.php`** — Reloads cron configuration when module settings change
- **`cleanupPort80.php`** — Cron watchdog (runs every minute): calls `AcmeHttpPort::cleanupStale()`
- **`updateCert.php`** — Manual cert request without nchan (runs synchronously)

### Frontend (ES6 → Babel → ES5)

- **`public/assets/js/src/module-get-ssl-index.js`** — Form controller: validation, module status toggle, triggers API call to start certificate request, handles async response channel
- **`public/assets/js/src/module-get-ssl-status-worker.js`** — Real-time progress: EventSource (PBX ≥2024.2.30) or polling fallback, Ace editor for log display, 4-stage processing pipeline (STAGE_1–4)

### Real-time Updates Flow

1. Browser sends `POST /pbxcore/api/modules/ModuleGetSsl/get-cert` with `X-Async-Response-Channel-Id: module-get-ssl-pub`
2. Backend opens port 80, generates config, launches getssl, monitors process (120s timeout)
3. Progress pushed to nchan channel `module-get-ssl-pub` as JSON with `moduleUniqueId`, `stage`, `stageDetails`, `pid`
4. Browser subscribes via EventSource (PBX ≥2024.2.30) or polls `check-result` endpoint
5. Backend closes port 80 in `finally` block

### Symlinks Created at Runtime
- `/usr/bin/getssl` → `{moduleDir}/bin/getssl`
- `/usr/share/getssl` → `{moduleDir}/bin/utils`
- `/usr/www/sites/.well-known` → `{moduleDir}/db/getssl/.well-known`
- `/usr/bin/nslookup` → busybox

## Phalcon Version Compatibility

Always use `MikoPBXVersion` for version-dependent class imports (Di, Validation, Uniqueness, Text, Logger). PBX versions ≥2024.2.30 use Phalcon 5; older versions use Phalcon 4. Do not hardcode Phalcon namespace paths.

## Internationalization

Language files in `Messages/`. Translation keys prefixed with `module_getssl_`. English (`en.php`) is the reference file. Translations managed via Weblate.

## Dependencies

- PHP 7.4+ / 8.0+, Phalcon 4 or 5
- MikoPBX Core framework (`MikoPBX\Common`, `MikoPBX\Core`, `MikoPBX\Modules`, `MikoPBX\AdminCabinet`)
- jQuery, Semantic UI, Ace Editor (from MikoPBX core frontend)
- `getssl` ACME client (`bin/getssl`, embedded bash script)
- Minimum PBX version: 2024.1.114 (from `module.json`)
