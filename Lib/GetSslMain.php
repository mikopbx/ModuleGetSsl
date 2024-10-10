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
use MikoPBX\Core\System\Directories;
use MikoPBX\Core\System\PBX;
use MikoPBX\Core\System\Processes;
use MikoPBX\Core\System\Util;
use MikoPBX\Modules\PbxExtensionUtils;
use MikoPBX\PBXCoreREST\Lib\PBXApiResult;
use Modules\ModuleGetSsl\Models\ModuleGetSsl;
use Phalcon\Di\Injectable;

/**
 * Main class for managing SSL certificates via the GetSSL module.
 *
 * @property \MikoPBX\Common\Providers\TranslationProvider translation
 */
class GetSslMain extends Injectable
{
    public const GET_SSL_BIN = '/usr/bin/getssl';
    public const NS_LOOKUP_BIN = '/usr/bin/nslookup';

    /**
     * @var array Directories used by the module
     */
    public array $dirs;
    /**
     * @var array Module settings
     */
    public array $module_settings = [];
    /**
     * @var string Unique identifier for the module
     */
    private string $moduleUniqueID = 'ModuleGetSsl';

    /**
     * @var string Log file path for the module
     */
    private string $logFile;

    /**
     * ZabbixAgent5Main constructor.
     * Initializes module directories, checks module status and loads settings.
     */
    public function __construct()
    {
        // Initialize directories used by the module
        $this->dirs = $this->getModuleDirs();

        // Load module settings if the module is enabled
        if (PbxExtensionUtils::isEnabled($this->moduleUniqueID)) {
            // Retrieve the module settings from the database
            $module_settings = ModuleGetSsl::findFirst();
            if ($module_settings !== null) {
                $this->module_settings = $module_settings->toArray();
            }
        }

        // Set the log file path
        $this->logFile = $this->dirs['logDir'] . '/last-result.log';
    }

    /**
     * Prepare and return directories required by the module.
     *
     * @return array Associative array containing paths of directories used by the module.
     */
    private function getModuleDirs(): array
    {
        // moduleDir
        $moduleDir = PbxExtensionUtils::getModuleDir($this->moduleUniqueID);

        // binDir
        $binDir = $moduleDir . '/bin';
        Util::mwMkdir($binDir);

        // logDir
        $logDir = Directories::getDir(Directories::CORE_LOGS_DIR);
        $logDir = "{$logDir}/{$this->moduleUniqueID}";
        Util::mwMkdir($logDir);

        // pid
        $pidDir = "/var/run/custom_modules/{$this->moduleUniqueID}";
        Util::mwMkdir($pidDir);

        // Confdir
        $confDir = $moduleDir . '/db/getssl';
        Util::mwMkdir($confDir);

        // wellKnown dir
        $wellKnownDir = $confDir . '/.well-known';
        Util::mwMkdir($wellKnownDir);

        // Chalenge dir
        $challengeDir = $wellKnownDir . '/acme-challenge';
        Util::mwMkdir($challengeDir);

        return [
            'logDir' => $logDir,
            'binDir' => $binDir,
            'moduleDir' => $moduleDir,
            'confDir' => $confDir,
            'wellKnownDir' => $wellKnownDir,
            'challengeDir' => $challengeDir
        ];
    }
    /**
     * Starts the SSL certificate generation process.
     *
     * @return PBXApiResult The result of the certificate generation process.
     */
    public function startGetCertSsl(): PBXApiResult
    {
        $this->createAclConf();
        $result = new PBXApiResult();
        $extHostname = $this->module_settings['domainName'];
        if (empty($extHostname)) {
            // Domain name is not provided
            $result->messages = ['error' =>  $this->translation->_('module_getssl_DomainNameEmpty')];
            $result->success = false;
            return $result;
        }
        $getSsl = Util::which('getssl');
        $pid = Processes::getPidOfProcess("$getSsl $extHostname");
        if ($pid === '') {
            $confDir = $this->dirs['confDir'];
            Processes::mwExecBg("$getSsl $extHostname -w '$confDir'", $this->logFile);
            $pid = Processes::getPidOfProcess("$getSsl $extHostname");
        }
        $result->data = [
            'pid' => $pid
        ];
        PBX::managerReload();
        $result->success = true;
        return $result;
    }

