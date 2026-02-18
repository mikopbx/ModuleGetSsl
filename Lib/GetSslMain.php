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

use MikoPBX\Common\Models\LanInterfaces;
use MikoPBX\Common\Models\PbxSettings;
use MikoPBX\Common\Providers\PBXCoreRESTClientProvider;
use MikoPBX\Core\System\Directories;
use MikoPBX\Core\System\Processes;
use MikoPBX\Core\System\Util;
use MikoPBX\Modules\PbxExtensionUtils;
use MikoPBX\PBXCoreREST\Lib\PBXApiResult;
use Modules\ModuleGetSsl\Models\ModuleGetSsl;
use Phalcon\Di\Injectable;

/**
 * Main class for managing SSL certificates via the GetSSL module.
 *
 * Supports both acme.sh (primary) and legacy getssl ACME clients.
 * Supports HTTP-01 and DNS-01 challenge types.
 *
 * @property \MikoPBX\Common\Providers\TranslationProvider translation
 */
class GetSslMain extends Injectable
{
    public const ACME_SH_BIN = '/usr/bin/acme.sh';
    public const GET_SSL_BIN = '/usr/bin/getssl';
    public const NS_LOOKUP_BIN = '/usr/bin/nslookup';
    private const STAGE_1_GENERATE_CONFIG = 'STAGE_1_GENERATE_CONFIG';
    private const STAGE_2_REQUEST_CERT = 'STAGE_2_REQUEST_CERT';
    private const STAGE_3_PARSE_RESPONSE = 'STAGE_3_PARSE_RESPONSE';
    private const STAGE_4_FINAL_RESULT = 'STAGE_4_FINAL_RESULT';

    /**
     * @var array Directories used by the module
     */
    public array $dirs;
    /**
     * @var array Module settings
     */
    public array $module_settings = [];
    protected string $asyncChannelId;
    /**
     * @var string Unique identifier for the module
     */
    private string $moduleUniqueID = 'ModuleGetSsl';
    /**
     * @var string Log file path for the module
     */
    private string $logFile;

