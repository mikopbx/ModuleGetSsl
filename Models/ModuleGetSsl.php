<?php
/**
 * Copyright © MIKO LLC - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 * Written by Alexey Portnov, 2 2019
 */

/*
 * https://docs.phalcon.io/4.0/en/db-models
 *
 */

namespace Modules\ModuleGetSsl\Models;

use MikoPBX\Common\Models\Providers;
use MikoPBX\Modules\Models\ModulesModelsBase;
use Phalcon\Mvc\Model\Relation;

class ModuleGetSsl extends ModulesModelsBase
{

    /**
     * @Primary
     * @Identity
     * @Column(type="integer", nullable=false)
     */
    public $id;

    /**
     * Text field example
     *
     * @Column(type="string", nullable=true)
     */
    public $text_field;

    /**
     * TextArea field example
     *
     * @Column(type="string", nullable=true)
     */
    public $text_area_field;

    /**
     * Password field example
     *
     * @Column(type="string", nullable=true)
     */
    public $password_field;

    /**
     * Integer field example
     *
     * @Column(type="integer", default="1", nullable=true)
     */
    public $integer_field;

    /**
     * CheckBox
     *
     * @Column(type="integer", default="1", nullable=true)
     */
    public $checkbox_field;

    /**
     * Toggle
     *
     * @Column(type="integer", default="1", nullable=true)
     */
    public $toggle_field;

    /**
     * Dropdown menu
     *
     * @Column(type="string", nullable=true)
     */
    public $dropdown_field;

    /**
     * Returns dynamic relations between module models and common models
     * MikoPBX check it in ModelsBase after every call to keep data consistent
     *
     * There is example to describe the relation between Providers and ModuleGetSsl models
     *
     * It is important to duplicate the relation alias on message field after Models\ word
     *
     * @param $calledModelObject
     *
     * @return void
     */
    public static function getDynamicRelations(&$calledModelObject): void
    {
//        if (is_a($calledModelObject, Providers::class)) {
//            $calledModelObject->belongsTo(
//                'id',
//                ModuleGetSsl::class,
//                'dropdown_field',
//                [
//                    'alias'      => 'ModuleGetSslProvider',
//                    'foreignKey' => [
//                        'allowNulls' => 0,
//                        'message'    => 'Models\ModuleGetSslProvider',
//                        'action'     => Relation::ACTION_RESTRICT
//                        // запретить удалять провайдера если есть ссылки в модуле
//                    ],
//                ]
//            );
//        }
    }

    public function initialize(): void
    {
        $this->setSource('m_ModuleGetSsl');
        $this->hasOne(
            'dropdown_field',
            Providers::class,
            'id',
            [
                'alias'      => 'Providers',
                'foreignKey' => [
                    'allowNulls' => true,
                    'action'     => Relation::NO_ACTION,
                ],
            ]
        );
        parent::initialize();
    }


}