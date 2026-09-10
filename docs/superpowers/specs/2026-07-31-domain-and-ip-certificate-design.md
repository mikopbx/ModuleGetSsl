# Domain and public IP certificate

## Goal

Allow a user who configured a domain name to include one explicit public IPv4 or IPv6 address in the same Let's Encrypt certificate.

## User interface

When the primary address is a domain, show a checkbox named “Add public IP address to the certificate” (“Добавить публичный IP-адрес в сертификат”). Hide the checkbox when the primary address is itself an IP address.

Enabling the checkbox reveals a required “Public IP address” field. Show a native Semantic UI warning explaining that the certificate covers both identifiers, is valid for about six days, and is renewed more frequently. Reject domains, private/malformed values, and unmatched IPv6 brackets in the additional IP field. Preserve the entered IP while the checkbox is temporarily hidden.

When either the primary identifier is an IP or the additional-IP checkbox is active, select HTTP-01 in the UI, disable DNS-01, enable automatic renewal, and prevent the user from disabling it. Restore normal controls when no IP identifier is requested.

## Persistence and migration

Add nullable model columns `includeIpAddress` (integer, default 0) and `publicIpAddress` (string). Existing installations migrate with the checkbox disabled and no additional address. The controller normalizes unchecked state to `0` and validates the additional address server-side before saving.

## Certificate issuance

Build the identifier list from the primary `domainName` plus `publicIpAddress` only when the checkbox is active and the primary identifier is not an IP. Any order containing an IP uses HTTP-01 and adds `--cert-profile shortlived`. A mixed order passes both identifiers to `acme.sh` as separate `-d` arguments. The primary identifier remains first, preserving certificate storage paths and renewal configuration lookup.

Reject inconsistent persisted or submitted settings rather than silently issuing a different certificate. Shell arguments remain escaped independently.

## Renewal

Certificates containing an IP require automatic renewal. Their renewal check runs hourly at a stable non-zero minute; ordinary domain-only certificates retain the existing twice-monthly schedule. `acme.sh` decides whether renewal is due, so hourly invocations normally exit without issuing.

The saved acme.sh renewal configuration retains the identifiers and `shortlived` profile. The existing reload hook continues installing renewed material into MikoPBX settings.

## Testing

Add focused tests for UI visibility/control state and IPv4/IPv6 validation, backend identifier/command policy, persistence normalization, and cron selection. Verify the test first fails for each new behavior, then passes. Rebuild the tracked browser asset and run JavaScript/PHP syntax checks plus `git diff --check`.
