# Domain and Public IP Certificate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Issue and automatically renew one short-lived certificate containing a configured domain and an explicit public IP address.

**Architecture:** A dependency-free `CertificateIdentifierPolicy` centralizes IP recognition, public-address validation, SAN construction, challenge constraints, and renewal cadence. The model/controller persist two new settings, `GetSslMain` consumes the policy for issuance and cron behavior, and the existing form controller mirrors those rules for immediate feedback.

**Tech Stack:** PHP 7.4+, Phalcon model/forms, acme.sh 3.1.3, ES6/jQuery/Semantic UI, Node test runner, Babel.

## Global Constraints

- Keep the primary domain first in the ACME identifier list so existing certificate paths remain stable.
- Any IP-containing order uses HTTP-01, `--cert-profile shortlived`, mandatory auto-renewal, and hourly renewal checks.
- The additional address accepts only public IPv4/IPv6 and is ignored unless explicitly enabled for a domain primary identifier.
- Existing domain-only installations retain their current behavior.
- Every shell identifier is escaped independently.

---

### Task 1: Certificate identifier policy

**Files:**
- Create: `Lib/CertificateIdentifierPolicy.php`
- Create: `tests/CertificateIdentifierPolicyTest.php`

**Interfaces:**
- Produces: `isIpAddress(string): bool`, `isPublicIpAddress(string): bool`, `getIdentifiers(array): array`, `containsIpAddress(array): bool`, `requiresHttp01(array): bool`, `getCronSchedule(array): string`.

- [x] **Step 1: Write failing policy tests** covering domain-only, IP-only, enabled domain+public IPv4/IPv6, disabled additional IP, private/malformed IP rejection, forced HTTP-01, and cron strings `17 * * * *` versus `0 1 1,15 * *`.
- [x] **Step 2: Run `php tests/CertificateIdentifierPolicyTest.php`** and confirm failure because the policy class is absent.
- [x] **Step 3: Implement the static dependency-free policy** using `filter_var`, `FILTER_FLAG_NO_PRIV_RANGE`, and `FILTER_FLAG_NO_RES_RANGE`; throw `InvalidArgumentException` for inconsistent enabled settings.
- [x] **Step 4: Re-run the policy test** and require all assertions to pass.

### Task 2: Persistence and issuance

**Files:**
- Modify: `Models/ModuleGetSsl.php`
- Modify: `Setup/PbxExtensionSetup.php`
- Modify: `App/Forms/ModuleGetSslForm.php`
- Modify: `App/Controllers/ModuleGetSslController.php`
- Modify: `Lib/GetSslMain.php`
- Create: `tests/GetSslPolicyIntegrationTest.php`

**Interfaces:**
- Consumes: `CertificateIdentifierPolicy` methods from Task 1.
- Produces: persisted `includeIpAddress` and `publicIpAddress`; `GetSslMain::getCertificateIdentifiers()`, `hasIpIdentifier()`, and policy-driven cron/issue behavior.

- [x] **Step 1: Write a failing source-level integration test** that loads the real policy and verifies a command-argument builder returns two independently escaped `-d` arguments plus `--cert-profile shortlived`, while domain-only output omits the profile.
- [x] **Step 2: Run the test and verify RED** for the missing integration method.
- [x] **Step 3: Add model annotations/default migration and form elements.** Normalize checkbox state in the controller; force `challengeType=http` and `autoUpdate=1` when the policy contains IP; reject invalid additional IP with `module_getssl_PublicIpAddressInvalid`.
- [x] **Step 4: Refactor `GetSslMain` to build identifiers through the policy.** Append one escaped `-d` per identifier, append the short-lived profile for IP orders, treat IP orders as HTTP-01 even if stale settings say DNS, and select the policy cron schedule.
- [x] **Step 5: Run both PHP tests** and require PASS.

### Task 3: Reactive Semantic UI form

**Files:**
- Modify: `App/Views/ModuleGetSsl/index.volt`
- Modify: `Messages/en.php`
- Modify: `Messages/ru.php`
- Modify: `public/assets/js/src/module-get-ssl-index.js`
- Modify: `public/assets/js/module-get-ssl-index.js`
- Modify: `tests/ip-address-warning.test.mjs`

**Interfaces:**
- Consumes: `#domainName`, `#includeIpAddress`, `#publicIpAddress`, `#challengeType`, and `#autoUpdate` form controls.
- Produces: reactive visibility, required-field validation, and forced HTTP/renewal control state for IP-containing orders.

- [x] **Step 1: Extend the Node harness and write failing tests** for domain/IP visibility, checkbox toggling, additional field validation, warning visibility, and forced/restored challenge/renewal controls.
- [x] **Step 2: Run `node --test tests/ip-address-warning.test.mjs`** and verify failures are caused by missing combined-certificate behavior.
- [x] **Step 3: Add native Semantic UI checkbox, field, and warning markup**, plus English/Russian labels and errors.
- [x] **Step 4: Implement the minimal reactive controller behavior** and integrate additional-IP validation into `cbBeforeSendForm`.
- [x] **Step 5: Rebuild the tracked browser asset with Babel** and re-run the Node and PHP tests.

### Task 4: Final verification and commit

**Files:** All files above and this plan.

- [x] **Step 1: Run** `node --test tests/ip-address-warning.test.mjs`, both PHP tests, `node --check` on source/compiled JS, `php -l` on modified PHP files, and `git diff --check`.
- [x] **Step 2: Review the diff** for unrelated changes, credential exposure, unsafe shell concatenation, and migration compatibility.
- [x] **Step 3: Commit** with `git commit -m "feat: include public IP in domain certificates"`.
