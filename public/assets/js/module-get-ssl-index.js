/* global globalRootUrl, globalTranslate, Form, Config, PbxApi, dnsProvidersMeta */

// Constants related to the form and module
const idUrl = 'module-get-ssl'; // API endpoint for SSL module
const idForm = 'module-get-ssl-form'; // Form element ID for SSL module
const className = 'ModuleGetSsl'; // Class name for this module

// Main ModuleGetSsl class definition
const ModuleGetSsl = {
  // Cache commonly used jQuery objects
  $formObj: $('#' + idForm),
  $checkBoxes: $('#' + idForm + ' .ui.checkbox'),
  $disabilityFields: $('#' + idForm + ' .disability'),
  $statusToggle: $('#module-status-toggle'),
  $submitButton: $('#submitbutton'),
  $moduleStatus: $('#status'),
  $domainName: $('#domainName'),
  $challengeType: $('#challengeType'),
  $dnsProvider: $('#dnsProvider'),
  $httpChallengeInfo: $('#http-challenge-info'),
  $dnsSettingsBlock: $('#dns-settings-block'),
  $dnsCredentialsFields: $('#dns-credentials-fields'),
  $dnsCredentialsInput: $('input[name="dnsCredentials"]'),
  $ipAddressWarning: $('#ip-address-certificate-warning'),
  // Validation rules for the form
  validateRules: {
    domainName: {
      identifier: 'domainName',
      rules: [{
        type: 'empty',
        prompt: globalTranslate.module_getssl_DomainNameEmpty
      }]
    }
  },
  /**
   * Initialize the module, bind event listeners, and setup the form.
   */
  initialize() {
    // Initialize Semantic UI checkboxes
    this.$checkBoxes.checkbox();

    // Initialize dropdowns
    this.$challengeType.dropdown({
      onChange: ModuleGetSsl.onChangeChallengeType
    });
    this.$dnsProvider.dropdown({
      fullTextSearch: true,
      onChange: ModuleGetSsl.onChangeDnsProvider
    });

    // Check and set module status on load and when the status changes
    this.checkStatusToggle();
    window.addEventListener('ModuleStatusChanged', this.checkStatusToggle);

    // Initialize form with validation and submit handlers
    this.initializeForm();
    this.bindIpAddressWarning();
    moduleGetSSLStatusLoopWorker.$resultBlock.hide();

    // Restore saved state
    const currentChallenge = this.$challengeType.dropdown('get value') || 'http';
    this.onChangeChallengeType(currentChallenge);
    this.restoreSavedCredentials();
  },
  /**
   * Check whether a value is a valid IPv4 or IPv6 address.
   * @param {string} value
   * @returns {boolean}
   */
  isIpAddress(value) {
    const address = String(value || '').trim();
    const ipv4Parts = address.split('.');
    if (ipv4Parts.length === 4) {
      return ipv4Parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255 && (part === '0' || part[0] !== '0'));
    }
    const hasOpeningBracket = address.startsWith('[');
    const hasClosingBracket = address.endsWith(']');
    if (hasOpeningBracket !== hasClosingBracket) return false;
    const ipv6 = hasOpeningBracket ? address.slice(1, -1) : address;
    if (!ipv6.includes(':') || /\s/.test(ipv6)) return false;
    try {
      new URL(`http://[${ipv6}]/`);
      return true;
    } catch (e) {
      return false;
    }
  },
  /** Update warning visibility when the configured address changes. */
  updateIpAddressWarning() {
    if (this.isIpAddress(this.$domainName.val())) {
      this.$ipAddressWarning.show();
    } else {
      this.$ipAddressWarning.hide();
    }
  },
  /** Bind reactive IP warning behavior and initialize its state. */
  bindIpAddressWarning() {
    this.$domainName.on('input', () => this.updateIpAddressWarning());
    this.updateIpAddressWarning();
  },
  /**
   * Handle challenge type change: show/hide relevant sections.
   * @param {string} value - 'http' or 'dns'
   */
  onChangeChallengeType(value) {
    if (value === 'dns') {
      ModuleGetSsl.$httpChallengeInfo.hide();
      ModuleGetSsl.$dnsSettingsBlock.show();
      // Trigger provider change to render credential fields
      const currentProvider = ModuleGetSsl.$dnsProvider.dropdown('get value');
      if (currentProvider) {
        ModuleGetSsl.onChangeDnsProvider(currentProvider);
      }
    } else {
      ModuleGetSsl.$httpChallengeInfo.show();
      ModuleGetSsl.$dnsSettingsBlock.hide();
    }
  },
  /**
   * Handle DNS provider change: dynamically render credential fields.
   * @param {string} value - provider ID (e.g. 'dns_cf')
   */
  onChangeDnsProvider(value) {
    const $container = ModuleGetSsl.$dnsCredentialsFields;
    $container.empty();
    if (!value || typeof dnsProvidersMeta === 'undefined') {
      return;
    }

    // Find provider metadata
    const provider = dnsProvidersMeta.find(p => p.id === value);
    if (!provider || !provider.fields) {
      return;
    }

    // Decode existing saved credentials for pre-filling
    let savedCreds = {};
    const encodedVal = ModuleGetSsl.$dnsCredentialsInput.val();
    if (encodedVal) {
      try {
        const decoded = atob(encodedVal);
        savedCreds = JSON.parse(decoded);
      } catch (e) {
        // ignore decode errors
      }
    }

    // Render fields
    provider.fields.forEach(field => {
      const hasSaved = Boolean(savedCreds[field.var]);
      const displayValue = hasSaved ? '••••••••' : '';
      const maskedAttr = hasSaved ? 'data-masked="true"' : '';
      const html = `
				<div class="field">
					<label>${field.label}</label>
					<input type="password"
						   class="dns-cred-input"
						   data-var="${field.var}"
						   ${maskedAttr}
						   value="${ModuleGetSsl.escapeHtml(displayValue)}"
						   placeholder="${field.label}">
				</div>`;
      $container.append(html);
    });
    // On focus: clear mask so user can enter new value
    $container.on('focus', '.dns-cred-input[data-masked]', function () {
      $(this).val('').removeAttr('data-masked');
    });
    // Clear error highlight when user starts typing
    $container.on('input', '.dns-cred-input', function () {
      $(this).closest('.field').removeClass('error');
    });
  },
  /**
   * Collect DNS credential field values into base64 JSON and write to hidden input.
   * Masked fields (unchanged) are restored from the previously saved credentials.
   */
  collectDnsCredentials() {
    const challengeType = ModuleGetSsl.$challengeType.dropdown('get value');
    if (challengeType !== 'dns') {
      return;
    }
    // Decode currently stored credentials (source of truth for masked fields)
    let savedCreds = {};
    const encodedVal = ModuleGetSsl.$dnsCredentialsInput.val();
    if (encodedVal) {
      try {
        savedCreds = JSON.parse(atob(encodedVal));
      } catch (e) {
        // ignore
      }
    }
    const creds = {};
    $('.dns-cred-input').each(function () {
      const varName = $(this).data('var');
      if (!varName) return;
      if ($(this).is('[data-masked]')) {
        // User didn't change this field — keep stored value
        if (savedCreds[varName]) {
          creds[varName] = savedCreds[varName];
        }
      } else {
        const val = $(this).val();
        if (val) {
          creds[varName] = val;
        }
      }
    });
    ModuleGetSsl.$dnsCredentialsInput.val(btoa(JSON.stringify(creds)));
  },
  /**
   * Restore saved credentials into the DNS provider fields on page load.
   */
  restoreSavedCredentials() {
    const currentProvider = ModuleGetSsl.$dnsProvider.dropdown('get value');
    if (currentProvider) {
      ModuleGetSsl.onChangeDnsProvider(currentProvider);
    }
  },
  /**
   * Escape HTML special characters for safe insertion into attributes.
   * @param {string} text
   * @returns {string}
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  },
  /**
   * Request an SSL certificate by calling the server-side API.
   */
  getSsl() {
    $.api({
      url: `${Config.pbxUrl}/pbxcore/api/modules/${className}/get-cert`,
      on: 'now',
      method: 'POST',
      beforeXHR(xhr) {
        xhr.setRequestHeader('X-Async-Response-Channel-Id', moduleGetSSLStatusLoopWorker.channelId);
        xhr.setRequestHeader('X-Processor-Timeout', '120');
        return xhr;
      },
      beforeSend(settings) {
        ModuleGetSsl.$submitButton.addClass('loading disabled');
        moduleGetSSLStatusLoopWorker.$resultBlock.show();
        moduleGetSSLStatusLoopWorker.editor.getSession().setValue(globalTranslate.module_getssl_GetSSLProcessing + '\n');
        return settings;
      },
      successTest: PbxApi.successTest,
      onSuccess: function (response) {
        ModuleGetSsl.$submitButton.removeClass('loading disabled');
      },
      onFailure: function (response) {
        ModuleGetSsl.$submitButton.removeClass('loading disabled');
        UserMessage.showMultiString(response.message);
      }
    });
  },
  /**
   * Toggles the form fields and status visibility based on the module's status.
   */
  checkStatusToggle() {
    if (ModuleGetSsl.$statusToggle.checkbox('is checked')) {
      ModuleGetSsl.$disabilityFields.removeClass('disabled');
      ModuleGetSsl.$moduleStatus.show();
    } else {
      ModuleGetSsl.$disabilityFields.addClass('disabled');
      ModuleGetSsl.$moduleStatus.hide();
    }
  },
  /**
   * Validate DNS provider and credentials when DNS-01 is selected.
   * Returns true if valid, false otherwise.
   */
  validateDnsFields() {
    if (ModuleGetSsl.$challengeType.dropdown('get value') !== 'dns') {
      return true;
    }
    if (!ModuleGetSsl.$dnsProvider.dropdown('get value')) {
      UserMessage.showError(globalTranslate.module_getssl_DnsProviderEmpty);
      return false;
    }
    let hasEmpty = false;
    $('.dns-cred-input').each(function () {
      const $field = $(this).closest('.field');
      const isMasked = $(this).is('[data-masked]');
      if (!isMasked && !$(this).val().trim()) {
        $field.addClass('error');
        hasEmpty = true;
      } else {
        $field.removeClass('error');
      }
    });
    if (hasEmpty) {
      UserMessage.showError(globalTranslate.module_getssl_DnsCredentialsEmpty);
      return false;
    }
    return true;
  },
  /**
   * Callback before sending the form.
   * @param {Object} settings - Ajax request settings.
   * @returns {Object} The modified Ajax request settings.
   */
  cbBeforeSendForm(settings) {
    if (!ModuleGetSsl.validateDnsFields()) {
      return false;
    }
    const result = settings;
    // Collect DNS credentials into hidden field before form submission
    ModuleGetSsl.collectDnsCredentials();
    result.data = ModuleGetSsl.$formObj.form('get values');
    return result;
  },
  /**
   * Callback function after sending the form.
   */
  cbAfterSendForm(response) {
    if (Form.checkSuccess(response)) {
      ModuleGetSsl.getSsl();
    }
  },
  /**
   * Initializes the form validation and submission logic.
   */
  initializeForm() {
    Form.$formObj = ModuleGetSsl.$formObj;
    Form.url = `${globalRootUrl}${idUrl}/${idUrl}/save`;
    Form.validateRules = ModuleGetSsl.validateRules;
    Form.enableDirrity = false;
    Form.cbAfterSendForm = ModuleGetSsl.cbAfterSendForm;
    Form.cbBeforeSendForm = ModuleGetSsl.cbBeforeSendForm;
    Form.initialize();
  }
};

