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

namespace Modules\ModuleGetSsl\App\Forms;

use Phalcon\Forms\Form;
use Phalcon\Forms\Element\Text;
use Phalcon\Forms\Element\Check;
use Phalcon\Forms\Element\Hidden;
use Phalcon\Forms\Element\Select;

class ModuleGetSslForm extends Form
{
    public function initialize($entity = null, $options = null): void
    {

        // id
        $this->add(new Hidden('id', ['value' => $entity->id]));

        // DomainName
        $this->add(new Text('domainName'));

        // Challenge type: http or dns
        $challengeTypeOptions = [
            'http' => 'HTTP-01 (port 80)',
            'dns'  => 'DNS-01 (DNS provider API)',
        ];
        $this->add(new Select('challengeType', $challengeTypeOptions, [
            'value' => $entity->challengeType ?? 'http',
        ]));

        // DNS provider dropdown
        $dnsProviderOptions = $options['dnsProviderOptions'] ?? [];
        $this->add(new Select('dnsProvider', $dnsProviderOptions, [
            'value'       => $entity->dnsProvider ?? '',
            'useEmpty'    => true,
            'emptyText'   => '---',
            'emptyValue'  => '',
        ]));

        // DNS credentials (base64 JSON, populated by JS)
        $this->add(new Hidden('dnsCredentials', ['value' => $entity->dnsCredentials ?? '']));

        // AutoUpdate
        $this->addCheckBox('autoUpdate', intval($entity->autoUpdate) === 1);
    }

    /**
     * Adds a checkbox to the form field with the given name.
     * Can be deleted if the module depends on MikoPBX later than 2024.3.0
     *
     * @param string $fieldName The name of the form field.
     * @param bool $checked Indicates whether the checkbox is checked by default.
     * @param string $checkedValue The value assigned to the checkbox when it is checked.
     * @return void
     */
    public function addCheckBox(string $fieldName, bool $checked, string $checkedValue = 'on'): void
    {
        $checkAr = ['value' => null];
        if ($checked) {
            $checkAr = ['checked' => $checkedValue,'value' => $checkedValue];
        }
        $this->add(new Check($fieldName, $checkAr));
    }
}
