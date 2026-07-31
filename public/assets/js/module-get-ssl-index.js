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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kdWxlLWdldC1zc2wtaW5kZXguanMiLCJuYW1lcyI6W10sInNvdXJjZXMiOlsic3JjL21vZHVsZS1nZXQtc3NsLWluZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIGdsb2JhbCBnbG9iYWxSb290VXJsLCBnbG9iYWxUcmFuc2xhdGUsIEZvcm0sIENvbmZpZywgUGJ4QXBpLCBkbnNQcm92aWRlcnNNZXRhLCBzdWdnZXN0ZWRQdWJsaWNJcCAqL1xuXG4vLyBDb25zdGFudHMgcmVsYXRlZCB0byB0aGUgZm9ybSBhbmQgbW9kdWxlXG5jb25zdCBpZFVybCAgICAgPSAnbW9kdWxlLWdldC1zc2wnOyAgICAgICAgICAgICAgLy8gQVBJIGVuZHBvaW50IGZvciBTU0wgbW9kdWxlXG5jb25zdCBpZEZvcm0gICAgPSAnbW9kdWxlLWdldC1zc2wtZm9ybSc7ICAgICAgICAgLy8gRm9ybSBlbGVtZW50IElEIGZvciBTU0wgbW9kdWxlXG5jb25zdCBjbGFzc05hbWUgPSAnTW9kdWxlR2V0U3NsJzsgICAgICAgICAgICAgICAgLy8gQ2xhc3MgbmFtZSBmb3IgdGhpcyBtb2R1bGVcblxuLy8gTWFpbiBNb2R1bGVHZXRTc2wgY2xhc3MgZGVmaW5pdGlvblxuY29uc3QgTW9kdWxlR2V0U3NsID0ge1xuXHQvLyBDYWNoZSBjb21tb25seSB1c2VkIGpRdWVyeSBvYmplY3RzXG5cdCRmb3JtT2JqOiAkKCcjJyArIGlkRm9ybSksXG5cdCRjaGVja0JveGVzOiAkKCcjJyArIGlkRm9ybSArICcgLnVpLmNoZWNrYm94JyksXG5cdCRkaXNhYmlsaXR5RmllbGRzOiAkKCcjJyArIGlkRm9ybSArICcgLmRpc2FiaWxpdHknKSxcblx0JHN0YXR1c1RvZ2dsZTogJCgnI21vZHVsZS1zdGF0dXMtdG9nZ2xlJyksXG5cdCRzdWJtaXRCdXR0b246ICQoJyNzdWJtaXRidXR0b24nKSxcblx0JG1vZHVsZVN0YXR1czogJCgnI3N0YXR1cycpLFxuXHQkZG9tYWluTmFtZTogJCgnI2RvbWFpbk5hbWUnKSxcblx0JGluY2x1ZGVJcEFkZHJlc3M6ICQoJyNpbmNsdWRlSXBBZGRyZXNzJyksXG5cdCRpbmNsdWRlSXBBZGRyZXNzRmllbGQ6ICQoJyNpbmNsdWRlLWlwLWFkZHJlc3MtZmllbGQnKSxcblx0JGluY2x1ZGVJcEFkZHJlc3NDaGVja2JveDogJCgnI2luY2x1ZGUtaXAtYWRkcmVzcy1jaGVja2JveCcpLFxuXHQkcHVibGljSXBBZGRyZXNzOiAkKCcjcHVibGljSXBBZGRyZXNzJyksXG5cdCRwdWJsaWNJcEFkZHJlc3NTZXR0aW5nczogJCgnI3B1YmxpYy1pcC1hZGRyZXNzLXNldHRpbmdzJyksXG5cdCRhdXRvVXBkYXRlOiAkKCcjYXV0b1VwZGF0ZScpLFxuXHQkYXV0b1VwZGF0ZUNoZWNrYm94OiAkKCcjYXV0by11cGRhdGUtY2hlY2tib3gnKSxcblx0JGNoYWxsZW5nZVR5cGU6ICQoJyNjaGFsbGVuZ2VUeXBlJyksXG5cdCRkbnNQcm92aWRlcjogJCgnI2Ruc1Byb3ZpZGVyJyksXG5cdCRodHRwQ2hhbGxlbmdlSW5mbzogJCgnI2h0dHAtY2hhbGxlbmdlLWluZm8nKSxcblx0JGRuc1NldHRpbmdzQmxvY2s6ICQoJyNkbnMtc2V0dGluZ3MtYmxvY2snKSxcblx0JGRuc0NyZWRlbnRpYWxzRmllbGRzOiAkKCcjZG5zLWNyZWRlbnRpYWxzLWZpZWxkcycpLFxuXHQkZG5zQ3JlZGVudGlhbHNJbnB1dDogJCgnaW5wdXRbbmFtZT1cImRuc0NyZWRlbnRpYWxzXCJdJyksXG5cdCRpcEFkZHJlc3NXYXJuaW5nOiAkKCcjaXAtYWRkcmVzcy1jZXJ0aWZpY2F0ZS13YXJuaW5nJyksXG5cblx0Ly8gVmFsaWRhdGlvbiBydWxlcyBmb3IgdGhlIGZvcm1cblx0dmFsaWRhdGVSdWxlczoge1xuXHRcdGRvbWFpbk5hbWU6IHtcblx0XHRcdGlkZW50aWZpZXI6ICdkb21haW5OYW1lJyxcblx0XHRcdHJ1bGVzOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR0eXBlOiAnZW1wdHknLFxuXHRcdFx0XHRcdHByb21wdDogZ2xvYmFsVHJhbnNsYXRlLm1vZHVsZV9nZXRzc2xfRG9tYWluTmFtZUVtcHR5LFxuXHRcdFx0XHR9LFxuXHRcdFx0XSxcblx0XHR9LFxuXHR9LFxuXG5cdC8qKlxuXHQgKiBJbml0aWFsaXplIHRoZSBtb2R1bGUsIGJpbmQgZXZlbnQgbGlzdGVuZXJzLCBhbmQgc2V0dXAgdGhlIGZvcm0uXG5cdCAqL1xuXHRpbml0aWFsaXplKCkge1xuXHRcdC8vIEluaXRpYWxpemUgU2VtYW50aWMgVUkgY2hlY2tib3hlc1xuXHRcdHRoaXMuJGNoZWNrQm94ZXMuY2hlY2tib3goKTtcblxuXHRcdC8vIEluaXRpYWxpemUgZHJvcGRvd25zXG5cdFx0dGhpcy4kY2hhbGxlbmdlVHlwZS5kcm9wZG93bih7XG5cdFx0XHRvbkNoYW5nZTogTW9kdWxlR2V0U3NsLm9uQ2hhbmdlQ2hhbGxlbmdlVHlwZSxcblx0XHR9KTtcblx0XHR0aGlzLiRkbnNQcm92aWRlci5kcm9wZG93bih7XG5cdFx0XHRmdWxsVGV4dFNlYXJjaDogdHJ1ZSxcblx0XHRcdG9uQ2hhbmdlOiBNb2R1bGVHZXRTc2wub25DaGFuZ2VEbnNQcm92aWRlcixcblx0XHR9KTtcblxuXHRcdC8vIENoZWNrIGFuZCBzZXQgbW9kdWxlIHN0YXR1cyBvbiBsb2FkIGFuZCB3aGVuIHRoZSBzdGF0dXMgY2hhbmdlc1xuXHRcdHRoaXMuY2hlY2tTdGF0dXNUb2dnbGUoKTtcblx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignTW9kdWxlU3RhdHVzQ2hhbmdlZCcsIHRoaXMuY2hlY2tTdGF0dXNUb2dnbGUpO1xuXG5cdFx0Ly8gSW5pdGlhbGl6ZSBmb3JtIHdpdGggdmFsaWRhdGlvbiBhbmQgc3VibWl0IGhhbmRsZXJzXG5cdFx0dGhpcy5pbml0aWFsaXplRm9ybSgpO1xuXHRcdHRoaXMuYmluZElwQWRkcmVzc1dhcm5pbmcoKTtcblx0XHR0aGlzLmJpbmRDZXJ0aWZpY2F0ZUlkZW50aWZpZXJDb250cm9scygpO1xuXG5cdFx0bW9kdWxlR2V0U1NMU3RhdHVzTG9vcFdvcmtlci4kcmVzdWx0QmxvY2suaGlkZSgpO1xuXG5cdFx0Ly8gUmVzdG9yZSBzYXZlZCBzdGF0ZVxuXHRcdGNvbnN0IGN1cnJlbnRDaGFsbGVuZ2UgPSB0aGlzLiRjaGFsbGVuZ2VUeXBlLmRyb3Bkb3duKCdnZXQgdmFsdWUnKSB8fCAnaHR0cCc7XG5cdFx0dGhpcy5vbkNoYW5nZUNoYWxsZW5nZVR5cGUoY3VycmVudENoYWxsZW5nZSk7XG5cdFx0dGhpcy5yZXN0b3JlU2F2ZWRDcmVkZW50aWFscygpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBDaGVjayB3aGV0aGVyIGEgdmFsdWUgaXMgYSB2YWxpZCBJUHY0IG9yIElQdjYgYWRkcmVzcy5cblx0ICogQHBhcmFtIHtzdHJpbmd9IHZhbHVlXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxuXHQgKi9cblx0aXNJcEFkZHJlc3ModmFsdWUpIHtcblx0XHRjb25zdCBhZGRyZXNzID0gU3RyaW5nKHZhbHVlIHx8ICcnKS50cmltKCk7XG5cdFx0Y29uc3QgaXB2NFBhcnRzID0gYWRkcmVzcy5zcGxpdCgnLicpO1xuXHRcdGlmIChpcHY0UGFydHMubGVuZ3RoID09PSA0KSB7XG5cdFx0XHRyZXR1cm4gaXB2NFBhcnRzLmV2ZXJ5KHBhcnQgPT4gL15cXGR7MSwzfSQvLnRlc3QocGFydClcblx0XHRcdFx0JiYgTnVtYmVyKHBhcnQpIDw9IDI1NVxuXHRcdFx0XHQmJiAocGFydCA9PT0gJzAnIHx8IHBhcnRbMF0gIT09ICcwJykpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGhhc09wZW5pbmdCcmFja2V0ID0gYWRkcmVzcy5zdGFydHNXaXRoKCdbJyk7XG5cdFx0Y29uc3QgaGFzQ2xvc2luZ0JyYWNrZXQgPSBhZGRyZXNzLmVuZHNXaXRoKCddJyk7XG5cdFx0aWYgKGhhc09wZW5pbmdCcmFja2V0ICE9PSBoYXNDbG9zaW5nQnJhY2tldCkgcmV0dXJuIGZhbHNlO1xuXHRcdGNvbnN0IGlwdjYgPSBoYXNPcGVuaW5nQnJhY2tldCA/IGFkZHJlc3Muc2xpY2UoMSwgLTEpIDogYWRkcmVzcztcblx0XHRpZiAoIWlwdjYuaW5jbHVkZXMoJzonKSB8fCAvXFxzLy50ZXN0KGlwdjYpKSByZXR1cm4gZmFsc2U7XG5cdFx0dHJ5IHtcblx0XHRcdG5ldyBVUkwoYGh0dHA6Ly9bJHtpcHY2fV0vYCk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKiBSZXR1cm4gdHJ1ZSBvbmx5IGZvciBhIHB1YmxpY2x5IHJvdXRhYmxlIElQdjQgb3IgSVB2NiBhZGRyZXNzLiAqL1xuXHRpc1B1YmxpY0lwQWRkcmVzcyh2YWx1ZSkge1xuXHRcdGlmICghdGhpcy5pc0lwQWRkcmVzcyh2YWx1ZSkpIHJldHVybiBmYWxzZTtcblx0XHRjb25zdCBhZGRyZXNzID0gU3RyaW5nKHZhbHVlIHx8ICcnKS50cmltKCkucmVwbGFjZSgvXlxcW3xcXF0kL2csICcnKS50b0xvd2VyQ2FzZSgpO1xuXHRcdGNvbnN0IGlwdjRQYXJ0cyA9IGFkZHJlc3Muc3BsaXQoJy4nKS5tYXAoTnVtYmVyKTtcblx0XHRpZiAoaXB2NFBhcnRzLmxlbmd0aCA9PT0gNCkge1xuXHRcdFx0Y29uc3QgW2EsIGIsIGNdID0gaXB2NFBhcnRzO1xuXHRcdFx0cmV0dXJuICEoYSA9PT0gMCB8fCBhID09PSAxMCB8fCBhID09PSAxMjcgfHwgYSA+PSAyMjRcblx0XHRcdFx0fHwgKGEgPT09IDEwMCAmJiBiID49IDY0ICYmIGIgPD0gMTI3KVxuXHRcdFx0XHR8fCAoYSA9PT0gMTY5ICYmIGIgPT09IDI1NClcblx0XHRcdFx0fHwgKGEgPT09IDE3MiAmJiBiID49IDE2ICYmIGIgPD0gMzEpXG5cdFx0XHRcdHx8IChhID09PSAxOTIgJiYgYiA9PT0gMCAmJiAoYyA9PT0gMCB8fCBjID09PSAyKSlcblx0XHRcdFx0fHwgKGEgPT09IDE5MiAmJiBiID09PSAxNjgpXG5cdFx0XHRcdHx8IChhID09PSAxOTggJiYgKGIgPT09IDE4IHx8IGIgPT09IDE5KSlcblx0XHRcdFx0fHwgKGEgPT09IDE5OCAmJiBiID09PSA1MSAmJiBjID09PSAxMDApXG5cdFx0XHRcdHx8IChhID09PSAyMDMgJiYgYiA9PT0gMCAmJiBjID09PSAxMTMpKTtcblx0XHR9XG5cdFx0cmV0dXJuICEoYWRkcmVzcyA9PT0gJzo6JyB8fCBhZGRyZXNzID09PSAnOjoxJ1xuXHRcdFx0fHwgYWRkcmVzcy5zdGFydHNXaXRoKCdmYycpIHx8IGFkZHJlc3Muc3RhcnRzV2l0aCgnZmQnKVxuXHRcdFx0fHwgL15mZVs4OWFiXS8udGVzdChhZGRyZXNzKSB8fCBhZGRyZXNzLnN0YXJ0c1dpdGgoJzIwMDE6ZGI4OicpKTtcblx0fSxcblxuXHQvKiogVXBkYXRlIHdhcm5pbmcgdmlzaWJpbGl0eSB3aGVuIHRoZSBjb25maWd1cmVkIGFkZHJlc3MgY2hhbmdlcy4gKi9cblx0dXBkYXRlSXBBZGRyZXNzV2FybmluZygpIHtcblx0XHRpZiAodGhpcy5pc0lwQWRkcmVzcyh0aGlzLiRkb21haW5OYW1lLnZhbCgpKSkge1xuXHRcdFx0dGhpcy4kaXBBZGRyZXNzV2FybmluZy5zaG93KCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuJGlwQWRkcmVzc1dhcm5pbmcuaGlkZSgpO1xuXHRcdH1cblx0fSxcblxuXHQvKiogQmluZCByZWFjdGl2ZSBJUCB3YXJuaW5nIGJlaGF2aW9yIGFuZCBpbml0aWFsaXplIGl0cyBzdGF0ZS4gKi9cblx0YmluZElwQWRkcmVzc1dhcm5pbmcoKSB7XG5cdFx0dGhpcy4kZG9tYWluTmFtZS5vbignaW5wdXQnLCAoKSA9PiB0aGlzLnVwZGF0ZUlwQWRkcmVzc1dhcm5pbmcoKSk7XG5cdFx0dGhpcy51cGRhdGVJcEFkZHJlc3NXYXJuaW5nKCk7XG5cdH0sXG5cblx0LyoqIEFwcGx5IHZpc2liaWxpdHkgYW5kIGNvbXBhdGliaWxpdHkgcnVsZXMgZm9yIGRvbWFpbi9JUCBjZXJ0aWZpY2F0ZSBpZGVudGlmaWVycy4gKi9cblx0dXBkYXRlQ2VydGlmaWNhdGVJZGVudGlmaWVyQ29udHJvbHMoKSB7XG5cdFx0Y29uc3QgcHJpbWFyeSA9IFN0cmluZyh0aGlzLiRkb21haW5OYW1lLnZhbCgpIHx8ICcnKS50cmltKCk7XG5cdFx0Y29uc3QgcHJpbWFyeUlzSXAgPSB0aGlzLmlzSXBBZGRyZXNzKHByaW1hcnkpO1xuXHRcdGNvbnN0IGNhbkluY2x1ZGVJcCA9IHByaW1hcnkgIT09ICcnICYmICFwcmltYXJ5SXNJcDtcblx0XHRpZiAocHJpbWFyeUlzSXAgJiYgdGhpcy4kaW5jbHVkZUlwQWRkcmVzcy5pcygnOmNoZWNrZWQnKSkge1xuXHRcdFx0dGhpcy4kaW5jbHVkZUlwQWRkcmVzcy5wcm9wKCdjaGVja2VkJywgZmFsc2UpO1xuXHRcdFx0dGhpcy4kaW5jbHVkZUlwQWRkcmVzc0NoZWNrYm94LmNoZWNrYm94KCd1bmNoZWNrJyk7XG5cdFx0fVxuXHRcdGNvbnN0IGluY2x1ZGVJcCA9IGNhbkluY2x1ZGVJcCAmJiB0aGlzLiRpbmNsdWRlSXBBZGRyZXNzLmlzKCc6Y2hlY2tlZCcpO1xuXHRcdGlmIChpbmNsdWRlSXAgJiYgIVN0cmluZyh0aGlzLiRwdWJsaWNJcEFkZHJlc3MudmFsKCkgfHwgJycpLnRyaW0oKVxuXHRcdFx0JiYgdHlwZW9mIHN1Z2dlc3RlZFB1YmxpY0lwID09PSAnc3RyaW5nJyAmJiB0aGlzLmlzUHVibGljSXBBZGRyZXNzKHN1Z2dlc3RlZFB1YmxpY0lwKSkge1xuXHRcdFx0dGhpcy4kcHVibGljSXBBZGRyZXNzLnZhbChzdWdnZXN0ZWRQdWJsaWNJcCk7XG5cdFx0fVxuXG5cdFx0dGhpcy4kaW5jbHVkZUlwQWRkcmVzc0ZpZWxkLnRvZ2dsZShjYW5JbmNsdWRlSXApO1xuXHRcdHRoaXMuJHB1YmxpY0lwQWRkcmVzc1NldHRpbmdzLnRvZ2dsZShpbmNsdWRlSXApO1xuXG5cdFx0aWYgKHByaW1hcnlJc0lwIHx8IGluY2x1ZGVJcCkge1xuXHRcdFx0dGhpcy4kY2hhbGxlbmdlVHlwZS5kcm9wZG93bignc2V0IHNlbGVjdGVkJywgJ2h0dHAnKS5kcm9wZG93bignc2V0IGRpc2FibGVkJyk7XG5cdFx0XHR0aGlzLiRhdXRvVXBkYXRlLnByb3AoJ2NoZWNrZWQnLCB0cnVlKS5wcm9wKCdkaXNhYmxlZCcsIHRydWUpO1xuXHRcdFx0dGhpcy4kYXV0b1VwZGF0ZUNoZWNrYm94LmNoZWNrYm94KCdjaGVjaycpLmNoZWNrYm94KCdzZXQgZGlzYWJsZWQnKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy4kY2hhbGxlbmdlVHlwZS5kcm9wZG93bignc2V0IGVuYWJsZWQnKTtcblx0XHRcdHRoaXMuJGF1dG9VcGRhdGUucHJvcCgnZGlzYWJsZWQnLCBmYWxzZSk7XG5cdFx0XHR0aGlzLiRhdXRvVXBkYXRlQ2hlY2tib3guY2hlY2tib3goJ3NldCBlbmFibGVkJyk7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKiBCaW5kIGNoYW5nZXMgYWZmZWN0aW5nIHRoZSByZXF1ZXN0ZWQgY2VydGlmaWNhdGUgaWRlbnRpZmllciBsaXN0LiAqL1xuXHRiaW5kQ2VydGlmaWNhdGVJZGVudGlmaWVyQ29udHJvbHMoKSB7XG5cdFx0dGhpcy4kZG9tYWluTmFtZS5vbignaW5wdXQnLCAoKSA9PiB0aGlzLnVwZGF0ZUNlcnRpZmljYXRlSWRlbnRpZmllckNvbnRyb2xzKCkpO1xuXHRcdHRoaXMuJGluY2x1ZGVJcEFkZHJlc3NDaGVja2JveC5jaGVja2JveCh7XG5cdFx0XHRvbkNoYW5nZTogKCkgPT4gdGhpcy51cGRhdGVDZXJ0aWZpY2F0ZUlkZW50aWZpZXJDb250cm9scygpLFxuXHRcdH0pO1xuXHRcdHRoaXMudXBkYXRlQ2VydGlmaWNhdGVJZGVudGlmaWVyQ29udHJvbHMoKTtcblx0fSxcblxuXHQvKiogVmFsaWRhdGUgdGhlIG9wdGlvbmFsIGFkZGl0aW9uYWwgcHVibGljIElQIGFkZHJlc3MuICovXG5cdHZhbGlkYXRlUHVibGljSXBBZGRyZXNzKCkge1xuXHRcdGNvbnN0IHByaW1hcnlJc0lwID0gdGhpcy5pc0lwQWRkcmVzcyh0aGlzLiRkb21haW5OYW1lLnZhbCgpKTtcblx0XHRpZiAocHJpbWFyeUlzSXAgfHwgIXRoaXMuJGluY2x1ZGVJcEFkZHJlc3MuaXMoJzpjaGVja2VkJykpIHJldHVybiB0cnVlO1xuXHRcdGlmICh0aGlzLmlzUHVibGljSXBBZGRyZXNzKHRoaXMuJHB1YmxpY0lwQWRkcmVzcy52YWwoKSkpIHJldHVybiB0cnVlO1xuXHRcdFVzZXJNZXNzYWdlLnNob3dFcnJvcihnbG9iYWxUcmFuc2xhdGUubW9kdWxlX2dldHNzbF9QdWJsaWNJcEFkZHJlc3NJbnZhbGlkKTtcblx0XHR0aGlzLiRwdWJsaWNJcEFkZHJlc3MuY2xvc2VzdCgnLmZpZWxkJykuYWRkQ2xhc3MoJ2Vycm9yJyk7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBIYW5kbGUgY2hhbGxlbmdlIHR5cGUgY2hhbmdlOiBzaG93L2hpZGUgcmVsZXZhbnQgc2VjdGlvbnMuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB2YWx1ZSAtICdodHRwJyBvciAnZG5zJ1xuXHQgKi9cblx0b25DaGFuZ2VDaGFsbGVuZ2VUeXBlKHZhbHVlKSB7XG5cdFx0aWYgKHZhbHVlID09PSAnZG5zJykge1xuXHRcdFx0TW9kdWxlR2V0U3NsLiRodHRwQ2hhbGxlbmdlSW5mby5oaWRlKCk7XG5cdFx0XHRNb2R1bGVHZXRTc2wuJGRuc1NldHRpbmdzQmxvY2suc2hvdygpO1xuXHRcdFx0Ly8gVHJpZ2dlciBwcm92aWRlciBjaGFuZ2UgdG8gcmVuZGVyIGNyZWRlbnRpYWwgZmllbGRzXG5cdFx0XHRjb25zdCBjdXJyZW50UHJvdmlkZXIgPSBNb2R1bGVHZXRTc2wuJGRuc1Byb3ZpZGVyLmRyb3Bkb3duKCdnZXQgdmFsdWUnKTtcblx0XHRcdGlmIChjdXJyZW50UHJvdmlkZXIpIHtcblx0XHRcdFx0TW9kdWxlR2V0U3NsLm9uQ2hhbmdlRG5zUHJvdmlkZXIoY3VycmVudFByb3ZpZGVyKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0TW9kdWxlR2V0U3NsLiRodHRwQ2hhbGxlbmdlSW5mby5zaG93KCk7XG5cdFx0XHRNb2R1bGVHZXRTc2wuJGRuc1NldHRpbmdzQmxvY2suaGlkZSgpO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogSGFuZGxlIEROUyBwcm92aWRlciBjaGFuZ2U6IGR5bmFtaWNhbGx5IHJlbmRlciBjcmVkZW50aWFsIGZpZWxkcy5cblx0ICogQHBhcmFtIHtzdHJpbmd9IHZhbHVlIC0gcHJvdmlkZXIgSUQgKGUuZy4gJ2Ruc19jZicpXG5cdCAqL1xuXHRvbkNoYW5nZURuc1Byb3ZpZGVyKHZhbHVlKSB7XG5cdFx0Y29uc3QgJGNvbnRhaW5lciA9IE1vZHVsZUdldFNzbC4kZG5zQ3JlZGVudGlhbHNGaWVsZHM7XG5cdFx0JGNvbnRhaW5lci5lbXB0eSgpO1xuXG5cdFx0aWYgKCF2YWx1ZSB8fCB0eXBlb2YgZG5zUHJvdmlkZXJzTWV0YSA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBGaW5kIHByb3ZpZGVyIG1ldGFkYXRhXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBkbnNQcm92aWRlcnNNZXRhLmZpbmQocCA9PiBwLmlkID09PSB2YWx1ZSk7XG5cdFx0aWYgKCFwcm92aWRlciB8fCAhcHJvdmlkZXIuZmllbGRzKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gRGVjb2RlIGV4aXN0aW5nIHNhdmVkIGNyZWRlbnRpYWxzIGZvciBwcmUtZmlsbGluZ1xuXHRcdGxldCBzYXZlZENyZWRzID0ge307XG5cdFx0Y29uc3QgZW5jb2RlZFZhbCA9IE1vZHVsZUdldFNzbC4kZG5zQ3JlZGVudGlhbHNJbnB1dC52YWwoKTtcblx0XHRpZiAoZW5jb2RlZFZhbCkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgZGVjb2RlZCA9IGF0b2IoZW5jb2RlZFZhbCk7XG5cdFx0XHRcdHNhdmVkQ3JlZHMgPSBKU09OLnBhcnNlKGRlY29kZWQpO1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHQvLyBpZ25vcmUgZGVjb2RlIGVycm9yc1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFJlbmRlciBmaWVsZHNcblx0XHRwcm92aWRlci5maWVsZHMuZm9yRWFjaChmaWVsZCA9PiB7XG5cdFx0XHRjb25zdCBoYXNTYXZlZCA9IEJvb2xlYW4oc2F2ZWRDcmVkc1tmaWVsZC52YXJdKTtcblx0XHRcdGNvbnN0IGRpc3BsYXlWYWx1ZSA9IGhhc1NhdmVkID8gJ+KAouKAouKAouKAouKAouKAouKAouKAoicgOiAnJztcblx0XHRcdGNvbnN0IG1hc2tlZEF0dHIgPSBoYXNTYXZlZCA/ICdkYXRhLW1hc2tlZD1cInRydWVcIicgOiAnJztcblx0XHRcdGNvbnN0IGh0bWwgPSBgXG5cdFx0XHRcdDxkaXYgY2xhc3M9XCJmaWVsZFwiPlxuXHRcdFx0XHRcdDxsYWJlbD4ke2ZpZWxkLmxhYmVsfTwvbGFiZWw+XG5cdFx0XHRcdFx0PGlucHV0IHR5cGU9XCJwYXNzd29yZFwiXG5cdFx0XHRcdFx0XHQgICBjbGFzcz1cImRucy1jcmVkLWlucHV0XCJcblx0XHRcdFx0XHRcdCAgIGRhdGEtdmFyPVwiJHtmaWVsZC52YXJ9XCJcblx0XHRcdFx0XHRcdCAgICR7bWFza2VkQXR0cn1cblx0XHRcdFx0XHRcdCAgIHZhbHVlPVwiJHtNb2R1bGVHZXRTc2wuZXNjYXBlSHRtbChkaXNwbGF5VmFsdWUpfVwiXG5cdFx0XHRcdFx0XHQgICBwbGFjZWhvbGRlcj1cIiR7ZmllbGQubGFiZWx9XCI+XG5cdFx0XHRcdDwvZGl2PmA7XG5cdFx0XHQkY29udGFpbmVyLmFwcGVuZChodG1sKTtcblx0XHR9KTtcblx0XHQvLyBPbiBmb2N1czogY2xlYXIgbWFzayBzbyB1c2VyIGNhbiBlbnRlciBuZXcgdmFsdWVcblx0XHQkY29udGFpbmVyLm9uKCdmb2N1cycsICcuZG5zLWNyZWQtaW5wdXRbZGF0YS1tYXNrZWRdJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0JCh0aGlzKS52YWwoJycpLnJlbW92ZUF0dHIoJ2RhdGEtbWFza2VkJyk7XG5cdFx0fSk7XG5cdFx0Ly8gQ2xlYXIgZXJyb3IgaGlnaGxpZ2h0IHdoZW4gdXNlciBzdGFydHMgdHlwaW5nXG5cdFx0JGNvbnRhaW5lci5vbignaW5wdXQnLCAnLmRucy1jcmVkLWlucHV0JywgZnVuY3Rpb24gKCkge1xuXHRcdFx0JCh0aGlzKS5jbG9zZXN0KCcuZmllbGQnKS5yZW1vdmVDbGFzcygnZXJyb3InKTtcblx0XHR9KTtcblx0fSxcblxuXHQvKipcblx0ICogQ29sbGVjdCBETlMgY3JlZGVudGlhbCBmaWVsZCB2YWx1ZXMgaW50byBiYXNlNjQgSlNPTiBhbmQgd3JpdGUgdG8gaGlkZGVuIGlucHV0LlxuXHQgKiBNYXNrZWQgZmllbGRzICh1bmNoYW5nZWQpIGFyZSByZXN0b3JlZCBmcm9tIHRoZSBwcmV2aW91c2x5IHNhdmVkIGNyZWRlbnRpYWxzLlxuXHQgKi9cblx0Y29sbGVjdERuc0NyZWRlbnRpYWxzKCkge1xuXHRcdGNvbnN0IGNoYWxsZW5nZVR5cGUgPSBNb2R1bGVHZXRTc2wuJGNoYWxsZW5nZVR5cGUuZHJvcGRvd24oJ2dldCB2YWx1ZScpO1xuXHRcdGlmIChjaGFsbGVuZ2VUeXBlICE9PSAnZG5zJykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHQvLyBEZWNvZGUgY3VycmVudGx5IHN0b3JlZCBjcmVkZW50aWFscyAoc291cmNlIG9mIHRydXRoIGZvciBtYXNrZWQgZmllbGRzKVxuXHRcdGxldCBzYXZlZENyZWRzID0ge307XG5cdFx0Y29uc3QgZW5jb2RlZFZhbCA9IE1vZHVsZUdldFNzbC4kZG5zQ3JlZGVudGlhbHNJbnB1dC52YWwoKTtcblx0XHRpZiAoZW5jb2RlZFZhbCkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0c2F2ZWRDcmVkcyA9IEpTT04ucGFyc2UoYXRvYihlbmNvZGVkVmFsKSk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdC8vIGlnbm9yZVxuXHRcdFx0fVxuXHRcdH1cblx0XHRjb25zdCBjcmVkcyA9IHt9O1xuXHRcdCQoJy5kbnMtY3JlZC1pbnB1dCcpLmVhY2goZnVuY3Rpb24gKCkge1xuXHRcdFx0Y29uc3QgdmFyTmFtZSA9ICQodGhpcykuZGF0YSgndmFyJyk7XG5cdFx0XHRpZiAoIXZhck5hbWUpIHJldHVybjtcblx0XHRcdGlmICgkKHRoaXMpLmlzKCdbZGF0YS1tYXNrZWRdJykpIHtcblx0XHRcdFx0Ly8gVXNlciBkaWRuJ3QgY2hhbmdlIHRoaXMgZmllbGQg4oCUIGtlZXAgc3RvcmVkIHZhbHVlXG5cdFx0XHRcdGlmIChzYXZlZENyZWRzW3Zhck5hbWVdKSB7XG5cdFx0XHRcdFx0Y3JlZHNbdmFyTmFtZV0gPSBzYXZlZENyZWRzW3Zhck5hbWVdO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCB2YWwgPSAkKHRoaXMpLnZhbCgpO1xuXHRcdFx0XHRpZiAodmFsKSB7XG5cdFx0XHRcdFx0Y3JlZHNbdmFyTmFtZV0gPSB2YWw7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0XHRNb2R1bGVHZXRTc2wuJGRuc0NyZWRlbnRpYWxzSW5wdXQudmFsKGJ0b2EoSlNPTi5zdHJpbmdpZnkoY3JlZHMpKSk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJlc3RvcmUgc2F2ZWQgY3JlZGVudGlhbHMgaW50byB0aGUgRE5TIHByb3ZpZGVyIGZpZWxkcyBvbiBwYWdlIGxvYWQuXG5cdCAqL1xuXHRyZXN0b3JlU2F2ZWRDcmVkZW50aWFscygpIHtcblx0XHRjb25zdCBjdXJyZW50UHJvdmlkZXIgPSBNb2R1bGVHZXRTc2wuJGRuc1Byb3ZpZGVyLmRyb3Bkb3duKCdnZXQgdmFsdWUnKTtcblx0XHRpZiAoY3VycmVudFByb3ZpZGVyKSB7XG5cdFx0XHRNb2R1bGVHZXRTc2wub25DaGFuZ2VEbnNQcm92aWRlcihjdXJyZW50UHJvdmlkZXIpO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogRXNjYXBlIEhUTUwgc3BlY2lhbCBjaGFyYWN0ZXJzIGZvciBzYWZlIGluc2VydGlvbiBpbnRvIGF0dHJpYnV0ZXMuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0XG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9XG5cdCAqL1xuXHRlc2NhcGVIdG1sKHRleHQpIHtcblx0XHRjb25zdCBtYXAgPSB7ICcmJzogJyZhbXA7JywgJzwnOiAnJmx0OycsICc+JzogJyZndDsnLCAnXCInOiAnJnF1b3Q7JywgXCInXCI6ICcmIzAzOTsnIH07XG5cdFx0cmV0dXJuIFN0cmluZyh0ZXh0KS5yZXBsYWNlKC9bJjw+XCInXS9nLCBtID0+IG1hcFttXSk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJlcXVlc3QgYW4gU1NMIGNlcnRpZmljYXRlIGJ5IGNhbGxpbmcgdGhlIHNlcnZlci1zaWRlIEFQSS5cblx0ICovXG5cdGdldFNzbCgpIHtcblx0XHQkLmFwaSh7XG5cdFx0XHR1cmw6IGAke0NvbmZpZy5wYnhVcmx9L3BieGNvcmUvYXBpL21vZHVsZXMvJHtjbGFzc05hbWV9L2dldC1jZXJ0YCxcblx0XHRcdG9uOiAnbm93Jyxcblx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0YmVmb3JlWEhSKHhocikge1xuXHRcdFx0XHR4aHIuc2V0UmVxdWVzdEhlYWRlciAoJ1gtQXN5bmMtUmVzcG9uc2UtQ2hhbm5lbC1JZCcsIG1vZHVsZUdldFNTTFN0YXR1c0xvb3BXb3JrZXIuY2hhbm5lbElkKTtcblx0XHRcdFx0eGhyLnNldFJlcXVlc3RIZWFkZXIgKCdYLVByb2Nlc3Nvci1UaW1lb3V0JywgJzEyMCcpO1xuXHRcdFx0XHRyZXR1cm4geGhyO1xuXHRcdFx0fSxcblx0XHRcdGJlZm9yZVNlbmQoc2V0dGluZ3MpIHtcblx0XHRcdFx0TW9kdWxlR2V0U3NsLiRzdWJtaXRCdXR0b24uYWRkQ2xhc3MoJ2xvYWRpbmcgZGlzYWJsZWQnKTtcblx0XHRcdFx0bW9kdWxlR2V0U1NMU3RhdHVzTG9vcFdvcmtlci4kcmVzdWx0QmxvY2suc2hvdygpO1xuXHRcdFx0XHRtb2R1bGVHZXRTU0xTdGF0dXNMb29wV29ya2VyLmVkaXRvci5nZXRTZXNzaW9uKCkuc2V0VmFsdWUoXG5cdFx0XHRcdGdsb2JhbFRyYW5zbGF0ZS5tb2R1bGVfZ2V0c3NsX0dldFNTTFByb2Nlc3NpbmcgKyAnXFxuJ1xuXHRcdFx0KTtcblx0XHRcdFx0cmV0dXJuIHNldHRpbmdzO1xuXHRcdFx0fSxcblx0XHRcdHN1Y2Nlc3NUZXN0OiBQYnhBcGkuc3VjY2Vzc1Rlc3QsXG5cdFx0XHRvblN1Y2Nlc3M6IGZ1bmN0aW9uIChyZXNwb25zZSkge1xuXHRcdFx0XHRNb2R1bGVHZXRTc2wuJHN1Ym1pdEJ1dHRvbi5yZW1vdmVDbGFzcygnbG9hZGluZyBkaXNhYmxlZCcpO1xuXHRcdFx0fSxcblx0XHRcdG9uRmFpbHVyZTogZnVuY3Rpb24ocmVzcG9uc2UpIHtcblx0XHRcdFx0TW9kdWxlR2V0U3NsLiRzdWJtaXRCdXR0b24ucmVtb3ZlQ2xhc3MoJ2xvYWRpbmcgZGlzYWJsZWQnKTtcblx0XHRcdFx0VXNlck1lc3NhZ2Uuc2hvd011bHRpU3RyaW5nKHJlc3BvbnNlLm1lc3NhZ2UpO1xuXHRcdFx0fSxcblx0XHR9KVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBUb2dnbGVzIHRoZSBmb3JtIGZpZWxkcyBhbmQgc3RhdHVzIHZpc2liaWxpdHkgYmFzZWQgb24gdGhlIG1vZHVsZSdzIHN0YXR1cy5cblx0ICovXG5cdGNoZWNrU3RhdHVzVG9nZ2xlKCkge1xuXHRcdGlmIChNb2R1bGVHZXRTc2wuJHN0YXR1c1RvZ2dsZS5jaGVja2JveCgnaXMgY2hlY2tlZCcpKSB7XG5cdFx0XHRNb2R1bGVHZXRTc2wuJGRpc2FiaWxpdHlGaWVsZHMucmVtb3ZlQ2xhc3MoJ2Rpc2FibGVkJyk7XG5cdFx0XHRNb2R1bGVHZXRTc2wuJG1vZHVsZVN0YXR1cy5zaG93KCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdE1vZHVsZUdldFNzbC4kZGlzYWJpbGl0eUZpZWxkcy5hZGRDbGFzcygnZGlzYWJsZWQnKTtcblx0XHRcdE1vZHVsZUdldFNzbC4kbW9kdWxlU3RhdHVzLmhpZGUoKTtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIFZhbGlkYXRlIEROUyBwcm92aWRlciBhbmQgY3JlZGVudGlhbHMgd2hlbiBETlMtMDEgaXMgc2VsZWN0ZWQuXG5cdCAqIFJldHVybnMgdHJ1ZSBpZiB2YWxpZCwgZmFsc2Ugb3RoZXJ3aXNlLlxuXHQgKi9cblx0dmFsaWRhdGVEbnNGaWVsZHMoKSB7XG5cdFx0aWYgKE1vZHVsZUdldFNzbC4kY2hhbGxlbmdlVHlwZS5kcm9wZG93bignZ2V0IHZhbHVlJykgIT09ICdkbnMnKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKCFNb2R1bGVHZXRTc2wuJGRuc1Byb3ZpZGVyLmRyb3Bkb3duKCdnZXQgdmFsdWUnKSkge1xuXHRcdFx0VXNlck1lc3NhZ2Uuc2hvd0Vycm9yKGdsb2JhbFRyYW5zbGF0ZS5tb2R1bGVfZ2V0c3NsX0Ruc1Byb3ZpZGVyRW1wdHkpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRsZXQgaGFzRW1wdHkgPSBmYWxzZTtcblx0XHQkKCcuZG5zLWNyZWQtaW5wdXQnKS5lYWNoKGZ1bmN0aW9uICgpIHtcblx0XHRcdGNvbnN0ICRmaWVsZCA9ICQodGhpcykuY2xvc2VzdCgnLmZpZWxkJyk7XG5cdFx0XHRjb25zdCBpc01hc2tlZCA9ICQodGhpcykuaXMoJ1tkYXRhLW1hc2tlZF0nKTtcblx0XHRcdGlmICghaXNNYXNrZWQgJiYgISQodGhpcykudmFsKCkudHJpbSgpKSB7XG5cdFx0XHRcdCRmaWVsZC5hZGRDbGFzcygnZXJyb3InKTtcblx0XHRcdFx0aGFzRW1wdHkgPSB0cnVlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0JGZpZWxkLnJlbW92ZUNsYXNzKCdlcnJvcicpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGlmIChoYXNFbXB0eSkge1xuXHRcdFx0VXNlck1lc3NhZ2Uuc2hvd0Vycm9yKGdsb2JhbFRyYW5zbGF0ZS5tb2R1bGVfZ2V0c3NsX0Ruc0NyZWRlbnRpYWxzRW1wdHkpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fSxcblxuXHQvKipcblx0ICogQ2FsbGJhY2sgYmVmb3JlIHNlbmRpbmcgdGhlIGZvcm0uXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBzZXR0aW5ncyAtIEFqYXggcmVxdWVzdCBzZXR0aW5ncy5cblx0ICogQHJldHVybnMge09iamVjdH0gVGhlIG1vZGlmaWVkIEFqYXggcmVxdWVzdCBzZXR0aW5ncy5cblx0ICovXG5cdGNiQmVmb3JlU2VuZEZvcm0oc2V0dGluZ3MpIHtcblx0XHRpZiAoIU1vZHVsZUdldFNzbC52YWxpZGF0ZVB1YmxpY0lwQWRkcmVzcygpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmICghTW9kdWxlR2V0U3NsLnZhbGlkYXRlRG5zRmllbGRzKCkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0Y29uc3QgcmVzdWx0ID0gc2V0dGluZ3M7XG5cdFx0Ly8gQ29sbGVjdCBETlMgY3JlZGVudGlhbHMgaW50byBoaWRkZW4gZmllbGQgYmVmb3JlIGZvcm0gc3VibWlzc2lvblxuXHRcdE1vZHVsZUdldFNzbC5jb2xsZWN0RG5zQ3JlZGVudGlhbHMoKTtcblx0XHRyZXN1bHQuZGF0YSA9IE1vZHVsZUdldFNzbC4kZm9ybU9iai5mb3JtKCdnZXQgdmFsdWVzJyk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fSxcblxuXHQvKipcblx0ICogQ2FsbGJhY2sgZnVuY3Rpb24gYWZ0ZXIgc2VuZGluZyB0aGUgZm9ybS5cblx0ICovXG5cdGNiQWZ0ZXJTZW5kRm9ybShyZXNwb25zZSkge1xuXHRcdGlmIChGb3JtLmNoZWNrU3VjY2VzcyhyZXNwb25zZSkpe1xuXHRcdFx0TW9kdWxlR2V0U3NsLmdldFNzbCgpO1xuXHRcdH1cblx0fSxcblxuXG5cdC8qKlxuXHQgKiBJbml0aWFsaXplcyB0aGUgZm9ybSB2YWxpZGF0aW9uIGFuZCBzdWJtaXNzaW9uIGxvZ2ljLlxuXHQgKi9cblx0aW5pdGlhbGl6ZUZvcm0oKSB7XG5cdFx0Rm9ybS4kZm9ybU9iaiA9IE1vZHVsZUdldFNzbC4kZm9ybU9iajtcblx0XHRGb3JtLnVybCA9IGAke2dsb2JhbFJvb3RVcmx9JHtpZFVybH0vJHtpZFVybH0vc2F2ZWA7XG5cdFx0Rm9ybS52YWxpZGF0ZVJ1bGVzID0gTW9kdWxlR2V0U3NsLnZhbGlkYXRlUnVsZXM7XG5cdFx0Rm9ybS5lbmFibGVEaXJyaXR5ID0gZmFsc2U7XG5cdFx0Rm9ybS5jYkFmdGVyU2VuZEZvcm0gPSBNb2R1bGVHZXRTc2wuY2JBZnRlclNlbmRGb3JtO1xuXHRcdEZvcm0uY2JCZWZvcmVTZW5kRm9ybSA9IE1vZHVsZUdldFNzbC5jYkJlZm9yZVNlbmRGb3JtO1xuXHRcdEZvcm0uaW5pdGlhbGl6ZSgpO1xuXHR9LFxufTtcblxuLy8gSW5pdGlhbGl6ZSB0aGUgTW9kdWxlR2V0U3NsIGNsYXNzIHdoZW4gdGhlIGRvY3VtZW50IGlzIHJlYWR5XG4kKGRvY3VtZW50KS5yZWFkeSgoKSA9PiB7XG5cdE1vZHVsZUdldFNzbC5pbml0aWFsaXplKCk7XG59KTtcbiJdLCJtYXBwaW5ncyI6IkFBQUE7O0FBRUE7QUFDQSxNQUFNLEtBQUssR0FBTyxnQkFBZ0IsQ0FBQyxDQUFjO0FBQ2pELE1BQU0sTUFBTSxHQUFNLHFCQUFxQixDQUFDLENBQVM7QUFDakQsTUFBTSxTQUFTLEdBQUcsY0FBYyxDQUFDLENBQWdCOztBQUVqRDtBQUNBLE1BQU0sWUFBWSxHQUFHO0VBQ3BCO0VBQ0EsUUFBUSxFQUFFLENBQUMsQ0FBQyxHQUFHLEdBQUcsTUFBTSxDQUFDO0VBQ3pCLFdBQVcsRUFBRSxDQUFDLENBQUMsR0FBRyxHQUFHLE1BQU0sR0FBRyxlQUFlLENBQUM7RUFDOUMsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDLEdBQUcsR0FBRyxNQUFNLEdBQUcsY0FBYyxDQUFDO0VBQ25ELGFBQWEsRUFBRSxDQUFDLENBQUMsdUJBQXVCLENBQUM7RUFDekMsYUFBYSxFQUFFLENBQUMsQ0FBQyxlQUFlLENBQUM7RUFDakMsYUFBYSxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUM7RUFDM0IsV0FBVyxFQUFFLENBQUMsQ0FBQyxhQUFhLENBQUM7RUFDN0Is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