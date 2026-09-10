/* global globalRootUrl, globalTranslate, Form, Config, PbxApi, dnsProvidersMeta, suggestedPublicIp */

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
  $includeIpAddress: $('#includeIpAddress'),
  $includeIpAddressField: $('#include-ip-address-field'),
  $includeIpAddressCheckbox: $('#include-ip-address-checkbox'),
  $publicIpAddress: $('#publicIpAddress'),
  $publicIpAddressSettings: $('#public-ip-address-settings'),
  $autoUpdate: $('#autoUpdate'),
  $autoUpdateCheckbox: $('#auto-update-checkbox'),
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
    this.bindCertificateIdentifierControls();
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
  /** Return true only for a publicly routable IPv4 or IPv6 address. */
  isPublicIpAddress(value) {
    if (!this.isIpAddress(value)) return false;
    const address = String(value || '').trim().replace(/^\[|\]$/g, '').toLowerCase();
    const ipv4Parts = address.split('.').map(Number);
    if (ipv4Parts.length === 4) {
      const [a, b, c] = ipv4Parts;
      return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 100 && b >= 64 && b <= 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 0 && (c === 0 || c === 2) || a === 192 && b === 168 || a === 198 && (b === 18 || b === 19) || a === 198 && b === 51 && c === 100 || a === 203 && b === 0 && c === 113);
    }
    return !(address === '::' || address === '::1' || address.startsWith('fc') || address.startsWith('fd') || /^fe[89ab]/.test(address) || address.startsWith('2001:db8:'));
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
  /** Apply visibility and compatibility rules for domain/IP certificate identifiers. */
  updateCertificateIdentifierControls() {
    const primary = String(this.$domainName.val() || '').trim();
    const primaryIsIp = this.isIpAddress(primary);
    const canIncludeIp = primary !== '' && !primaryIsIp;
    if (primaryIsIp && this.$includeIpAddress.is(':checked')) {
      this.$includeIpAddress.prop('checked', false);
      this.$includeIpAddressCheckbox.checkbox('uncheck');
    }
    const includeIp = canIncludeIp && this.$includeIpAddress.is(':checked');
    if (includeIp && !String(this.$publicIpAddress.val() || '').trim() && typeof suggestedPublicIp === 'string' && this.isPublicIpAddress(suggestedPublicIp)) {
      this.$publicIpAddress.val(suggestedPublicIp);
    }
    this.$includeIpAddressField.toggle(canIncludeIp);
    this.$publicIpAddressSettings.toggle(includeIp);
    if (primaryIsIp || includeIp) {
      this.$challengeType.dropdown('set selected', 'http').dropdown('set disabled');
      this.$autoUpdate.prop('checked', true).prop('disabled', true);
      this.$autoUpdateCheckbox.checkbox('check').checkbox('set disabled');
    } else {
      this.$challengeType.dropdown('set enabled');
      this.$autoUpdate.prop('disabled', false);
      this.$autoUpdateCheckbox.checkbox('set enabled');
    }
  },
  /** Bind changes affecting the requested certificate identifier list. */
  bindCertificateIdentifierControls() {
    this.$domainName.on('input', () => this.updateCertificateIdentifierControls());
    this.$includeIpAddressCheckbox.checkbox({
      onChange: () => this.updateCertificateIdentifierControls()
    });
    this.updateCertificateIdentifierControls();
  },
  /** Validate the optional additional public IP address. */
  validatePublicIpAddress() {
    const primaryIsIp = this.isIpAddress(this.$domainName.val());
    if (primaryIsIp || !this.$includeIpAddress.is(':checked')) return true;
    if (this.isPublicIpAddress(this.$publicIpAddress.val())) return true;
    UserMessage.showError(globalTranslate.module_getssl_PublicIpAddressInvalid);
    this.$publicIpAddress.closest('.field').addClass('error');
    return false;
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
        // Keep button in loading state — it will be unlocked
        // by the event timeout or final stage event.
        ModuleGetSsl.scheduleButtonUnlock();
      },
      onFailure: function (response) {
        ModuleGetSsl.$submitButton.removeClass('loading disabled');
        UserMessage.showMultiString(response.message);
      }
    });
  },
  /**
   * Timer handle for the button unlock delay.
   * @type {number}
   */
  buttonUnlockTimer: 0,
  /**
   * Schedules button unlock after 30 seconds of inactivity.
   * Each call resets the timer so the button stays locked while events arrive.
   */
  scheduleButtonUnlock() {
    window.clearTimeout(ModuleGetSsl.buttonUnlockTimer);
    ModuleGetSsl.buttonUnlockTimer = window.setTimeout(() => {
      ModuleGetSsl.$submitButton.removeClass('loading disabled');
    }, 30000);
  },
  /**
   * Immediately unlocks the submit button (called on final stage).
   */
  unlockButton() {
    window.clearTimeout(ModuleGetSsl.buttonUnlockTimer);
    ModuleGetSsl.$submitButton.removeClass('loading disabled');
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
    if (!ModuleGetSsl.validatePublicIpAddress()) {
      return false;
    }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJpZFVybCIsImlkRm9ybSIsImNsYXNzTmFtZSIsIk1vZHVsZUdldFNzbCIsIiRmb3JtT2JqIiwiJCIsIiRjaGVja0JveGVzIiwiJGRpc2FiaWxpdHlGaWVsZHMiLCIkc3RhdHVzVG9nZ2xlIiwiJHN1Ym1pdEJ1dHRvbiIsIiRtb2R1bGVTdGF0dXMiLCIkZG9tYWluTmFtZSIsIiRpbmNsdWRlSXBBZGRyZXNzIiwiJGluY2x1ZGVJcEFkZHJlc3NGaWVsZCIsIiRpbmNsdWRlSXBBZGRyZXNzQ2hlY2tib3giLCIkcHVibGljSXBBZGRyZXNzIiwiJHB1YmxpY0lwQWRkcmVzc1NldHRpbmdzIiwiJGF1dG9VcGRhdGUiLCIkYXV0b1VwZGF0ZUNoZWNrYm94IiwiJGNoYWxsZW5nZVR5cGUiLCIkZG5zUHJvdmlkZXIiLCIkaHR0cENoYWxsZW5nZUluZm8iLCIkZG5zU2V0dGluZ3NCbG9jayIsIiRkbnNDcmVkZW50aWFsc0ZpZWxkcyIsIiRkbnNDcmVkZW50aWFsc0lucHV0IiwiJGlwQWRkcmVzc1dhcm5pbmciLCJ2YWxpZGF0ZVJ1bGVzIiwiZG9tYWluTmFtZSIsImlkZW50aWZpZXIiLCJydWxlcyIsInR5cGUiLCJwcm9tcHQiLCJnbG9iYWxUcmFuc2xhdGUiLCJtb2R1bGVfZ2V0c3NsX0RvbWFpbk5hbWVFbXB0eSIsImluaXRpYWxpemUiLCJjaGVja2JveCIsImRyb3Bkb3duIiwib25DaGFuZ2UiLCJvbkNoYW5nZUNoYWxsZW5nZVR5cGUiLCJmdWxsVGV4dFNlYXJjaCIsIm9uQ2hhbmdlRG5zUHJvdmlkZXIiLCJjaGVja1N0YXR1c1RvZ2dsZSIsIndpbmRvdyIsImFkZEV2ZW50TGlzdGVuZXIiLCJpbml0aWFsaXplRm9ybSIsImJpbmRJcEFkZHJlc3NXYXJuaW5nIiwiYmluZENlcnRpZmljYXRlSWRlbnRpZmllckNvbnRyb2xzIiwibW9kdWxlR2V0U1NMU3RhdHVzTG9vcFdvcmtlciIsIiRyZXN1bHRCbG9jayIsImhpZGUiLCJjdXJyZW50Q2hhbGxlbmdlIiwicmVzdG9yZVNhdmVkQ3JlZGVudGlhbHMiLCJpc0lwQWRkcmVzcyIsInZhbHVlIiwiYWRkcmVzcyIsIlN0cmluZyIsInRyaW0iLCJpcHY0UGFydHMiLCJzcGxpdCIsImxlbmd0aCIsImV2ZXJ5IiwicGFydCIsInRlc3QiLCJOdW1iZXIiLCJoYXNPcGVuaW5nQnJhY2tldCIsInN0YXJ0c1dpdGgiLCJoYXNDbG9zaW5nQnJhY2tldCIsImVuZHNXaXRoIiwiaXB2NiIsInNsaWNlIiwiaW5jbHVkZXMiLCJVUkwiLCJlIiwiaXNQdWJsaWNJcEFkZHJlc3MiLCJyZXBsYWNlIiwidG9Mb3dlckNhc2UiLCJtYXAiLCJhIiwiYiIsImMiLCJ1cGRhdGVJcEFkZHJlc3NXYXJuaW5nIiwidmFsIiwic2hvdyIsIm9uIiwidXBkYXRlQ2VydGlmaWNhdGVJZGVudGlmaWVyQ29udHJvbHMiLCJwcmltYXJ5IiwicHJpbWFyeUlzSXAiLCJjYW5JbmNsdWRlSXAiLCJpcyIsInByb3AiLCJpbmNsdWRlSXAiLCJzdWdnZXN0ZWRQdWJsaWNJcCIsInRvZ2dsZSIsInZhbGlkYXRlUHVibGljSXBBZGRyZXNzIiwiVXNlck1lc3NhZ2UiLCJzaG93RXJyb3IiLCJtb2R1bGVfZ2V0c3NsX1B1YmxpY0lwQWRkcmVzc0ludmFsaWQiLCJjbG9zZXN0IiwiYWRkQ2xhc3MiLCJjdXJyZW50UHJvdmlkZXIiLCIkY29udGFpbmVyIiwiZW1wdHkiLCJkbnNQcm92aWRlcnNNZXRhIiwicHJvdmlkZXIiLCJmaW5kIiwicCIsImlkIiwiZmllbGRzIiwic2F2ZWRDcmVkcyIsImVuY29kZWRWYWwiLCJkZWNvZGVkIiwiYXRvYiIsIkpTT04iLCJwYXJzZSIsImZvckVhY2giLCJmaWVsZCIsImhhc1NhdmVkIiwiQm9vbGVhbiIsInZhciIsImRpc3BsYXlWYWx1ZSIsIm1hc2tlZEF0dHIiLCJodG1sIiwibGFiZWwiLCJlc2NhcGVIdG1sIiwiYXBwZW5kIiwicmVtb3ZlQXR0ciIsInJlbW92ZUNsYXNzIiwiY29sbGVjdERuc0NyZWRlbnRpYWxzIiwiY2hhbGxlbmdlVHlwZSIsImNyZWRzIiwiZWFjaCIsInZhck5hbWUiLCJkYXRhIiwiYnRvYSIsInN0cmluZ2lmeSIsInRleHQiLCJtIiwiZ2V0U3NsIiwiYXBpIiwidXJsIiwiQ29uZmlnIiwicGJ4VXJsIiwibWV0aG9kIiwiYmVmb3JlWEhSIiwieGhyIiwic2V0UmVxdWVzdEhlYWRlciIsImNoYW5uZWxJZCIsImJlZm9yZVNlbmQiLCJzZXR0aW5ncyIsImVkaXRvciIsImdldFNlc3Npb24iLCJzZXRWYWx1ZSIsIm1vZHVsZV9nZXRzc2xfR2V0U1NMUHJvY2Vzc2luZyIsInN1Y2Nlc3NUZXN0IiwiUGJ4QXBpIiwib25TdWNjZXNzIiwicmVzcG9uc2UiLCJzY2hlZHVsZUJ1dHRvblVubG9jayIsIm9uRmFpbHVyZSIsInNob3dNdWx0aVN0cmluZyIsIm1lc3NhZ2UiLCJidXR0b25VbmxvY2tUaW1lciIsImNsZWFyVGltZW91dCIsInNldFRpbWVvdXQiLCJ1bmxvY2tCdXR0b24iLCJ2YWxpZGF0ZURuc0ZpZWxkcyIsIm1vZHVsZV9nZXRzc2xfRG5zUHJvdmlkZXJFbXB0eSIsImhhc0VtcHR5IiwiJGZpZWxkIiwiaXNNYXNrZWQiLCJtb2R1bGVfZ2V0c3NsX0Ruc0NyZWRlbnRpYWxzRW1wdHkiLCJjYkJlZm9yZVNlbmRGb3JtIiwicmVzdWx0IiwiZm9ybSIsImNiQWZ0ZXJTZW5kRm9ybSIsIkZvcm0iLCJjaGVja1N1Y2Nlc3MiLCJnbG9iYWxSb290VXJsIiwiZW5hYmxlRGlycml0eSIsImRvY3VtZW50IiwicmVhZHkiXSwic291cmNlcyI6WyJzcmMvbW9kdWxlLWdldC1zc2wtaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyogZ2xvYmFsIGdsb2JhbFJvb3RVcmwsIGdsb2JhbFRyYW5zbGF0ZSwgRm9ybSwgQ29uZmlnLCBQYnhBcGksIGRuc1Byb3ZpZGVyc01ldGEsIHN1Z2dlc3RlZFB1YmxpY0lwICovXG5cbi8vIENvbnN0YW50cyByZWxhdGVkIHRvIHRoZSBmb3JtIGFuZCBtb2R1bGVcbmNvbnN0IGlkVXJsICAgICA9ICdtb2R1bGUtZ2V0LXNzbCc7ICAgICAgICAgICAgICAvLyBBUEkgZW5kcG9pbnQgZm9yIFNTTCBtb2R1bGVcbmNvbnN0IGlkRm9ybSAgICA9ICdtb2R1bGUtZ2V0LXNzbC1mb3JtJzsgICAgICAgICAvLyBGb3JtIGVsZW1lbnQgSUQgZm9yIFNTTCBtb2R1bGVcbmNvbnN0IGNsYXNzTmFtZSA9ICdNb2R1bGVHZXRTc2wnOyAgICAgICAgICAgICAgICAvLyBDbGFzcyBuYW1lIGZvciB0aGlzIG1vZHVsZVxuXG4vLyBNYWluIE1vZHVsZUdldFNzbCBjbGFzcyBkZWZpbml0aW9uXG5jb25zdCBNb2R1bGVHZXRTc2wgPSB7XG5cdC8vIENhY2hlIGNvbW1vbmx5IHVzZWQgalF1ZXJ5IG9iamVjdHNcblx0JGZvcm1PYmo6ICQoJyMnICsgaWRGb3JtKSxcblx0JGNoZWNrQm94ZXM6ICQoJyMnICsgaWRGb3JtICsgJyAudWkuY2hlY2tib3gnKSxcblx0JGRpc2FiaWxpdHlGaWVsZHM6ICQoJyMnICsgaWRGb3JtICsgJyAuZGlzYWJpbGl0eScpLFxuXHQkc3RhdHVzVG9nZ2xlOiAkKCcjbW9kdWxlLXN0YXR1cy10b2dnbGUnKSxcblx0JHN1Ym1pdEJ1dHRvbjogJCgnI3N1Ym1pdGJ1dHRvbicpLFxuXHQkbW9kdWxlU3RhdHVzOiAkKCcjc3RhdHVzJyksXG5cdCRkb21haW5OYW1lOiAkKCcjZG9tYWluTmFtZScpLFxuXHQkaW5jbHVkZUlwQWRkcmVzczogJCgnI2luY2x1ZGVJcEFkZHJlc3MnKSxcblx0JGluY2x1ZGVJcEFkZHJlc3NGaWVsZDogJCgnI2luY2x1ZGUtaXAtYWRkcmVzcy1maWVsZCcpLFxuXHQkaW5jbHVkZUlwQWRkcmVzc0NoZWNrYm94OiAkKCcjaW5jbHVkZS1pcC1hZGRyZXNzLWNoZWNrYm94JyksXG5cdCRwdWJsaWNJcEFkZHJlc3M6ICQoJyNwdWJsaWNJcEFkZHJlc3MnKSxcblx0JHB1YmxpY0lwQWRkcmVzc1NldHRpbmdzOiAkKCcjcHVibGljLWlwLWFkZHJlc3Mtc2V0dGluZ3MnKSxcblx0JGF1dG9VcGRhdGU6ICQoJyNhdXRvVXBkYXRlJyksXG5cdCRhdXRvVXBkYXRlQ2hlY2tib3g6ICQoJyNhdXRvLXVwZGF0ZS1jaGVja2JveCcpLFxuXHQkY2hhbGxlbmdlVHlwZTogJCgnI2NoYWxsZW5nZVR5cGUnKSxcblx0JGRuc1Byb3ZpZGVyOiAkKCcjZG5zUHJvdmlkZXInKSxcblx0JGh0dHBDaGFsbGVuZ2VJbmZvOiAkKCcjaHR0cC1jaGFsbGVuZ2UtaW5mbycpLFxuXHQkZG5zU2V0dGluZ3NCbG9jazogJCgnI2Rucy1zZXR0aW5ncy1ibG9jaycpLFxuXHQkZG5zQ3JlZGVudGlhbHNGaWVsZHM6ICQoJyNkbnMtY3JlZGVudGlhbHMtZmllbGRzJyksXG5cdCRkbnNDcmVkZW50aWFsc0lucHV0OiAkKCdpbnB1dFtuYW1lPVwiZG5zQ3JlZGVudGlhbHNcIl0nKSxcblx0JGlwQWRkcmVzc1dhcm5pbmc6ICQoJyNpcC1hZGRyZXNzLWNlcnRpZmljYXRlLXdhcm5pbmcnKSxcblxuXHQvLyBWYWxpZGF0aW9uIHJ1bGVzIGZvciB0aGUgZm9ybVxuXHR2YWxpZGF0ZVJ1bGVzOiB7XG5cdFx0ZG9tYWluTmFtZToge1xuXHRcdFx0aWRlbnRpZmllcjogJ2RvbWFpbk5hbWUnLFxuXHRcdFx0cnVsZXM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHR5cGU6ICdlbXB0eScsXG5cdFx0XHRcdFx0cHJvbXB0OiBnbG9iYWxUcmFuc2xhdGUubW9kdWxlX2dldHNzbF9Eb21haW5OYW1lRW1wdHksXG5cdFx0XHRcdH0sXG5cdFx0XHRdLFxuXHRcdH0sXG5cdH0sXG5cblx0LyoqXG5cdCAqIEluaXRpYWxpemUgdGhlIG1vZHVsZSwgYmluZCBldmVudCBsaXN0ZW5lcnMsIGFuZCBzZXR1cCB0aGUgZm9ybS5cblx0ICovXG5cdGluaXRpYWxpemUoKSB7XG5cdFx0Ly8gSW5pdGlhbGl6ZSBTZW1hbnRpYyBVSSBjaGVja2JveGVzXG5cdFx0dGhpcy4kY2hlY2tCb3hlcy5jaGVja2JveCgpO1xuXG5cdFx0Ly8gSW5pdGlhbGl6ZSBkcm9wZG93bnNcblx0XHR0aGlzLiRjaGFsbGVuZ2VUeXBlLmRyb3Bkb3duKHtcblx0XHRcdG9uQ2hhbmdlOiBNb2R1bGVHZXRTc2wub25DaGFuZ2VDaGFsbGVuZ2VUeXBlLFxuXHRcdH0pO1xuXHRcdHRoaXMuJGRuc1Byb3ZpZGVyLmRyb3Bkb3duKHtcblx0XHRcdGZ1bGxUZXh0U2VhcmNoOiB0cnVlLFxuXHRcdFx0b25DaGFuZ2U6IE1vZHVsZUdldFNzbC5vbkNoYW5nZURuc1Byb3ZpZGVyLFxuXHRcdH0pO1xuXG5cdFx0Ly8gQ2hlY2sgYW5kIHNldCBtb2R1bGUgc3RhdHVzIG9uIGxvYWQgYW5kIHdoZW4gdGhlIHN0YXR1cyBjaGFuZ2VzXG5cdFx0dGhpcy5jaGVja1N0YXR1c1RvZ2dsZSgpO1xuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdNb2R1bGVTdGF0dXNDaGFuZ2VkJywgdGhpcy5jaGVja1N0YXR1c1RvZ2dsZSk7XG5cblx0XHQvLyBJbml0aWFsaXplIGZvcm0gd2l0aCB2YWxpZGF0aW9uIGFuZCBzdWJtaXQgaGFuZGxlcnNcblx0XHR0aGlzLmluaXRpYWxpemVGb3JtKCk7XG5cdFx0dGhpcy5iaW5kSXBBZGRyZXNzV2FybmluZygpO1xuXHRcdHRoaXMuYmluZENlcnRpZmljYXRlSWRlbnRpZmllckNvbnRyb2xzKCk7XG5cblx0XHRtb2R1bGVHZXRTU0xTdGF0dXNMb29wV29ya2VyLiRyZXN1bHRCbG9jay5oaWRlKCk7XG5cblx0XHQvLyBSZXN0b3JlIHNhdmVkIHN0YXRlXG5cdFx0Y29uc3QgY3VycmVudENoYWxsZW5nZSA9IHRoaXMuJGNoYWxsZW5nZVR5cGUuZHJvcGRvd24oJ2dldCB2YWx1ZScpIHx8ICdodHRwJztcblx0XHR0aGlzLm9uQ2hhbmdlQ2hhbGxlbmdlVHlwZShjdXJyZW50Q2hhbGxlbmdlKTtcblx0XHR0aGlzLnJlc3RvcmVTYXZlZENyZWRlbnRpYWxzKCk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIENoZWNrIHdoZXRoZXIgYSB2YWx1ZSBpcyBhIHZhbGlkIElQdjQgb3IgSVB2NiBhZGRyZXNzLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdmFsdWVcblx0ICogQHJldHVybnMge2Jvb2xlYW59XG5cdCAqL1xuXHRpc0lwQWRkcmVzcyh2YWx1ZSkge1xuXHRcdGNvbnN0IGFkZHJlc3MgPSBTdHJpbmcodmFsdWUgfHwgJycpLnRyaW0oKTtcblx0XHRjb25zdCBpcHY0UGFydHMgPSBhZGRyZXNzLnNwbGl0KCcuJyk7XG5cdFx0aWYgKGlwdjRQYXJ0cy5sZW5ndGggPT09IDQpIHtcblx0XHRcdHJldHVybiBpcHY0UGFydHMuZXZlcnkocGFydCA9PiAvXlxcZHsxLDN9JC8udGVzdChwYXJ0KVxuXHRcdFx0XHQmJiBOdW1iZXIocGFydCkgPD0gMjU1XG5cdFx0XHRcdCYmIChwYXJ0ID09PSAnMCcgfHwgcGFydFswXSAhPT0gJzAnKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGFzT3BlbmluZ0JyYWNrZXQgPSBhZGRyZXNzLnN0YXJ0c1dpdGgoJ1snKTtcblx0XHRjb25zdCBoYXNDbG9zaW5nQnJhY2tldCA9IGFkZHJlc3MuZW5kc1dpdGgoJ10nKTtcblx0XHRpZiAoaGFzT3BlbmluZ0JyYWNrZXQgIT09IGhhc0Nsb3NpbmdCcmFja2V0KSByZXR1cm4gZmFsc2U7XG5cdFx0Y29uc3QgaXB2NiA9IGhhc09wZW5pbmdCcmFja2V0ID8gYWRkcmVzcy5zbGljZSgxLCAtMSkgOiBhZGRyZXNzO1xuXHRcdGlmICghaXB2Ni5pbmNsdWRlcygnOicpIHx8IC9cXHMvLnRlc3QoaXB2NikpIHJldHVybiBmYWxzZTtcblx0XHR0cnkge1xuXHRcdFx0bmV3IFVSTChgaHR0cDovL1ske2lwdjZ9XS9gKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH0sXG5cblx0LyoqIFJldHVybiB0cnVlIG9ubHkgZm9yIGEgcHVibGljbHkgcm91dGFibGUgSVB2NCBvciBJUHY2IGFkZHJlc3MuICovXG5cdGlzUHVibGljSXBBZGRyZXNzKHZhbHVlKSB7XG5cdFx0aWYgKCF0aGlzLmlzSXBBZGRyZXNzKHZhbHVlKSkgcmV0dXJuIGZhbHNlO1xuXHRcdGNvbnN0IGFkZHJlc3MgPSBTdHJpbmcodmFsdWUgfHwgJycpLnRyaW0oKS5yZXBsYWNlKC9eXFxbfFxcXSQvZywgJycpLnRvTG93ZXJDYXNlKCk7XG5cdFx0Y29uc3QgaXB2NFBhcnRzID0gYWRkcmVzcy5zcGxpdCgnLicpLm1hcChOdW1iZXIpO1xuXHRcdGlmIChpcHY0UGFydHMubGVuZ3RoID09PSA0KSB7XG5cdFx0XHRjb25zdCBbYSwgYiwgY10gPSBpcHY0UGFydHM7XG5cdFx0XHRyZXR1cm4gIShhID09PSAwIHx8IGEgPT09IDEwIHx8IGEgPT09IDEyNyB8fCBhID49IDIyNFxuXHRcdFx0XHR8fCAoYSA9PT0gMTAwICYmIGIgPj0gNjQgJiYgYiA8PSAxMjcpXG5cdFx0XHRcdHx8IChhID09PSAxNjkgJiYgYiA9PT0gMjU0KVxuXHRcdFx0XHR8fCAoYSA9PT0gMTcyICYmIGIgPj0gMTYgJiYgYiA8PSAzMSlcblx0XHRcdFx0fHwgKGEgPT09IDE5MiAmJiBiID09PSAwICYmIChjID09PSAwIHx8IGMgPT09IDIpKVxuXHRcdFx0XHR8fCAoYSA9PT0gMTkyICYmIGIgPT09IDE2OClcblx0XHRcdFx0fHwgKGEgPT09IDE5OCAmJiAoYiA9PT0gMTggfHwgYiA9PT0gMTkpKVxuXHRcdFx0XHR8fCAoYSA9PT0gMTk4ICYmIGIgPT09IDUxICYmIGMgPT09IDEwMClcblx0XHRcdFx0fHwgKGEgPT09IDIwMyAmJiBiID09PSAwICYmIGMgPT09IDExMykpO1xuXHRcdH1cblx0XHRyZXR1cm4gIShhZGRyZXNzID09PSAnOjonIHx8IGFkZHJlc3MgPT09ICc6OjEnXG5cdFx0XHR8fCBhZGRyZXNzLnN0YXJ0c1dpdGgoJ2ZjJykgfHwgYWRkcmVzcy5zdGFydHNXaXRoKCdmZCcpXG5cdFx0XHR8fCAvXmZlWzg5YWJdLy50ZXN0KGFkZHJlc3MpIHx8IGFkZHJlc3Muc3RhcnRzV2l0aCgnMjAwMTpkYjg6JykpO1xuXHR9LFxuXG5cdC8qKiBVcGRhdGUgd2FybmluZyB2aXNpYmlsaXR5IHdoZW4gdGhlIGNvbmZpZ3VyZWQgYWRkcmVzcyBjaGFuZ2VzLiAqL1xuXHR1cGRhdGVJcEFkZHJlc3NXYXJuaW5nKCkge1xuXHRcdGlmICh0aGlzLmlzSXBBZGRyZXNzKHRoaXMuJGRvbWFpbk5hbWUudmFsKCkpKSB7XG5cdFx0XHR0aGlzLiRpcEFkZHJlc3NXYXJuaW5nLnNob3coKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy4kaXBBZGRyZXNzV2FybmluZy5oaWRlKCk7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKiBCaW5kIHJlYWN0aXZlIElQIHdhcm5pbmcgYmVoYXZpb3IgYW5kIGluaXRpYWxpemUgaXRzIHN0YXRlLiAqL1xuXHRiaW5kSXBBZGRyZXNzV2FybmluZygpIHtcblx0XHR0aGlzLiRkb21haW5OYW1lLm9uKCdpbnB1dCcsICgpID0+IHRoaXMudXBkYXRlSXBBZGRyZXNzV2FybmluZygpKTtcblx0XHR0aGlzLnVwZGF0ZUlwQWRkcmVzc1dhcm5pbmcoKTtcblx0fSxcblxuXHQvKiogQXBwbHkgdmlzaWJpbGl0eSBhbmQgY29tcGF0aWJpbGl0eSBydWxlcyBmb3IgZG9tYWluL0lQIGNlcnRpZmljYXRlIGlkZW50aWZpZXJzLiAqL1xuXHR1cGRhdGVDZXJ0aWZpY2F0ZUlkZW50aWZpZXJDb250cm9scygpIHtcblx0XHRjb25zdCBwcmltYXJ5ID0gU3RyaW5nKHRoaXMuJGRvbWFpbk5hbWUudmFsKCkgfHwgJycpLnRyaW0oKTtcblx0XHRjb25zdCBwcmltYXJ5SXNJcCA9IHRoaXMuaXNJcEFkZHJlc3MocHJpbWFyeSk7XG5cdFx0Y29uc3QgY2FuSW5jbHVkZUlwID0gcHJpbWFyeSAhPT0gJycgJiYgIXByaW1hcnlJc0lwO1xuXHRcdGlmIChwcmltYXJ5SXNJcCAmJiB0aGlzLiRpbmNsdWRlSXBBZGRyZXNzLmlzKCc6Y2hlY2tlZCcpKSB7XG5cdFx0XHR0aGlzLiRpbmNsdWRlSXBBZGRyZXNzLnByb3AoJ2NoZWNrZWQnLCBmYWxzZSk7XG5cdFx0XHR0aGlzLiRpbmNsdWRlSXBBZGRyZXNzQ2hlY2tib3guY2hlY2tib3goJ3VuY2hlY2snKTtcblx0XHR9XG5cdFx0Y29uc3QgaW5jbHVkZUlwID0gY2FuSW5jbHVkZUlwICYmIHRoaXMuJGluY2x1ZGVJcEFkZHJlc3MuaXMoJzpjaGVja2VkJyk7XG5cdFx0aWYgKGluY2x1ZGVJcCAmJiAhU3RyaW5nKHRoaXMuJHB1YmxpY0lwQWRkcmVzcy52YWwoKSB8fCAnJykudHJpbSgpXG5cdFx0XHQmJiB0eXBlb2Ygc3VnZ2VzdGVkUHVibGljSXAgPT09ICdzdHJpbmcnICYmIHRoaXMuaXNQdWJsaWNJcEFkZHJlc3Moc3VnZ2VzdGVkUHVibGljSXApKSB7XG5cdFx0XHR0aGlzLiRwdWJsaWNJcEFkZHJlc3MudmFsKHN1Z2dlc3RlZFB1YmxpY0lwKTtcblx0XHR9XG5cblx0XHR0aGlzLiRpbmNsdWRlSXBBZGRyZXNzRmllbGQudG9nZ2xlKGNhbkluY2x1ZGVJcCk7XG5cdFx0dGhpcy4kcHVibGljSXBBZGRyZXNzU2V0dGluZ3MudG9nZ2xlKGluY2x1ZGVJcCk7XG5cblx0XHRpZiAocHJpbWFyeUlzSXAgfHwgaW5jbHVkZUlwKSB7XG5cdFx0XHR0aGlzLiRjaGFsbGVuZ2VUeXBlLmRyb3Bkb3duKCdzZXQgc2VsZWN0ZWQnLCAnaHR0cCcpLmRyb3Bkb3duKCdzZXQgZGlzYWJsZWQnKTtcblx0XHRcdHRoaXMuJGF1dG9VcGRhdGUucHJvcCgnY2hlY2tlZCcsIHRydWUpLnByb3AoJ2Rpc2FibGVkJywgdHJ1ZSk7XG5cdFx0XHR0aGlzLiRhdXRvVXBkYXRlQ2hlY2tib3guY2hlY2tib3goJ2NoZWNrJykuY2hlY2tib3goJ3NldCBkaXNhYmxlZCcpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLiRjaGFsbGVuZ2VUeXBlLmRyb3Bkb3duKCdzZXQgZW5hYmxlZCcpO1xuXHRcdFx0dGhpcy4kYXV0b1VwZGF0ZS5wcm9wKCdkaXNhYmxlZCcsIGZhbHNlKTtcblx0XHRcdHRoaXMuJGF1dG9VcGRhdGVDaGVja2JveC5jaGVja2JveCgnc2V0IGVuYWJsZWQnKTtcblx0XHR9XG5cdH0sXG5cblx0LyoqIEJpbmQgY2hhbmdlcyBhZmZlY3RpbmcgdGhlIHJlcXVlc3RlZCBjZXJ0aWZpY2F0ZSBpZGVudGlmaWVyIGxpc3QuICovXG5cdGJpbmRDZXJ0aWZpY2F0ZUlkZW50aWZpZXJDb250cm9scygpIHtcblx0XHR0aGlzLiRkb21haW5OYW1lLm9uKCdpbnB1dCcsICgpID0+IHRoaXMudXBkYXRlQ2VydGlmaWNhdGVJZGVudGlmaWVyQ29udHJvbHMoKSk7XG5cdFx0dGhpcy4kaW5jbHVkZUlwQWRkcmVzc0NoZWNrYm94LmNoZWNrYm94KHtcblx0XHRcdG9uQ2hhbmdlOiAoKSA9PiB0aGlzLnVwZGF0ZUNlcnRpZmljYXRlSWRlbnRpZmllckNvbnRyb2xzKCksXG5cdFx0fSk7XG5cdFx0dGhpcy51cGRhdGVDZXJ0aWZpY2F0ZUlkZW50aWZpZXJDb250cm9scygpO1xuXHR9LFxuXG5cdC8qKiBWYWxpZGF0ZSB0aGUgb3B0aW9uYWwgYWRkaXRpb25hbCBwdWJsaWMgSVAgYWRkcmVzcy4gKi9cblx0dmFsaWRhdGVQdWJsaWNJcEFkZHJlc3MoKSB7XG5cdFx0Y29uc3QgcHJpbWFyeUlzSXAgPSB0aGlzLmlzSXBBZGRyZXNzKHRoaXMuJGRvbWFpbk5hbWUudmFsKCkpO1xuXHRcdGlmIChwcmltYXJ5SXNJcCB8fCAhdGhpcy4kaW5jbHVkZUlwQWRkcmVzcy5pcygnOmNoZWNrZWQnKSkgcmV0dXJuIHRydWU7XG5cdFx0aWYgKHRoaXMuaXNQdWJsaWNJcEFkZHJlc3ModGhpcy4kcHVibGljSXBBZGRyZXNzLnZhbCgpKSkgcmV0dXJuIHRydWU7XG5cdFx0VXNlck1lc3NhZ2Uuc2hvd0Vycm9yKGdsb2JhbFRyYW5zbGF0ZS5tb2R1bGVfZ2V0c3NsX1B1YmxpY0lwQWRkcmVzc0ludmFsaWQpO1xuXHRcdHRoaXMuJHB1YmxpY0lwQWRkcmVzcy5jbG9zZXN0KCcuZmllbGQnKS5hZGRDbGFzcygnZXJyb3InKTtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEhhbmRsZSBjaGFsbGVuZ2UgdHlwZSBjaGFuZ2U6IHNob3cvaGlkZSByZWxldmFudCBzZWN0aW9ucy5cblx0ICogQHBhcmFtIHtzdHJpbmd9IHZhbHVlIC0gJ2h0dHAnIG9yICdkbnMnXG5cdCAqL1xuXHRvbkNoYW5nZUNoYWxsZW5nZVR5cGUodmFsdWUpIHtcblx0XHRpZiAodmFsdWUgPT09ICdkbnMnKSB7XG5cdFx0XHRNb2R1bGVHZXRTc2wuJGh0dHBDaGFsbGVuZ2VJbmZvLmhpZGUoKTtcblx0XHRcdE1vZHVsZUdldFNzbC4kZG5zU2V0dGluZ3NCbG9jay5zaG93KCk7XG5cdFx0XHQvLyBUcmlnZ2VyIHByb3ZpZGVyIGNoYW5nZSB0byByZW5kZXIgY3JlZGVudGlhbCBmaWVsZHNcblx0XHRcdGNvbnN0IGN1cnJlbnRQcm92aWRlciA9IE1vZHVsZUdldFNzbC4kZG5zUHJvdmlkZXIuZHJvcGRvd24oJ2dldCB2YWx1ZScpO1xuXHRcdFx0aWYgKGN1cnJlbnRQcm92aWRlcikge1xuXHRcdFx0XHRNb2R1bGVHZXRTc2wub25DaGFuZ2VEbnNQcm92aWRlcihjdXJyZW50UHJvdmlkZXIpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRNb2R1bGVHZXRTc2wuJGh0dHBDaGFsbGVuZ2VJbmZvLnNob3coKTtcblx0XHRcdE1vZHVsZUdldFNzbC4kZG5zU2V0dGluZ3NCbG9jay5oaWRlKCk7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBIYW5kbGUgRE5TIHByb3ZpZGVyIGNoYW5nZTogZHluYW1pY2FsbHkgcmVuZGVyIGNyZWRlbnRpYWwgZmllbGRzLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdmFsdWUgLSBwcm92aWRlciBJRCAoZS5nLiAnZG5zX2NmJylcblx0ICovXG5cdG9uQ2hhbmdlRG5zUHJvdmlkZXIodmFsdWUpIHtcblx0XHRjb25zdCAkY29udGFpbmVyID0gTW9kdWxlR2V0U3NsLiRkbnNDcmVkZW50aWFsc0ZpZWxkcztcblx0XHQkY29udGFpbmVyLmVtcHR5KCk7XG5cblx0XHRpZiAoIXZhbHVlIHx8IHR5cGVvZiBkbnNQcm92aWRlcnNNZXRhID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIEZpbmQgcHJvdmlkZXIgbWV0YWRhdGFcblx0XHRjb25zdCBwcm92aWRlciA9IGRuc1Byb3ZpZGVyc01ldGEuZmluZChwID0+IHAuaWQgPT09IHZhbHVlKTtcblx0XHRpZiAoIXByb3ZpZGVyIHx8ICFwcm92aWRlci5maWVsZHMpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBEZWNvZGUgZXhpc3Rpbmcgc2F2ZWQgY3JlZGVudGlhbHMgZm9yIHByZS1maWxsaW5nXG5cdFx0bGV0IHNhdmVkQ3JlZHMgPSB7fTtcblx0XHRjb25zdCBlbmNvZGVkVmFsID0gTW9kdWxlR2V0U3NsLiRkbnNDcmVkZW50aWFsc0lucHV0LnZhbCgpO1xuXHRcdGlmIChlbmNvZGVkVmFsKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBkZWNvZGVkID0gYXRvYihlbmNvZGVkVmFsKTtcblx0XHRcdFx0c2F2ZWRDcmVkcyA9IEpTT04ucGFyc2UoZGVjb2RlZCk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdC8vIGlnbm9yZSBkZWNvZGUgZXJyb3JzXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gUmVuZGVyIGZpZWxkc1xuXHRcdHByb3ZpZGVyLmZpZWxkcy5mb3JFYWNoKGZpZWxkID0+IHtcblx0XHRcdGNvbnN0IGhhc1NhdmVkID0gQm9vbGVhbihzYXZlZENyZWRzW2ZpZWxkLnZhcl0pO1xuXHRcdFx0Y29uc3QgZGlzcGxheVZhbHVlID0gaGFzU2F2ZWQgPyAn4oCi4oCi4oCi4oCi4oCi4oCi4oCi4oCiJyA6ICcnO1xuXHRcdFx0Y29uc3QgbWFza2VkQXR0ciA9IGhhc1NhdmVkID8gJ2RhdGEtbWFza2VkPVwidHJ1ZVwiJyA6ICcnO1xuXHRcdFx0Y29uc3QgaHRtbCA9IGBcblx0XHRcdFx0PGRpdiBjbGFzcz1cImZpZWxkXCI+XG5cdFx0XHRcdFx0PGxhYmVsPiR7ZmllbGQubGFiZWx9PC9sYWJlbD5cblx0XHRcdFx0XHQ8aW5wdXQgdHlwZT1cInBhc3N3b3JkXCJcblx0XHRcdFx0XHRcdCAgIGNsYXNzPVwiZG5zLWNyZWQtaW5wdXRcIlxuXHRcdFx0XHRcdFx0ICAgZGF0YS12YXI9XCIke2ZpZWxkLnZhcn1cIlxuXHRcdFx0XHRcdFx0ICAgJHttYXNrZWRBdHRyfVxuXHRcdFx0XHRcdFx0ICAgdmFsdWU9XCIke01vZHVsZUdldFNzbC5lc2NhcGVIdG1sKGRpc3BsYXlWYWx1ZSl9XCJcblx0XHRcdFx0XHRcdCAgIHBsYWNlaG9sZGVyPVwiJHtmaWVsZC5sYWJlbH1cIj5cblx0XHRcdFx0PC9kaXY+YDtcblx0XHRcdCRjb250YWluZXIuYXBwZW5kKGh0bWwpO1xuXHRcdH0pO1xuXHRcdC8vIE9uIGZvY3VzOiBjbGVhciBtYXNrIHNvIHVzZXIgY2FuIGVudGVyIG5ldyB2YWx1ZVxuXHRcdCRjb250YWluZXIub24oJ2ZvY3VzJywgJy5kbnMtY3JlZC1pbnB1dFtkYXRhLW1hc2tlZF0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHQkKHRoaXMpLnZhbCgnJykucmVtb3ZlQXR0cignZGF0YS1tYXNrZWQnKTtcblx0XHR9KTtcblx0XHQvLyBDbGVhciBlcnJvciBoaWdobGlnaHQgd2hlbiB1c2VyIHN0YXJ0cyB0eXBpbmdcblx0XHQkY29udGFpbmVyLm9uKCdpbnB1dCcsICcuZG5zLWNyZWQtaW5wdXQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHQkKHRoaXMpLmNsb3Nlc3QoJy5maWVsZCcpLnJlbW92ZUNsYXNzKCdlcnJvcicpO1xuXHRcdH0pO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBDb2xsZWN0IEROUyBjcmVkZW50aWFsIGZpZWxkIHZhbHVlcyBpbnRvIGJhc2U2NCBKU09OIGFuZCB3cml0ZSB0byBoaWRkZW4gaW5wdXQuXG5cdCAqIE1hc2tlZCBmaWVsZHMgKHVuY2hhbmdlZCkgYXJlIHJlc3RvcmVkIGZyb20gdGhlIHByZXZpb3VzbHkgc2F2ZWQgY3JlZGVudGlhbHMuXG5cdCAqL1xuXHRjb2xsZWN0RG5zQ3JlZGVudGlhbHMoKSB7XG5cdFx0Y29uc3QgY2hhbGxlbmdlVHlwZSA9IE1vZHVsZUdldFNzbC4kY2hhbGxlbmdlVHlwZS5kcm9wZG93bignZ2V0IHZhbHVlJyk7XG5cdFx0aWYgKGNoYWxsZW5nZVR5cGUgIT09ICdkbnMnKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdC8vIERlY29kZSBjdXJyZW50bHkgc3RvcmVkIGNyZWRlbnRpYWxzIChzb3VyY2Ugb2YgdHJ1dGggZm9yIG1hc2tlZCBmaWVsZHMpXG5cdFx0bGV0IHNhdmVkQ3JlZHMgPSB7fTtcblx0XHRjb25zdCBlbmNvZGVkVmFsID0gTW9kdWxlR2V0U3NsLiRkbnNDcmVkZW50aWFsc0lucHV0LnZhbCgpO1xuXHRcdGlmIChlbmNvZGVkVmFsKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRzYXZlZENyZWRzID0gSlNPTi5wYXJzZShhdG9iKGVuY29kZWRWYWwpKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0Ly8gaWdub3JlXG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnN0IGNyZWRzID0ge307XG5cdFx0JCgnLmRucy1jcmVkLWlucHV0JykuZWFjaChmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCB2YXJOYW1lID0gJCh0aGlzKS5kYXRhKCd2YXInKTtcblx0XHRcdGlmICghdmFyTmFtZSkgcmV0dXJuO1xuXHRcdFx0aWYgKCQodGhpcykuaXMoJ1tkYXRhLW1hc2tlZF0nKSkge1xuXHRcdFx0XHQvLyBVc2VyIGRpZG4ndCBjaGFuZ2UgdGhpcyBmaWVsZCDigJQga2VlcCBzdG9yZWQgdmFsdWVcblx0XHRcdFx0aWYgKHNhdmVkQ3JlZHNbdmFyTmFtZV0pIHtcblx0XHRcdFx0XHRjcmVkc1t2YXJOYW1lXSA9IHNhdmVkQ3JlZHNbdmFyTmFtZV07XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IHZhbCA9ICQodGhpcykudmFsKCk7XG5cdFx0XHRcdGlmICh2YWwpIHtcblx0XHRcdFx0XHRjcmVkc1t2YXJOYW1lXSA9IHZhbDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdE1vZHVsZUdldFNzbC4kZG5zQ3JlZGVudGlhbHNJbnB1dC52YWwoYnRvYShKU09OLnN0cmluZ2lmeShjcmVkcykpKTtcblx0fSxcblxuXHQvKipcblx0ICogUmVzdG9yZSBzYXZlZCBjcmVkZW50aWFscyBpbnRvIHRoZSBETlMgcHJvdmlkZXIgZmllbGRzIG9uIHBhZ2UgbG9hZC5cblx0ICovXG5cdHJlc3RvcmVTYXZlZENyZWRlbnRpYWxzKCkge1xuXHRcdGNvbnN0IGN1cnJlbnRQcm92aWRlciA9IE1vZHVsZUdldFNzbC4kZG5zUHJvdmlkZXIuZHJvcGRvd24oJ2dldCB2YWx1ZScpO1xuXHRcdGlmIChjdXJyZW50UHJvdmlkZXIpIHtcblx0XHRcdE1vZHVsZUdldFNzbC5vbkNoYW5nZURuc1Byb3ZpZGVyKGN1cnJlbnRQcm92aWRlcik7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBFc2NhcGUgSFRNTCBzcGVjaWFsIGNoYXJhY3RlcnMgZm9yIHNhZmUgaW5zZXJ0aW9uIGludG8gYXR0cmlidXRlcy5cblx0ICogQHBhcmFtIHtzdHJpbmd9IHRleHRcblx0ICogQHJldHVybnMge3N0cmluZ31cblx0ICovXG5cdGVzY2FwZUh0bWwodGV4dCkge1xuXHRcdGNvbnN0IG1hcCA9IHsgJyYnOiAnJmFtcDsnLCAnPCc6ICcmbHQ7JywgJz4nOiAnJmd0OycsICdcIic6ICcmcXVvdDsnLCBcIidcIjogJyYjMDM5OycgfTtcblx0XHRyZXR1cm4gU3RyaW5nKHRleHQpLnJlcGxhY2UoL1smPD5cIiddL2csIG0gPT4gbWFwW21dKTtcblx0fSxcblxuXHQvKipcblx0ICogUmVxdWVzdCBhbiBTU0wgY2VydGlmaWNhdGUgYnkgY2FsbGluZyB0aGUgc2VydmVyLXNpZGUgQVBJLlxuXHQgKi9cblx0Z2V0U3NsKCkge1xuXHRcdCQuYXBpKHtcblx0XHRcdHVybDogYCR7Q29uZmlnLnBieFVybH0vcGJ4Y29yZS9hcGkvbW9kdWxlcy8ke2NsYXNzTmFtZX0vZ2V0LWNlcnRgLFxuXHRcdFx0b246ICdub3cnLFxuXHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRiZWZvcmVYSFIoeGhyKSB7XG5cdFx0XHRcdHhoci5zZXRSZXF1ZXN0SGVhZGVyICgnWC1Bc3luYy1SZXNwb25zZS1DaGFubmVsLUlkJywgbW9kdWxlR2V0U1NMU3RhdHVzTG9vcFdvcmtlci5jaGFubmVsSWQpO1xuXHRcdFx0XHR4aHIuc2V0UmVxdWVzdEhlYWRlciAoJ1gtUHJvY2Vzc29yLVRpbWVvdXQnLCAnMTIwJyk7XG5cdFx0XHRcdHJldHVybiB4aHI7XG5cdFx0XHR9LFxuXHRcdFx0YmVmb3JlU2VuZChzZXR0aW5ncykge1xuXHRcdFx0XHRNb2R1bGVHZXRTc2wuJHN1Ym1pdEJ1dHRvbi5hZGRDbGFzcygnbG9hZGluZyBkaXNhYmxlZCcpO1xuXHRcdFx0XHRtb2R1bGVHZXRTU0xTdGF0dXNMb29wV29ya2VyLiRyZXN1bHRCbG9jay5zaG93KCk7XG5cdFx0XHRcdG1vZHVsZUdldFNTTFN0YXR1c0xvb3BXb3JrZXIuZWRpdG9yLmdldFNlc3Npb24oKS5zZXRWYWx1ZShcblx0XHRcdFx0Z2xvYmFsVHJhbnNsYXRlLm1vZHVsZV9nZXRzc2xfR2V0U1NMUHJvY2Vzc2luZyArICdcXG4nXG5cdFx0XHQpO1xuXHRcdFx0XHRyZXR1cm4gc2V0dGluZ3M7XG5cdFx0XHR9LFxuXHRcdFx0c3VjY2Vzc1Rlc3Q6IFBieEFwaS5zdWNjZXNzVGVzdCxcblx0XHRcdG9uU3VjY2VzczogZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG5cdFx0XHRcdC8vIEtlZXAgYnV0dG9uIGluIGxvYWRpbmcgc3RhdGUg4oCUIGl0IHdpbGwgYmUgdW5sb2NrZWRcblx0XHRcdFx0Ly8gYnkgdGhlIGV2ZW50IHRpbWVvdXQgb3IgZmluYWwgc3RhZ2UgZXZlbnQuXG5cdFx0XHRcdE1vZHVsZUdldFNzbC5zY2hlZHVsZUJ1dHRvblVubG9jaygpO1xuXHRcdFx0fSxcblx0XHRcdG9uRmFpbHVyZTogZnVuY3Rpb24ocmVzcG9uc2UpIHtcblx0XHRcdFx0TW9kdWxlR2V0U3NsLiRzdWJtaXRCdXR0b24ucmVtb3ZlQ2xhc3MoJ2xvYWRpbmcgZGlzYWJsZWQnKTtcblx0XHRcdFx0VXNlck1lc3NhZ2Uuc2hvd011bHRpU3RyaW5nKHJlc3BvbnNlLm1lc3NhZ2UpO1xuXHRcdFx0fSxcblx0XHR9KVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBUaW1lciBoYW5kbGUgZm9yIHRoZSBidXR0b24gdW5sb2NrIGRlbGF5LlxuXHQgKiBAdHlwZSB7bnVtYmVyfVxuXHQgKi9cblx0YnV0dG9uVW5sb2NrVGltZXI6IDAsXG5cblx0LyoqXG5cdCAqIFNjaGVkdWxlcyBidXR0b24gdW5sb2NrIGFmdGVyIDMwIHNlY29uZHMgb2YgaW5hY3Rpdml0eS5cblx0ICogRWFjaCBjYWxsIHJlc2V0cyB0aGUgdGltZXIgc28gdGhlIGJ1dHRvbiBzdGF5cyBsb2NrZWQgd2hpbGUgZXZlbnRzIGFycml2ZS5cblx0ICovXG5cdHNjaGVkdWxlQnV0dG9uVW5sb2NrKCkge1xuXHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoTW9kdWxlR2V0U3NsLmJ1dHRvblVubG9ja1RpbWVyKTtcblx0XHRNb2R1bGVHZXRTc2wuYnV0dG9uVW5sb2NrVGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRNb2R1bGVHZXRTc2wuJHN1Ym1pdEJ1dHRvbi5yZW1vdmVDbGFzcygnbG9hZGluZyBkaXNhYmxlZCcpO1xuXHRcdH0sIDMwMDAwKTtcblx0fSxcblxuXHQvKipcblx0ICogSW1tZWRpYXRlbHkgdW5sb2NrcyB0aGUgc3VibWl0IGJ1dHRvbiAoY2FsbGVkIG9uIGZpbmFsIHN0YWdlKS5cblx0ICovXG5cdHVubG9ja0J1dHRvbigpIHtcblx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KE1vZHVsZUdldFNzbC5idXR0b25VbmxvY2tUaW1lcik7XG5cdFx0TW9kdWxlR2V0U3NsLiRzdWJtaXRCdXR0b24ucmVtb3ZlQ2xhc3MoJ2xvYWRpbmcgZGlzYWJsZWQnKTtcblx0fSxcblxuXHQvKipcblx0ICogVG9nZ2xlcyB0aGUgZm9ybSBmaWVsZHMgYW5kIHN0YXR1cyB2aXNpYmlsaXR5IGJhc2VkIG9uIHRoZSBtb2R1bGUncyBzdGF0dXMuXG5cdCAqL1xuXHRjaGVja1N0YXR1c1RvZ2dsZSgpIHtcblx0XHRpZiAoTW9kdWxlR2V0U3NsLiRzdGF0dXNUb2dnbGUuY2hlY2tib3goJ2lzIGNoZWNrZWQnKSkge1xuXHRcdFx0TW9kdWxlR2V0U3NsLiRkaXNhYmlsaXR5RmllbGRzLnJlbW92ZUNsYXNzKCdkaXNhYmxlZCcpO1xuXHRcdFx0TW9kdWxlR2V0U3NsLiRtb2R1bGVTdGF0dXMuc2hvdygpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRNb2R1bGVHZXRTc2wuJGRpc2FiaWxpdHlGaWVsZHMuYWRkQ2xhc3MoJ2Rpc2FibGVkJyk7XG5cdFx0XHRNb2R1bGVHZXRTc2wuJG1vZHVsZVN0YXR1cy5oaWRlKCk7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBWYWxpZGF0ZSBETlMgcHJvdmlkZXIgYW5kIGNyZWRlbnRpYWxzIHdoZW4gRE5TLTAxIGlzIHNlbGVjdGVkLlxuXHQgKiBSZXR1cm5zIHRydWUgaWYgdmFsaWQsIGZhbHNlIG90aGVyd2lzZS5cblx0ICovXG5cdHZhbGlkYXRlRG5zRmllbGRzKCkge1xuXHRcdGlmIChNb2R1bGVHZXRTc2wuJGNoYWxsZW5nZVR5cGUuZHJvcGRvd24oJ2dldCB2YWx1ZScpICE9PSAnZG5zJykge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGlmICghTW9kdWxlR2V0U3NsLiRkbnNQcm92aWRlci5kcm9wZG93bignZ2V0IHZhbHVlJykpIHtcblx0XHRcdFVzZXJNZXNzYWdlLnNob3dFcnJvcihnbG9iYWxUcmFuc2xhdGUubW9kdWxlX2dldHNzbF9EbnNQcm92aWRlckVtcHR5KTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0bGV0IGhhc0VtcHR5ID0gZmFsc2U7XG5cdFx0JCgnLmRucy1jcmVkLWlucHV0JykuZWFjaChmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCAkZmllbGQgPSAkKHRoaXMpLmNsb3Nlc3QoJy5maWVsZCcpO1xuXHRcdFx0Y29uc3QgaXNNYXNrZWQgPSAkKHRoaXMpLmlzKCdbZGF0YS1tYXNrZWRdJyk7XG5cdFx0XHRpZiAoIWlzTWFza2VkICYmICEkKHRoaXMpLnZhbCgpLnRyaW0oKSkge1xuXHRcdFx0XHQkZmllbGQuYWRkQ2xhc3MoJ2Vycm9yJyk7XG5cdFx0XHRcdGhhc0VtcHR5ID0gdHJ1ZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdCRmaWVsZC5yZW1vdmVDbGFzcygnZXJyb3InKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRpZiAoaGFzRW1wdHkpIHtcblx0XHRcdFVzZXJNZXNzYWdlLnNob3dFcnJvcihnbG9iYWxUcmFuc2xhdGUubW9kdWxlX2dldHNzbF9EbnNDcmVkZW50aWFsc0VtcHR5KTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH0sXG5cblx0LyoqXG5cdCAqIENhbGxiYWNrIGJlZm9yZSBzZW5kaW5nIHRoZSBmb3JtLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gc2V0dGluZ3MgLSBBamF4IHJlcXVlc3Qgc2V0dGluZ3MuXG5cdCAqIEByZXR1cm5zIHtPYmplY3R9IFRoZSBtb2RpZmllZCBBamF4IHJlcXVlc3Qgc2V0dGluZ3MuXG5cdCAqL1xuXHRjYkJlZm9yZVNlbmRGb3JtKHNldHRpbmdzKSB7XG5cdFx0aWYgKCFNb2R1bGVHZXRTc2wudmFsaWRhdGVQdWJsaWNJcEFkZHJlc3MoKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoIU1vZHVsZUdldFNzbC52YWxpZGF0ZURuc0ZpZWxkcygpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGNvbnN0IHJlc3VsdCA9IHNldHRpbmdzO1xuXHRcdC8vIENvbGxlY3QgRE5TIGNyZWRlbnRpYWxzIGludG8gaGlkZGVuIGZpZWxkIGJlZm9yZSBmb3JtIHN1Ym1pc3Npb25cblx0XHRNb2R1bGVHZXRTc2wuY29sbGVjdERuc0NyZWRlbnRpYWxzKCk7XG5cdFx0cmVzdWx0LmRhdGEgPSBNb2R1bGVHZXRTc2wuJGZvcm1PYmouZm9ybSgnZ2V0IHZhbHVlcycpO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH0sXG5cblx0LyoqXG5cdCAqIENhbGxiYWNrIGZ1bmN0aW9uIGFmdGVyIHNlbmRpbmcgdGhlIGZvcm0uXG5cdCAqL1xuXHRjYkFmdGVyU2VuZEZvcm0ocmVzcG9uc2UpIHtcblx0XHRpZiAoRm9ybS5jaGVja1N1Y2Nlc3MocmVzcG9uc2UpKXtcblx0XHRcdE1vZHVsZUdldFNzbC5nZXRTc2woKTtcblx0XHR9XG5cdH0sXG5cblxuXHQvKipcblx0ICogSW5pdGlhbGl6ZXMgdGhlIGZvcm0gdmFsaWRhdGlvbiBhbmQgc3VibWlzc2lvbiBsb2dpYy5cblx0ICovXG5cdGluaXRpYWxpemVGb3JtKCkge1xuXHRcdEZvcm0uJGZvcm1PYmogPSBNb2R1bGVHZXRTc2wuJGZvcm1PYmo7XG5cdFx0Rm9ybS51cmwgPSBgJHtnbG9iYWxSb290VXJsfSR7aWRVcmx9LyR7aWRVcmx9L3NhdmVgO1xuXHRcdEZvcm0udmFsaWRhdGVSdWxlcyA9IE1vZHVsZUdldFNzbC52YWxpZGF0ZVJ1bGVzO1xuXHRcdEZvcm0uZW5hYmxlRGlycml0eSA9IGZhbHNlO1xuXHRcdEZvcm0uY2JBZnRlclNlbmRGb3JtID0gTW9kdWxlR2V0U3NsLmNiQWZ0ZXJTZW5kRm9ybTtcblx0XHRGb3JtLmNiQmVmb3JlU2VuZEZvcm0gPSBNb2R1bGVHZXRTc2wuY2JCZWZvcmVTZW5kRm9ybTtcblx0XHRGb3JtLmluaXRpYWxpemUoKTtcblx0fSxcbn07XG5cbi8vIEluaXRpYWxpemUgdGhlIE1vZHVsZUdldFNzbCBjbGFzcyB3aGVuIHRoZSBkb2N1bWVudCBpcyByZWFkeVxuJChkb2N1bWVudCkucmVhZHkoKCkgPT4ge1xuXHRNb2R1bGVHZXRTc2wuaW5pdGlhbGl6ZSgpO1xufSk7XG4iXSwibWFwcGluZ3MiOiJBQUFBOztBQUVBO0FBQ0EsTUFBTUEsS0FBSyxHQUFPLGdCQUFnQixDQUFDLENBQWM7QUFDakQsTUFBTUMsTUFBTSxHQUFNLHFCQUFxQixDQUFDLENBQVM7QUFDakQsTUFBTUMsU0FBUyxHQUFHLGNBQWMsQ0FBQyxDQUFnQjs7QUFFakQ7QUFDQSxNQUFNQyxZQUFZLEdBQUc7RUFDcEI7RUFDQUMsUUFBUSxFQUFFQyxDQUFDLENBQUMsR0FBRyxHQUFHSixNQUFNLENBQUM7RUFDekJLLFdBQVcsRUFBRUQsQ0FBQyxDQUFDLEdBQUcsR0FBR0osTUFBTSxHQUFHLGVBQWUsQ0FBQztFQUM5Q00saUJBQWlCLEVBQUVGLENBQUMsQ0FBQyxHQUFHLEdBQUdKLE1BQU0sR0FBRyxjQUFjLENBQUM7RUFDbkRPLGFBQWEsRUFBRUgsQ0FBQyxDQUFDLHVCQUF1QixDQUFDO0VBQ3pDSSxhQUFhLEVBQUVKLENBQUMsQ0FBQyxlQUFlLENBQUM7RUFDakNLLGFBQWEsRUFBRUwsQ0FBQyxDQUFDLFNBQVMsQ0FBQztFQUMzQk0sV0FBVyxFQUFFTixDQUFDLENBQUMsYUFBYSxDQUFDO0VBQzdCTyxpQkFBaUIsRUFBRVAsQ0FBQyxDQUFDLG1CQUFtQixDQUFDO0VBQ3pDUSxzQkFBc0IsRUFBRVIsQ0FBQyxDQUFDLDJCQUEyQixDQUFDO0VBQ3REUyx5QkFBeUIsRUFBRVQsQ0FBQyxDQUFDLDhCQUE4QixDQUFDO0VBQzVEVSxnQkFBZ0IsRUFBRVYsQ0FBQyxDQUFDLGtCQUFrQixDQUFDO0VBQ3ZDVyx3QkFBd0IsRUFBRVgsQ0FBQyxDQUFDLDZCQUE2QixDQUFDO0VBQzFEWSxXQUFXLEVBQUVaLENBQUMsQ0FBQyxhQUFhLENBQUM7RUFDN0JhLG1CQUFtQixFQUFFYixDQUFDLENBQUMsdUJBQXVCLENBQUM7RUFDL0NjLGNBQWMsRUFBRWQsQ0FBQyxDQUFDLGdCQUFnQixDQUFDO0VB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LE9BQU8sS0FBSztJQUNiO0lBQ0EsT0FBTyxJQUFJO0VBQ1osQ0FBQztFQUVEO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7RUFDQ0MsZ0JBQWdCQSxDQUFDdkIsUUFBUSxFQUFFO0lBQzFCLElBQUksQ0FBQ2pKLFlBQVksQ0FBQzBGLHVCQUF1QixDQUFDLENBQUMsRUFBRTtNQUM1QyxPQUFPLEtBQUs7SUFDYjtJQUNBLElBQUksQ0FBQzFGLFlBQVksQ0FBQ2tLLGlCQUFpQixDQUFDLENBQUMsRUFBRTtNQUN0QyxPQUFPLEtBQUs7SUFDYjtJQUNBLE1BQU1PLE1BQU0sR0FBR3hCLFFBQVE7SUFDdkI7SUFDQWpKLFlBQVksQ0FBQzRILHFCQUFxQixDQUFDLENBQUM7SUFDcEM2QyxNQUFNLENBQUN4QyxJQUFJLEdBQUdqSSxZQUFZLENBQUNDLFFBQVEsQ0FBQ3lLLElBQUksQ0FBQyxZQUFZLENBQUM7SUFDdEQsT0FBT0QsTUFBTTtFQUNkLENBQUM7RUFFRDtBQUNEO0FBQ0E7RUFDQ0UsZUFBZUEsQ0FBQ2xCLFFBQVEsRUFBRTtJQUN6QixJQUFJbUIsSUFBSSxDQUFDQyxZQUFZLENBQUNwQixRQUFRLENBQUMsRUFBQztNQUMvQnpKLFlBQVksQ0FBQ3NJLE1BQU0sQ0FBQyxDQUFDO0lBQ3RCO0VBQ0QsQ0FBQztFQUdEO0FBQ0Q7QUFDQTtFQUNDN0YsY0FBY0EsQ0FBQSxFQUFHO0lBQ2hCbUksSUFBSSxDQUFDM0ssUUFBUSxHQUFHRCxZQUFZLENBQUNDLFFBQVE7SUFDckMySyxJQUFJLENBQUNwQyxHQUFHLEdBQUcsR0FBR3NDLGFBQWEsR0FBR2pMLEtBQUssSUFBSUEsS0FBSyxPQUFPO0lBQ25EK0ssSUFBSSxDQUFDckosYUFBYSxHQUFHdkIsWUFBWSxDQUFDdUIsYUFBYTtJQUMvQ3FKLElBQUksQ0FBQ0csYUFBYSxHQUFHLEtBQUs7SUFDMUJILElBQUksQ0FBQ0QsZUFBZSxHQUFHM0ssWUFBWSxDQUFDMkssZUFBZTtJQUNuREMsSUFBSSxDQUFDSixnQkFBZ0IsR0FBR3hLLFlBQVksQ0FBQ3dLLGdCQUFnQjtJQUNyREksSUFBSSxDQUFDN0ksVUFBVSxDQUFDLENBQUM7RUFDbEI7QUFDRCxDQUFDOztBQUVEO0FBQ0E3QixDQUFDLENBQUM4SyxRQUFRLENBQUMsQ0FBQ0MsS0FBSyxDQUFDLE1BQU07RUFDdkJqTCxZQUFZLENBQUMrQixVQUFVLENBQUMsQ0FBQztBQUMxQixDQUFDLENBQUMiLCJpZ25vcmVMaXN0IjpbXX0=