# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

MikoPBX extension module for automated SSL certificate management via Let's Encrypt (ACME v2). Uses `acme.sh` as the primary ACME client with support for both **HTTP-01** and **DNS-01** validation methods. Provides real-time certificate request progress via nchan Pub/Sub or polling fallback.

**DNS-01 support** enables certificate issuance without opening port 80, using DNS provider APIs (Cloudflare, AWS Route53, Hetzner, Yandex Cloud, and 150+ others). Also supports wildcard certificates (`*.domain.com`).

Legacy `getssl` client files are retained for one transition release cycle.

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
Config in `phpstan.neon`: level 0, scans `Lib/`, `Models/`, `bin/`, `App/`, `Setup/`. Requires MikoPBX Core sources at `../../Core/src` for class resolution. Ignores Phalcon 4/5 compatibility class-not-found errors. The `bin/` scripts report `Globals.php` not found — this is expected (runtime file from MikoPBX DI container).

## Architecture

### PSR-4 Namespace
Root namespace `Modules\ModuleGetSsl\` maps to repository root (see `composer.json`).

### Module Lifecycle
1. **Installation** (`Setup/PbxExtensionSetup.php`): Creates DB table `m_ModuleGetSsl`, sets defaults (including `challengeType='http'` for migration), detects domain from internet interface
2. **Runtime** (`Lib/GetSslConf.php`): Registers REST API callbacks, cron tasks, reacts to model changes and PBX lifecycle events
3. **Certificate Request** (`Lib/GetSslMain.php`): Prepares acme.sh environment, launches async certificate request (HTTP-01 via `--webroot` or DNS-01 via `--dns`), streams progress to browser
4. **Port 80 Management** (`Lib/AcmeHttpPort.php`): Temporarily opens port 80 for ACME HTTP-01 validation only — creates nginx server block at `/etc/nginx/mikopbx/modules_servers/ModuleGetSsl_acme80.conf`, adds iptables rules when firewall is active, uses a lock file at `/var/run/custom_modules/ModuleGetSsl/acme_port80.lock` with 300s max open time and automatic stale cleanup. **Skipped entirely for DNS-01.**
5. **Uninstall**: Removes symlinks `/usr/bin/acme.sh`, `/usr/bin/getssl`, `/usr/share/getssl`, `/usr/www/sites/.well-known`

### Key Classes

- **`Lib/GetSslMain.php`** — Core orchestrator. Manages directories, prepares acme.sh environment (`prepareAcmeEnvironment()`), builds acme.sh commands for HTTP-01 or DNS-01, launches certificate requests, monitors process completion (120s for HTTP-01 / 300s for DNS-01), pushes real-time updates via nchan, updates SSL keys in PbxSettings DB. Finds certificates in acme.sh paths first, falls back to legacy getssl paths
- **`Lib/GetSslConf.php`** — Module configuration hook (extends `ConfigClass`). Handles REST API routing (`GET-CERT`, `CHECK-RESULT`), cron task registration, and PBX lifecycle events (`onAfterPbxStarted`, `onAfterModuleEnable`). Conditionally wraps cert requests in `AcmeHttpPort::openPort()`/`closePort()` only for HTTP-01
- **`Lib/AcmeHttpPort.php`** — Port 80 lifecycle manager. Opens/closes nginx + iptables for ACME HTTP-01 validation. Includes stale lock cleanup (cron watchdog + PBX startup)
- **`Lib/DnsProviderRegistry.php`** — Static registry of 23 popular DNS providers with env variable definitions. Single source of truth for backend (form select options) and frontend (dynamic credential fields). Methods: `getProviders()`, `getProviderById()`, `getProviderSelectOptions()`
- **`Lib/MikoPBXVersion.php`** — Compatibility layer for Phalcon 4 vs 5 class names. Version cutoff at PBX 2024.2.30
- **`Models/ModuleGetSsl.php`** — Phalcon ORM model for `m_ModuleGetSsl` table. Fields: `id`, `domainName`, `autoUpdate`, `challengeType` ('http'|'dns'), `dnsProvider` (e.g. 'dns_cf'), `dnsCredentials` (base64-encoded JSON)
- **`App/Controllers/ModuleGetSslController.php`** — Web UI controller: renders form with DNS provider options, passes `dnsProvidersJson` to view for JS, handles save including `dnsCredentials`
- **`App/Forms/ModuleGetSslForm.php`** — Phalcon form definition with Select for `challengeType`, Select for `dnsProvider` (with search), Hidden for `dnsCredentials`. Note: `addCheckBox()` helper exists for backward compat and can be removed when `min_pbx_version` ≥ 2024.3.0

### ACME Client (`bin/acme/`)

- **`bin/acme/acme.sh`** — acme.sh ACME client (primary)
- **`bin/acme/dnsapi/`** — 168 DNS provider hook scripts for DNS-01 validation
- **`bin/getssl`** — Legacy getssl client (retained for transition)
- **`bin/utils/`** — Legacy getssl utilities (retained for transition)

### CLI Scripts (`bin/`)

All scripts bootstrap via `require_once('Globals.php')` which loads the MikoPBX DI container.

- **`cronRenewCert.php`** — Cron entry point: conditionally opens port 80 (HTTP-01 only), runs `acme.sh --cron`, installs cert, closes port 80
- **`reloadCmd.php`** — Called by acme.sh `--reloadcmd` after successful cert issuance; installs cert/key into PbxSettings
- **`reloadCron.php`** — Reloads cron configuration when module settings change
- **`cleanupPort80.php`** — Cron watchdog (runs every minute): calls `AcmeHttpPort::cleanupStale()`
- **`updateCert.php`** — Manual cert request without nchan (runs synchronously)

### Frontend (ES6 → Babel → ES5)

- **`public/assets/js/src/module-get-ssl-index.js`** — Form controller: validation, module status toggle, challenge type switching (HTTP-01/DNS-01), dynamic DNS provider credential fields based on `dnsProvidersMeta`, credential collection/restoration (base64 JSON), triggers API call to start certificate request
- **`public/assets/js/src/module-get-ssl-status-worker.js`** — Real-time progress: EventSource (PBX ≥2024.2.30) or polling fallback, Ace editor for log display, 4-stage processing pipeline (STAGE_1–4)

### Real-time Updates Flow

1. Browser sends `POST /pbxcore/api/modules/ModuleGetSsl/get-cert` with `X-Async-Response-Channel-Id: module-get-ssl-pub`
2. Backend conditionally opens port 80 (HTTP-01 only), prepares acme.sh environment, launches acme.sh, monitors process (120s HTTP-01 / 300s DNS-01)
3. Progress pushed to nchan channel `module-get-ssl-pub` as JSON with `moduleUniqueId`, `stage`, `stageDetails`, `pid`
4. Browser subscribes via EventSource (PBX ≥2024.2.30) or polls `check-result` endpoint
5. Backend closes port 80 in `finally` block (HTTP-01 only)

### DNS-01 Challenge Flow

1. User selects DNS-01 in the UI, picks a DNS provider, enters API credentials
2. Credentials stored as base64-encoded JSON in `dnsCredentials` model field
3. On cert request: credentials decoded to `export VAR='val'; ...` prefix before acme.sh command
4. acme.sh creates `_acme-challenge` TXT record via DNS provider API, validates, cleans up
5. No port 80 required — works behind firewalls and NAT

### Symlinks Created at Runtime
- `/usr/bin/acme.sh` → `{moduleDir}/bin/acme/acme.sh`
- `/usr/bin/getssl` → `{moduleDir}/bin/getssl` (legacy)
- `/usr/share/getssl` → `{moduleDir}/bin/utils` (legacy)
- `/usr/www/sites/.well-known` → `{moduleDir}/db/getssl/.well-known` (HTTP-01 only)
- `/usr/bin/nslookup` → busybox

### Certificate Storage Paths

acme.sh stores certificates in `{moduleDir}/db/acme/{domain}/`:
- `fullchain.cer` — full certificate chain
- `{domain}.key` — private key

Legacy getssl paths (`{moduleDir}/db/getssl/{domain}/`) are checked as fallback.

## Phalcon Version Compatibility

Always use `MikoPBXVersion` for version-dependent class imports (Di, Validation, Uniqueness, Text, Logger). PBX versions ≥2024.2.30 use Phalcon 5; older versions use Phalcon 4. Do not hardcode Phalcon namespace paths.

## Internationalization

Language files in `Messages/`. Translation keys prefixed with `module_getssl_`. English (`en.php`) is the reference file. Translations managed via Weblate.

## Dependencies

- PHP 7.4+ / 8.0+, Phalcon 4 or 5
- MikoPBX Core framework (`MikoPBX\Common`, `MikoPBX\Core`, `MikoPBX\Modules`, `MikoPBX\AdminCabinet`)
- jQuery, Semantic UI, Ace Editor (from MikoPBX core frontend)
- `acme.sh` ACME client (`bin/acme/acme.sh`, embedded bash script)
- Minimum PBX version: 2024.1.114 (from `module.json`)
