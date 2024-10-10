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

namespace Modules\ModuleGetSsl\Setup;

use MikoPBX\Core\System\Processes;
use MikoPBX\Core\System\Util;
use MikoPBX\Modules\Setup\PbxExtensionSetupBase;

/**
 * Class PbxExtensionSetup
 * Module installer and uninstaller
 *
 * @package Modules\ModuleGetSsl\Setup
 */
class PbxExtensionSetup extends PbxExtensionSetupBase
{
    /**
     * Deletes the module files, folders, and symlinks.
     * If $keepSettings is set to true, it copies the database file to the Backup folder.
     * @see https://docs.mikopbx.com/mikopbx-development/module-developement/module-installer#uninstallfiles
     *
     * @param bool $keepSettings If set to true, the module database is saved.
     *
     * @return bool The result of the deletion process.
     */
    public function unInstallFiles(bool $keepSettings = false): bool
    {
        $mount = Util::which('mount');
        $rm = Util::which('rm');
        Processes::mwExec("$mount -o remount,rw /offload 2> /dev/null");
        Processes::mwExec("$rm -rf /usr/share/getssl /usr/bin/getssl /usr/www/sites/.well-known");
        Processes::mwExec("$mount -o remount,ro /offload 2> /dev/null");

        return parent::unInstallFiles($keepSettings);
    }
}
