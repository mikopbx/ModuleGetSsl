
<form class="ui large grey segment form" id="module-get-ssl-form">
    {{ form.render('id') }}

    <button id="get-cert" class="ui positive basic button">Get / update cert</button>
    <br><br>

    <div class="ui icon message hidden" id="div-waiting">
      <i class="notched circle loading icon"></i>
      <div class="content">
        <div class="header">
          Just one second
        </div>
        <p>Certificate Request</p>
      </div>
    </div>

    <div class="ui message hidden" id="div-result">
      <i class="close icon"></i>
      <div id="div-result-text"></div>
    </div>

<!--     {{ partial("partials/submitbutton",['indexurl':'pbx-extension-modules/index/']) }} -->
</form>