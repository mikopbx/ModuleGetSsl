/* global globalRootUrl, globalTranslate, Form, Config, PbxApi, dnsProvidersMeta, suggestedPublicIp */

// Constants related to the form and module
const idUrl     = 'module-get-ssl';              // API endpoint for SSL module
const idForm    = 'module-get-ssl-form';         // Form element ID for SSL module
const className = 'ModuleGetSsl';                // Class name for this module

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
			rules: [
				{
					type: 'empty',
					prompt: globalTranslate.module_getssl_DomainNameEmpty,
				},
			],
		},
	},

	/**
	 * Initialize the module, bind event listeners, and setup the form.
	 */
	initialize() {
		// Initialize Semantic UI checkboxes
		this.$checkBoxes.checkbox();

		// Initialize dropdowns
		this.$challengeType.dropdown({
			onChange: ModuleGetSsl.onChangeChallengeType,
		});
		this.$dnsProvider.dropdown({
			fullTextSearch: true,
			onChange: ModuleGetSsl.onChangeDnsProvider,
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
			return ipv4Parts.every(part => /^\d{1,3}$/.test(part)
				&& Number(part) <= 255
				&& (part === '0' || part[0] !== '0'));
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
			return !(a === 0 || a === 10 || a === 127 || a >= 224
				|| (a === 100 && b >= 64 && b <= 127)
				|| (a === 169 && b === 254)
				|| (a === 172 && b >= 16 && b <= 31)
				|| (a === 192 && b === 0 && (c === 0 || c === 2))
				|| (a === 192 && b === 168)
				|| (a === 198 && (b === 18 || b === 19))
				|| (a === 198 && b === 51 && c === 100)
				|| (a === 203 && b === 0 && c === 113));
		}
		return !(address === '::' || address === '::1'
			|| address.startsWith('fc') || address.startsWith('fd')
			|| /^fe[89ab]/.test(address) || address.startsWith('2001:db8:'));
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
		if (includeIp && !String(this.$publicIpAddress.val() || '').trim()
			&& typeof suggestedPublicIp === 'string' && this.isPublicIpAddress(suggestedPublicIp)) {
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
			onChange: () => this.updateCertificateIdentifierControls(),
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
		const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
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
				xhr.setRequestHeader ('X-Async-Response-Channel-Id', moduleGetSSLStatusLoopWorker.channelId);
				xhr.setRequestHeader ('X-Processor-Timeout', '120');
				return xhr;
			},
			beforeSend(settings) {
				ModuleGetSsl.$submitButton.addClass('loading disabled');
				moduleGetSSLStatusLoopWorker.$resultBlock.show();
				moduleGetSSLStatusLoopWorker.editor.getSession().setValue(
				globalTranslate.module_getssl_GetSSLProcessing + '\n'
			);
				return settings;
			},
			successTest: PbxApi.successTest,
			onSuccess: function (response) {
				// Keep button in loading state — it will be unlocked
				// by the event timeout or final stage event.
				ModuleGetSsl.scheduleButtonUnlock();
			},
			onFailure: function(response) {
				ModuleGetSsl.$submitButton.removeClass('loading disabled');
				UserMessage.showMultiString(response.message);
			},
		})
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
		if (Form.checkSuccess(response)){
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
	},
};

// Initialize the ModuleGetSsl class when the document is ready
$(document).ready(() => {
	ModuleGetSsl.initialize();
});
