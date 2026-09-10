<?php

use Modules\ModuleGetSsl\Lib\CertificateIdentifierPolicy;

require_once __DIR__ . '/../Lib/CertificateIdentifierPolicy.php';

function assertSameValue($expected, $actual, string $message): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, "$message\nExpected: " . var_export($expected, true)
            . "\nActual: " . var_export($actual, true) . "\n");
        exit(1);
    }
}

$domainOnly = ['domainName' => 'pbx.example.com', 'includeIpAddress' => 0, 'publicIpAddress' => ''];
assertSameValue(['pbx.example.com'], CertificateIdentifierPolicy::getIdentifiers($domainOnly), 'Domain-only identifiers');
assertSameValue(false, CertificateIdentifierPolicy::containsIpAddress($domainOnly), 'Domain-only has no IP');
assertSameValue('0 1 1,15 * *', CertificateIdentifierPolicy::getCronSchedule($domainOnly), 'Domain cron');

$ipOnly = ['domainName' => '8.8.8.8', 'includeIpAddress' => 0, 'publicIpAddress' => ''];
assertSameValue(['8.8.8.8'], CertificateIdentifierPolicy::getIdentifiers($ipOnly), 'IP-only identifiers');
assertSameValue(true, CertificateIdentifierPolicy::requiresHttp01($ipOnly), 'IP-only requires HTTP');
assertSameValue(true, CertificateIdentifierPolicy::requiresAutoUpdate($ipOnly), 'IP-only requires auto-update');
assertSameValue('17 * * * *', CertificateIdentifierPolicy::getCronSchedule($ipOnly), 'IP cron');

$mixedV4 = ['domainName' => 'pbx.example.com', 'includeIpAddress' => 1, 'publicIpAddress' => '8.8.4.4'];
assertSameValue(['pbx.example.com', '8.8.4.4'], CertificateIdentifierPolicy::getIdentifiers($mixedV4), 'Mixed IPv4 identifiers');
assertSameValue(true, CertificateIdentifierPolicy::containsIpAddress($mixedV4), 'Mixed order has IP');
assertSameValue(true, CertificateIdentifierPolicy::requiresAutoUpdate($mixedV4), 'Mixed order requires auto-update');

$mixedV6 = ['domainName' => 'pbx.example.com', 'includeIpAddress' => 1, 'publicIpAddress' => '2606:4700:4700::1111'];
assertSameValue(['pbx.example.com', '2606:4700:4700::1111'], CertificateIdentifierPolicy::getIdentifiers($mixedV6), 'Mixed IPv6 identifiers');

$disabled = ['domainName' => 'pbx.example.com', 'includeIpAddress' => 0, 'publicIpAddress' => '8.8.4.4'];
assertSameValue(['pbx.example.com'], CertificateIdentifierPolicy::getIdentifiers($disabled), 'Disabled additional IP is ignored');

foreach (['192.168.1.10', '127.0.0.1', '999.1.1.1', 'pbx.example.com', '2001:db8::1'] as $invalidPublicIp) {
    assertSameValue(false, CertificateIdentifierPolicy::isPublicIpAddress($invalidPublicIp), "Reject $invalidPublicIp");
}

foreach (['8.8.8.8', '2606:4700:4700::1111'] as $publicIp) {
    assertSameValue(true, CertificateIdentifierPolicy::isPublicIpAddress($publicIp), "Accept $publicIp");
}

$thrown = false;
try {
    CertificateIdentifierPolicy::getIdentifiers([
        'domainName' => 'pbx.example.com',
        'includeIpAddress' => 1,
        'publicIpAddress' => '192.168.1.10',
    ]);
} catch (InvalidArgumentException $e) {
    $thrown = true;
}
assertSameValue(true, $thrown, 'Enabled invalid public IP must throw');

$thrown = false;
try {
    CertificateIdentifierPolicy::getIdentifiers([
        'domainName' => '192.168.1.10',
        'includeIpAddress' => 0,
        'publicIpAddress' => '',
    ]);
} catch (InvalidArgumentException $e) {
    $thrown = true;
}
assertSameValue(true, $thrown, 'Primary IP address must be public');

assertSameValue(
    '178.154.243.193',
    CertificateIdentifierPolicy::selectSuggestedPublicIp('178.154.243.193', ['158.160.170.198']),
    'Configured external IP has priority'
);
assertSameValue(
    '178.154.243.193',
    CertificateIdentifierPolicy::selectSuggestedPublicIp('178.154.243.193:5060', ['158.160.170.198']),
    'Configured external IPv4 port is removed'
);
assertSameValue(
    '158.160.170.198',
    CertificateIdentifierPolicy::selectSuggestedPublicIp('10.0.0.24', ['192.168.1.10', '158.160.170.198']),
    'Domain resolution is the fallback'
);
assertSameValue(
    '',
    CertificateIdentifierPolicy::selectSuggestedPublicIp('', ['192.168.1.10']),
    'No public candidate produces no suggestion'
);

echo "CertificateIdentifierPolicyTest: PASS\n";