    /**
     * Initializes module directories, checks module status and loads settings.
     */
    public function __construct(string $asyncChannelId = 'module-get-ssl-pub')
    {
        // Initialize directories used by the module
        $this->dirs = $this->getModuleDirs();

        // Initialize Pub/sub nchan channel id to send a response to frontend
        $this->asyncChannelId = $asyncChannelId;

        // Load module settings if the module is enabled
        if (PbxExtensionUtils::isEnabled($this->moduleUniqueID)) {
            // Retrieve the module settings from the database
            $module_settings = ModuleGetSsl::findFirst();
            if ($module_settings !== null) {
                $this->module_settings = $module_settings->toArray();
            }else{
                $this->module_settings = (new ModuleGetSsl())->toArray();
            }
            if(empty($this->module_settings['domainName'])){
                $res = LanInterfaces::findFirst("internet = '1'")->toArray();
                $this->module_settings['domainName'] = $res['exthostname'] ?? '';
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

        // Legacy getssl confDir
        $confDir = $moduleDir . '/db/getssl';
        Util::mwMkdir($confDir);

        // wellKnown dir
        $wellKnownDir = $confDir . '/.well-known';
        Util::mwMkdir($wellKnownDir);

        // Challenge dir
        $challengeDir = $wellKnownDir . '/acme-challenge';
        Util::mwMkdir($challengeDir);

        // acme.sh home (where the script lives)
        $acmeHome = $moduleDir . '/bin/acme';
        Util::mwMkdir($acmeHome);

        // acme.sh config home (where certs/accounts are stored)
        $acmeConfigHome = $moduleDir . '/db/acme';
        Util::mwMkdir($acmeConfigHome);

        return [
            'logDir' => $logDir,
            'getSslPath' => $moduleDir.'/bin/getssl',
            'binDir' => $binDir,
            'moduleDir' => $moduleDir,
            'confDir' => $confDir,
            'wellKnownDir' => $wellKnownDir,
            'challengeDir' => $challengeDir,
            'acmeHome' => $acmeHome,
            'acmeConfigHome' => $acmeConfigHome,
        ];
    }

    /**
     * Checks if current challenge type is DNS-01.
     */
    public function isDns01(): bool
    {
        return ($this->module_settings['challengeType'] ?? 'http') === 'dns';
    }

    /**
     * Decodes DNS credentials from base64 JSON and builds an export string.
     *
     * @return string Shell export commands, e.g. "export CF_Token='xxx'; export CF_Account_ID='yyy'; "
     */
    public function buildDnsCredentialEnvString(): string
    {
        $encoded = $this->module_settings['dnsCredentials'] ?? '';
        if (empty($encoded)) {
            return '';
        }
        $json = base64_decode($encoded, true);
        if ($json === false) {
            return '';
        }
        $credentials = json_decode($json, true);
        if (!is_array($credentials)) {
            return '';
        }
        $exports = '';
        foreach ($credentials as $varName => $value) {
            // Sanitize: only allow alphanumeric and underscore in var names
            $safeVar = preg_replace('/[^A-Za-z0-9_]/', '', $varName);
            // Escape single quotes in value
            $safeVal = str_replace("'", "'\\''", $value);
            $exports .= "export {$safeVar}='{$safeVal}'; ";
        }
        return $exports;
    }

    /**
     * Initiates the certificate request process, checks the result, and updates the browser with the final stage.
     *
     * @return PBXApiResult Object containing the result of the certificate request process.
     */
    public function checkResultAsync(): PBXApiResult
    {
        $result = new PBXApiResult();
        // For DNS-01, use longer timeout (DNS propagation takes time)
        $timeout = $this->isDns01() ? 300 : 120;
        $interval = 1;
        $elapsedTime = 0;

        // Loop while the process exists or until the timeout is reached
        while ($elapsedTime < $timeout) {
            $pid = $this->getAcmeProcessPid();
            if (empty($pid)) {
                break;
            }
            $result = $this->checkResult();
            sleep($interval);
            $elapsedTime += $interval;
        }

        if ($elapsedTime >= $timeout) {
            $result->messages['error'][] = $this->translation->_('module_getssl_GetSSLProcessingTimeout');
            $result->success = false;
            $this->pushMessageToBrowser(self::STAGE_3_PARSE_RESPONSE, $result->getResult());
        } else {
            $this->pushMessageToBrowser(self::STAGE_4_FINAL_RESULT, $result->getResult());
        }
        return $result;
    }

    /**
     * Gets the PID of the running ACME process (acme.sh or legacy getssl).
     */
    private function getAcmeProcessPid(): string
    {
        // Check acme.sh first
        $pid = Processes::getPidOfProcess('acme.sh');
        if (!empty($pid)) {
            return $pid;
        }
        // Fallback: check legacy getssl
        $getSsl = $this->dirs['getSslPath'];
        return Processes::getPidOfProcess($getSsl);
    }

    /**
     * Prepares the ACME environment: creates symlinks for acme.sh and webroot.
     */
    public function prepareAcmeEnvironment(): void
    {
        $extHostname = $this->module_settings['domainName'];
        if (empty($extHostname)) {
            return;
        }

        $result = new PBXApiResult();
        $result->success = true;
        $result->data['result'] = $this->translation->_('module_getssl_ConfigStartsGenerating');
        $this->pushMessageToBrowser(self::STAGE_1_GENERATE_CONFIG, $result->getResult());

        $binDir = $this->dirs['binDir'];
        $acmeHome = $this->dirs['acmeHome'];
        $wellKnownDir = $this->dirs['wellKnownDir'];

        // Remount /offload as read-write
        $busyBoxPath = Util::which('busybox');
        Processes::mwExec("$busyBoxPath mount -o remount,rw /offload 2> /dev/null");

        // Create symlink for acme.sh
        Util::createUpdateSymlink("$acmeHome/acme.sh", self::ACME_SH_BIN, true);

        // For HTTP-01: create webroot symlink
        if (!$this->isDns01()) {
            Util::createUpdateSymlink($wellKnownDir, '/usr/www/sites/.well-known');
        }

        // Legacy getssl symlinks (keep for transition period)
        Util::createUpdateSymlink("$binDir/utils", '/usr/share/getssl');
        Util::createUpdateSymlink("$binDir/getssl", self::GET_SSL_BIN, true);

        if (!file_exists(self::NS_LOOKUP_BIN)) {
            Util::createUpdateSymlink($busyBoxPath, self::NS_LOOKUP_BIN, true);
        }
        Processes::mwExec("$busyBoxPath mount -o remount,ro /offload 2> /dev/null");

        file_put_contents($this->logFile, '');

        $result = new PBXApiResult();
        $result->success = true;
        $result->data['result'] = $this->translation->_('module_getssl_ConfigGenerated');
        $this->pushMessageToBrowser(self::STAGE_1_GENERATE_CONFIG, $result->getResult());
    }

    /**
     * Pushes messages to the browser
     * @param string $stage current stage
     * @param array $data pushing data
     * @return void
     */
    private function pushMessageToBrowser(string $stage, array $data): void
    {
        if (empty($this->asyncChannelId)) {
            return;
        }
        $message = [
            'moduleUniqueId' => $this->moduleUniqueID,
            'stage' => $stage,
            'stageDetails' => $data,
            'pid' => posix_getpid()
        ];

        $di = MikoPBXVersion::getDefaultDi();
        $di->get(PBXCoreRESTClientProvider::SERVICE_NAME, [
            '/pbxcore/api/nchan/pub/' . $this->asyncChannelId,
            PBXCoreRESTClientProvider::HTTP_METHOD_POST,
            $message,
            ['Content-Type' => 'application/json']
        ]);
    }

    /**
     * Starts the SSL certificate generation process via acme.sh.
     *
     * @return PBXApiResult The result of the certificate generation process.
     */
    public function startGetCertSsl(bool $asynchronously = true): PBXApiResult
    {
        $result = new PBXApiResult();
        $extHostname = $this->module_settings['domainName'];
        if (empty($extHostname)) {
            $result->messages = ['error' => $this->translation->_('module_getssl_DomainNameEmpty')];
            $result->success = false;
            $this->pushMessageToBrowser(self::STAGE_2_REQUEST_CERT, $result->getResult());
            return $result;
        }

        // Kill any running acme process
        $pid = $this->getAcmeProcessPid();
        if (!empty($pid)) {
            Processes::killByName('acme.sh');
        }

        $acmeHome = $this->dirs['acmeHome'];
        $acmeConfigHome = $this->dirs['acmeConfigHome'];
        $email = PbxSettings::getValueByKey('SystemNotificationsEmail');
        $binDir = $this->dirs['binDir'];

        // Build acme.sh command
        $cmd = self::ACME_SH_BIN
            . " --issue -d " . escapeshellarg($extHostname)
            . " --home " . escapeshellarg($acmeHome)
            . " --config-home " . escapeshellarg($acmeConfigHome)
            . " --force"
            . " --reloadcmd " . escapeshellarg("$binDir/reloadCmd.php");

        if (!empty($email)) {
            $cmd .= " --accountemail " . escapeshellarg($email);
        }

        if ($this->isDns01()) {
            // DNS-01 challenge
            $dnsProvider = $this->module_settings['dnsProvider'] ?? '';
            if ($dnsProvider === 'custom') {
                // For custom provider, the hook name is in credentials
                $encoded = $this->module_settings['dnsCredentials'] ?? '';
                $json = base64_decode($encoded, true);
                $creds = $json !== false ? json_decode($json, true) : [];
                $hookName = $creds['CUSTOM_DNS_HOOK'] ?? 'dns_manual';
                $cmd .= " --dns " . escapeshellarg($hookName);
            } else {
                $cmd .= " --dns " . escapeshellarg($dnsProvider);
            }
            // Prepend env exports for DNS credentials
            $envExports = $this->buildDnsCredentialEnvString();
            $cmd = $envExports . $cmd;
        } else {
            // HTTP-01 challenge via webroot
            $webroot = $this->dirs['challengeDir'];
            $cmd .= " --webroot " . escapeshellarg($webroot);
        }

        $shPath = Util::which('sh');
        $tsWrapper = $this->dirs['binDir'] . '/timestampWrapper.sh';

        if ($asynchronously) {
            Processes::mwExecBg("$shPath $tsWrapper $cmd", $this->logFile);
            $pid = $this->getAcmeProcessPid();
        } else {
            echo('starting' . PHP_EOL);
            passthru("$shPath $tsWrapper $cmd", $this->logFile);
        }

        $result->data['result'] = $this->translation->_('module_getssl_GetSSLProcessing');
        $result->data['pid'] = $pid ?? '';
        $result->success = true;
        $this->pushMessageToBrowser(self::STAGE_2_REQUEST_CERT, $result->getResult());
        return $result;
    }

    /**
     * Checks the result of the ACME process and sends updates to the front-end.
     *
     * @return PBXApiResult The final result of the process or timeout.
     */
    public function checkResult(): PBXApiResult
    {
        $result = new PBXApiResult();
        $result->success = true;
        $result->data['result'] = file_get_contents($this->logFile) ?? '';
        $this->pushMessageToBrowser(self::STAGE_3_PARSE_RESPONSE, $result->getResult());
        return $result;
    }

    /**
     * Runs the SSL certificate update process.
     * Checks acme.sh paths first, then falls back to legacy getssl paths.
     */
    public function run(): void
    {
        $certPath = $this->getCertPath();
        $privateKeyPath = $this->getPrivateKeyPath();
        if (file_exists($privateKeyPath) && file_exists($certPath)) {
            $this->updateKey('WEBHTTPSPublicKey', $certPath);
            $this->updateKey('WEBHTTPSPrivateKey', $privateKeyPath);
            $this->appendLog('SSL certificate installed into PbxSettings');
        } else {
            $this->appendLog('Certificate files not found, skipping PbxSettings update');
        }
    }

    /**
     * Returns the path to the SSL certificate.
     * Checks acme.sh location first, then falls back to legacy getssl.
     *
     * @return string The certificate path.
     */
    private function getCertPath(): string
    {
        $extHostname = $this->module_settings['domainName'];
        // acme.sh path
        $acmePath = $this->dirs['acmeConfigHome'] . '/' . $extHostname . '/fullchain.cer';
        if (file_exists($acmePath)) {
            return $acmePath;
        }
        // Legacy getssl path
        return $this->dirs['confDir'] . '/' . $extHostname . '/fullchain.crt';
    }

    /**
     * Returns the path to the private SSL key.
     * Checks acme.sh location first, then falls back to legacy getssl.
     *
     * @return string The private key path.
     */
    private function getPrivateKeyPath(): string
    {
        $extHostname = $this->module_settings['domainName'];
        // acme.sh path
        $acmePath = $this->dirs['acmeConfigHome'] . '/' . $extHostname . '/' . $extHostname . '.key';
        if (file_exists($acmePath)) {
            return $acmePath;
        }
        // Legacy getssl path
        return $this->dirs['confDir'] . '/' . $extHostname . '/' . $extHostname . '.key';
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
     * Appends a timestamped message to the module log file.
     */
    private function appendLog(string $message): void
    {
        $timestamp = date('Y-m-d H:i:s');
        file_put_contents($this->logFile, "[$timestamp] $message" . PHP_EOL, FILE_APPEND);
    }

    /**
     * Generates a cron task string for automatically updating SSL certificates.
     *
     * @return string The cron task string if auto-update is enabled, otherwise an empty string.
     */
    public function getCronTask(): string
    {
        if (
            PbxExtensionUtils::isEnabled($this->moduleUniqueID)
            && intval($this->module_settings['autoUpdate']) === 1
            && !empty($this->module_settings['domainName'])
        ) {
            $phpPath = Util::which('php');
            $cronScript = $this->dirs['moduleDir'] . '/bin/cronRenewCert.php';
            return "0 1 1,15 * * $phpPath -f $cronScript > /dev/null 2>&1" . PHP_EOL;
        }
        return '';
    }

    /**
     * Legacy compatibility: creates ACL configuration for getssl.
     * Delegates to prepareAcmeEnvironment().
     */
    public function createAclConf(): void
    {
        $this->prepareAcmeEnvironment();
    }
}