    /**
     * Creates the necessary ACL configuration file for the domain.
     */
    public function createAclConf(): void
    {
        $extHostname = $this->module_settings['domainName'];
        if (empty($extHostname)) {
            return;
        }

        $confDir = $this->dirs['confDir'];
        $binDir = $this->dirs['binDir'];
        $challengeDir = $this->dirs['challengeDir'];
        $wellKnownDir = $this->dirs['wellKnownDir'];

        // Remount /offload as read-write
        $mount = Util::which('mount');
        Processes::mwExec("$mount -o remount,rw /offload 2> /dev/null");

        // Prepare the configuration file content
        $conf = 'CA="https://acme-v02.api.letsencrypt.org"' . PHP_EOL .
            'ACCOUNT_KEY_LENGTH=4096' . PHP_EOL .
            "ACCOUNT_KEY='$confDir/account.key'" . PHP_EOL .
            'PRIVATE_KEY_ALG="rsa"' . PHP_EOL .
            "RELOAD_CMD='$binDir/reloadCmd.php'" . PHP_EOL .
            'RENEW_ALLOW="30"' . PHP_EOL .
            'SERVER_TYPE="https"' . PHP_EOL .
            'CHECK_REMOTE="true"' . PHP_EOL .
            "ACL=('$challengeDir')" . PHP_EOL .
            'USE_SINGLE_ACL="true"' . PHP_EOL .
            'FULL_CHAIN_INCLUDE_ROOT="true"' . PHP_EOL .
            'SKIP_HTTP_TOKEN_CHECK="true"' . PHP_EOL;


        // Add email to the configuration if available
        $email = PbxSettings::getValueByKey(PbxSettings::SYSTEM_NOTIFICATIONS_EMAIL);
        if (!empty($email)) {
            $conf .= 'ACCOUNT_EMAIL="' . $email . '"' . PHP_EOL;
        }

        // Create symlinks and remount /offload as read-only
        Util::createUpdateSymlink("$binDir/utils", '/usr/share/getssl');
        Util::createUpdateSymlink($wellKnownDir, '/usr/www/sites/.well-known');
        Util::createUpdateSymlink("$binDir/getssl", self::GET_SSL_BIN, true);

        if (!file_exists(self::NS_LOOKUP_BIN)) {
            $busyBoxPath = Util::which('busybox');
            Util::createUpdateSymlink($busyBoxPath, self::NS_LOOKUP_BIN, true);
        }
        Processes::mwExec("$mount -o remount,ro /offload 2> /dev/null");

        // Create configuration for the domain and save it
        Util::mwMkdir("$confDir/$extHostname");
        file_put_contents("$confDir/getssl.cfg", $conf);
        Util::createUpdateSymlink("$confDir/getssl.cfg", "$confDir/$extHostname/getssl.cfg", true);
    }

    /**
     * Retrieves the result of the SSL certificate generation process.
     *
     * @return PBXApiResult The result of the SSL certificate generation.
     */
    public function checkResult(): PBXApiResult
    {
        $result = new PBXApiResult();
        $getSsl = Util::which('getssl');
        $pid = Processes::getPidOfProcess($getSsl);
        if ($pid === '') {
            $data = file_get_contents($this->logFile);
            if ($data) {
                $data = str_replace(PHP_EOL, '<br>', $data);
            }
            $result->data = ['result' => $data];
        } else {
            $result->data = [
                'pid' => $pid
            ];
        }
        return $result;
    }

    /**
     * Updates SSL key information in the system settings.
     *
     * @param string $name The name of the key setting.
     * @param string $path The path to the key file.
     */
    private function updateKey(string $name, string $path): void
    {
        $key = file_get_contents($path);
        $oldPubKey = PbxSettings::getValueByKey($name);

        if ($key !== $oldPubKey) {
            $filter = ['key=:key:', 'bind' => ['key' => $name]];
            $dbRec = PbxSettings::findFirst($filter) ?? new PbxSettings();
            $dbRec->key = $name;
            $dbRec->value = $key;
            $dbRec->save();
        }
    }

    /**
     * Runs the SSL certificate update process.
     */
    public function run(): void
    {
        $certPath = $this->getCertPath();
        $privateKeyPath = $this->getPrivateKeyPath();
        if (file_exists($privateKeyPath) && file_exists($certPath)) {
            $this->updateKey('WEBHTTPSPublicKey', $certPath);
            $this->updateKey('WEBHTTPSPrivateKey', $privateKeyPath);
        }
    }
    /**
     * Returns the path to the SSL certificate.
     *
     * @return string The certificate path.
     */
    private function getCertPath(): string
    {
        return $this->dirs['confDir'] . $this->module_settings['domainName'] . '/fullchain.crt';
    }

    /**
     * Returns the path to the private SSL key.
     *
     * @return string The private key path.
     */
    private function getPrivateKeyPath(): string
    {
        $extHostname = $this->module_settings['domainName'];
        return $this->dirs['confDir'] . $extHostname . "/$extHostname.key";
    }

    /**
     * Generates a cron task string for automatically updating SSL certificates.
     *
     * This method checks if the `autoUpdate` setting is enabled in the module settings.
     * If enabled, it constructs a cron task string that runs the GetSSL binary daily at 1:00 AM.
     * The task runs the GetSSL command with the `-a` (automatic), `-U` (update), and `-q` (quiet) options,
     * redirecting output to `/dev/null`.
     *
     * @return string The cron task string if auto-update is enabled, otherwise an empty string.
     */
    public function getCronTask(): string
    {
        if ($this->module_settings['autoUpdate'] === '1') {
            $workerPath = $this->moduleDir . '/db/getssl';
            $getSslPath = self::GET_SSL_BIN;
            return "0 1 * * * {$getSslPath} -a -U -q -w '$workerPath' > /dev/null 2> /dev/null" . PHP_EOL;
        }
        return '';
    }
}
