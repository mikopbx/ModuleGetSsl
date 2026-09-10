# IP Certificate Lifetime Warning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a localized native Semantic UI warning whenever the configured certificate address is a valid IPv4 or IPv6 address.

**Architecture:** The existing form controller owns a pure `isIpAddress(value)` predicate and toggles a warning element during initialization and on every address-field input event. The Volt view owns the native Semantic UI markup, while English and Russian message catalogs own the copy.

**Tech Stack:** JavaScript ES6, jQuery, Semantic UI, Volt, PHP translation arrays, Node test runner, Babel-generated browser asset.

## Global Constraints

- The warning text states that Let's Encrypt IP certificates are valid for about six days and that the module renews them more frequently.
- Valid IPv4 and IPv6 values show the warning; domains, empty input, and malformed values hide it.
- The warning reacts immediately and is correct for a value restored on page load.
- Do not add dependencies or change certificate issuance behavior.

---

### Task 1: IP lifetime warning behavior

**Files:**
- Create: `tests/ip-address-warning.test.mjs`
- Modify: `public/assets/js/src/module-get-ssl-index.js`
- Modify: `public/assets/js/module-get-ssl-index.js`
- Modify: `App/Views/ModuleGetSsl/index.volt`
- Modify: `Messages/en.php`
- Modify: `Messages/ru.php`

**Interfaces:**
- Consumes: existing `#domainName` input, jQuery visibility methods, and translation function `t._()`.
- Produces: `ModuleGetSsl.isIpAddress(value): boolean`, `ModuleGetSsl.updateIpAddressWarning(): void`, and `#ip-address-certificate-warning` UI state.

- [x] **Step 1: Write the failing behavior test**

Create a Node test that loads the real form controller in a minimal VM-backed jQuery/DOM harness. Assert that initialization and `input` events show `#ip-address-certificate-warning` for `203.0.113.10`, `2001:db8::1`, and `[2001:db8::1]`, and hide it for `pbx.example.com`, empty text, `999.1.1.1`, and `2001:::1`. This catches removal or weakening of either recognition branch and missing reactive updates.

- [x] **Step 2: Run the test and verify RED**

Run: `node --test tests/ip-address-warning.test.mjs`

Expected: FAIL because the warning selector and update behavior do not exist.

- [x] **Step 3: Add minimal UI behavior and localized markup**

Add cached `$domainName` and `$ipAddressWarning` elements. Implement strict dotted-decimal IPv4 validation and IPv6 recognition through bracket normalization plus `new URL('http://[' + value + ']')`, requiring a colon and an exact normalized hostname. Bind `input` to `updateIpAddressWarning` and call it from `initialize()`.

Insert below the address field:

```html
<div class="ui warning message" id="ip-address-certificate-warning" style="display:none">
    <p>{{ t._('module_getssl_IpAddressCertificateWarning') }}</p>
</div>
```

Add the approved English and Russian translations.

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/ip-address-warning.test.mjs`

Expected: PASS for initialization, reactive toggling, IPv4, IPv6, bracketed IPv6, domain, empty, and malformed inputs.

- [x] **Step 5: Rebuild and verify browser assets**

Compile `public/assets/js/src/module-get-ssl-index.js` to `public/assets/js/module-get-ssl-index.js` using the available project Babel binary. Run the Node test again, `node --check` on both JavaScript files, `php -l` on both message files, and `git diff --check`.

- [x] **Step 6: Commit the implementation**

```bash
git add tests/ip-address-warning.test.mjs public/assets/js/src/module-get-ssl-index.js public/assets/js/module-get-ssl-index.js App/Views/ModuleGetSsl/index.volt Messages/en.php Messages/ru.php docs/superpowers/plans/2026-07-31-ip-certificate-warning.md
git commit -m "feat: warn about short-lived IP certificates"
```
