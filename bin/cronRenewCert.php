#!/usr/bin/php
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

use MikoPBX\Core\System\Processes;
use MikoPBX\Core\System\Util;
use Modules\ModuleGetSsl\Lib\AcmeHttpPort;
use Modules\ModuleGetSsl\Lib\GetSslMain;

require_once('Globals.php');

$moduleMain = new GetSslMain();
$usePort80 = !$moduleMain->isDns01();

$portManager = null;
if ($usePort80) {
    $portManager = new AcmeHttpPort();
    $portManager->openPort();
}
try {
    $moduleMain->prepareAcmeEnvironment();

    $acmeHome = $moduleMain->dirs['acmeHome'];
    $acmeConfigHome = $moduleMain->dirs['acmeConfigHome'];
    $shPath = Util::which('sh');
    $tsWrapper = $moduleMain->dirs['binDir'] . '/timestampWrapper.sh';

    // Build acme.sh cron renewal command
    $cmd = GetSslMain::ACME_SH_BIN
        . ' --cron'
        . ' --home ' . escapeshellarg($acmeHome)
        . ' --config-home ' . escapeshellarg($acmeConfigHome);

    // For DNS-01: prepend env exports
    if ($moduleMain->isDns01()) {
        $envExports = $moduleMain->buildDnsCredentialEnvString();
        $cmd = $envExports . $cmd;
    }

    Processes::mwExec("$shPath $tsWrapper $cmd");

    $moduleMain->run();
} finally {
    if ($portManager !== null) {
        $portManager->closePort();
    }
}
