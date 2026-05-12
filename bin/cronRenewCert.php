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

    if ($moduleMain->hasAcmeDomain()) {
        // acme.sh already manages this domain — do a normal renewal pass.
        // On success acme.sh invokes --reloadcmd (reloadCmd.php), which calls run()
        // and installs the new cert into PbxSettings. No extra run() needed here.
        $acmeHome       = $moduleMain->dirs['acmeHome'];
        $acmeConfigHome = $moduleMain->dirs['acmeConfigHome'];
        $shPath         = Util::which('sh');
        $tsWrapper      = $moduleMain->dirs['binDir'] . '/timestampWrapper.sh';

        $cmd = GetSslMain::ACME_SH_BIN
            . ' --cron'
            . ' --home ' . escapeshellarg($acmeHome)
            . ' --config-home ' . escapeshellarg($acmeConfigHome);

        if ($moduleMain->isDns01()) {
            $cmd = $moduleMain->buildDnsCredentialEnvString() . $cmd;
        }

        Processes::mwExec("$shPath $tsWrapper $cmd");
    } else {
        // First run after upgrade from legacy getssl: no renewal config exists yet.
        // acme.sh --cron would silently no-op, so trigger a full --issue instead.
        $moduleMain->startGetCertSsl(false);
    }
} finally {
    if ($portManager !== null) {
        $portManager->closePort();
    }
}
