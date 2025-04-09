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

namespace Modules\ModuleGetSsl\Models;

use MikoPBX\Modules\Models\ModulesModelsBase;

class ModuleGetSsl extends ModulesModelsBase
{
    /**
     * @Primary
     * @Identity
     * @Column(type="integer", nullable=false)
     */
    public $id;

    /**
     * Domain name without scheme
     *
     * @Column(type="string", nullable=true)
     */
    public $domainName;

    /**
     * Auto update SSL certificate
     *
     * @Column(type="integer", default="1", nullable=true)
     */
    public $autoUpdate;

    public function initialize(): void
    {
        $this->setSource('m_ModuleGetSsl');
        parent::initialize();
    }
}
