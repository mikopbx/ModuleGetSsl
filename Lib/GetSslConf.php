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
use MikoPBX\Core\System\PBX;
use MikoPBX\Core\System\Processes;
use MikoPBX\Core\System\Util;
use MikoPBX\Modules\Config\ConfigClass;
use MikoPBX\PBXCoreREST\Lib\PBXApiResult;
use Modules\ModuleGetSsl\Lib\RestAPI\Controllers\GetController;

class GetSslConf extends ConfigClass
{
    public const GET_SSL_BIN    = '/usr/bin/getssl';
    public const NS_LOOKUP_BIN  = '/usr/bin/nslookup';

    /**
     * Receive information about mikopbx main database changes
     *
     * @param mixed $data
     */
    public function modelsEventChangeData(mixed $data): void
    {
        // f.e. if somebody changes PBXLanguage, we will restart all workers
//        if ( $data['model'] === PbxSettings::class && $data['recordId'] === 'PBXLanguage' ) {
//            $templateMain = new GetSslMain();
//            $templateMain->startAllServices(true);
//        }
    }

    /**
     * Returns array of additional routes for PBXCoreREST interface from module
     *
     * @return array
     */
    public function getPBXCoreRESTAdditionalRoutes(): array
    {
        return [
            [GetController::class, 'callAction', '/pbxcore/api/modules/ModuleGetSsl/{actionName}', 'get', '/', false],
        ];
    }

    /**
     *  Process CoreAPI requests under root rights
     *
     * @param array $request
     *
     * @return PBXApiResult
     */
    public function moduleRestAPICallback(array $request): PBXApiResult
    {
        $res    = new PBXApiResult();
        $res->processor = __METHOD__;
        $action = strtoupper($request['action']);
        switch ($action) {
            case 'CHECK-RESULT':
                $res = $this->checkResult();
                break;
            case 'GET-CERT':
                $res = $this->startGetCertSsl();
                break;
            case 'CHECK':
            case 'RELOAD':
                $res->success = true;
                break;
            default:
                $res->success    = false;
                $res->messages[] = 'API action not found in moduleRestAPICallback ModuleGetSsl';
        }

        return $res;
    }

    /**
     * Создает conf файл для адреса сайта.
     * @return void
     */
    private function createAclConf():void
    {
        $confDir = $this->moduleDir.'/db/getssl';
        $linkChallengeDir = '/usr/www/sites/.well-known';

        $wellKnowDir  = $confDir.'/.well-known';
        $challengeDir = $wellKnowDir.'/acme-challenge';
        Util::mwMkdir($confDir);
        Util::mwMkdir($challengeDir);

        $mount = Util::which('mount');
        Processes::mwExec("$mount -o remount,rw /offload 2> /dev/null");
        $email= $this->generalSettings['SystemNotificationsEmail']??'';

        $conf = 'CA="https://acme-v02.api.letsencrypt.org"'.PHP_EOL.
            'ACCOUNT_KEY_LENGTH=4096'.PHP_EOL.
            'ACCOUNT_KEY="'.$confDir.'/account.key"'.PHP_EOL.
            'PRIVATE_KEY_ALG="rsa"'.PHP_EOL.
            'RELOAD_CMD="'."$this->moduleDir/bin/reloadCmd.php".'"'.PHP_EOL.
            'RENEW_ALLOW="30"'.PHP_EOL.
            'SERVER_TYPE="https"'.PHP_EOL.
            'CHECK_REMOTE="true"'.PHP_EOL.
            'ACL=('."'$challengeDir'".')'.PHP_EOL.
            'USE_SINGLE_ACL="true"'.PHP_EOL.
            'FULL_CHAIN_INCLUDE_ROOT="true"'.PHP_EOL.
            'SKIP_HTTP_TOKEN_CHECK="true"'.PHP_EOL;
        if(!empty($email)){
            $conf.='ACCOUNT_EMAIL="'.$email.'"'.PHP_EOL;
        }

        Util::createUpdateSymlink("$this->moduleDir/bin/utils", '/usr/share/getssl');
        Util::createUpdateSymlink($wellKnowDir, $linkChallengeDir);
        Util::createUpdateSymlink("$this->moduleDir/bin/getssl", self::GET_SSL_BIN, true);

        if(!file_exists(self::NS_LOOKUP_BIN)){
            $busyBoxPath = Util::which('busybox');
            Util::createUpdateSymlink($busyBoxPath, self::NS_LOOKUP_BIN, true);

        }
        Processes::mwExec("$mount -o remount,ro /offload 2> /dev/null");
        $extHostname = $this->getHostname();
        Util::mwMkdir("$confDir/$extHostname");
        file_put_contents("$confDir/getssl.cfg", $conf);
        if(!empty($extHostname)){
            Util::createUpdateSymlink("$confDir/getssl.cfg", "$confDir/$extHostname/getssl.cfg", true);
        }
    }

