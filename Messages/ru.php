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

return [
    'repModuleGetSsl'         => 'Lets Encrypt - %repesent%',
    'mo_ModuleModuleGetSsl'   => 'Lets Encrypt Get ssl',
    'BreadcrumbModuleGetSsl'  => 'Lets Encrypt Get ssl',
    'SubHeaderModuleGetSsl'   => 'SSL сертификаты для HTTPS',
    'module_getssl_DomainNameLabel' => 'Имя домена без http и https, только название',
    'module_getssl_autoUpdateLabel' => 'Обновлять сертификат автоматически',
    'module_getssl_getUpdateSSLButton' => 'Получить/обновить SSL сертификат',
    'module_getssl_getUpdateLogHeader' => 'Результат запроса сертификата в Lets Encrypt',
    'module_getssl_DomainNameEmpty' => 'Введите значение домена для генерации сертификата',
    'module_getssl_ConfigStartsGenerating' => 'Генерируем конфигурационные файлы...',
    'module_getssl_ConfigGenerated' => 'Конфигурационные файлы созданы...',
    'module_getssl_GetSSLProcessing' => 'Выполняется запрос данных в Lets Encrypt...',
    'module_getssl_GetSSLProcessingTimeout' => 'Ошибка, сервис Lets Encrypt не вернул ответа в течение 2 минут',
];
