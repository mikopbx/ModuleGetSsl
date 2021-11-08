#!/usr/bin/php
<?php
#
# MikoPBX - free phone system for small business
# Copyright © 2017-2021 Alexey Portnov and Nikolay Beketov
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation; either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License along with this program.
# If not, see <https://www.gnu.org/licenses/>.
#

use MikoPBX\Common\Models\PbxSettings;
use MikoPBX\Common\Models\LanInterfaces;
use Modules\ModuleGetSsl\Lib\GetSslConf;
require_once('Globals.php');


$res = LanInterfaces::findFirst("internet = '1'")->toArray();
$extHostname = $res['exthostname']??'';

$confClass = new GetSslConf();
$dirCrt = $confClass->getModuleDir().'/db/getssl/'.$extHostname;
if(!file_exists($dirCrt)){
    exit(1);
}

if(!file_exists("$dirCrt/$extHostname.key") || !file_exists("$dirCrt/fullchain.crt")){
    exit(2);
}

/**
 * Обновление ключа в общих настройках АТС.
 * @param $name
 * @param $path
 */
function updateKey($name, $path):void
{
    if(!file_exists($path)){
        return;
    }
    $key        = file_get_contents($path);
    $oldPubKey  = PbxSettings::getValueByKey($name);

    if($key !== $oldPubKey){
        $filter = [
            'key=:key:',
            'bind'    => [
                'key' => $name,
            ],
        ];
        $dbRec = PbxSettings::findFirst($filter);
        if(!$dbRec){
            $dbRec = new PbxSettings();
            $dbRec->key = $name;
        }
        $dbRec->value = $key;
        $dbRec->save();
    }

}

updateKey('WEBHTTPSPublicKey', "$dirCrt/fullchain.crt");
updateKey('WEBHTTPSPrivateKey', "$dirCrt/$extHostname.key");