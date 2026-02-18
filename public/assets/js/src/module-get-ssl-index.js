/* global globalRootUrl, globalTranslate, Form, Config, PbxApi */

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
	$intervalId: undefined, // To manage the interval for SSL status check

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
	 * This function is called when the document is ready.
	 */
	initialize() {
		// Initialize Semantic UI checkboxes
		this.$checkBoxes.checkbox();

		// Check and set module status on load and when the status changes
		this.checkStatusToggle();
		window.addEventListener('ModuleStatusChanged', this.checkStatusToggle);

		// Initialize form with validation and submit handlers
		this.initializeForm();

		moduleGetSSLStatusLoopWorker.$resultBlock.hide();
	},

	/**
	 * Request an SSL certificate by calling the server-side API.
	 * This method sends a GET request to initiate the SSL process.
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
			/**
			 * Handles the successful response of the 'get-cert' API request.
			 * @param {object} response - The response object.
			 */
			onSuccess: function (response) {
				ModuleGetSsl.$submitButton.removeClass('loading disabled');
			},
			/**
			 * Handles the failure response of the 'get-cert' API request.
			 * @param {object} response - The response object.
			 */
			onFailure: function(response) {
				ModuleGetSsl.$submitButton.removeClass('loading disabled');
				UserMessage.showMultiString(response.message);
				moduleGetSSLStatusLoopWorker.$resultBlock.hide();
			},
		})
	},

	/**
	 * Toggles the form fields and status visibility based on the module's status.
	 * Enables or disables form fields depending on whether the module is active.
	 */
	checkStatusToggle() {
		// If the module status is active, enable form fields and show status
		if (ModuleGetSsl.$statusToggle.checkbox('is checked')) {
			ModuleGetSsl.$disabilityFields.removeClass('disabled');
			ModuleGetSsl.$moduleStatus.show();
		} else {
			// If the module status is inactive, disable form fields and hide status
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
	 * Sets up callbacks and validation rules for the form.
	 */
	initializeForm() {
		// Assign form-related settings to the Form object
		Form.$formObj = ModuleGetSsl.$formObj;
		Form.url = `${globalRootUrl}${idUrl}/${idUrl}/save`;
		Form.validateRules = ModuleGetSsl.validateRules;
		Form.enableDirrity = false;
		Form.cbAfterSendForm = ModuleGetSsl.cbAfterSendForm;
		Form.cbBeforeSendForm = ModuleGetSsl.cbBeforeSendForm;
		// Initialize the form with the specified parameters
		Form.initialize();
	},
};

// Initialize the ModuleGetSsl class when the document is ready
$(document).ready(() => {
	ModuleGetSsl.initialize();
});