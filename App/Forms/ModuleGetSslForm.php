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

class ModuleGetSslForm extends Form
{
    public function initialize($entity = null, $options = null): void
    {

        // id
        $this->add(new Hidden('id', ['value' => $entity->id]));

        // DomainName
        $this->add(new Text('domainName'));

        // AutoUpdate
        $checkAr = ['value' => null];
        if (intval($entity->autoUpdate) === 1) {
            $checkAr = ['checked' => '1'];
        }
        $this->add(new Check('autoUpdate', $checkAr));
    }
}
