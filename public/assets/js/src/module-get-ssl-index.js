/* global globalRootUrl, globalTranslate, Form, Config */

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

		// Attach event listener for the SSL certificate request button
		$('#get-cert').click(this.getSsl);

		// Attach event listener to close messages on close button click
		$('.message .close').on('click', function () {
			$(this).closest('.message').transition('fade');
		});
	},

	/**
	 * Request an SSL certificate by calling the server-side API.
	 * This method sends a GET request to initiate the SSL process.
	 */
	getSsl() {
		// Show the loading div and hide the result div while waiting for the server response
		$('#div-waiting').show();
		$('#div-result').hide();

		$.api({
			url: `${globalRootUrl}pbxcore/api/modules/${idUrl}/get-cert`,
			on: 'now',
			method: 'GET',
			beforeSend(settings) {
				return settings;
			},
			successTest(response){
				return response.success;
			},
			/**
			 * Handles the successful response of the 'get-available-ldap-users' API request.
			 * @param {object} response - The response object.
			 */
			onSuccess: function (response) {
				if (ModuleGetSsl.$intervalId !== undefined) {
					clearInterval(ModuleGetSsl.$intervalId);
				}
				ModuleGetSsl.$intervalId = setInterval(ModuleGetSsl.checkResult, 5000);
			},
			/**
			 * Handles the failure response of the 'get-available-ldap-users' API request.
			 * @param {object} response - The response object.
			 */
			onFailure: function(response) {
				$('#div-result-text').html(result.messages.error.replace('\n', '<br>'));
				$('#div-waiting').hide();
				$('#div-result').show();
			},
		})
	},

	/**
	 * Periodically checks the result of the SSL certificate generation.
	 * This method calls the server to check if the process is completed.
	 */
	checkResult() {
		// Send GET request to check the SSL certificate generation status
		$.api({
			url: `${globalRootUrl}pbxcore/api/modules/${idUrl}/check-result`,
			on: 'now',
			method: 'GET',
			beforeSend(settings) {
				return settings;
			},
			successTest(response){
				return response.success;
			},
			/**
			 * Handles the successful response of the 'get-available-ldap-users' API request.
			 * @param {object} response - The response object.
			 */
			onSuccess: function (response) {
				// Update the result text with the server response and stop checking
				$('#div-result-text').html(result.data.result.replace('\n', '<br>'));
				$('#div-waiting').hide();
				$('#div-result').show();
				clearInterval(ModuleGetSsl.$intervalId);
			},
			/**
			 * Handles the failure response of the 'get-available-ldap-users' API request.
			 * @param {object} response - The response object.
			 */
			onFailure: function(response) {
				$('#div-result-text').html(result.messages.error.replace('\n', '<br>'));
				$('#div-waiting').hide();
				$('#div-result').show();
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
	 * Callback executed before sending the form data.
	 * It collects form data and appends it to the request payload.
	 * @param {Object} settings - The current form settings.
	 * @returns {Object} Modified settings with form data.
	 */
	cbBeforeSendForm(settings) {
		const result = settings;
		// Get all form values and assign them to the request data
		result.data = ModuleGetSsl.$formObj.form('get values');
		return result;
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
		Form.cbBeforeSendForm = ModuleGetSsl.cbBeforeSendForm;
		Form.cbAfterSendForm = ModuleGetSsl.cbAfterSendForm;
		// Initialize the form with the specified parameters
		Form.initialize();
	},
};

// Initialize the ModuleGetSsl class when the document is ready
$(document).ready(() => {
	ModuleGetSsl.initialize();
});