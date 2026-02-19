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

namespace Modules\ModuleGetSsl\Lib;

/**
 * Static registry of DNS providers for acme.sh DNS-01 validation.
 *
 * Single source of truth for backend and frontend.
 */
class DnsProviderRegistry
{
    /**
     * @var array[]
     */
    private static array $providers = [
        [
            'id' => 'dns_cf',
            'name' => 'Cloudflare',
            'fields' => [
                ['var' => 'CF_Token', 'label' => 'API Token', 'type' => 'password'],
                ['var' => 'CF_Account_ID', 'label' => 'Account ID', 'type' => 'text'],
                ['var' => 'CF_Zone_ID', 'label' => 'Zone ID (optional)', 'type' => 'text'],
            ],
        ],
        [
            'id' => 'dns_aws',
            'name' => 'Amazon Route53',
            'fields' => [
                ['var' => 'AWS_ACCESS_KEY_ID', 'label' => 'Access Key ID', 'type' => 'text'],
                ['var' => 'AWS_SECRET_ACCESS_KEY', 'label' => 'Secret Access Key', 'type' => 'password'],
            ],
        ],
        [
            'id' => 'dns_gd',
            'name' => 'GoDaddy',
            'fields' => [
                ['var' => 'GD_Key', 'label' => 'API Key', 'type' => 'text'],
                ['var' => 'GD_Secret', 'label' => 'API Secret', 'type' => 'password'],
            ],
        ],
        [
            'id' => 'dns_dgon',
            'name' => 'DigitalOcean',
            'fields' => [
                ['var' => 'DO_API_KEY', 'label' => 'API Key', 'type' => 'password'],
            ],
        ],
        [
            'id' => 'dns_linode_v4',
            'name' => 'Linode',
            'fields' => [
                ['var' => 'LINODE_V4_API_KEY', 'label' => 'API Key', 'type' => 'password'],
            ],
        ],
        [
            'id' => 'dns_he',
            'name' => 'Hurricane Electric',
            'fields' => [
                ['var' => 'HE_Username', 'label' => 'Username', 'type' => 'text'],
                ['var' => 'HE_Password', 'label' => 'Password', 'type' => 'password'],
            ],
        ],
        [
            'id' => 'dns_ovh',
            'name' => 'OVH',
            'fields' => [
                ['var' => 'OVH_END_POINT', 'label' => 'Endpoint (ovh-eu / ovh-ca)', 'type' => 'text'],
                ['var' => 'OVH_AK', 'label' => 'Application Key', 'type' => 'text'],
                ['var' => 'OVH_AS', 'label' => 'Application Secret', 'type' => 'password'],
                ['var' => 'OVH_CK', 'label' => 'Consumer Key', 'type' => 'password'],
            ],
        ],
        [
            'id' => 'dns_hetzner',
            'name' => 'Hetzner',
            'fields' => [
                ['var' => 'HETZNER_Token', 'label' => 'API Token', 'type' => 'password'],
            ],
        ],
        [
            'id' => 'dns_yc',
            'name' => 'Yandex Cloud',
            'fields' => [
                ['var' => 'YC_Zone_ID', 'label' => 'DNS Zone ID', 'type' => 'text'],
                ['var' => 'YC_Folder_ID', 'label' => 'Folder ID', 'type' => 'text'],
                ['var' => 'YC_SA_ID', 'label' => 'Service Account ID', 'type' => 'text'],
                ['var' => 'YC_SA_Key_ID', 'label' => 'SA IAM Key ID', 'type' => 'text'],
                ['var' => 'YC_SA_Key_File_PEM_b64', 'label' => 'SA Private Key (base64)', 'type' => 'password'],
            ],
        ],
        [
            'id' => 'dns_namecheap',
            'name' => 'Namecheap',
            'fields' => [
                ['var' => 'NAMECHEAP_USERNAME', 'label' => 'Username', 'type' => 'text'],
                ['var' => 'NAMECHEAP_API_KEY', 'label' => 'API Key', 'type' => 'password'],
                ['var' => 'NAMECHEAP_SOURCEIP', 'label' => 'Source IP', 'type' => 'text'],
            ],
        ],
        [
            'id' => 'dns_azure',
            'name' => 'Azure DNS',
            'fields' => [
                ['var' => 'AZUREDNS_SUBSCRIPTIONID', 'label' => 'Subscription ID', 'type' => 'text'],
                ['var' => 'AZUREDNS_TENANTID', 'label' => 'Tenant ID', 'type' => 'text'],
                ['var' => 'AZUREDNS_APPID', 'label' => 'App ID', 'type' => 'text'],
                ['var' => 'AZUREDNS_CLIENTSECRET', 'label' => 'Client Secret', 'type' => 'password'],
            ],
        ],
        [
            'id' => 'dns_duckdns',
            'name' => 'DuckDNS',
            'fields' => [
                ['var' => 'DuckDNS_Token', 'label' => 'API Token', 'type' => 'password'],
            ],
        ],
        [
            'id' => 'dns_pdns',
            'name' => 'PowerDNS',
            'fields' => [
                ['var' => 'PDNS_Url', 'label' => 'API URL', 'type' => 'text'],
                ['var' => 'PDNS_ServerId', 'label' => 'Server ID', 'type' => 'text'],
                ['var' => 'PDNS_Token', 'label' => 'API Token', 'type' => 'password'],
            ],
        ],
        [
            'id' => 'dns_selectel',
            'name' => 'Selectel',
            'fields' => [
                ['var' => 'SL_Login_ID', 'label' => 'Account ID', 'type' => 'text'],
                ['var' => 'SL_Project_Name', 'label' => 'Project Name', 'type' => 'text'],
                ['var' => 'SL_Login_Name', 'label' => 'Service User Name', 'type' => 'text'],
                ['var' => 'SL_Pswd', 'label' => 'Service User Password', 'type' => 'password'],
            ],
        ],
        [
            'id' => 'dns_regru',
            'name' => 'reg.ru',
            'fields' => [
                ['var' => 'REGRU_API_Username', 'label' => 'Username', 'type' => 'text'],
                ['var' => 'REGRU_API_Password', 'label' => 'Password', 'type' => 'password'],
            ],
        ],
        [
            'id' => 'dns_beget',
            'name' => 'Beget',
            'fields' => [
                ['var' => 'BEGET_User', 'label' => 'API User', 'type' => 'text'],
                ['var' => 'BEGET_Password', 'label' => 'API Password', 'type' => 'password'],
            ],
        ],
        [
            'id' => 'dns_vultr',
            'name' => 'Vultr',
            'fields' => [
                ['var' => 'VULTR_API_KEY', 'label' => 'API Key', 'type' => 'password'],
            ],
        ],
        [
            'id' => 'dns_inwx',
            'name' => 'INWX',
            'fields' => [
                ['var' => 'INWX_User', 'label' => 'Username', 'type' => 'text'],
                ['var' => 'INWX_Password', 'label' => 'Password', 'type' => 'password'],
            ],
        ],
        [
            'id' => 'dns_dreamhost',
            'name' => 'DreamHost',
            'fields' => [
                ['var' => 'DH_API_KEY', 'label' => 'API Key', 'type' => 'password'],
            ],
        ],
        [
            'id' => 'dns_desec',
            'name' => 'deSEC',
            'fields' => [
                ['var' => 'DEDYN_TOKEN', 'label' => 'API Token', 'type' => 'password'],
            ],
        ],
        [
            'id' => 'dns_ispconfig',
            'name' => 'ISPConfig',
            'fields' => [
                ['var' => 'ISPC_User', 'label' => 'Remote User', 'type' => 'text'],
                ['var' => 'ISPC_Password', 'label' => 'Remote Password', 'type' => 'password'],
                ['var' => 'ISPC_Api', 'label' => 'API URL', 'type' => 'text'],
            ],
        ],
        [
            'id' => 'dns_gcloud',
            'name' => 'Google Cloud DNS',
            'fields' => [
                ['var' => 'CLOUDSDK_ACTIVE_CONFIG_NAME', 'label' => 'Config Name', 'type' => 'text'],
            ],
        ],
        [
            'id' => 'custom',
            'name' => 'Custom (manual --dns argument)',
            'fields' => [
                ['var' => 'CUSTOM_DNS_HOOK', 'label' => 'DNS hook name (e.g. dns_myapi)', 'type' => 'text'],
            ],
        ],
    ];

    /**
     * Returns the full list of DNS providers.
     *
     * @return array[]
     */
    public static function getProviders(): array
    {
        return self::$providers;
    }

    /**
     * Finds a provider by ID.
     *
     * @param string $id Provider identifier (e.g. 'dns_cf')
     * @return array|null
     */
    public static function getProviderById(string $id): ?array
    {
        foreach (self::$providers as $provider) {
            if ($provider['id'] === $id) {
                return $provider;
            }
        }
        return null;
    }

    /**
     * Returns [id => name] pairs for use in Phalcon Select elements.
     *
     * @return array<string, string>
     */
    public static function getProviderSelectOptions(): array
    {
        $options = [];
        foreach (self::$providers as $provider) {
            $options[$provider['id']] = $provider['name'];
        }
        return $options;
    }
}
