<script>var dnsProvidersMeta = {{ dnsProvidersJson }};</script>

<form class="ui large grey segment form" id="module-get-ssl-form">
    {{ form.render('id') }}
    {{ form.render('dnsCredentials') }}

    <div class="field disability">
        <label>{{ t._('module_getssl_DomainNameLabel') }}</label>
            {{ form.render('domainName') }}
    </div>

    <div class="field disability">
        <label>{{ t._('module_getssl_ChallengeTypeLabel') }}</label>
        {{ form.render('challengeType') }}
    </div>

    <div class="field disability" id="http-challenge-info">
        <div class="ui info message">
            <p>{{ t._('module_getssl_HttpChallengeInfo') }}</p>
        </div>
    </div>

    <div class="field disability" id="dns-settings-block" style="display:none">
        <div class="ui segment">
            <div class="field">
                <label>{{ t._('module_getssl_DnsProviderLabel') }}</label>
                {{ form.render('dnsProvider') }}
            </div>
            <div id="dns-credentials-fields">
                <!-- Dynamic credential fields rendered by JS -->
            </div>
            <div class="ui info message">
                <p>{{ t._('module_getssl_DnsChallengeInfo') }}</p>
            </div>
        </div>
    </div>

    <div class="field disability">
        <div class="ui segment">
            <div class="ui checkbox">
                <label>{{ t._('module_getssl_autoUpdateLabel') }}</label>
                {{ form.render('autoUpdate') }}
            </div>
        </div>
    </div>


    <div class="field hidden" id="div-result">
        <label>{{ t._('module_getssl_getUpdateLogHeader') }}</label>
        <div id="user-edit-config" class="application-code"></div>
        <a href="{{ url('system-diagnostic/index/') }}#file=ModuleGetSsl%2Flast-result.log" target="_blank">
            <i class="external alternate icon"></i>{{ t._('module_getssl_ViewFullLogLink') }}
        </a>
    </div>

    {{ partial("partials/submitbutton",['submitBtnIconClass':'exchange icon', 'submitBtnText': t._('module_getssl_getUpdateSSLButton')]) }}

    <div class="ui clearing hidden divider"></div>
</form>
