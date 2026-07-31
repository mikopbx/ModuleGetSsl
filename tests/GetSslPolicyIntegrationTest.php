<?php

use Modules\ModuleGetSsl\Lib\CertificateIdentifierPolicy;

require_once __DIR__ . '/../Lib/CertificateIdentifierPolicy.php';

function assertContainsText(string $needle, string $haystack, string $message): void
{
    if (strpos($haystack, $needle) === false) {
        fwrite(STDERR, "$message\nMissing: $needle\nActual: $haystack\n");
        exit(1);
    }
}

function assertNotContainsText(string $needle, string $haystack, string $message): void
{
    if (strpos($haystack, $needle) !== false) {
        fwrite(STDERR, "$message\nUnexpected: $needle\nActual: $haystack\n");
        exit(1);
    }
}

$mixed = CertificateIdentifierPolicy::buildAcmeIdentifierArguments([
    'domainName' => 'pbx.example.com',
    'includeIpAddress' => 1,
    'publicIpAddress' => '8.8.4.4',
]);
assertContainsText(" -d 'pbx.example.com'", $mixed, 'Primary domain argument');
assertContainsText(" -d '8.8.4.4'", $mixed, 'Additional IP argument');
assertContainsText(' --cert-profile shortlived', $mixed, 'Short-lived profile');
assertContainsText(' --days 5', $mixed, 'Short-lived certificate renews before expiry');

$domainOnly = CertificateIdentifierPolicy::buildAcmeIdentifierArguments([
    'domainName' => 'pbx.example.com',
    'includeIpAddress' => 0,
    'publicIpAddress' => '',
]);
assertContainsText(" -d 'pbx.example.com'", $domainOnly, 'Domain argument');
assertNotContainsText('--cert-profile', $domainOnly, 'Domain-only order is not forced short-lived');
assertNotContainsText('--days', $domainOnly, 'Domain-only order keeps the default renewal interval');

$escaped = CertificateIdentifierPolicy::buildAcmeIdentifierArguments([
    'domainName' => "pbx'example.com",
    'includeIpAddress' => 0,
    'publicIpAddress' => '',
]);
assertContainsText(escapeshellarg("pbx'example.com"), $escaped, 'Identifier is escaped independently');

echo "GetSslPolicyIntegrationTest: PASS\n";