// Initialize the ModuleGetSsl class when the document is ready
$(document).ready(() => {
  ModuleGetSsl.initialize();
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kdWxlLWdldC1zc2wtaW5kZXguanMiLCJuYW1lcyI6W10sInNvdXJjZXMiOlsic3JjL21vZHVsZS1nZXQtc3NsLWluZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIGdsb2JhbCBnbG9iYWxSb290VXJsLCBnbG9iYWxUcmFuc2xhdGUsIEZvcm0sIENvbmZpZywgUGJ4QXBpLCBkbnNQcm92aWRlcnNNZXRhICovXG5cbi8vIENvbnN0YW50cyByZWxhdGVkIHRvIHRoZSBmb3JtIGFuZCBtb2R1bGVcbmNvbnN0IGlkVXJsICAgICA9ICdtb2R1bGUtZ2V0LXNzbCc7ICAgICAgICAgICAgICAvLyBBUEkgZW5kcG9pbnQgZm9yIFNTTCBtb2R1bGVcbmNvbnN0IGlkRm9ybSAgICA9ICdtb2R1bGUtZ2V0LXNzbC1mb3JtJzsgICAgICAgICAvLyBGb3JtIGVsZW1lbnQgSUQgZm9yIFNTTCBtb2R1bGVcbmNvbnN0IGNsYXNzTmFtZSA9ICdNb2R1bGVHZXRTc2wnOyAgICAgICAgICAgICAgICAvLyBDbGFzcyBuYW1lIGZvciB0aGlzIG1vZHVsZVxuXG4vLyBNYWluIE1vZHVsZUdldFNzbCBjbGFzcyBkZWZpbml0aW9uXG5jb25zdCBNb2R1bGVHZXRTc2wgPSB7XG5cdC8vIENhY2hlIGNvbW1vbmx5IHVzZWQgalF1ZXJ5IG9iamVjdHNcblx0JGZvcm1PYmo6ICQoJyMnICsgaWRGb3JtKSxcblx0JGNoZWNrQm94ZXM6ICQoJyMnICsgaWRGb3JtICsgJyAudWkuY2hlY2tib3gnKSxcblx0JGRpc2FiaWxpdHlGaWVsZHM6ICQoJyMnICsgaWRGb3JtICsgJyAuZGlzYWJpbGl0eScpLFxuXHQkc3RhdHVzVG9nZ2xlOiAkKCcjbW9kdWxlLXN0YXR1cy10b2dnbGUnKSxcblx0JHN1Ym1pdEJ1dHRvbjogJCgnI3N1Ym1pdGJ1dHRvbicpLFxuXHQkbW9kdWxlU3RhdHVzOiAkKCcjc3RhdHVzJyksXG5cdCRkb21haW5OYW1lOiAkKCcjZG9tYWluTmFtZScpLFxuXHQkY2hhbGxlbmdlVHlwZTogJCgnI2NoYWxsZW5nZVR5cGUnKSxcblx0JGRuc1Byb3ZpZGVyOiAkKCcjZG5zUHJvdmlkZXInKSxcblx0JGh0dHBDaGFsbGVuZ2VJbmZvOiAkKCcjaHR0cC1jaGFsbGVuZ2UtaW5mbycpLFxuXHQkZG5zU2V0dGluZ3NCbG9jazogJCgnI2Rucy1zZXR0aW5ncy1ibG9jaycpLFxuXHQkZG5zQ3JlZGVudGlhbHNGaWVsZHM6ICQoJyNkbnMtY3JlZGVudGlhbHMtZmllbGRzJyksXG5cdCRkbnNDcmVkZW50aWFsc0lucHV0OiAkKCdpbnB1dFtuYW1lPVwiZG5zQ3JlZGVudGlhbHNcIl0nKSxcblx0JGlwQWRkcmVzc1dhcm5pbmc6ICQoJyNpcC1hZGRyZXNzLWNlcnRpZmljYXRlLXdhcm5pbmcnKSxcblxuXHQvLyBWYWxpZGF0aW9uIHJ1bGVzIGZvciB0aGUgZm9ybVxuXHR2YWxpZGF0ZVJ1bGVzOiB7XG5cdFx0ZG9tYWluTmFtZToge1xuXHRcdFx0aWRlbnRpZmllcjogJ2RvbWFpbk5hbWUnLFxuXHRcdFx0cnVsZXM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHR5cGU6ICdlbXB0eScsXG5cdFx0XHRcdFx0cHJvbXB0OiBnbG9iYWxUcmFuc2xhdGUubW9kdWxlX2dldHNzbF9Eb21haW5OYW1lRW1wdHksXG5cdFx0XHRcdH0sXG5cdFx0XHRdLFxuXHRcdH0sXG5cdH0sXG5cblx0LyoqXG5cdCAqIEluaXRpYWxpemUgdGhlIG1vZHVsZSwgYmluZCBldmVudCBsaXN0ZW5lcnMsIGFuZCBzZXR1cCB0aGUgZm9ybS5cblx0ICovXG5cdGluaXRpYWxpemUoKSB7XG5cdFx0Ly8gSW5pdGlhbGl6ZSBTZW1hbnRpYyBVSSBjaGVja2JveGVzXG5cdFx0dGhpcy4kY2hlY2tCb3hlcy5jaGVja2JveCgpO1xuXG5cdFx0Ly8gSW5pdGlhbGl6ZSBkcm9wZG93bnNcblx0XHR0aGlzLiRjaGFsbGVuZ2VUeXBlLmRyb3Bkb3duKHtcblx0XHRcdG9uQ2hhbmdlOiBNb2R1bGVHZXRTc2wub25DaGFuZ2VDaGFsbGVuZ2VUeXBlLFxuXHRcdH0pO1xuXHRcdHRoaXMuJGRuc1Byb3ZpZGVyLmRyb3Bkb3duKHtcblx0XHRcdGZ1bGxUZXh0U2VhcmNoOiB0cnVlLFxuXHRcdFx0b25DaGFuZ2U6IE1vZHVsZUdldFNzbC5vbkNoYW5nZURuc1Byb3ZpZGVyLFxuXHRcdH0pO1xuXG5cdFx0Ly8gQ2hlY2sgYW5kIHNldCBtb2R1bGUgc3RhdHVzIG9uIGxvYWQgYW5kIHdoZW4gdGhlIHN0YXR1cyBjaGFuZ2VzXG5cdFx0dGhpcy5jaGVja1N0YXR1c1RvZ2dsZSgpO1xuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdNb2R1bGVTdGF0dXNDaGFuZ2VkJywgdGhpcy5jaGVja1N0YXR1c1RvZ2dsZSk7XG5cblx0XHQvLyBJbml0aWFsaXplIGZvcm0gd2l0aCB2YWxpZGF0aW9uIGFuZCBzdWJtaXQgaGFuZGxlcnNcblx0XHR0aGlzLmluaXRpYWxpemVGb3JtKCk7XG5cdFx0dGhpcy5iaW5kSXBBZGRyZXNzV2FybmluZygpO1xuXG5cdFx0bW9kdWxlR2V0U1NMU3RhdHVzTG9vcFdvcmtlci4kcmVzdWx0QmxvY2suaGlkZSgpO1xuXG5cdFx0Ly8gUmVzdG9yZSBzYXZlZCBzdGF0ZVxuXHRcdGNvbnN0IGN1cnJlbnRDaGFsbGVuZ2UgPSB0aGlzLiRjaGFsbGVuZ2VUeXBlLmRyb3Bkb3duKCdnZXQgdmFsdWUnKSB8fCAnaHR0cCc7XG5cdFx0dGhpcy5vbkNoYW5nZUNoYWxsZW5nZVR5cGUoY3VycmVudENoYWxsZW5nZSk7XG5cdFx0dGhpcy5yZXN0b3JlU2F2ZWRDcmVkZW50aWFscygpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBDaGVjayB3aGV0aGVyIGEgdmFsdWUgaXMgYSB2YWxpZCBJUHY0IG9yIElQdjYgYWRkcmVzcy5cblx0ICogQHBhcmFtIHtzdHJpbmd9IHZhbHVlXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxuXHQgKi9cblx0aXNJcEFkZHJlc3ModmFsdWUpIHtcblx0XHRjb25zdCBhZGRyZXNzID0gU3RyaW5nKHZhbHVlIHx8ICcnKS50cmltKCk7XG5cdFx0Y29uc3QgaXB2NFBhcnRzID0gYWRkcmVzcy5zcGxpdCgnLicpO1xuXHRcdGlmIChpcHY0UGFydHMubGVuZ3RoID09PSA0KSB7XG5cdFx0XHRyZXR1cm4gaXB2NFBhcnRzLmV2ZXJ5KHBhcnQgPT4gL15cXGR7MSwzfSQvLnRlc3QocGFydClcblx0XHRcdFx0JiYgTnVtYmVyKHBhcnQpIDw9IDI1NVxuXHRcdFx0XHQmJiAocGFydCA9PT0gJzAnIHx8IHBhcnRbMF0gIT09ICcwJykpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGhhc09wZW5pbmdCcmFja2V0ID0gYWRkcmVzcy5zdGFydHNXaXRoKCdbJyk7XG5cdFx0Y29uc3QgaGFzQ2xvc2luZ0JyYWNrZXQgPSBhZGRyZXNzLmVuZHNXaXRoKCddJyk7XG5cdFx0aWYgKGhhc09wZW5pbmdCcmFja2V0ICE9PSBoYXNDbG9zaW5nQnJhY2tldCkgcmV0dXJuIGZhbHNlO1xuXHRcdGNvbnN0IGlwdjYgPSBoYXNPcGVuaW5nQnJhY2tldCA/IGFkZHJlc3Muc2xpY2UoMSwgLTEpIDogYWRkcmVzcztcblx0XHRpZiAoIWlwdjYuaW5jbHVkZXMoJzonKSB8fCAvXFxzLy50ZXN0KGlwdjYpKSByZXR1cm4gZmFsc2U7XG5cdFx0dHJ5IHtcblx0XHRcdG5ldyBVUkwoYGh0dHA6Ly9bJHtpcHY2fV0vYCk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKiBVcGRhdGUgd2FybmluZyB2aXNpYmlsaXR5IHdoZW4gdGhlIGNvbmZpZ3VyZWQgYWRkcmVzcyBjaGFuZ2VzLiAqL1xuXHR1cGRhdGVJcEFkZHJlc3NXYXJuaW5nKCkge1xuXHRcdGlmICh0aGlzLmlzSXBBZGRyZXNzKHRoaXMuJGRvbWFpbk5hbWUudmFsKCkpKSB7XG5cdFx0XHR0aGlzLiRpcEFkZHJlc3NXYXJuaW5nLnNob3coKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy4kaXBBZGRyZXNzV2FybmluZy5oaWRlKCk7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKiBCaW5kIHJlYWN0aXZlIElQIHdhcm5pbmcgYmVoYXZpb3IgYW5kIGluaXRpYWxpemUgaXRzIHN0YXRlLiAqL1xuXHRiaW5kSXBBZGRyZXNzV2FybmluZygpIHtcblx0XHR0aGlzLiRkb21haW5OYW1lLm9uKCdpbnB1dCcsICgpID0+IHRoaXMudXBkYXRlSXBBZGRyZXNzV2FybmluZygpKTtcblx0XHR0aGlzLnVwZGF0ZUlwQWRkcmVzc1dhcm5pbmcoKTtcblx0fSxcblxuXHQvKipcblx0ICogSGFuZGxlIGNoYWxsZW5nZSB0eXBlIGNoYW5nZTogc2hvdy9oaWRlIHJlbGV2YW50IHNlY3Rpb25zLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdmFsdWUgLSAnaHR0cCcgb3IgJ2Rucydcblx0ICovXG5cdG9uQ2hhbmdlQ2hhbGxlbmdlVHlwZSh2YWx1ZSkge1xuXHRcdGlmICh2YWx1ZSA9PT0gJ2RucycpIHtcblx0XHRcdE1vZHVsZUdldFNzbC4kaHR0cENoYWxsZW5nZUluZm8uaGlkZSgpO1xuXHRcdFx0TW9kdWxlR2V0U3NsLiRkbnNTZXR0aW5nc0Jsb2NrLnNob3coKTtcblx0XHRcdC8vIFRyaWdnZXIgcHJvdmlkZXIgY2hhbmdlIHRvIHJlbmRlciBjcmVkZW50aWFsIGZpZWxkc1xuXHRcdFx0Y29uc3QgY3VycmVudFByb3ZpZGVyID0gTW9kdWxlR2V0U3NsLiRkbnNQcm92aWRlci5kcm9wZG93bignZ2V0IHZhbHVlJyk7XG5cdFx0XHRpZiAoY3VycmVudFByb3ZpZGVyKSB7XG5cdFx0XHRcdE1vZHVsZUdldFNzbC5vbkNoYW5nZURuc1Byb3ZpZGVyKGN1cnJlbnRQcm92aWRlcik7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdE1vZHVsZUdldFNzbC4kaHR0cENoYWxsZW5nZUluZm8uc2hvdygpO1xuXHRcdFx0TW9kdWxlR2V0U3NsLiRkbnNTZXR0aW5nc0Jsb2NrLmhpZGUoKTtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIEhhbmRsZSBETlMgcHJvdmlkZXIgY2hhbmdlOiBkeW5hbWljYWxseSByZW5kZXIgY3JlZGVudGlhbCBmaWVsZHMuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB2YWx1ZSAtIHByb3ZpZGVyIElEIChlLmcuICdkbnNfY2YnKVxuXHQgKi9cblx0b25DaGFuZ2VEbnNQcm92aWRlcih2YWx1ZSkge1xuXHRcdGNvbnN0ICRjb250YWluZXIgPSBNb2R1bGVHZXRTc2wuJGRuc0NyZWRlbnRpYWxzRmllbGRzO1xuXHRcdCRjb250YWluZXIuZW1wdHkoKTtcblxuXHRcdGlmICghdmFsdWUgfHwgdHlwZW9mIGRuc1Byb3ZpZGVyc01ldGEgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gRmluZCBwcm92aWRlciBtZXRhZGF0YVxuXHRcdGNvbnN0IHByb3ZpZGVyID0gZG5zUHJvdmlkZXJzTWV0YS5maW5kKHAgPT4gcC5pZCA9PT0gdmFsdWUpO1xuXHRcdGlmICghcHJvdmlkZXIgfHwgIXByb3ZpZGVyLmZpZWxkcykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIERlY29kZSBleGlzdGluZyBzYXZlZCBjcmVkZW50aWFscyBmb3IgcHJlLWZpbGxpbmdcblx0XHRsZXQgc2F2ZWRDcmVkcyA9IHt9O1xuXHRcdGNvbnN0IGVuY29kZWRWYWwgPSBNb2R1bGVHZXRTc2wuJGRuc0NyZWRlbnRpYWxzSW5wdXQudmFsKCk7XG5cdFx0aWYgKGVuY29kZWRWYWwpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IGRlY29kZWQgPSBhdG9iKGVuY29kZWRWYWwpO1xuXHRcdFx0XHRzYXZlZENyZWRzID0gSlNPTi5wYXJzZShkZWNvZGVkKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0Ly8gaWdub3JlIGRlY29kZSBlcnJvcnNcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBSZW5kZXIgZmllbGRzXG5cdFx0cHJvdmlkZXIuZmllbGRzLmZvckVhY2goZmllbGQgPT4ge1xuXHRcdFx0Y29uc3QgaGFzU2F2ZWQgPSBCb29sZWFuKHNhdmVkQ3JlZHNbZmllbGQudmFyXSk7XG5cdFx0XHRjb25zdCBkaXNwbGF5VmFsdWUgPSBoYXNTYXZlZCA/ICfigKLigKLigKLigKLigKLigKLigKLigKInIDogJyc7XG5cdFx0XHRjb25zdCBtYXNrZWRBdHRyID0gaGFzU2F2ZWQgPyAnZGF0YS1tYXNrZWQ9XCJ0cnVlXCInIDogJyc7XG5cdFx0XHRjb25zdCBodG1sID0gYFxuXHRcdFx0XHQ8ZGl2IGNsYXNzPVwiZmllbGRcIj5cblx0XHRcdFx0XHQ8bGFiZWw+JHtmaWVsZC5sYWJlbH08L2xhYmVsPlxuXHRcdFx0XHRcdDxpbnB1dCB0eXBlPVwicGFzc3dvcmRcIlxuXHRcdFx0XHRcdFx0ICAgY2xhc3M9XCJkbnMtY3JlZC1pbnB1dFwiXG5cdFx0XHRcdFx0XHQgICBkYXRhLXZhcj1cIiR7ZmllbGQudmFyfVwiXG5cdFx0XHRcdFx0XHQgICAke21hc2tlZEF0dHJ9XG5cdFx0XHRcdFx0XHQgICB2YWx1ZT1cIiR7TW9kdWxlR2V0U3NsLmVzY2FwZUh0bWwoZGlzcGxheVZhbHVlKX1cIlxuXHRcdFx0XHRcdFx0ICAgcGxhY2Vob2xkZXI9XCIke2ZpZWxkLmxhYmVsfVwiPlxuXHRcdFx0XHQ8L2Rpdj5gO1xuXHRcdFx0JGNvbnRhaW5lci5hcHBlbmQoaHRtbCk7XG5cdFx0fSk7XG5cdFx0Ly8gT24gZm9jdXM6IGNsZWFyIG1hc2sgc28gdXNlciBjYW4gZW50ZXIgbmV3IHZhbHVlXG5cdFx0JGNvbnRhaW5lci5vbignZm9jdXMnLCAnLmRucy1jcmVkLWlucHV0W2RhdGEtbWFza2VkXScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdCQodGhpcykudmFsKCcnKS5yZW1vdmVBdHRyKCdkYXRhLW1hc2tlZCcpO1xuXHRcdH0pO1xuXHRcdC8vIENsZWFyIGVycm9yIGhpZ2hsaWdodCB3aGVuIHVzZXIgc3RhcnRzIHR5cGluZ1xuXHRcdCRjb250YWluZXIub24oJ2lucHV0JywgJy5kbnMtY3JlZC1pbnB1dCcsIGZ1bmN0aW9uICgpIHtcblx0XHRcdCQodGhpcykuY2xvc2VzdCgnLmZpZWxkJykucmVtb3ZlQ2xhc3MoJ2Vycm9yJyk7XG5cdFx0fSk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIENvbGxlY3QgRE5TIGNyZWRlbnRpYWwgZmllbGQgdmFsdWVzIGludG8gYmFzZTY0IEpTT04gYW5kIHdyaXRlIHRvIGhpZGRlbiBpbnB1dC5cblx0ICogTWFza2VkIGZpZWxkcyAodW5jaGFuZ2VkKSBhcmUgcmVzdG9yZWQgZnJvbSB0aGUgcHJldmlvdXNseSBzYXZlZCBjcmVkZW50aWFscy5cblx0ICovXG5cdGNvbGxlY3REbnNDcmVkZW50aWFscygpIHtcblx0XHRjb25zdCBjaGFsbGVuZ2VUeXBlID0gTW9kdWxlR2V0U3NsLiRjaGFsbGVuZ2VUeXBlLmRyb3Bkb3duKCdnZXQgdmFsdWUnKTtcblx0XHRpZiAoY2hhbGxlbmdlVHlwZSAhPT0gJ2RucycpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Ly8gRGVjb2RlIGN1cnJlbnRseSBzdG9yZWQgY3JlZGVudGlhbHMgKHNvdXJjZSBvZiB0cnV0aCBmb3IgbWFza2VkIGZpZWxkcylcblx0XHRsZXQgc2F2ZWRDcmVkcyA9IHt9O1xuXHRcdGNvbnN0IGVuY29kZWRWYWwgPSBNb2R1bGVHZXRTc2wuJGRuc0NyZWRlbnRpYWxzSW5wdXQudmFsKCk7XG5cdFx0aWYgKGVuY29kZWRWYWwpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHNhdmVkQ3JlZHMgPSBKU09OLnBhcnNlKGF0b2IoZW5jb2RlZFZhbCkpO1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHQvLyBpZ25vcmVcblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3QgY3JlZHMgPSB7fTtcblx0XHQkKCcuZG5zLWNyZWQtaW5wdXQnKS5lYWNoKGZ1bmN0aW9uICgpIHtcblx0XHRcdGNvbnN0IHZhck5hbWUgPSAkKHRoaXMpLmRhdGEoJ3ZhcicpO1xuXHRcdFx0aWYgKCF2YXJOYW1lKSByZXR1cm47XG5cdFx0XHRpZiAoJCh0aGlzKS5pcygnW2RhdGEtbWFza2VkXScpKSB7XG5cdFx0XHRcdC8vIFVzZXIgZGlkbid0IGNoYW5nZSB0aGlzIGZpZWxkIOKAlCBrZWVwIHN0b3JlZCB2YWx1ZVxuXHRcdFx0XHRpZiAoc2F2ZWRDcmVkc1t2YXJOYW1lXSkge1xuXHRcdFx0XHRcdGNyZWRzW3Zhck5hbWVdID0gc2F2ZWRDcmVkc1t2YXJOYW1lXTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgdmFsID0gJCh0aGlzKS52YWwoKTtcblx0XHRcdFx0aWYgKHZhbCkge1xuXHRcdFx0XHRcdGNyZWRzW3Zhck5hbWVdID0gdmFsO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0TW9kdWxlR2V0U3NsLiRkbnNDcmVkZW50aWFsc0lucHV0LnZhbChidG9hKEpTT04uc3RyaW5naWZ5KGNyZWRzKSkpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBSZXN0b3JlIHNhdmVkIGNyZWRlbnRpYWxzIGludG8gdGhlIEROUyBwcm92aWRlciBmaWVsZHMgb24gcGFnZSBsb2FkLlxuXHQgKi9cblx0cmVzdG9yZVNhdmVkQ3JlZGVudGlhbHMoKSB7XG5cdFx0Y29uc3QgY3VycmVudFByb3ZpZGVyID0gTW9kdWxlR2V0U3NsLiRkbnNQcm92aWRlci5kcm9wZG93bignZ2V0IHZhbHVlJyk7XG5cdFx0aWYgKGN1cnJlbnRQcm92aWRlcikge1xuXHRcdFx0TW9kdWxlR2V0U3NsLm9uQ2hhbmdlRG5zUHJvdmlkZXIoY3VycmVudFByb3ZpZGVyKTtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIEVzY2FwZSBIVE1MIHNwZWNpYWwgY2hhcmFjdGVycyBmb3Igc2FmZSBpbnNlcnRpb24gaW50byBhdHRyaWJ1dGVzLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdGV4dFxuXHQgKiBAcmV0dXJucyB7c3RyaW5nfVxuXHQgKi9cblx0ZXNjYXBlSHRtbCh0ZXh0KSB7XG5cdFx0Y29uc3QgbWFwID0geyAnJic6ICcmYW1wOycsICc8JzogJyZsdDsnLCAnPic6ICcmZ3Q7JywgJ1wiJzogJyZxdW90OycsIFwiJ1wiOiAnJiMwMzk7JyB9O1xuXHRcdHJldHVybiBTdHJpbmcodGV4dCkucmVwbGFjZSgvWyY8PlwiJ10vZywgbSA9PiBtYXBbbV0pO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBSZXF1ZXN0IGFuIFNTTCBjZXJ0aWZpY2F0ZSBieSBjYWxsaW5nIHRoZSBzZXJ2ZXItc2lkZSBBUEkuXG5cdCAqL1xuXHRnZXRTc2woKSB7XG5cdFx0JC5hcGkoe1xuXHRcdFx0dXJsOiBgJHtDb25maWcucGJ4VXJsfS9wYnhjb3JlL2FwaS9tb2R1bGVzLyR7Y2xhc3NOYW1lfS9nZXQtY2VydGAsXG5cdFx0XHRvbjogJ25vdycsXG5cdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdGJlZm9yZVhIUih4aHIpIHtcblx0XHRcdFx0eGhyLnNldFJlcXVlc3RIZWFkZXIgKCdYLUFzeW5jLVJlc3BvbnNlLUNoYW5uZWwtSWQnLCBtb2R1bGVHZXRTU0xTdGF0dXNMb29wV29ya2VyLmNoYW5uZWxJZCk7XG5cdFx0XHRcdHhoci5zZXRSZXF1ZXN0SGVhZGVyICgnWC1Qcm9jZXNzb3ItVGltZW91dCcsICcxMjAnKTtcblx0XHRcdFx0cmV0dXJuIHhocjtcblx0XHRcdH0sXG5cdFx0XHRiZWZvcmVTZW5kKHNldHRpbmdzKSB7XG5cdFx0XHRcdE1vZHVsZUdldFNzbC4kc3VibWl0QnV0dG9uLmFkZENsYXNzKCdsb2FkaW5nIGRpc2FibGVkJyk7XG5cdFx0XHRcdG1vZHVsZUdldFNTTFN0YXR1c0xvb3BXb3JrZXIuJHJlc3VsdEJsb2NrLnNob3coKTtcblx0XHRcdFx0bW9kdWxlR2V0U1NMU3RhdHVzTG9vcFdvcmtlci5lZGl0b3IuZ2V0U2Vzc2lvbigpLnNldFZhbHVlKFxuXHRcdFx0XHRnbG9iYWxUcmFuc2xhdGUubW9kdWxlX2dldHNzbF9HZXRTU0xQcm9jZXNzaW5nICsgJ1xcbidcblx0XHRcdCk7XG5cdFx0XHRcdHJldHVybiBzZXR0aW5ncztcblx0XHRcdH0sXG5cdFx0XHRzdWNjZXNzVGVzdDogUGJ4QXBpLnN1Y2Nlc3NUZXN0LFxuXHRcdFx0b25TdWNjZXNzOiBmdW5jdGlvbiAocmVzcG9uc2UpIHtcblx0XHRcdFx0TW9kdWxlR2V0U3NsLiRzdWJtaXRCdXR0b24ucmVtb3ZlQ2xhc3MoJ2xvYWRpbmcgZGlzYWJsZWQnKTtcblx0XHRcdH0sXG5cdFx0XHRvbkZhaWx1cmU6IGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG5cdFx0XHRcdE1vZHVsZUdldFNzbC4kc3VibWl0QnV0dG9uLnJlbW92ZUNsYXNzKCdsb2FkaW5nIGRpc2FibGVkJyk7XG5cdFx0XHRcdFVzZXJNZXNzYWdlLnNob3dNdWx0aVN0cmluZyhyZXNwb25zZS5tZXNzYWdlKTtcblx0XHRcdH0sXG5cdFx0fSlcblx0fSxcblxuXHQvKipcblx0ICogVG9nZ2xlcyB0aGUgZm9ybSBmaWVsZHMgYW5kIHN0YXR1cyB2aXNpYmlsaXR5IGJhc2VkIG9uIHRoZSBtb2R1bGUncyBzdGF0dXMuXG5cdCAqL1xuXHRjaGVja1N0YXR1c1RvZ2dsZSgpIHtcblx0XHRpZiAoTW9kdWxlR2V0U3NsLiRzdGF0dXNUb2dnbGUuY2hlY2tib3goJ2lzIGNoZWNrZWQnKSkge1xuXHRcdFx0TW9kdWxlR2V0U3NsLiRkaXNhYmlsaXR5RmllbGRzLnJlbW92ZUNsYXNzKCdkaXNhYmxlZCcpO1xuXHRcdFx0TW9kdWxlR2V0U3NsLiRtb2R1bGVTdGF0dXMuc2hvdygpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRNb2R1bGVHZXRTc2wuJGRpc2FiaWxpdHlGaWVsZHMuYWRkQ2xhc3MoJ2Rpc2FibGVkJyk7XG5cdFx0XHRNb2R1bGVHZXRTc2wuJG1vZHVsZVN0YXR1cy5oaWRlKCk7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBWYWxpZGF0ZSBETlMgcHJvdmlkZXIgYW5kIGNyZWRlbnRpYWxzIHdoZW4gRE5TLTAxIGlzIHNlbGVjdGVkLlxuXHQgKiBSZXR1cm5zIHRydWUgaWYgdmFsaWQsIGZhbHNlIG90aGVyd2lzZS5cblx0ICovXG5cdHZhbGlkYXRlRG5zRmllbGRzKCkge1xuXHRcdGlmIChNb2R1bGVHZXRTc2wuJGNoYWxsZW5nZVR5cGUuZHJvcGRvd24oJ2dldCB2YWx1ZScpICE9PSAnZG5zJykge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGlmICghTW9kdWxlR2V0U3NsLiRkbnNQcm92aWRlci5kcm9wZG93bignZ2V0IHZhbHVlJykpIHtcblx0XHRcdFVzZXJNZXNzYWdlLnNob3dFcnJvcihnbG9iYWxUcmFuc2xhdGUubW9kdWxlX2dldHNzbF9EbnNQcm92aWRlckVtcHR5KTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0bGV0IGhhc0VtcHR5ID0gZmFsc2U7XG5cdFx0JCgnLmRucy1jcmVkLWlucHV0JykuZWFjaChmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCAkZmllbGQgPSAkKHRoaXMpLmNsb3Nlc3QoJy5maWVsZCcpO1xuXHRcdFx0Y29uc3QgaXNNYXNrZWQgPSAkKHRoaXMpLmlzKCdbZGF0YS1tYXNrZWRdJyk7XG5cdFx0XHRpZiAoIWlzTWFza2VkICYmICEkKHRoaXMpLnZhbCgpLnRyaW0oKSkge1xuXHRcdFx0XHQkZmllbGQuYWRkQ2xhc3MoJ2Vycm9yJyk7XG5cdFx0XHRcdGhhc0VtcHR5ID0gdHJ1ZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdCRmaWVsZC5yZW1vdmVDbGFzcygnZXJyb3InKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRpZiAoaGFzRW1wdHkpIHtcblx0XHRcdFVzZXJNZXNzYWdlLnNob3dFcnJvcihnbG9iYWxUcmFuc2xhdGUubW9kdWxlX2dldHNzbF9EbnNDcmVkZW50aWFsc0VtcHR5KTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH0sXG5cblx0LyoqXG5cdCAqIENhbGxiYWNrIGJlZm9yZSBzZW5kaW5nIHRoZSBmb3JtLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gc2V0dGluZ3MgLSBBamF4IHJlcXVlc3Qgc2V0dGluZ3MuXG5cdCAqIEByZXR1cm5zIHtPYmplY3R9IFRoZSBtb2RpZmllZCBBamF4IHJlcXVlc3Qgc2V0dGluZ3MuXG5cdCAqL1xuXHRjYkJlZm9yZVNlbmRGb3JtKHNldHRpbmdzKSB7XG5cdFx0aWYgKCFNb2R1bGVHZXRTc2wudmFsaWRhdGVEbnNGaWVsZHMoKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCByZXN1bHQgPSBzZXR0aW5ncztcblx0XHQvLyBDb2xsZWN0IEROUyBjcmVkZW50aWFscyBpbnRvIGhpZGRlbiBmaWVsZCBiZWZvcmUgZm9ybSBzdWJtaXNzaW9uXG5cdFx0TW9kdWxlR2V0U3NsLmNvbGxlY3REbnNDcmVkZW50aWFscygpO1xuXHRcdHJlc3VsdC5kYXRhID0gTW9kdWxlR2V0U3NsLiRmb3JtT2JqLmZvcm0oJ2dldCB2YWx1ZXMnKTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBDYWxsYmFjayBmdW5jdGlvbiBhZnRlciBzZW5kaW5nIHRoZSBmb3JtLlxuXHQgKi9cblx0Y2JBZnRlclNlbmRGb3JtKHJlc3BvbnNlKSB7XG5cdFx0aWYgKEZvcm0uY2hlY2tTdWNjZXNzKHJlc3BvbnNlKSl7XG5cdFx0XHRNb2R1bGVHZXRTc2wuZ2V0U3NsKCk7XG5cdFx0fVxuXHR9LFxuXG5cblx0LyoqXG5cdCAqIEluaXRpYWxpemVzIHRoZSBmb3JtIHZhbGlkYXRpb24gYW5kIHN1Ym1pc3Npb24gbG9naWMuXG5cdCAqL1xuXHRpbml0aWFsaXplRm9ybSgpIHtcblx0XHRGb3JtLiRmb3JtT2JqID0gTW9kdWxlR2V0U3NsLiRmb3JtT2JqO1xuXHRcdEZvcm0udXJsID0gYCR7Z2xvYmFsUm9vdFVybH0ke2lkVXJsfS8ke2lkVXJsfS9zYXZlYDtcblx0XHRGb3JtLnZhbGlkYXRlUnVsZXMgPSBNb2R1bGVHZXRTc2wudmFsaWRhdGVSdWxlcztcblx0XHRGb3JtLmVuYWJsZURpcnJpdHkgPSBmYWxzZTtcblx0XHRGb3JtLmNiQWZ0ZXJTZW5kRm9ybSA9IE1vZHVsZUdldFNzbC5jYkFmdGVyU2VuZEZvcm07XG5cdFx0Rm9ybS5jYkJlZm9yZVNlbmRGb3JtID0gTW9kdWxlR2V0U3NsLmNiQmVmb3JlU2VuZEZvcm07XG5cdFx0Rm9ybS5pbml0aWFsaXplKCk7XG5cdH0sXG59O1xuXG4vLyBJbml0aWFsaXplIHRoZSBNb2R1bGVHZXRTc2wgY2xhc3Mgd2hlbiB0aGUgZG9jdW1lbnQgaXMgcmVhZHlcbiQoZG9jdW1lbnQpLnJlYWR5KCgpID0+IHtcblx0TW9kdWxlR2V0U3NsLmluaXRpYWxpemUoKTtcbn0pO1xuIl0sIm1hcHBpbmdzIjoiQUFBQTs7QUFFQTtBQUNBLE1BQU0sS0FBSyxHQUFPLGdCQUFnQixDQUFDLENBQWM7QUFDakQsTUFBTSxNQUFNLEdBQU0scUJBQXFCLENBQUMsQ0FBUztBQUNqRCxNQUFNLFNBQVMsR0FBRyxjQUFjLENBQUMsQ0FBZ0I7O0FBRWpEO0FBQ0EsTUFBTSxZQUFZLEdBQUc7RUFDcEI7RUFDQSxRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUcsR0FBRyxNQUFNLENBQUM7RUFDekIsV0FBVyxFQUFFLENBQUMsQ0FBQyxHQUFHLEdBQUcsTUFBTSxHQUFHLGVBQWUsQ0FBQztFQUM5QyxpQkFBaUIsRUFBRSxDQUFDLENBQUMsR0FBRyxHQUFHLE1BQU0sR0FBRyxjQUFjLENBQUM7RUFDbkQsYUFBYSxFQUFFLENBQUMsQ0FBQyx1QkFBdUIsQ0FBQztFQUN6QyxhQUFhLEVBQUUsQ0FBQyxDQUFDLGVBQWUsQ0FBQztFQUNqQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQztFQUMzQixXQUFXLEVBQUUsQ0FBQyxDQUFDLGFBQWEsQ0FBQztFQUM3QixjQUFjLEVBQUUsQ0FBQyxDQUFDLGdCQUFnQixDQUFDO0VBQ25DLFlBQVksRUFBRSxDQUFDLENBQUMsY0FBYyxDQUFDO0VBQy9CLGtCQUFrQixFQUFFLENBQUMsQ0FBQyxzQkFBc0IsQ0FBQztFQUM3QyxpQkFBaUIsRUFBRSxDQUFDLENBQUMscUJBQXFCLENBQUM7RUFDM0MscUJBQXFCLEVBQUUsQ0FBQyxDQUFDLHlCQUF5QixDQUFDO0VBQ25ELG9CQUFvQixFQUFFLENBQUMsQ0FBQyw4QkFBOEIsQ0FBQztFQUN2RCxpQkFBaUIsRUFBRSxDQUFDLENBQUMsaUNBQWlDLENBQUM7RUFFdkQ7RUFDQSxhQUFhLEVBQUU7SUFDZCxVQUFVLEVBQUU7TUFDWCxVQUFVLEVBQUUsWUFBWTtNQUN4QixLQUFLLEVBQUUsQ0FDTjtRQUNDLElBQUksRUFBRSxPQUFPO1FBQ2IsTUFBTSxFQUFFLGVBQWUsQ0FBQztNQUN6QixDQUFDO0lBRUg7RUFDRCxDQUFDO0VBRUQ7QUFDRDtBQUNBO0VBQ0MsVUFBVSxHQUFHO0lBQ1o7SUFDQSxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDOztJQUUzQjtJQUNBLElBQUksQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDO01BQzVCLFFBQVEsRUFBRSxZQUFZLENBQUM7SUFDeEIsQ0FBQyxDQUFDO0lBQ0YsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUM7TUFDMUIsY0FBYyxFQUFFLElBQUk7TUFDcEIsUUFBUSxFQUFFLFlBQVksQ0FBQztJQUN4QixDQUFDLENBQUM7O0lBRUY7SUFDQSxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUN4QixNQUFNLENBQUMsZ0JBQWdCLENBQUMscUJBQXFCLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDOztJQUV0RTtJQUNBLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUNyQixJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQztJQUUzQiw0QkFBNEIsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7O0lBRWhEO0lBQ0EsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsSUFBSSxNQUFNO0lBQzVFLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxnQkFBZ0IsQ0FBQztJQUM1QyxJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQztFQUMvQixDQUFDO0VBRUQ7QUFDRDtBQUNBO0FBQ0E7QUFDQTtFQUNDLFdBQVcsQ0FBQyxLQUFLLEVBQUU7SUFDbEIsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUMxQyxNQUFNLFNBQVMsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQztJQUNwQyxJQUFJLFNBQVMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO01BQzNCLE9BQU8sU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFDakQsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcsS0FDbEIsSUFBSSxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUM7SUFDdkM7SUFFQSxNQUFNLGlCQUFpQixHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDO0lBQ2pELE1BQU0saUJBQWlCLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUM7SUFDL0MsSUFBSSxpQkFBaUIsS0FBSyxpQkFBaUIsRUFBRSxPQUFPLEtBQUs7SUFDekQsTUFBTSxJQUFJLEdBQUcsaUJBQWlCLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxPQUFPO0lBQy9ELElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxLQUFLO0lBQ3hELElBQUk7TUFDSCxJQUFJLEdBQUcsQ0FBQyxXQUFXLElBQUksSUFBSSxDQUFDO01BQzVCLE9BQU8sSUFBSTtJQUNaLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRTtNQUNYLE9BQU8sS0FBSztJQUNiO0VBQ0QsQ0FBQztFQUVEO0VBQ0Esc0JBQXNCLEdBQUc7SUFDeEIsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFO01BQzdDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM5QixDQUFDLE1BQU07TUFDTixJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDOUI7RUFDRCxDQUFDO0VBRUQ7RUFDQSxvQkFBb0IsR0FBRztJQUN0QixJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsTUFBTSxJQUFJLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDO0lBQ2pFLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0VBQzlCLENBQUM7RUFFRDtBQUNEO0FBQ0E7QUFDQTtFQUNDLHFCQUFxQixDQUFDLEtBQUssRUFBRTtJQUM1QixJQUFJLEtBQUssS0FBSyxLQUFLLEVBQUU7TUFDcEIsWUFBWSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO01BQ3RDLFlBQVksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztNQUNyQztNQUNBLE1BQU0sZUFBZSxHQUFHLFlBQVksQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQztNQUN2RSxJQUFJLGVBQWUsRUFBRTtRQUNwQixZQUFZLENBQUMsbUJBQW1CLENBQUMsZUFBZSxDQUFDO01BQ2xEO0lBQ0QsQ0FBQyxNQUFNO01BQ04sWUFBWSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO01BQ3RDLFlBQVksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN0QztFQUNELENBQUM7RUFFRDtBQUNEO0FBQ0E7QUFDQTtFQUNDLG1CQUFtQixDQUFDLEtBQUssRUFBRTtJQUMxQixNQUFNLFVBQVUsR0FBRyxZQUFZLENBQUMscUJBQXFCO0lBQ3JELFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUVsQixJQUFJLENBQUMsS0FBSyxJQUFJLE9BQU8sZ0JBQWdCLEtBQUssV0FBVyxFQUFFO01BQ3REO0lBQ0Q7O0lBRUE7SUFDQSxNQUFNLFFBQVEsR0FBRyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEtBQUssS0FBSyxDQUFDO0lBQzNELElBQUksQ0FBQyxRQUFRLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFO01BQ2xDO0lBQ0Q7O0lBRUE7SUFDQSxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7SUFDbkIsTUFBTSxVQUFVLEdBQUcsWUFBWSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzFELElBQUksVUFBVSxFQUFFO01BQ2YsSUFBSTtRQUNILE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7UUFDaEMsVUFBVSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDO01BQ2pDLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRTtRQUNYO01BQUE7SUFFRjs7SUFFQTtJQUNBLFFBQVEsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssSUFBSTtNQUNoQyxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztNQUMvQyxNQUFNLFlBQVksR0FBRyxRQUFRLEdBQUcsVUFBVSxHQUFHLEVBQUU7TUFDL0MsTUFBTSxVQUFVLEdBQUcsUUFBUSxHQUFHLG9CQUFvQixHQUFHLEVBQUU7TUFDdkQsTUFBTSxJQUFJLEdBQUc7QUFDaEI7QUFDQSxjQUFjLEtBQUssQ0FBQyxLQUFLO0FBQ3pCO0FBQ0E7QUFDQSxxQkFBcUIsS0FBSyxDQUFDLEdBQUc7QUFDOUIsV0FBVyxVQUFVO0FBQ3JCLGtCQUFrQixZQUFZLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQztBQUN2RCx3QkFBd0IsS0FBSyxDQUFDLEtBQUs7QUFDbkMsV0FBVztNQUNSLFVBQVUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ3hCLENBQUMsQ0FBQztJQUNGO0lBQ0EsVUFBVSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsOEJBQThCLEVBQUUsWUFBWTtNQUNsRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUM7SUFDMUMsQ0FBQyxDQUFDO0lBQ0Y7SUFDQSxVQUFVLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxZQUFZO01BQ3JELENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQztJQUMvQyxDQUFDLENBQUM7RUFDSCxDQUFDO0VBRUQ7QUFDRDtBQUNBO0FBQ0E7RUFDQyxxQkFBcUIsR0FBRztJQUN2QixNQUFNLGFBQWEsR0FBRyxZQUFZLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUM7SUFDdkUsSUFBSSxhQUFhLEtBQUssS0FBSyxFQUFFO01BQzVCO0lBQ0Q7SUFDQTtJQUNBLElBQUksVUFBVSxHQUFHLENBQUMsQ0FBQztJQUNuQixNQUFNLFVBQVUsR0FBRyxZQUFZLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDMUQsSUFBSSxVQUFVLEVBQUU7TUFDZixJQUFJO1FBQ0gsVUFBVSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO01BQzFDLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRTtRQUNYO01BQUE7SUFFRjtJQUNBLE1BQU0sS0FBSyxHQUFHLENBQUMsQ0FBQztJQUNoQixDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWTtNQUNyQyxNQUFNLE9BQU8sR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztNQUNuQyxJQUFJLENBQUMsT0FBTyxFQUFFO01BQ2QsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxFQUFFO1FBQ2hDO1FBQ0EsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLEVBQUU7VUFDeEIsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLFVBQVUsQ0FBQyxPQUFPLENBQUM7UUFDckM7TUFDRCxDQUFDLE1BQU07UUFDTixNQUFNLEdBQUcsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDekIsSUFBSSxHQUFHLEVBQUU7VUFDUixLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsR0FBRztRQUNyQjtNQUNEO0lBQ0QsQ0FBQyxDQUFDO0lBQ0YsWUFBWSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0VBQ25FLENBQUM7RUFFRDtBQUNEO0FBQ0E7RUFDQyx1QkFBdUIsR0FBRztJQUN6QixNQUFNLGVBQWUsR0FBRyxZQUFZLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUM7SUFDdkUsSUFBSSxlQUFlLEVBQUU7TUFDcEIsWUFBWSxDQUFDLG1CQUFtQixDQUFDLGVBQWUsQ0FBQztJQUNsRDtFQUNELENBQUM7RUFFRDtBQUNEO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsVUFBVSxDQUFDLElBQUksRUFBRTtJQUNoQixNQUFNLEdBQUcsR0FBRztNQUFFLEdBQUcsRUFBRSxPQUFPO01BQUUsR0FBRyxFQUFFLE1BQU07TUFBRSxHQUFHLEVBQUUsTUFBTTtNQUFFLEdBQUcsRUFBRSxRQUFRO01BQUUsR0FBRyxFQUFFO0lBQVMsQ0FBQztJQUNwRixPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDckQsQ0FBQztFQUVEO0FBQ0Q7QUFDQTtFQUNDLE1BQU0sR0FBRztJQUNSLENBQUMsQ0FBQyxHQUFHLENBQUM7TUFDTCxHQUFHLEVBQUUsR0FBRyxNQUFNLENBQUMsTUFBTSx3QkFBd0IsU0FBUyxXQUFXO01BQ2pFLEVBQUUsRUFBRSxLQUFLO01BQ1QsTUFBTSxFQUFFLE1BQU07TUFDZCxTQUFTLENBQUMsR0FBRyxFQUFFO1FBQ2QsR0FBRyxDQUFDLGdCQUFnQixDQUFFLDZCQUE2QixFQUFFLDRCQUE0QixDQUFDLFNBQVMsQ0FBQztRQUM1RixHQUFHLENBQUMsZ0JBQWdCLENBQUUscUJBQXFCLEVBQUUsS0FBSyxDQUFDO1FBQ25ELE9BQU8sR0FBRztNQUNYLENBQUM7TUFDRCxVQUFVLENBQUMsUUFBUSxFQUFFO1FBQ3BCLFlBQVksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLGtCQUFrQixDQUFDO1FBQ3ZELDRCQUE0QixDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNoRCw0QkFBNEIsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQ3pELGVBQWUsQ0FBQyw4QkFBOEIsR0FBRyxJQUNsRCxDQUFDO1FBQ0EsT0FBTyxRQUFRO01BQ2hCLENBQUM7TUFDRCxXQUFXLEVBQUUsTUFBTSxDQUFDLFdBQVc7TUFDL0IsU0FBUyxFQUFFLFVBQVUsUUFBUSxFQUFFO1FBQzlCLFlBQVksQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUFDO01BQzNELENBQUM7TUFDRCxTQUFTLEVBQUUsVUFBUyxRQUFRLEVBQUU7UUFDN0IsWUFBWSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUM7UUFDMUQsV0FBVyxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDO01BQzlDO0lBQ0QsQ0FBQyxDQUFDO0VBQ0gsQ0FBQztFQUVEO0FBQ0Q7QUFDQTtFQUNDLGlCQUFpQixHQUFHO0lBQ25CLElBQUksWUFBWSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLEVBQUU7TUFDdEQsWUFBWSxDQUFDLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUM7TUFDdEQsWUFBWSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNsQyxDQUFDLE1BQU07TUFDTixZQUFZLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQztNQUNuRCxZQUFZLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2xDO0VBQ0QsQ0FBQztFQUVEO0FBQ0Q7QUFDQTtBQUNBO0VBQ0MsaUJBQWlCLEdBQUc7SUFDbkIsSUFBSSxZQUFZLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsS0FBSyxLQUFLLEVBQUU7TUFDaEUsT0FBTyxJQUFJO0lBQ1o7SUFDQSxJQUFJLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLEVBQUU7TUFDckQsV0FBVyxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsOEJBQThCLENBQUM7TUFDckUsT0FBTyxLQUFLO0lBQ2I7SUFDQSxJQUFJLFFBQVEsR0FBRyxLQUFLO0lBQ3BCLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZO01BQ3JDLE1BQU0sTUFBTSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDO01BQ3hDLE1BQU0sUUFBUSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDO01BQzVDLElBQUksQ0FBQyxRQUFRLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFO1FBQ3ZDLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDO1FBQ3hCLFFBQVEsR0FBRyxJQUFJO01BQ2hCLENBQUMsTUFBTTtRQUNOLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDO01BQzVCO0lBQ0QsQ0FBQyxDQUFDO0lBQ0YsSUFBSSxRQUFRLEVBQUU7TUFDYixXQUFXLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxpQ0FBaUMsQ0FBQztNQUN4RSxPQUFPLEtBQUs7SUFDYjtJQUNBLE9BQU8sSUFBSTtFQUNaLENBQUM7RUFFRDtBQUNEO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsZ0JBQWdCLENBQUMsUUFBUSxFQUFFO0lBQzFCLElBQUksQ0FBQyxZQUFZLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxFQUFFO01BQ3RDLE9BQU8sS0FBSztJQUNiO0lBQ0EsTUFBTSxNQUFNLEdBQUcsUUFBUTtJQUN2QjtJQUNBLFlBQVksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO0lBQ3BDLE1BQU0sQ0FBQyxJQUFJLEdBQUcsWUFBWSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDO0lBQ3RELE9BQU8sTUFBTTtFQUNkLENBQUM7RUFFRDtBQUNEO0FBQ0E7RUFDQyxlQUFlLENBQUMsUUFBUSxFQUFFO0lBQ3pCLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsRUFBQztNQUMvQixZQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDdEI7RUFDRCxDQUFDO0VBR0Q7QUFDRDtBQUNBO0VBQ0MsY0FBYyxHQUFHO0lBQ2hCLElBQUksQ0FBQyxRQUFRLEdBQUcsWUFBWSxDQUFDLFFBQVE7SUFDckMsSUFBSSxDQUFDLEdBQUcsR0FBRyxHQUFHLGFBQWEsR0FBRyxLQUFLLElBQUksS0FBSyxPQUFPO0lBQ25ELElBQUksQ0FBQyxhQUFhLEdBQUcsWUFBWSxDQUFDLGFBQWE7SUFDL0MsSUFBSSxDQUFDLGFBQWEsR0FBRyxLQUFLO0lBQzFCLElBQUksQ0FBQyxlQUFlLEdBQUcsWUFBWSxDQUFDLGVBQWU7SUFDbkQsSUFBSSxDQUFDLGdCQUFnQixHQUFHLFlBQVksQ0FBQyxnQkFBZ0I7SUFDckQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0VBQ2xCO0FBQ0QsQ0FBQzs7QUFFRDtBQUNBLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTTtFQUN2QixZQUFZLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDMUIsQ0FBQyxDQUFDIiwiaWdub3JlTGlzdCI6W119