/* global globalRootUrl, globalTranslate, Form, Config, PbxApi, dnsProvidersMeta */

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
	$challengeType: $('#challengeType'),
	$dnsProvider: $('#dnsProvider'),
	$httpChallengeInfo: $('#http-challenge-info'),
	$dnsSettingsBlock: $('#dns-settings-block'),
	$dnsCredentialsFields: $('#dns-credentials-fields'),
	$dnsCredentialsInput: $('input[name="dnsCredentials"]'),

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

		moduleGetSSLStatusLoopWorker.$resultBlock.hide();

		// Restore saved state
		const currentChallenge = this.$challengeType.dropdown('get value') || 'http';
		this.onChangeChallengeType(currentChallenge);
		this.restoreSavedCredentials();
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
			const savedValue = savedCreds[field.var] || '';
			const inputType = field.type === 'password' ? 'password' : 'text';
			const html = `
				<div class="field">
					<label>${field.label}</label>
					<input type="${inputType}"
						   class="dns-cred-input"
						   data-var="${field.var}"
						   value="${ModuleGetSsl.escapeHtml(savedValue)}"
						   placeholder="${field.label}">
				</div>`;
			$container.append(html);
		});
	},

	/**
	 * Collect DNS credential field values into base64 JSON and write to hidden input.
	 */
	collectDnsCredentials() {
		const challengeType = ModuleGetSsl.$challengeType.dropdown('get value');
		if (challengeType !== 'dns') {
			return;
		}
		const creds = {};
		$('.dns-cred-input').each(function () {
			const varName = $(this).data('var');
			const val = $(this).val();
			if (varName && val) {
				creds[varName] = val;
			}
		});
		const json = JSON.stringify(creds);
		const encoded = btoa(json);
		ModuleGetSsl.$dnsCredentialsInput.val(encoded);
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
				moduleGetSSLStatusLoopWorker.editor.getSession().setValue('');
				return settings;
			},
			successTest: PbxApi.successTest,
			onSuccess: function (response) {
				ModuleGetSsl.$submitButton.removeClass('loading disabled');
			},
			onFailure: function(response) {
				ModuleGetSsl.$submitButton.removeClass('loading disabled');
				UserMessage.showMultiString(response.message);
				moduleGetSSLStatusLoopWorker.$resultBlock.hide();
			},
		})
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
	 * Callback before sending the form.
	 * @param {Object} settings - Ajax request settings.
	 * @returns {Object} The modified Ajax request settings.
	 */
	cbBeforeSendForm(settings) {
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
