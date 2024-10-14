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

use MikoPBX\Core\System\PBX;
use MikoPBX\Modules\Config\ConfigClass;
use MikoPBX\PBXCoreREST\Lib\PBXApiResult;

class GetSslConf extends ConfigClass
{
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
        if (!empty($request['asyncChannelId'])) {
            $asyncChannelId = $request['asyncChannelId'];
        } else {
            $asyncChannelId = '';
        }
        switch ($action) {
            case 'GET-CERT':
                $moduleMain = new GetSslMain($asyncChannelId);
                $moduleMain->createAclConf();
                $res = $moduleMain->startGetCertSsl();
                if (!empty($asyncChannelId)) {
                    $res = $moduleMain->checkResultAsync();
                }
                break;
            case 'CHECK-RESULT':
                $moduleMain = new GetSslMain($asyncChannelId);
                $res = $moduleMain->checkResult();
                break;
            default:
                $res->success    = false;
                $res->messages[] = 'API action not found in moduleRestAPICallback ModuleGetSsl';
        }

        return $res;
    }

    /**
     * The callback function will execute after PBX started.
     * @see https://docs.mikopbx.com/mikopbx-development/module-developement/module-class#onafterpbxstarted
     *
     * @return void
     */
    public function onAfterPbxStarted(): void
    {
        $moduleMain = new GetSslMain();
        $moduleMain->createAclConf();
    }

    /**
     * Processes actions after enabling the module in the web interface
     * @see https://docs.mikopbx.com/mikopbx-development/module-developement/module-class#onaftermoduleenable
     *
     * @return void
     */
    public function onAfterModuleEnable(): void
    {
        $this->onAfterPbxStarted();
        PBX::managerReload();
    }

    /**
     * Adds cron tasks.
     * @see https://docs.mikopbx.com/mikopbx-development/module-developement/module-class#createcrontasks
     *
     * @param array $tasks The array of cron tasks.
     *
     * @return void
     */
    public function createCronTasks(array &$tasks): void
    {
        $moduleMain = new GetSslMain();
        $task = $moduleMain->getCronTask();
        if (!empty($task)) {
            $tasks[] = $task;
        }
    }
}
