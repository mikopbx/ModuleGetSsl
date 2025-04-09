#!/usr/bin/php
<?php
require_once 'Globals.php';
use \MikoPBX\Core\System\System;

System::invokeActions(['cron' => 0]);