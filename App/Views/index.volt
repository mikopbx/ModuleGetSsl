<form class="ui large grey segment form" id="module-get-ssl-form">
    {{ form.render('id') }}

    <div class="ten wide field disability">
        <label>{{ t._('module_getssl_DomainNameLabel') }}</label>
        {{ form.render('domainName') }}
    </div>
    <div class="field disability">
        <div class="ui segment">
            <div class="ui checkbox">
                <label>{{ t._('module_getssl_autoUpdateLabel') }}</label>
                {{ form.render('autoUpdate') }}
            </div>
        </div>
    </div>

    <button id="get-cert" class="ui positive basic button">{{ t._('module_getssl_getUpdateSSLButton') }}</button>
    <br><br>

    <div class="ui icon message hidden" id="div-waiting">
        <i class="notched circle loading icon"></i>
        <div class="content">
            <div class="header">
                {{ t._('module_getssl_getUpdateStatusHeader') }}
            </div>
            <p>{{ t._('module_getssl_getUpdateStatusText') }}</p>
        </div>
    </div>

    <div class="ui message hidden" id="div-result">
        <i class="close icon"></i>
        <div id="div-result-text"></div>
    </div>

    {{ partial("partials/submitbutton",['indexurl':'pbx-extension-modules/index/']) }}
</form>