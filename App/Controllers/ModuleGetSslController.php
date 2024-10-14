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

namespace Modules\ModuleGetSsl\App\Controllers;

use MikoPBX\AdminCabinet\Controllers\BaseController;
use MikoPBX\AdminCabinet\Providers\AssetProvider;
use MikoPBX\Common\Models\LanInterfaces;
use Modules\ModuleGetSsl\App\Forms\ModuleGetSslForm;
use Modules\ModuleGetSsl\Models\ModuleGetSsl;

class ModuleGetSslController extends BaseController
{
    private $moduleUniqueID = 'ModuleGetSsl';

    /**
     * Basic initial class
     */
    public function initialize(): void
    {
        $this->view->logoImagePath = $this->url->get() . 'assets/img/cache/' . $this->moduleUniqueID . '/logo.svg';
        parent::initialize();
    }

    /**
     * Index page controller
     */
    public function indexAction(): void
    {
        $this->view->submitMode = null;
        $footerCollection = $this->assets->collection(AssetProvider::FOOTER_JS);
        $footerCollection->addJs('js/pbx/main/form.js', true);
        $footerCollection->addJs("js/cache/{$this->moduleUniqueID}/module-get-ssl-status-worker.js", true);
        $footerCollection->addJs("js/cache/{$this->moduleUniqueID}/module-get-ssl-index.js", true);

        $footerCollectionACE = $this->assets->collection(AssetProvider::FOOTER_ACE);
        $footerCollectionACE
            ->addJs('js/vendor/ace/ace.js', true)
            ->addJs('js/vendor/ace/mode-julia.js', true);

        $headerCollectionCSS = $this->assets->collection(AssetProvider::HEADER_CSS);
        $headerCollectionCSS->addCss("css/cache/{$this->moduleUniqueID}/module-get-ssl.css", true);

        $settings = ModuleGetSsl::findFirst();
        if ($settings === null) {
            $settings = new ModuleGetSsl();
            $res = LanInterfaces::findFirst("internet = '1'")->toArray();
            $settings->domainName = $res['exthostname'] ?? '';
        }

        $this->view->form = new ModuleGetSslForm($settings, []);
    }

    /**
     * Save settings AJAX action
     */
    public function saveAction(): void
    {
        if (!$this->request->isPost()) {
            return;
        }
        $record = ModuleGetSsl::findFirst();
        if ($record === null) {
            $record = new ModuleGetSsl();
        }
        $this->db->begin();
        foreach ($record as $key => $value) {
            $newVal = $this->request->getPost($key, ['string','trim']) ?? '';
            switch ($key) {
                case 'id':
                    break;
                case 'autoUpdate':
                    $record->$key = ($newVal === 'on') ? '1' : '0';
                    break;
                default:
                    $record->$key = $newVal;
            }
        }

        if ($record->save() === false) {
            $errors = $record->getMessages();
            $this->flash->error(implode('<br>', $errors));
            $this->view->success = false;
            $this->db->rollback();
            return;
        }

        $this->flash->success($this->translation->_('ms_SuccessfulSaved'));
        $this->view->success = true;
        $this->db->commit();
    }
}