    /**
     * Будет вызван после старта asterisk.
     */
    public function onAfterPbxStarted(): void
    {
        $this->createAclConf();
    }

    /**
     * Kills all module daemons
     *
     */
    public function onAfterModuleDisable(): void
    {
        $mount  = Util::which('mount');
        $rm     = Util::which('rm');
        Processes::mwExec("$mount -o remount,rw /offload 2> /dev/null");
        Processes::mwExec("$rm -rf /usr/share/getssl /usr/bin/getssl /usr/www/sites/.well-known");
        Processes::mwExec("$mount -o remount,ro /offload 2> /dev/null");
    }

    /**
     * Process after enable action in web interface
     *
     * @return void
     */
    public function onAfterModuleEnable(): void
    {
        $this->onAfterPbxStarted();
        PBX::managerReload();
    }

    /**
     * Добавление задач в crond.
     *
     * @param array $tasks
     */
    public function createCronTasks(array &$tasks): void
    {
        if ( ! is_array($tasks)) {
            return;
        }
        $workerPath = $this->moduleDir.'/db/getssl';
        $getSslPath = self::GET_SSL_BIN;
        $tasks[]      = "0 1 * * * {$getSslPath} -a -U -q -w '$workerPath' > /dev/null 2> /dev/null".PHP_EOL;
    }

    /**
     * Возвращает директорию модуля.
     * @return string
     */
    public function getModuleDir():string
    {
        return $this->moduleDir;
    }

    /**
     * Запускает процесс проверки сертификата SSL.
     * @return PBXApiResult
     */
    public function startGetCertSsl():PBXApiResult
    {
        $this->createAclConf();
        $result      = new PBXApiResult();
        $extHostname = $this->getHostname();

        if(empty($extHostname)){
            // Имя хост не заполнено.
            $result->messages = ['error' => 'External hostname is empty.'];
            $result->success = false;
            return $result;
        }
        $getSsl = Util::which('getssl');
        $pid    = Processes::getPidOfProcess("$getSsl $extHostname");
        if($pid === ''){
            Processes::mwExecBg("$getSsl $extHostname -w '$this->moduleDir/db/getssl'", "$this->moduleDir/db/last-result.log");
            $pid    = Processes::getPidOfProcess("$getSsl $extHostname");
        }
        $result->data = [
            'pid' => $pid
        ];
        PBX::managerReload();
        $result->success = true;
        return $result;
    }

    /**
     * Получение результата работы скрипта getssl.
     * @return PBXApiResult
     */
    public function checkResult():PBXApiResult
    {
        $result    = new PBXApiResult();
        $getSsl = Util::which('getssl');
        $pid    = Processes::getPidOfProcess($getSsl);
        if($pid === ''){

            $data = file_get_contents("$this->moduleDir/db/last-result.log");
            if($data){
                $data = str_replace(PHP_EOL, '<br>', $data);
            }
            $result->data = ['result' => $data];
        }else{
            $result->data = [
                'pid' => $pid
            ];
        }
        return $result;
    }

    /**
     * Возвращает имя хост.
     * @return string
     */
    private function getHostname():string
    {
        $res = LanInterfaces::findFirst("internet = '1'")->toArray();
        return $res['exthostname']??'';
    }
}