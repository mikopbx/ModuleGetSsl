<?php

namespace Modules\ModuleGetSsl\Lib;

use InvalidArgumentException;

final class CertificateIdentifierPolicy
{
    public static function normalizeIpAddress(string $value): string
    {
        $value = trim($value);
        if (strlen($value) >= 2 && $value[0] === '[' && substr($value, -1) === ']') {
            return substr($value, 1, -1);
        }
        return $value;
    }

    public static function isIpAddress(string $value): bool
    {
        return filter_var(self::normalizeIpAddress($value), FILTER_VALIDATE_IP) !== false;
    }

    public static function isPublicIpAddress(string $value): bool
    {
        $value = self::normalizeIpAddress($value);
        $flags = FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE;
        if (filter_var($value, FILTER_VALIDATE_IP, $flags) === false) {
            return false;
        }

        foreach (['100.64.0.0/10', '192.0.2.0/24', '198.51.100.0/24', '203.0.113.0/24',
                     '2001:db8::/32'] as $reservedRange) {
            if (self::isInCidr($value, $reservedRange)) {
                return false;
            }
        }
        return true;
    }

    public static function getIdentifiers(array $settings): array
    {
        $primary = trim((string)($settings['domainName'] ?? ''));
        if ($primary === '') {
            throw new InvalidArgumentException('Primary certificate identifier is empty');
        }
        if (self::isIpAddress($primary)) {
            $primary = self::normalizeIpAddress($primary);
            if (!self::isPublicIpAddress($primary)) {
                throw new InvalidArgumentException('The primary IP address must be public');
            }
        }

        $includeIp = (int)($settings['includeIpAddress'] ?? 0) === 1;
        if (!$includeIp) {
            return [$primary];
        }
        if (self::isIpAddress($primary)) {
            throw new InvalidArgumentException('An IP primary identifier cannot include an additional IP');
        }

        $publicIp = self::normalizeIpAddress((string)($settings['publicIpAddress'] ?? ''));
        if (!self::isPublicIpAddress($publicIp)) {
            throw new InvalidArgumentException('The additional IP address must be public');
        }
        return [$primary, $publicIp];
    }

    public static function containsIpAddress(array $settings): bool
    {
        foreach (self::getIdentifiers($settings) as $identifier) {
            if (self::isIpAddress($identifier)) {
                return true;
            }
        }
        return false;
    }

    public static function requiresHttp01(array $settings): bool
    {
        return self::containsIpAddress($settings);
    }

    public static function requiresAutoUpdate(array $settings): bool
    {
        return self::containsIpAddress($settings);
    }

    public static function getCronSchedule(array $settings): string
    {
        return self::containsIpAddress($settings) ? '17 * * * *' : '0 1 1,15 * *';
    }

    public static function buildAcmeIdentifierArguments(array $settings): string
    {
        $arguments = '';
        foreach (self::getIdentifiers($settings) as $identifier) {
            $arguments .= ' -d ' . escapeshellarg($identifier);
        }
        if (self::containsIpAddress($settings)) {
            // acme.sh otherwise retains its default ~60-day renewal window,
            // which is longer than Let's Encrypt short-lived certificates.
            // acme.sh subtracts one day from this value, so 5 renews after 4 days.
            $arguments .= ' --cert-profile shortlived --days 5';
        }
        return $arguments;
    }

    public static function selectSuggestedPublicIp(string $configuredExternalIp, array $resolvedIps): string
    {
        $configuredExternalIp = self::normalizeIpWithOptionalPort($configuredExternalIp);
        if (self::isPublicIpAddress($configuredExternalIp)) {
            return $configuredExternalIp;
        }
        foreach ($resolvedIps as $resolvedIp) {
            $resolvedIp = self::normalizeIpAddress((string)$resolvedIp);
            if (self::isPublicIpAddress($resolvedIp)) {
                return $resolvedIp;
            }
        }
        return '';
    }

    private static function normalizeIpWithOptionalPort(string $value): string
    {
        $value = trim($value);
        if (preg_match('/^\[([^]]+)](?::\d+)?$/', $value, $matches) === 1) {
            return $matches[1];
        }
        if (substr_count($value, ':') === 1 && preg_match('/^(.+):(\d+)$/', $value, $matches) === 1) {
            return $matches[1];
        }
        return self::normalizeIpAddress($value);
    }

    private static function isInCidr(string $ipAddress, string $cidr): bool
    {
        [$network, $prefixLength] = explode('/', $cidr, 2);
        $ipBytes = inet_pton($ipAddress);
        $networkBytes = inet_pton($network);
        if ($ipBytes === false || $networkBytes === false || strlen($ipBytes) !== strlen($networkBytes)) {
            return false;
        }

        $remainingBits = (int)$prefixLength;
        for ($index = 0, $length = strlen($ipBytes); $index < $length && $remainingBits > 0; $index++) {
            $bits = min(8, $remainingBits);
            $mask = (0xff << (8 - $bits)) & 0xff;
            if ((ord($ipBytes[$index]) & $mask) !== (ord($networkBytes[$index]) & $mask)) {
                return false;
            }
            $remainingBits -= $bits;
        }
        return true;
    }
}
