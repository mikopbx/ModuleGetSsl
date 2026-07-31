# IP certificate lifetime warning

## Goal

Warn users who enter an IPv4 or IPv6 address that Let's Encrypt IP certificates are short-lived and therefore renewed more frequently.

## User interface

Add a hidden native Semantic UI `ui warning message` directly below the existing address field. Its localized message says that Let's Encrypt IP certificates are valid for about six days and that the module will renew the certificate more frequently.

The warning appears immediately when the field contains a valid IPv4 or IPv6 address, including an address restored when the page loads. It remains hidden for domain names, empty input, and malformed IP-like input.

## Implementation

Keep IP recognition in a small JavaScript predicate on the existing `ModuleGetSsl` form controller. Bind warning-state refresh to the address field's `input` event and call it once during initialization. Use strict IPv4 validation and browser URL parsing plus colon checks for IPv6; do not classify hostnames as IP addresses.

Add English and Russian translation keys. Other locale files will fall back according to the module's existing translation behavior. Update both the ES6 source and its compiled browser asset using the project's Babel workflow.

## Verification

An automated Node test extracts and exercises the real predicate with valid and invalid IPv4/IPv6/domain inputs and verifies that the view uses the Semantic UI warning markup. Syntax checks and the available project analysis complete verification.
