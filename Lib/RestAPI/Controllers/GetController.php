<?php
/*
 * Copyright © MIKO LLC - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 * Written by Alexey Portnov, 8 2020
 */

namespace Modules\ModuleGetSsl\Lib\RestAPI\Controllers;

use MikoPBX\AdminCabinet\Providers\SessionProvider;
use MikoPBX\Common\Models\CallQueueMembers;
use MikoPBX\Common\Models\CallQueues;
use MikoPBX\Common\Models\Extensions;
use MikoPBX\Common\Providers\BeanstalkConnectionModelsProvider;
use MikoPBX\Common\Providers\MessagesProvider;
use MikoPBX\Common\Providers\TranslationProvider;
use MikoPBX\Modules\PbxExtensionUtils;
use MikoPBX\PBXCoreREST\Controllers\BaseController;
use MikoPBX\PBXCoreREST\Controllers\Modules\ModulesControllerBase;
use Modules\ModuleAdditionalWebAPI\Lib\ModuleAdditionalWebAPIWorker;
use Phalcon\Di;

class GetController extends ModulesControllerBase
{

    /**
     * curl 'http://127.0.0.1/pbxcore/api/modules/ModuleGetSsl/get-cert'
     * curl 'http://127.0.0.1/pbxcore/api/modules/ModuleGetSsl/check-result'
     *
     * @param string $actionName
     */
    public function callAction(string $actionName): void
    {
        $this->callActionForModule('ModuleGetSsl', $actionName);
        $this->response->sendRaw();
    }

}