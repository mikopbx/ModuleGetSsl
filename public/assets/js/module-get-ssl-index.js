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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kdWxlLWdldC1zc2wtaW5kZXguanMiLCJuYW1lcyI6W10sInNvdXJjZXMiOlsic3JjL21vZHVsZS1nZXQtc3NsLWluZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIGdsb2JhbCBnbG9iYWxSb290VXJsLCBnbG9iYWxUcmFuc2xhdGUsIEZvcm0sIENvbmZpZywgUGJ4QXBpLCBkbnNQcm92aWRlcnNNZXRhICovXG5cbi8vIENvbnN0YW50cyByZWxhdGVkIHRvIHRoZSBmb3JtIGFuZCBtb2R1bGVcbmNvbnN0IGlkVXJsICAgICA9ICdtb2R1bGUtZ2V0LXNzbCc7ICAgICAgICAgICAgICAvLyBBUEkgZW5kcG9pbnQgZm9yIFNTTCBtb2R1bGVcbmNvbnN0IGlkRm9ybSAgICA9ICdtb2R1bGUtZ2V0LXNzbC1mb3JtJzsgICAgICAgICAvLyBGb3JtIGVsZW1lbnQgSUQgZm9yIFNTTCBtb2R1bGVcbmNvbnN0IGNsYXNzTmFtZSA9ICdNb2R1bGVHZXRTc2wnOyAgICAgICAgICAgICAgICAvLyBDbGFzcyBuYW1lIGZvciB0aGlzIG1vZHVsZVxuXG4vLyBNYWluIE1vZHVsZUdldFNzbCBjbGFzcyBkZWZpbml0aW9uXG5jb25zdCBNb2R1bGVHZXRTc2wgPSB7XG5cdC8vIENhY2hlIGNvbW1vbmx5IHVzZWQgalF1ZXJ5IG9iamVjdHNcblx0JGZvcm1PYmo6ICQoJyMnICsgaWRGb3JtKSxcblx0JGNoZWNrQm94ZXM6ICQoJyMnICsgaWRGb3JtICsgJyAudWkuY2hlY2tib3gnKSxcblx0JGRpc2FiaWxpdHlGaWVsZHM6ICQoJyMnICsgaWRGb3JtICsgJyAuZGlzYWJpbGl0eScpLFxuXHQkc3RhdHVzVG9nZ2xlOiAkKCcjbW9kdWxlLXN0YXR1cy10b2dnbGUnKSxcblx0JHN1Ym1pdEJ1dHRvbjogJCgnI3N1Ym1pdGJ1dHRvbicpLFxuXHQkbW9kdWxlU3RhdHVzOiAkKCcjc3RhdHVzJyksXG5cdCRkb21haW5OYW1lOiAkKCcjZG9tYWluTmFtZScpLFxuXHQkaW5jbHVkZUlwQWRkcmVzczogJCgnI2luY2x1ZGVJcEFkZHJlc3MnKSxcblx0JGluY2x1ZGVJcEFkZHJlc3NGaWVsZDogJCgnI2luY2x1ZGUtaXAtYWRkcmVzcy1maWVsZCcpLFxuXHQkaW5jbHVkZUlwQWRkcmVzc0NoZWNrYm94OiAkKCcjaW5jbHVkZS1pcC1hZGRyZXNzLWNoZWNrYm94JyksXG5cdCRwdWJsaWNJcEFkZHJlc3M6ICQoJyNwdWJsaWNJcEFkZHJlc3MnKSxcblx0JHB1YmxpY0lwQWRkcmVzc1NldHRpbmdzOiAkKCcjcHVibGljLWlwLWFkZHJlc3Mtc2V0dGluZ3MnKSxcblx0JGF1dG9VcGRhdGU6ICQoJyNhdXRvVXBkYXRlJyksXG5cdCRhdXRvVXBkYXRlQ2hlY2tib3g6ICQoJyNhdXRvLXVwZGF0ZS1jaGVja2JveCcpLFxuXHQkY2hhbGxlbmdlVHlwZTogJCgnI2NoYWxsZW5nZVR5cGUnKSxcblx0JGRuc1Byb3ZpZGVyOiAkKCcjZG5zUHJvdmlkZXInKSxcblx0JGh0dHBDaGFsbGVuZ2VJbmZvOiAkKCcjaHR0cC1jaGFsbGVuZ2UtaW5mbycpLFxuXHQkZG5zU2V0dGluZ3NCbG9jazogJCgnI2Rucy1zZXR0aW5ncy1ibG9jaycpLFxuXHQkZG5zQ3JlZGVudGlhbHNGaWVsZHM6ICQoJyNkbnMtY3JlZGVudGlhbHMtZmllbGRzJyksXG5cdCRkbnNDcmVkZW50aWFsc0lucHV0OiAkKCdpbnB1dFtuYW1lPVwiZG5zQ3JlZGVudGlhbHNcIl0nKSxcblx0JGlwQWRkcmVzc1dhcm5pbmc6ICQoJyNpcC1hZGRyZXNzLWNlcnRpZmljYXRlLXdhcm5pbmcnKSxcblxuXHQvLyBWYWxpZGF0aW9uIHJ1bGVzIGZvciB0aGUgZm9ybVxuXHR2YWxpZGF0ZVJ1bGVzOiB7XG5cdFx0ZG9tYWluTmFtZToge1xuXHRcdFx0aWRlbnRpZmllcjogJ2RvbWFpbk5hbWUnLFxuXHRcdFx0cnVsZXM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHR5cGU6ICdlbXB0eScsXG5cdFx0XHRcdFx0cHJvbXB0OiBnbG9iYWxUcmFuc2xhdGUubW9kdWxlX2dldHNzbF9Eb21haW5OYW1lRW1wdHksXG5cdFx0XHRcdH0sXG5cdFx0XHRdLFxuXHRcdH0sXG5cdH0sXG5cblx0LyoqXG5cdCAqIEluaXRpYWxpemUgdGhlIG1vZHVsZSwgYmluZCBldmVudCBsaXN0ZW5lcnMsIGFuZCBzZXR1cCB0aGUgZm9ybS5cblx0ICovXG5cdGluaXRpYWxpemUoKSB7XG5cdFx0Ly8gSW5pdGlhbGl6ZSBTZW1hbnRpYyBVSSBjaGVja2JveGVzXG5cdFx0dGhpcy4kY2hlY2tCb3hlcy5jaGVja2JveCgpO1xuXG5cdFx0Ly8gSW5pdGlhbGl6ZSBkcm9wZG93bnNcblx0XHR0aGlzLiRjaGFsbGVuZ2VUeXBlLmRyb3Bkb3duKHtcblx0XHRcdG9uQ2hhbmdlOiBNb2R1bGVHZXRTc2wub25DaGFuZ2VDaGFsbGVuZ2VUeXBlLFxuXHRcdH0pO1xuXHRcdHRoaXMuJGRuc1Byb3ZpZGVyLmRyb3Bkb3duKHtcblx0XHRcdGZ1bGxUZXh0U2VhcmNoOiB0cnVlLFxuXHRcdFx0b25DaGFuZ2U6IE1vZHVsZUdldFNzbC5vbkNoYW5nZURuc1Byb3ZpZGVyLFxuXHRcdH0pO1xuXG5cdFx0Ly8gQ2hlY2sgYW5kIHNldCBtb2R1bGUgc3RhdHVzIG9uIGxvYWQgYW5kIHdoZW4gdGhlIHN0YXR1cyBjaGFuZ2VzXG5cdFx0dGhpcy5jaGVja1N0YXR1c1RvZ2dsZSgpO1xuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdNb2R1bGVTdGF0dXNDaGFuZ2VkJywgdGhpcy5jaGVja1N0YXR1c1RvZ2dsZSk7XG5cblx0XHQvLyBJbml0aWFsaXplIGZvcm0gd2l0aCB2YWxpZGF0aW9uIGFuZCBzdWJtaXQgaGFuZGxlcnNcblx0XHR0aGlzLmluaXRpYWxpemVGb3JtKCk7XG5cdFx0dGhpcy5iaW5kSXBBZGRyZXNzV2FybmluZygpO1xuXHRcdHRoaXMuYmluZENlcnRpZmljYXRlSWRlbnRpZmllckNvbnRyb2xzKCk7XG5cblx0XHRtb2R1bGVHZXRTU0xTdGF0dXNMb29wV29ya2VyLiRyZXN1bHRCbG9jay5oaWRlKCk7XG5cblx0XHQvLyBSZXN0b3JlIHNhdmVkIHN0YXRlXG5cdFx0Y29uc3QgY3VycmVudENoYWxsZW5nZSA9IHRoaXMuJGNoYWxsZW5nZVR5cGUuZHJvcGRvd24oJ2dldCB2YWx1ZScpIHx8ICdodHRwJztcblx0XHR0aGlzLm9uQ2hhbmdlQ2hhbGxlbmdlVHlwZShjdXJyZW50Q2hhbGxlbmdlKTtcblx0XHR0aGlzLnJlc3RvcmVTYXZlZENyZWRlbnRpYWxzKCk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIENoZWNrIHdoZXRoZXIgYSB2YWx1ZSBpcyBhIHZhbGlkIElQdjQgb3IgSVB2NiBhZGRyZXNzLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdmFsdWVcblx0ICogQHJldHVybnMge2Jvb2xlYW59XG5cdCAqL1xuXHRpc0lwQWRkcmVzcyh2YWx1ZSkge1xuXHRcdGNvbnN0IGFkZHJlc3MgPSBTdHJpbmcodmFsdWUgfHwgJycpLnRyaW0oKTtcblx0XHRjb25zdCBpcHY0UGFydHMgPSBhZGRyZXNzLnNwbGl0KCcuJyk7XG5cdFx0aWYgKGlwdjRQYXJ0cy5sZW5ndGggPT09IDQpIHtcblx0XHRcdHJldHVybiBpcHY0UGFydHMuZXZlcnkocGFydCA9PiAvXlxcZHsxLDN9JC8udGVzdChwYXJ0KVxuXHRcdFx0XHQmJiBOdW1iZXIocGFydCkgPD0gMjU1XG5cdFx0XHRcdCYmIChwYXJ0ID09PSAnMCcgfHwgcGFydFswXSAhPT0gJzAnKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGFzT3BlbmluZ0JyYWNrZXQgPSBhZGRyZXNzLnN0YXJ0c1dpdGgoJ1snKTtcblx0XHRjb25zdCBoYXNDbG9zaW5nQnJhY2tldCA9IGFkZHJlc3MuZW5kc1dpdGgoJ10nKTtcblx0XHRpZiAoaGFzT3BlbmluZ0JyYWNrZXQgIT09IGhhc0Nsb3NpbmdCcmFja2V0KSByZXR1cm4gZmFsc2U7XG5cdFx0Y29uc3QgaXB2NiA9IGhhc09wZW5pbmdCcmFja2V0ID8gYWRkcmVzcy5zbGljZSgxLCAtMSkgOiBhZGRyZXNzO1xuXHRcdGlmICghaXB2Ni5pbmNsdWRlcygnOicpIHx8IC9cXHMvLnRlc3QoaXB2NikpIHJldHVybiBmYWxzZTtcblx0XHR0cnkge1xuXHRcdFx0bmV3IFVSTChgaHR0cDovL1ske2lwdjZ9XS9gKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH0sXG5cblx0LyoqIFJldHVybiB0cnVlIG9ubHkgZm9yIGEgcHVibGljbHkgcm91dGFibGUgSVB2NCBvciBJUHY2IGFkZHJlc3MuICovXG5cdGlzUHVibGljSXBBZGRyZXNzKHZhbHVlKSB7XG5cdFx0aWYgKCF0aGlzLmlzSXBBZGRyZXNzKHZhbHVlKSkgcmV0dXJuIGZhbHNlO1xuXHRcdGNvbnN0IGFkZHJlc3MgPSBTdHJpbmcodmFsdWUgfHwgJycpLnRyaW0oKS5yZXBsYWNlKC9eXFxbfFxcXSQvZywgJycpLnRvTG93ZXJDYXNlKCk7XG5cdFx0Y29uc3QgaXB2NFBhcnRzID0gYWRkcmVzcy5zcGxpdCgnLicpLm1hcChOdW1iZXIpO1xuXHRcdGlmIChpcHY0UGFydHMubGVuZ3RoID09PSA0KSB7XG5cdFx0XHRjb25zdCBbYSwgYiwgY10gPSBpcHY0UGFydHM7XG5cdFx0XHRyZXR1cm4gIShhID09PSAwIHx8IGEgPT09IDEwIHx8IGEgPT09IDEyNyB8fCBhID49IDIyNFxuXHRcdFx0XHR8fCAoYSA9PT0gMTAwICYmIGIgPj0gNjQgJiYgYiA8PSAxMjcpXG5cdFx0XHRcdHx8IChhID09PSAxNjkgJiYgYiA9PT0gMjU0KVxuXHRcdFx0XHR8fCAoYSA9PT0gMTcyICYmIGIgPj0gMTYgJiYgYiA8PSAzMSlcblx0XHRcdFx0fHwgKGEgPT09IDE5MiAmJiBiID09PSAwICYmIChjID09PSAwIHx8IGMgPT09IDIpKVxuXHRcdFx0XHR8fCAoYSA9PT0gMTkyICYmIGIgPT09IDE2OClcblx0XHRcdFx0fHwgKGEgPT09IDE5OCAmJiAoYiA9PT0gMTggfHwgYiA9PT0gMTkpKVxuXHRcdFx0XHR8fCAoYSA9PT0gMTk4ICYmIGIgPT09IDUxICYmIGMgPT09IDEwMClcblx0XHRcdFx0fHwgKGEgPT09IDIwMyAmJiBiID09PSAwICYmIGMgPT09IDExMykpO1xuXHRcdH1cblx0XHRyZXR1cm4gIShhZGRyZXNzID09PSAnOjonIHx8IGFkZHJlc3MgPT09ICc6OjEnXG5cdFx0XHR8fCBhZGRyZXNzLnN0YXJ0c1dpdGgoJ2ZjJykgfHwgYWRkcmVzcy5zdGFydHNXaXRoKCdmZCcpXG5cdFx0XHR8fCAvXmZlWzg5YWJdLy50ZXN0KGFkZHJlc3MpIHx8IGFkZHJlc3Muc3RhcnRzV2l0aCgnMjAwMTpkYjg6JykpO1xuXHR9LFxuXG5cdC8qKiBVcGRhdGUgd2FybmluZyB2aXNpYmlsaXR5IHdoZW4gdGhlIGNvbmZpZ3VyZWQgYWRkcmVzcyBjaGFuZ2VzLiAqL1xuXHR1cGRhdGVJcEFkZHJlc3NXYXJuaW5nKCkge1xuXHRcdGlmICh0aGlzLmlzSXBBZGRyZXNzKHRoaXMuJGRvbWFpbk5hbWUudmFsKCkpKSB7XG5cdFx0XHR0aGlzLiRpcEFkZHJlc3NXYXJuaW5nLnNob3coKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy4kaXBBZGRyZXNzV2FybmluZy5oaWRlKCk7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKiBCaW5kIHJlYWN0aXZlIElQIHdhcm5pbmcgYmVoYXZpb3IgYW5kIGluaXRpYWxpemUgaXRzIHN0YXRlLiAqL1xuXHRiaW5kSXBBZGRyZXNzV2FybmluZygpIHtcblx0XHR0aGlzLiRkb21haW5OYW1lLm9uKCdpbnB1dCcsICgpID0+IHRoaXMudXBkYXRlSXBBZGRyZXNzV2FybmluZygpKTtcblx0XHR0aGlzLnVwZGF0ZUlwQWRkcmVzc1dhcm5pbmcoKTtcblx0fSxcblxuXHQvKiogQXBwbHkgdmlzaWJpbGl0eSBhbmQgY29tcGF0aWJpbGl0eSBydWxlcyBmb3IgZG9tYWluL0lQIGNlcnRpZmljYXRlIGlkZW50aWZpZXJzLiAqL1xuXHR1cGRhdGVDZXJ0aWZpY2F0ZUlkZW50aWZpZXJDb250cm9scygpIHtcblx0XHRjb25zdCBwcmltYXJ5ID0gU3RyaW5nKHRoaXMuJGRvbWFpbk5hbWUudmFsKCkgfHwgJycpLnRyaW0oKTtcblx0XHRjb25zdCBwcmltYXJ5SXNJcCA9IHRoaXMuaXNJcEFkZHJlc3MocHJpbWFyeSk7XG5cdFx0Y29uc3QgY2FuSW5jbHVkZUlwID0gcHJpbWFyeSAhPT0gJycgJiYgIXByaW1hcnlJc0lwO1xuXHRcdGlmIChwcmltYXJ5SXNJcCAmJiB0aGlzLiRpbmNsdWRlSXBBZGRyZXNzLmlzKCc6Y2hlY2tlZCcpKSB7XG5cdFx0XHR0aGlzLiRpbmNsdWRlSXBBZGRyZXNzLnByb3AoJ2NoZWNrZWQnLCBmYWxzZSk7XG5cdFx0XHR0aGlzLiRpbmNsdWRlSXBBZGRyZXNzQ2hlY2tib3guY2hlY2tib3goJ3VuY2hlY2snKTtcblx0XHR9XG5cdFx0Y29uc3QgaW5jbHVkZUlwID0gY2FuSW5jbHVkZUlwICYmIHRoaXMuJGluY2x1ZGVJcEFkZHJlc3MuaXMoJzpjaGVja2VkJyk7XG5cblx0XHR0aGlzLiRpbmNsdWRlSXBBZGRyZXNzRmllbGQudG9nZ2xlKGNhbkluY2x1ZGVJcCk7XG5cdFx0dGhpcy4kcHVibGljSXBBZGRyZXNzU2V0dGluZ3MudG9nZ2xlKGluY2x1ZGVJcCk7XG5cblx0XHRpZiAocHJpbWFyeUlzSXAgfHwgaW5jbHVkZUlwKSB7XG5cdFx0XHR0aGlzLiRjaGFsbGVuZ2VUeXBlLmRyb3Bkb3duKCdzZXQgc2VsZWN0ZWQnLCAnaHR0cCcpLmRyb3Bkb3duKCdzZXQgZGlzYWJsZWQnKTtcblx0XHRcdHRoaXMuJGF1dG9VcGRhdGUucHJvcCgnY2hlY2tlZCcsIHRydWUpLnByb3AoJ2Rpc2FibGVkJywgdHJ1ZSk7XG5cdFx0XHR0aGlzLiRhdXRvVXBkYXRlQ2hlY2tib3guY2hlY2tib3goJ2NoZWNrJykuY2hlY2tib3goJ3NldCBkaXNhYmxlZCcpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLiRjaGFsbGVuZ2VUeXBlLmRyb3Bkb3duKCdzZXQgZW5hYmxlZCcpO1xuXHRcdFx0dGhpcy4kYXV0b1VwZGF0ZS5wcm9wKCdkaXNhYmxlZCcsIGZhbHNlKTtcblx0XHRcdHRoaXMuJGF1dG9VcGRhdGVDaGVja2JveC5jaGVja2JveCgnc2V0IGVuYWJsZWQnKTtcblx0XHR9XG5cdH0sXG5cblx0LyoqIEJpbmQgY2hhbmdlcyBhZmZlY3RpbmcgdGhlIHJlcXVlc3RlZCBjZXJ0aWZpY2F0ZSBpZGVudGlmaWVyIGxpc3QuICovXG5cdGJpbmRDZXJ0aWZpY2F0ZUlkZW50aWZpZXJDb250cm9scygpIHtcblx0XHR0aGlzLiRkb21haW5OYW1lLm9uKCdpbnB1dCcsICgpID0+IHRoaXMudXBkYXRlQ2VydGlmaWNhdGVJZGVudGlmaWVyQ29udHJvbHMoKSk7XG5cdFx0dGhpcy4kaW5jbHVkZUlwQWRkcmVzc0NoZWNrYm94LmNoZWNrYm94KHtcblx0XHRcdG9uQ2hhbmdlOiAoKSA9PiB0aGlzLnVwZGF0ZUNlcnRpZmljYXRlSWRlbnRpZmllckNvbnRyb2xzKCksXG5cdFx0fSk7XG5cdFx0dGhpcy51cGRhdGVDZXJ0aWZpY2F0ZUlkZW50aWZpZXJDb250cm9scygpO1xuXHR9LFxuXG5cdC8qKiBWYWxpZGF0ZSB0aGUgb3B0aW9uYWwgYWRkaXRpb25hbCBwdWJsaWMgSVAgYWRkcmVzcy4gKi9cblx0dmFsaWRhdGVQdWJsaWNJcEFkZHJlc3MoKSB7XG5cdFx0Y29uc3QgcHJpbWFyeUlzSXAgPSB0aGlzLmlzSXBBZGRyZXNzKHRoaXMuJGRvbWFpbk5hbWUudmFsKCkpO1xuXHRcdGlmIChwcmltYXJ5SXNJcCB8fCAhdGhpcy4kaW5jbHVkZUlwQWRkcmVzcy5pcygnOmNoZWNrZWQnKSkgcmV0dXJuIHRydWU7XG5cdFx0aWYgKHRoaXMuaXNQdWJsaWNJcEFkZHJlc3ModGhpcy4kcHVibGljSXBBZGRyZXNzLnZhbCgpKSkgcmV0dXJuIHRydWU7XG5cdFx0VXNlck1lc3NhZ2Uuc2hvd0Vycm9yKGdsb2JhbFRyYW5zbGF0ZS5tb2R1bGVfZ2V0c3NsX1B1YmxpY0lwQWRkcmVzc0ludmFsaWQpO1xuXHRcdHRoaXMuJHB1YmxpY0lwQWRkcmVzcy5jbG9zZXN0KCcuZmllbGQnKS5hZGRDbGFzcygnZXJyb3InKTtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEhhbmRsZSBjaGFsbGVuZ2UgdHlwZSBjaGFuZ2U6IHNob3cvaGlkZSByZWxldmFudCBzZWN0aW9ucy5cblx0ICogQHBhcmFtIHtzdHJpbmd9IHZhbHVlIC0gJ2h0dHAnIG9yICdkbnMnXG5cdCAqL1xuXHRvbkNoYW5nZUNoYWxsZW5nZVR5cGUodmFsdWUpIHtcblx0XHRpZiAodmFsdWUgPT09ICdkbnMnKSB7XG5cdFx0XHRNb2R1bGVHZXRTc2wuJGh0dHBDaGFsbGVuZ2VJbmZvLmhpZGUoKTtcblx0XHRcdE1vZHVsZUdldFNzbC4kZG5zU2V0dGluZ3NCbG9jay5zaG93KCk7XG5cdFx0XHQvLyBUcmlnZ2VyIHByb3ZpZGVyIGNoYW5nZSB0byByZW5kZXIgY3JlZGVudGlhbCBmaWVsZHNcblx0XHRcdGNvbnN0IGN1cnJlbnRQcm92aWRlciA9IE1vZHVsZUdldFNzbC4kZG5zUHJvdmlkZXIuZHJvcGRvd24oJ2dldCB2YWx1ZScpO1xuXHRcdFx0aWYgKGN1cnJlbnRQcm92aWRlcikge1xuXHRcdFx0XHRNb2R1bGVHZXRTc2wub25DaGFuZ2VEbnNQcm92aWRlcihjdXJyZW50UHJvdmlkZXIpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRNb2R1bGVHZXRTc2wuJGh0dHBDaGFsbGVuZ2VJbmZvLnNob3coKTtcblx0XHRcdE1vZHVsZUdldFNzbC4kZG5zU2V0dGluZ3NCbG9jay5oaWRlKCk7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBIYW5kbGUgRE5TIHByb3ZpZGVyIGNoYW5nZTogZHluYW1pY2FsbHkgcmVuZGVyIGNyZWRlbnRpYWwgZmllbGRzLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdmFsdWUgLSBwcm92aWRlciBJRCAoZS5nLiAnZG5zX2NmJylcblx0ICovXG5cdG9uQ2hhbmdlRG5zUHJvdmlkZXIodmFsdWUpIHtcblx0XHRjb25zdCAkY29udGFpbmVyID0gTW9kdWxlR2V0U3NsLiRkbnNDcmVkZW50aWFsc0ZpZWxkcztcblx0XHQkY29udGFpbmVyLmVtcHR5KCk7XG5cblx0XHRpZiAoIXZhbHVlIHx8IHR5cGVvZiBkbnNQcm92aWRlcnNNZXRhID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIEZpbmQgcHJvdmlkZXIgbWV0YWRhdGFcblx0XHRjb25zdCBwcm92aWRlciA9IGRuc1Byb3ZpZGVyc01ldGEuZmluZChwID0+IHAuaWQgPT09IHZhbHVlKTtcblx0XHRpZiAoIXByb3ZpZGVyIHx8ICFwcm92aWRlci5maWVsZHMpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBEZWNvZGUgZXhpc3Rpbmcgc2F2ZWQgY3JlZGVudGlhbHMgZm9yIHByZS1maWxsaW5nXG5cdFx0bGV0IHNhdmVkQ3JlZHMgPSB7fTtcblx0XHRjb25zdCBlbmNvZGVkVmFsID0gTW9kdWxlR2V0U3NsLiRkbnNDcmVkZW50aWFsc0lucHV0LnZhbCgpO1xuXHRcdGlmIChlbmNvZGVkVmFsKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBkZWNvZGVkID0gYXRvYihlbmNvZGVkVmFsKTtcblx0XHRcdFx0c2F2ZWRDcmVkcyA9IEpTT04ucGFyc2UoZGVjb2RlZCk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdC8vIGlnbm9yZSBkZWNvZGUgZXJyb3JzXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gUmVuZGVyIGZpZWxkc1xuXHRcdHByb3ZpZGVyLmZpZWxkcy5mb3JFYWNoKGZpZWxkID0+IHtcblx0XHRcdGNvbnN0IGhhc1NhdmVkID0gQm9vbGVhbihzYXZlZENyZWRzW2ZpZWxkLnZhcl0pO1xuXHRcdFx0Y29uc3QgZGlzcGxheVZhbHVlID0gaGFzU2F2ZWQgPyAn4oCi4oCi4oCi4oCi4oCi4oCi4oCi4oCiJyA6ICcnO1xuXHRcdFx0Y29uc3QgbWFza2VkQXR0ciA9IGhhc1NhdmVkID8gJ2RhdGEtbWFza2VkPVwidHJ1ZVwiJyA6ICcnO1xuXHRcdFx0Y29uc3QgaHRtbCA9IGBcblx0XHRcdFx0PGRpdiBjbGFzcz1cImZpZWxkXCI+XG5cdFx0XHRcdFx0PGxhYmVsPiR7ZmllbGQubGFiZWx9PC9sYWJlbD5cblx0XHRcdFx0XHQ8aW5wdXQgdHlwZT1cInBhc3N3b3JkXCJcblx0XHRcdFx0XHRcdCAgIGNsYXNzPVwiZG5zLWNyZWQtaW5wdXRcIlxuXHRcdFx0XHRcdFx0ICAgZGF0YS12YXI9XCIke2ZpZWxkLnZhcn1cIlxuXHRcdFx0XHRcdFx0ICAgJHttYXNrZWRBdHRyfVxuXHRcdFx0XHRcdFx0ICAgdmFsdWU9XCIke01vZHVsZUdldFNzbC5lc2NhcGVIdG1sKGRpc3BsYXlWYWx1ZSl9XCJcblx0XHRcdFx0XHRcdCAgIHBsYWNlaG9sZGVyPVwiJHtmaWVsZC5sYWJlbH1cIj5cblx0XHRcdFx0PC9kaXY+YDtcblx0XHRcdCRjb250YWluZXIuYXBwZW5kKGh0bWwpO1xuXHRcdH0pO1xuXHRcdC8vIE9uIGZvY3VzOiBjbGVhciBtYXNrIHNvIHVzZXIgY2FuIGVudGVyIG5ldyB2YWx1ZVxuXHRcdCRjb250YWluZXIub24oJ2ZvY3VzJywgJy5kbnMtY3JlZC1pbnB1dFtkYXRhLW1hc2tlZF0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHQkKHRoaXMpLnZhbCgnJykucmVtb3ZlQXR0cignZGF0YS1tYXNrZWQnKTtcblx0XHR9KTtcblx0XHQvLyBDbGVhciBlcnJvciBoaWdobGlnaHQgd2hlbiB1c2VyIHN0YXJ0cyB0eXBpbmdcblx0XHQkY29udGFpbmVyLm9uKCdpbnB1dCcsICcuZG5zLWNyZWQtaW5wdXQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHQkKHRoaXMpLmNsb3Nlc3QoJy5maWVsZCcpLnJlbW92ZUNsYXNzKCdlcnJvcicpO1xuXHRcdH0pO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBDb2xsZWN0IEROUyBjcmVkZW50aWFsIGZpZWxkIHZhbHVlcyBpbnRvIGJhc2U2NCBKU09OIGFuZCB3cml0ZSB0byBoaWRkZW4gaW5wdXQuXG5cdCAqIE1hc2tlZCBmaWVsZHMgKHVuY2hhbmdlZCkgYXJlIHJlc3RvcmVkIGZyb20gdGhlIHByZXZpb3VzbHkgc2F2ZWQgY3JlZGVudGlhbHMuXG5cdCAqL1xuXHRjb2xsZWN0RG5zQ3JlZGVudGlhbHMoKSB7XG5cdFx0Y29uc3QgY2hhbGxlbmdlVHlwZSA9IE1vZHVsZUdldFNzbC4kY2hhbGxlbmdlVHlwZS5kcm9wZG93bignZ2V0IHZhbHVlJyk7XG5cdFx0aWYgKGNoYWxsZW5nZVR5cGUgIT09ICdkbnMnKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdC8vIERlY29kZSBjdXJyZW50bHkgc3RvcmVkIGNyZWRlbnRpYWxzIChzb3VyY2Ugb2YgdHJ1dGggZm9yIG1hc2tlZCBmaWVsZHMpXG5cdFx0bGV0IHNhdmVkQ3JlZHMgPSB7fTtcblx0XHRjb25zdCBlbmNvZGVkVmFsID0gTW9kdWxlR2V0U3NsLiRkbnNDcmVkZW50aWFsc0lucHV0LnZhbCgpO1xuXHRcdGlmIChlbmNvZGVkVmFsKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRzYXZlZENyZWRzID0gSlNPTi5wYXJzZShhdG9iKGVuY29kZWRWYWwpKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0Ly8gaWdub3JlXG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnN0IGNyZWRzID0ge307XG5cdFx0JCgnLmRucy1jcmVkLWlucHV0JykuZWFjaChmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCB2YXJOYW1lID0gJCh0aGlzKS5kYXRhKCd2YXInKTtcblx0XHRcdGlmICghdmFyTmFtZSkgcmV0dXJuO1xuXHRcdFx0aWYgKCQodGhpcykuaXMoJ1tkYXRhLW1hc2tlZF0nKSkge1xuXHRcdFx0XHQvLyBVc2VyIGRpZG4ndCBjaGFuZ2UgdGhpcyBmaWVsZCDigJQga2VlcCBzdG9yZWQgdmFsdWVcblx0XHRcdFx0aWYgKHNhdmVkQ3JlZHNbdmFyTmFtZV0pIHtcblx0XHRcdFx0XHRjcmVkc1t2YXJOYW1lXSA9IHNhdmVkQ3JlZHNbdmFyTmFtZV07XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IHZhbCA9ICQodGhpcykudmFsKCk7XG5cdFx0XHRcdGlmICh2YWwpIHtcblx0XHRcdFx0XHRjcmVkc1t2YXJOYW1lXSA9IHZhbDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdE1vZHVsZUdldFNzbC4kZG5zQ3JlZGVudGlhbHNJbnB1dC52YWwoYnRvYShKU09OLnN0cmluZ2lmeShjcmVkcykpKTtcblx0fSxcblxuXHQvKipcblx0ICogUmVzdG9yZSBzYXZlZCBjcmVkZW50aWFscyBpbnRvIHRoZSBETlMgcHJvdmlkZXIgZmllbGRzIG9uIHBhZ2UgbG9hZC5cblx0ICovXG5cdHJlc3RvcmVTYXZlZENyZWRlbnRpYWxzKCkge1xuXHRcdGNvbnN0IGN1cnJlbnRQcm92aWRlciA9IE1vZHVsZUdldFNzbC4kZG5zUHJvdmlkZXIuZHJvcGRvd24oJ2dldCB2YWx1ZScpO1xuXHRcdGlmIChjdXJyZW50UHJvdmlkZXIpIHtcblx0XHRcdE1vZHVsZUdldFNzbC5vbkNoYW5nZURuc1Byb3ZpZGVyKGN1cnJlbnRQcm92aWRlcik7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBFc2NhcGUgSFRNTCBzcGVjaWFsIGNoYXJhY3RlcnMgZm9yIHNhZmUgaW5zZXJ0aW9uIGludG8gYXR0cmlidXRlcy5cblx0ICogQHBhcmFtIHtzdHJpbmd9IHRleHRcblx0ICogQHJldHVybnMge3N0cmluZ31cblx0ICovXG5cdGVzY2FwZUh0bWwodGV4dCkge1xuXHRcdGNvbnN0IG1hcCA9IHsgJyYnOiAnJmFtcDsnLCAnPCc6ICcmbHQ7JywgJz4nOiAnJmd0OycsICdcIic6ICcmcXVvdDsnLCBcIidcIjogJyYjMDM5OycgfTtcblx0XHRyZXR1cm4gU3RyaW5nKHRleHQpLnJlcGxhY2UoL1smPD5cIiddL2csIG0gPT4gbWFwW21dKTtcblx0fSxcblxuXHQvKipcblx0ICogUmVxdWVzdCBhbiBTU0wgY2VydGlmaWNhdGUgYnkgY2FsbGluZyB0aGUgc2VydmVyLXNpZGUgQVBJLlxuXHQgKi9cblx0Z2V0U3NsKCkge1xuXHRcdCQuYXBpKHtcblx0XHRcdHVybDogYCR7Q29uZmlnLnBieFVybH0vcGJ4Y29yZS9hcGkvbW9kdWxlcy8ke2NsYXNzTmFtZX0vZ2V0LWNlcnRgLFxuXHRcdFx0b246ICdub3cnLFxuXHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRiZWZvcmVYSFIoeGhyKSB7XG5cdFx0XHRcdHhoci5zZXRSZXF1ZXN0SGVhZGVyICgnWC1Bc3luYy1SZXNwb25zZS1DaGFubmVsLUlkJywgbW9kdWxlR2V0U1NMU3RhdHVzTG9vcFdvcmtlci5jaGFubmVsSWQpO1xuXHRcdFx0XHR4aHIuc2V0UmVxdWVzdEhlYWRlciAoJ1gtUHJvY2Vzc29yLVRpbWVvdXQnLCAnMTIwJyk7XG5cdFx0XHRcdHJldHVybiB4aHI7XG5cdFx0XHR9LFxuXHRcdFx0YmVmb3JlU2VuZChzZXR0aW5ncykge1xuXHRcdFx0XHRNb2R1bGVHZXRTc2wuJHN1Ym1pdEJ1dHRvbi5hZGRDbGFzcygnbG9hZGluZyBkaXNhYmxlZCcpO1xuXHRcdFx0XHRtb2R1bGVHZXRTU0xTdGF0dXNMb29wV29ya2VyLiRyZXN1bHRCbG9jay5zaG93KCk7XG5cdFx0XHRcdG1vZHVsZUdldFNTTFN0YXR1c0xvb3BXb3JrZXIuZWRpdG9yLmdldFNlc3Npb24oKS5zZXRWYWx1ZShcblx0XHRcdFx0Z2xvYmFsVHJhbnNsYXRlLm1vZHVsZV9nZXRzc2xfR2V0U1NMUHJvY2Vzc2luZyArICdcXG4nXG5cdFx0XHQpO1xuXHRcdFx0XHRyZXR1cm4gc2V0dGluZ3M7XG5cdFx0XHR9LFxuXHRcdFx0c3VjY2Vzc1Rlc3Q6IFBieEFwaS5zdWNjZXNzVGVzdCxcblx0XHRcdG9uU3VjY2VzczogZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG5cdFx0XHRcdE1vZHVsZUdldFNzbC4kc3VibWl0QnV0dG9uLnJlbW92ZUNsYXNzKCdsb2FkaW5nIGRpc2FibGVkJyk7XG5cdFx0XHR9LFxuXHRcdFx0b25GYWlsdXJlOiBmdW5jdGlvbihyZXNwb25zZSkge1xuXHRcdFx0XHRNb2R1bGVHZXRTc2wuJHN1Ym1pdEJ1dHRvbi5yZW1vdmVDbGFzcygnbG9hZGluZyBkaXNhYmxlZCcpO1xuXHRcdFx0XHRVc2VyTWVzc2FnZS5zaG93TXVsdGlTdHJpbmcocmVzcG9uc2UubWVzc2FnZSk7XG5cdFx0XHR9LFxuXHRcdH0pXG5cdH0sXG5cblx0LyoqXG5cdCAqIFRvZ2dsZXMgdGhlIGZvcm0gZmllbGRzIGFuZCBzdGF0dXMgdmlzaWJpbGl0eSBiYXNlZCBvbiB0aGUgbW9kdWxlJ3Mgc3RhdHVzLlxuXHQgKi9cblx0Y2hlY2tTdGF0dXNUb2dnbGUoKSB7XG5cdFx0aWYgKE1vZHVsZUdldFNzbC4kc3RhdHVzVG9nZ2xlLmNoZWNrYm94KCdpcyBjaGVja2VkJykpIHtcblx0XHRcdE1vZHVsZUdldFNzbC4kZGlzYWJpbGl0eUZpZWxkcy5yZW1vdmVDbGFzcygnZGlzYWJsZWQnKTtcblx0XHRcdE1vZHVsZUdldFNzbC4kbW9kdWxlU3RhdHVzLnNob3coKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0TW9kdWxlR2V0U3NsLiRkaXNhYmlsaXR5RmllbGRzLmFkZENsYXNzKCdkaXNhYmxlZCcpO1xuXHRcdFx0TW9kdWxlR2V0U3NsLiRtb2R1bGVTdGF0dXMuaGlkZSgpO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogVmFsaWRhdGUgRE5TIHByb3ZpZGVyIGFuZCBjcmVkZW50aWFscyB3aGVuIEROUy0wMSBpcyBzZWxlY3RlZC5cblx0ICogUmV0dXJucyB0cnVlIGlmIHZhbGlkLCBmYWxzZSBvdGhlcndpc2UuXG5cdCAqL1xuXHR2YWxpZGF0ZURuc0ZpZWxkcygpIHtcblx0XHRpZiAoTW9kdWxlR2V0U3NsLiRjaGFsbGVuZ2VUeXBlLmRyb3Bkb3duKCdnZXQgdmFsdWUnKSAhPT0gJ2RucycpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAoIU1vZHVsZUdldFNzbC4kZG5zUHJvdmlkZXIuZHJvcGRvd24oJ2dldCB2YWx1ZScpKSB7XG5cdFx0XHRVc2VyTWVzc2FnZS5zaG93RXJyb3IoZ2xvYmFsVHJhbnNsYXRlLm1vZHVsZV9nZXRzc2xfRG5zUHJvdmlkZXJFbXB0eSk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGxldCBoYXNFbXB0eSA9IGZhbHNlO1xuXHRcdCQoJy5kbnMtY3JlZC1pbnB1dCcpLmVhY2goZnVuY3Rpb24gKCkge1xuXHRcdFx0Y29uc3QgJGZpZWxkID0gJCh0aGlzKS5jbG9zZXN0KCcuZmllbGQnKTtcblx0XHRcdGNvbnN0IGlzTWFza2VkID0gJCh0aGlzKS5pcygnW2RhdGEtbWFza2VkXScpO1xuXHRcdFx0aWYgKCFpc01hc2tlZCAmJiAhJCh0aGlzKS52YWwoKS50cmltKCkpIHtcblx0XHRcdFx0JGZpZWxkLmFkZENsYXNzKCdlcnJvcicpO1xuXHRcdFx0XHRoYXNFbXB0eSA9IHRydWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQkZmllbGQucmVtb3ZlQ2xhc3MoJ2Vycm9yJyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0aWYgKGhhc0VtcHR5KSB7XG5cdFx0XHRVc2VyTWVzc2FnZS5zaG93RXJyb3IoZ2xvYmFsVHJhbnNsYXRlLm1vZHVsZV9nZXRzc2xfRG5zQ3JlZGVudGlhbHNFbXB0eSk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBDYWxsYmFjayBiZWZvcmUgc2VuZGluZyB0aGUgZm9ybS5cblx0ICogQHBhcmFtIHtPYmplY3R9IHNldHRpbmdzIC0gQWpheCByZXF1ZXN0IHNldHRpbmdzLlxuXHQgKiBAcmV0dXJucyB7T2JqZWN0fSBUaGUgbW9kaWZpZWQgQWpheCByZXF1ZXN0IHNldHRpbmdzLlxuXHQgKi9cblx0Y2JCZWZvcmVTZW5kRm9ybShzZXR0aW5ncykge1xuXHRcdGlmICghTW9kdWxlR2V0U3NsLnZhbGlkYXRlUHVibGljSXBBZGRyZXNzKCkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKCFNb2R1bGVHZXRTc2wudmFsaWRhdGVEbnNGaWVsZHMoKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCByZXN1bHQgPSBzZXR0aW5ncztcblx0XHQvLyBDb2xsZWN0IEROUyBjcmVkZW50aWFscyBpbnRvIGhpZGRlbiBmaWVsZCBiZWZvcmUgZm9ybSBzdWJtaXNzaW9uXG5cdFx0TW9kdWxlR2V0U3NsLmNvbGxlY3REbnNDcmVkZW50aWFscygpO1xuXHRcdHJlc3VsdC5kYXRhID0gTW9kdWxlR2V0U3NsLiRmb3JtT2JqLmZvcm0oJ2dldCB2YWx1ZXMnKTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBDYWxsYmFjayBmdW5jdGlvbiBhZnRlciBzZW5kaW5nIHRoZSBmb3JtLlxuXHQgKi9cblx0Y2JBZnRlclNlbmRGb3JtKHJlc3BvbnNlKSB7XG5cdFx0aWYgKEZvcm0uY2hlY2tTdWNjZXNzKHJlc3BvbnNlKSl7XG5cdFx0XHRNb2R1bGVHZXRTc2wuZ2V0U3NsKCk7XG5cdFx0fVxuXHR9LFxuXG5cblx0LyoqXG5cdCAqIEluaXRpYWxpemVzIHRoZSBmb3JtIHZhbGlkYXRpb24gYW5kIHN1Ym1pc3Npb24gbG9naWMuXG5cdCAqL1xuXHRpbml0aWFsaXplRm9ybSgpIHtcblx0XHRGb3JtLiRmb3JtT2JqID0gTW9kdWxlR2V0U3NsLiRmb3JtT2JqO1xuXHRcdEZvcm0udXJsID0gYCR7Z2xvYmFsUm9vdFVybH0ke2lkVXJsfS8ke2lkVXJsfS9zYXZlYDtcblx0XHRGb3JtLnZhbGlkYXRlUnVsZXMgPSBNb2R1bGVHZXRTc2wudmFsaWRhdGVSdWxlcztcblx0XHRGb3JtLmVuYWJsZURpcnJpdHkgPSBmYWxzZTtcblx0XHRGb3JtLmNiQWZ0ZXJTZW5kRm9ybSA9IE1vZHVsZUdldFNzbC5jYkFmdGVyU2VuZEZvcm07XG5cdFx0Rm9ybS5jYkJlZm9yZVNlbmRGb3JtID0gTW9kdWxlR2V0U3NsLmNiQmVmb3JlU2VuZEZvcm07XG5cdFx0Rm9ybS5pbml0aWFsaXplKCk7XG5cdH0sXG59O1xuXG4vLyBJbml0aWFsaXplIHRoZSBNb2R1bGVHZXRTc2wgY2xhc3Mgd2hlbiB0aGUgZG9jdW1lbnQgaXMgcmVhZHlcbiQoZG9jdW1lbnQpLnJlYWR5KCgpID0+IHtcblx0TW9kdWxlR2V0U3NsLmluaXRpYWxpemUoKTtcbn0pO1xuIl0sIm1hcHBpbmdzIjoiQUFBQTs7QUFFQTtBQUNBLE1BQU0sS0FBSyxHQUFPLGdCQUFnQixDQUFDLENBQWM7QUFDakQsTUFBTSxNQUFNLEdBQU0scUJBQXFCLENBQUMsQ0FBUztBQUNqRCxNQUFNLFNBQVMsR0FBRyxjQUFjLENBQUMsQ0FBZ0I7O0FBRWpEO0FBQ0EsTUFBTSxZQUFZLEdBQUc7RUFDcEI7RUFDQSxRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUcsR0FBRyxNQUFNLENBQUM7RUFDekIsV0FBVyxFQUFFLENBQUMsQ0FBQyxHQUFHLEdBQUcsTUFBTSxHQUFHLGVBQWUsQ0FBQztFQUM5QyxpQkFBaUIsRUFBRSxDQUFDLENBQUMsR0FBRyxHQUFHLE1BQU0sR0FBRyxjQUFjLENBQUM7RUFDbkQsYUFBYSxFQUFFLENBQUMsQ0FBQyx1QkFBdUIsQ0FBQztFQUN6QyxhQUFhLEVBQUUsQ0FBQyxDQUFDLGVBQWUsQ0FBQztFQUNqQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQztFQUMzQixXQUFXLEVBQUUsQ0FBQyxDQUFDLGFBQWEsQ0FBQztFQUM3QixpQkFBaUIsRUFBRSxDQUFDLENBQUMsbUJBQW1CLENBQUM7RUFDekMsc0JBQXNCLEVBQUUsQ0FBQyxDQUFDLDJCQUEyQixDQUFDO0VBQ3RELHlCQUF5QixFQUFFLENBQUMsQ0FBQyw4QkFBOEIsQ0FBQztFQUM1RCxnQkFBZ0IsRUFBRSxDQUFDLENBQUMsa0JBQWtCLENBQUM7RUFDdkMsd0JBQXdCLEVBQUUsQ0FBQyxDQUFDLDZCQUE2QixDQUFDO0VBQzFELFdBQVcsRUFBRSxDQUFDLENBQUMsYUFBYSxDQUFDO0VBQzdCLG1CQUFtQixFQUFF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