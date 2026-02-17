<?php

/*
 * MikoPBX - free phone system for small business
 * Copyright © 2017-2024 Alexey Portnov and Nikolay Beketov
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with this program.
 * If not, see <https://www.gnu.org/licenses/>.
 */

namespace Modules\ModuleGetSsl\Lib;

use MikoPBX\Common\Models\PbxSettings;
use MikoPBX\Core\System\Processes;
use MikoPBX\Core\System\System;
use MikoPBX\Core\System\Util;
use Modules\ModuleGetSsl\Models\ModuleGetSsl;

/**
 * Manages temporary port 80 opening for ACME HTTP-01 validation.
 *
 * Creates a dedicated nginx server block on port 80 serving only
 * /.well-known/acme-challenge/ and adds iptables rules when firewall is active.
 */
class AcmeHttpPort
{
    private const LOCK_FILE = '/var/run/custom_modules/ModuleGetSsl/acme_port80.lock';
    private const NGINX_ACME_CONF = '/etc/nginx/mikopbx/modules_servers/ModuleGetSsl_acme80.conf';
    private const MAX_OPEN_SECONDS = 300;

    /**
     * Opens port 80 for ACME HTTP-01 validation.
     *
     * Creates a dedicated nginx server block and adds firewall rules if needed.
     *
     * @return bool true on success or if port is already open
     */
    public function openPort(): bool
    {
        if ($this->isAlreadyOpen()) {
            return true;
        }

        $lockDir = dirname(self::LOCK_FILE);
        Util::mwMkdir($lockDir);
        $lockData = json_encode(['pid' => getmypid(), 'time' => time()]);
        file_put_contents(self::LOCK_FILE, $lockData);

        $domainName = $this->getDomainName();
        if (empty($domainName)) {
            unlink(self::LOCK_FILE);
            return false;
        }

        $this->createNginxConf($domainName);
        $this->reloadNginx();
        $this->addFirewallRules();

        return true;
    }

    /**
     * Closes port 80 after ACME validation completes.
     *
     * Removes the nginx config, reloads nginx, removes firewall rules, and cleans up the lock file.
     */
    public function closePort(): void
    {
        if (file_exists(self::NGINX_ACME_CONF)) {
            unlink(self::NGINX_ACME_CONF);
        }
        $this->reloadNginx();
        $this->removeFirewallRules();

        if (file_exists(self::LOCK_FILE)) {
            unlink(self::LOCK_FILE);
        }
    }

    /**
     * Cleans up stale port 80 state from a previous crash or timeout.
     */
    public static function cleanupStale(): void
    {
        if (!file_exists(self::LOCK_FILE)) {
            return;
        }

        $lockContent = file_get_contents(self::LOCK_FILE);
        $lockData = json_decode($lockContent, true);
        if (!is_array($lockData)) {
            // Corrupted lock file, clean up
            $instance = new self();
            $instance->closePort();
            Util::sysLogMsg(__CLASS__, 'Cleaned up corrupted ACME port 80 lock file');
            return;
        }

        $pid = $lockData['pid'] ?? 0;
        $lockTime = $lockData['time'] ?? 0;
        $elapsed = time() - $lockTime;
        $pidDead = ($pid > 0) ? !file_exists("/proc/$pid") : true;

        if ($elapsed > self::MAX_OPEN_SECONDS || $pidDead) {
            $instance = new self();
            $instance->closePort();
            Util::sysLogMsg(
                __CLASS__,
                "Cleaned up stale ACME port 80 (elapsed: {$elapsed}s, pid: $pid, dead: " . ($pidDead ? 'yes' : 'no') . ')'
            );
        }
    }

    /**
     * Checks if port 80 is already open by this module.
     */
    private function isAlreadyOpen(): bool
    {
        if (!file_exists(self::LOCK_FILE)) {
            return false;
        }

        $lockContent = file_get_contents(self::LOCK_FILE);
        $lockData = json_decode($lockContent, true);
        if (!is_array($lockData)) {
            return false;
        }

        $pid = $lockData['pid'] ?? 0;
        if ($pid > 0 && file_exists("/proc/$pid")) {
            return true;
        }

        return false;
    }

    /**
     * Gets domain name from module settings.
     */
    private function getDomainName(): string
    {
        $settings = ModuleGetSsl::findFirst();
        if ($settings === null) {
            return '';
        }
        return $settings->domainName ?? '';
    }

    /**
     * Creates a dedicated nginx server block for ACME validation on port 80.
     */
    private function createNginxConf(string $domainName): void
    {
        $confDir = dirname(self::NGINX_ACME_CONF);
        Util::mwMkdir($confDir);

        $conf = <<<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $domainName;

    location /.well-known/acme-challenge/ {
        root /usr/www/sites;
        allow all;
    }

    location / {
        return 444;
    }
}
NGINX;

        file_put_contents(self::NGINX_ACME_CONF, $conf);
    }

    /**
     * Reloads nginx configuration.
     */
    private function reloadNginx(): void
    {
        $nginxPath = Util::which('nginx');
        Processes::mwExec("$nginxPath -s reload");
    }

    /**
     * Adds iptables rules to allow traffic on port 80.
     */
    private function addFirewallRules(): void
    {
        if (!$this->isFirewallManaged()) {
            return;
        }

        $iptablesPath = Util::which('iptables');
        Processes::mwExec("$iptablesPath -I INPUT -p tcp --dport 80 -j ACCEPT");

        $ip6tablesPath = Util::which('ip6tables');
        Processes::mwExec("$ip6tablesPath -I INPUT -p tcp --dport 80 -j ACCEPT");
    }

    /**
     * Removes iptables rules for port 80.
     */
    private function removeFirewallRules(): void
    {
        if (!$this->isFirewallManaged()) {
            return;
        }

        $iptablesPath = Util::which('iptables');
        Processes::mwExec("$iptablesPath -D INPUT -p tcp --dport 80 -j ACCEPT");

        $ip6tablesPath = Util::which('ip6tables');
        Processes::mwExec("$ip6tablesPath -D INPUT -p tcp --dport 80 -j ACCEPT");
    }

    /**
     * Checks whether firewall rules need to be managed.
     *
     * Returns true only when PBX firewall is enabled AND system can manage iptables.
     */
    private function isFirewallManaged(): bool
    {
        $firewallEnabled = PbxSettings::getValueByKey(PbxSettings::PBX_FIREWALL_ENABLED);
        if ($firewallEnabled !== '1') {
            return false;
        }
        return System::canManageFirewall();
    }
}
