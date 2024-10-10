"use strict";

/* global globalRootUrl, globalTranslate, Form, Config */
// Constants related to the form and module
var idUrl = 'module-get-ssl'; // API endpoint for SSL module

var idForm = 'module-get-ssl-form'; // Form element ID for SSL module

var className = 'ModuleGetSsl'; // Class name for this module
// Main ModuleGetSsl class definition

var ModuleGetSsl = {
  // Cache commonly used jQuery objects
  $formObj: $('#' + idForm),
  $checkBoxes: $('#' + idForm + ' .ui.checkbox'),
  $disabilityFields: $('#' + idForm + ' .disability'),
  $statusToggle: $('#module-status-toggle'),
  $moduleStatus: $('#status'),
  $intervalId: undefined,
  // To manage the interval for SSL status check
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
   * This function is called when the document is ready.
   */
  initialize: function initialize() {
    // Initialize Semantic UI checkboxes
    this.$checkBoxes.checkbox(); // Check and set module status on load and when the status changes

    this.checkStatusToggle();
    window.addEventListener('ModuleStatusChanged', this.checkStatusToggle); // Initialize form with validation and submit handlers

    this.initializeForm(); // Attach event listener for the SSL certificate request button

    $('#get-cert').click(this.getSsl); // Attach event listener to close messages on close button click

    $('.message .close').on('click', function () {
      $(this).closest('.message').transition('fade');
    });
  },

  /**
   * Request an SSL certificate by calling the server-side API.
   * This method sends a GET request to initiate the SSL process.
   */
  getSsl: function getSsl() {
    // Show the loading div and hide the result div while waiting for the server response
    $('#div-waiting').show();
    $('#div-result').hide();
    $.api({
      url: "".concat(globalRootUrl, "pbxcore/api/modules/").concat(idUrl, "/get-cert"),
      on: 'now',
      method: 'GET',
      beforeSend: function beforeSend(settings) {
        return settings;
      },
      successTest: function successTest(response) {
        return response.success;
      },

      /**
       * Handles the successful response of the 'get-available-ldap-users' API request.
       * @param {object} response - The response object.
       */
      onSuccess: function onSuccess(response) {
        if (ModuleGetSsl.$intervalId !== undefined) {
          clearInterval(ModuleGetSsl.$intervalId);
        }

        ModuleGetSsl.$intervalId = setInterval(ModuleGetSsl.checkResult, 5000);
      },

      /**
       * Handles the failure response of the 'get-available-ldap-users' API request.
       * @param {object} response - The response object.
       */
      onFailure: function onFailure(response) {
        $('#div-result-text').html(result.messages.error.replace('\n', '<br>'));
        $('#div-waiting').hide();
        $('#div-result').show();
      }
    });
  },

  /**
   * Periodically checks the result of the SSL certificate generation.
   * This method calls the server to check if the process is completed.
   */
  checkResult: function checkResult() {
    // Send GET request to check the SSL certificate generation status
    $.api({
      url: "".concat(globalRootUrl, "pbxcore/api/modules/").concat(idUrl, "/check-result"),
      on: 'now',
      method: 'GET',
      beforeSend: function beforeSend(settings) {
        return settings;
      },
      successTest: function successTest(response) {
        return response.success;
      },

      /**
       * Handles the successful response of the 'get-available-ldap-users' API request.
       * @param {object} response - The response object.
       */
      onSuccess: function onSuccess(response) {
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
      onFailure: function onFailure(response) {
        $('#div-result-text').html(result.messages.error.replace('\n', '<br>'));
        $('#div-waiting').hide();
        $('#div-result').show();
      }
    });
  },

  /**
   * Toggles the form fields and status visibility based on the module's status.
   * Enables or disables form fields depending on whether the module is active.
   */
  checkStatusToggle: function checkStatusToggle() {
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
  cbBeforeSendForm: function cbBeforeSendForm(settings) {
    var result = settings; // Get all form values and assign them to the request data

    result.data = ModuleGetSsl.$formObj.form('get values');
    return result;
  },

  /**
   * Initializes the form validation and submission logic.
   * Sets up callbacks and validation rules for the form.
   */
  initializeForm: function initializeForm() {
    // Assign form-related settings to the Form object
    Form.$formObj = ModuleGetSsl.$formObj;
    Form.url = "".concat(globalRootUrl).concat(idUrl, "/").concat(idUrl, "/save");
    Form.validateRules = ModuleGetSsl.validateRules;
    Form.cbBeforeSendForm = ModuleGetSsl.cbBeforeSendForm;
    Form.cbAfterSendForm = ModuleGetSsl.cbAfterSendForm; // Initialize the form with the specified parameters

    Form.initialize();
  }
}; // Initialize the ModuleGetSsl class when the document is ready

$(document).ready(function () {
  ModuleGetSsl.initialize();
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9tb2R1bGUtZ2V0LXNzbC1pbmRleC5qcyJdLCJuYW1lcyI6WyJpZFVybCIsImlkRm9ybSIsImNsYXNzTmFtZSIsIk1vZHVsZUdldFNzbCIsIiRmb3JtT2JqIiwiJCIsIiRjaGVja0JveGVzIiwiJGRpc2FiaWxpdHlGaWVsZHMiLCIkc3RhdHVzVG9nZ2xlIiwiJG1vZHVsZVN0YXR1cyIsIiRpbnRlcnZhbElkIiwidW5kZWZpbmVkIiwidmFsaWRhdGVSdWxlcyIsImRvbWFpbk5hbWUiLCJpZGVudGlmaWVyIiwicnVsZXMiLCJ0eXBlIiwicHJvbXB0IiwiZ2xvYmFsVHJhbnNsYXRlIiwibW9kdWxlX2dldHNzbF9Eb21haW5OYW1lRW1wdHkiLCJpbml0aWFsaXplIiwiY2hlY2tib3giLCJjaGVja1N0YXR1c1RvZ2dsZSIsIndpbmRvdyIsImFkZEV2ZW50TGlzdGVuZXIiLCJpbml0aWFsaXplRm9ybSIsImNsaWNrIiwiZ2V0U3NsIiwib24iLCJjbG9zZXN0IiwidHJhbnNpdGlvbiIsInNob3ciLCJoaWRlIiwiYXBpIiwidXJsIiwiZ2xvYmFsUm9vdFVybCIsIm1ldGhvZCIsImJlZm9yZVNlbmQiLCJzZXR0aW5ncyIsInN1Y2Nlc3NUZXN0IiwicmVzcG9uc2UiLCJzdWNjZXNzIiwib25TdWNjZXNzIiwiY2xlYXJJbnRlcnZhbCIsInNldEludGVydmFsIiwiY2hlY2tSZXN1bHQiLCJvbkZhaWx1cmUiLCJodG1sIiwicmVzdWx0IiwibWVzc2FnZXMiLCJlcnJvciIsInJlcGxhY2UiLCJkYXRhIiwicmVtb3ZlQ2xhc3MiLCJhZGRDbGFzcyIsImNiQmVmb3JlU2VuZEZvcm0iLCJmb3JtIiwiRm9ybSIsImNiQWZ0ZXJTZW5kRm9ybSIsImRvY3VtZW50IiwicmVhZHkiXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFFQTtBQUNBLElBQU1BLEtBQUssR0FBTyxnQkFBbEIsQyxDQUFpRDs7QUFDakQsSUFBTUMsTUFBTSxHQUFNLHFCQUFsQixDLENBQWlEOztBQUNqRCxJQUFN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LGNBL0pvQiw0QkErSkg7QUFDaEI7QUFDQWdDLElBQUFBLElBQUksQ0FBQ3JELFFBQUwsR0FBZ0JELFlBQVksQ0FBQ0MsUUFBN0I7QUFDQXFELElBQUFBLElBQUksQ0FBQ3ZCLEdBQUwsYUFBY0MsYUFBZCxTQUE4Qm5DLEtBQTlCLGNBQXVDQSxLQUF2QztBQUNBeUQsSUFBQUEsSUFBSSxDQUFDN0MsYUFBTCxHQUFxQlQsWUFBWSxDQUFDUyxhQUFsQztBQUNBNkMsSUFBQUEsSUFBSSxDQUFDRixnQkFBTCxHQUF3QnBELFlBQVksQ0FBQ29ELGdCQUFyQztBQUNBRSxJQUFBQSxJQUFJLENBQUNDLGVBQUwsR0FBdUJ2RCxZQUFZLENBQUN1RCxlQUFwQyxDQU5nQixDQU9oQjs7QUFDQUQsSUFBQUEsSUFBSSxDQUFDckMsVUFBTDtBQUNBO0FBeEttQixDQUFyQixDLENBMktBOztBQUNBZixDQUFDLENBQUNzRCxRQUFELENBQUQsQ0FBWUMsS0FBWixDQUFrQixZQUFNO0FBQ3ZCekQsRUFBQUEsWUFBWSxDQUFDaUIsVUFBYjtBQUNBLENBRkQiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBnbG9iYWwgZ2xvYmFsUm9vdFVybCwgZ2xvYmFsVHJhbnNsYXRlLCBGb3JtLCBDb25maWcgKi9cblxuLy8gQ29uc3RhbnRzIHJlbGF0ZWQgdG8gdGhlIGZvcm0gYW5kIG1vZHVsZVxuY29uc3QgaWRVcmwgICAgID0gJ21vZHVsZS1nZXQtc3NsJzsgICAgICAgICAgICAgIC8vIEFQSSBlbmRwb2ludCBmb3IgU1NMIG1vZHVsZVxuY29uc3QgaWRGb3JtICAgID0gJ21vZHVsZS1nZXQtc3NsLWZvcm0nOyAgICAgICAgIC8vIEZvcm0gZWxlbWVudCBJRCBmb3IgU1NMIG1vZHVsZVxuY29uc3QgY2xhc3NOYW1lID0gJ01vZHVsZUdldFNzbCc7ICAgICAgICAgICAgICAgIC8vIENsYXNzIG5hbWUgZm9yIHRoaXMgbW9kdWxlXG5cbi8vIE1haW4gTW9kdWxlR2V0U3NsIGNsYXNzIGRlZmluaXRpb25cbmNvbnN0IE1vZHVsZUdldFNzbCA9IHtcblx0Ly8gQ2FjaGUgY29tbW9ubHkgdXNlZCBqUXVlcnkgb2JqZWN0c1xuXHQkZm9ybU9iajogJCgnIycgKyBpZEZvcm0pLFxuXHQkY2hlY2tCb3hlczogJCgnIycgKyBpZEZvcm0gKyAnIC51aS5jaGVja2JveCcpLFxuXHQkZGlzYWJpbGl0eUZpZWxkczogJCgnIycgKyBpZEZvcm0gKyAnIC5kaXNhYmlsaXR5JyksXG5cdCRzdGF0dXNUb2dnbGU6ICQoJyNtb2R1bGUtc3RhdHVzLXRvZ2dsZScpLFxuXHQkbW9kdWxlU3RhdHVzOiAkKCcjc3RhdHVzJyksXG5cdCRpbnRlcnZhbElkOiB1bmRlZmluZWQsIC8vIFRvIG1hbmFnZSB0aGUgaW50ZXJ2YWwgZm9yIFNTTCBzdGF0dXMgY2hlY2tcblxuXHQvLyBWYWxpZGF0aW9uIHJ1bGVzIGZvciB0aGUgZm9ybVxuXHR2YWxpZGF0ZVJ1bGVzOiB7XG5cdFx0ZG9tYWluTmFtZToge1xuXHRcdFx0aWRlbnRpZmllcjogJ2RvbWFpbk5hbWUnLFxuXHRcdFx0cnVsZXM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHR5cGU6ICdlbXB0eScsXG5cdFx0XHRcdFx0cHJvbXB0OiBnbG9iYWxUcmFuc2xhdGUubW9kdWxlX2dldHNzbF9Eb21haW5OYW1lRW1wdHksXG5cdFx0XHRcdH0sXG5cdFx0XHRdLFxuXHRcdH0sXG5cdH0sXG5cblx0LyoqXG5cdCAqIEluaXRpYWxpemUgdGhlIG1vZHVsZSwgYmluZCBldmVudCBsaXN0ZW5lcnMsIGFuZCBzZXR1cCB0aGUgZm9ybS5cblx0ICogVGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgd2hlbiB0aGUgZG9jdW1lbnQgaXMgcmVhZHkuXG5cdCAqL1xuXHRpbml0aWFsaXplKCkge1xuXHRcdC8vIEluaXRpYWxpemUgU2VtYW50aWMgVUkgY2hlY2tib3hlc1xuXHRcdHRoaXMuJGNoZWNrQm94ZXMuY2hlY2tib3goKTtcblxuXHRcdC8vIENoZWNrIGFuZCBzZXQgbW9kdWxlIHN0YXR1cyBvbiBsb2FkIGFuZCB3aGVuIHRoZSBzdGF0dXMgY2hhbmdlc1xuXHRcdHRoaXMuY2hlY2tTdGF0dXNUb2dnbGUoKTtcblx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignTW9kdWxlU3RhdHVzQ2hhbmdlZCcsIHRoaXMuY2hlY2tTdGF0dXNUb2dnbGUpO1xuXG5cdFx0Ly8gSW5pdGlhbGl6ZSBmb3JtIHdpdGggdmFsaWRhdGlvbiBhbmQgc3VibWl0IGhhbmRsZXJzXG5cdFx0dGhpcy5pbml0aWFsaXplRm9ybSgpO1xuXG5cdFx0Ly8gQXR0YWNoIGV2ZW50IGxpc3RlbmVyIGZvciB0aGUgU1NMIGNlcnRpZmljYXRlIHJlcXVlc3QgYnV0dG9uXG5cdFx0JCgnI2dldC1jZXJ0JykuY2xpY2sodGhpcy5nZXRTc2wpO1xuXG5cdFx0Ly8gQXR0YWNoIGV2ZW50IGxpc3RlbmVyIHRvIGNsb3NlIG1lc3NhZ2VzIG9uIGNsb3NlIGJ1dHRvbiBjbGlja1xuXHRcdCQoJy5tZXNzYWdlIC5jbG9zZScpLm9uKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcblx0XHRcdCQodGhpcykuY2xvc2VzdCgnLm1lc3NhZ2UnKS50cmFuc2l0aW9uKCdmYWRlJyk7XG5cdFx0fSk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJlcXVlc3QgYW4gU1NMIGNlcnRpZmljYXRlIGJ5IGNhbGxpbmcgdGhlIHNlcnZlci1zaWRlIEFQSS5cblx0ICogVGhpcyBtZXRob2Qgc2VuZHMgYSBHRVQgcmVxdWVzdCB0byBpbml0aWF0ZSB0aGUgU1NMIHByb2Nlc3MuXG5cdCAqL1xuXHRnZXRTc2woKSB7XG5cdFx0Ly8gU2hvdyB0aGUgbG9hZGluZyBkaXYgYW5kIGhpZGUgdGhlIHJlc3VsdCBkaXYgd2hpbGUgd2FpdGluZyBmb3IgdGhlIHNlcnZlciByZXNwb25zZVxuXHRcdCQoJyNkaXYtd2FpdGluZycpLnNob3coKTtcblx0XHQkKCcjZGl2LXJlc3VsdCcpLmhpZGUoKTtcblxuXHRcdCQuYXBpKHtcblx0XHRcdHVybDogYCR7Z2xvYmFsUm9vdFVybH1wYnhjb3JlL2FwaS9tb2R1bGVzLyR7aWRVcmx9L2dldC1jZXJ0YCxcblx0XHRcdG9uOiAnbm93Jyxcblx0XHRcdG1ldGhvZDogJ0dFVCcsXG5cdFx0XHRiZWZvcmVTZW5kKHNldHRpbmdzKSB7XG5cdFx0XHRcdHJldHVybiBzZXR0aW5ncztcblx0XHRcdH0sXG5cdFx0XHRzdWNjZXNzVGVzdChyZXNwb25zZSl7XG5cdFx0XHRcdHJldHVybiByZXNwb25zZS5zdWNjZXNzO1xuXHRcdFx0fSxcblx0XHRcdC8qKlxuXHRcdFx0ICogSGFuZGxlcyB0aGUgc3VjY2Vzc2Z1bCByZXNwb25zZSBvZiB0aGUgJ2dldC1hdmFpbGFibGUtbGRhcC11c2VycycgQVBJIHJlcXVlc3QuXG5cdFx0XHQgKiBAcGFyYW0ge29iamVjdH0gcmVzcG9uc2UgLSBUaGUgcmVzcG9uc2Ugb2JqZWN0LlxuXHRcdFx0ICovXG5cdFx0XHRvblN1Y2Nlc3M6IGZ1bmN0aW9uIChyZXNwb25zZSkge1xuXHRcdFx0XHRpZiAoTW9kdWxlR2V0U3NsLiRpbnRlcnZhbElkICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRjbGVhckludGVydmFsKE1vZHVsZUdldFNzbC4kaW50ZXJ2YWxJZCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0TW9kdWxlR2V0U3NsLiRpbnRlcnZhbElkID0gc2V0SW50ZXJ2YWwoTW9kdWxlR2V0U3NsLmNoZWNrUmVzdWx0LCA1MDAwKTtcblx0XHRcdH0sXG5cdFx0XHQvKipcblx0XHRcdCAqIEhhbmRsZXMgdGhlIGZhaWx1cmUgcmVzcG9uc2Ugb2YgdGhlICdnZXQtYXZhaWxhYmxlLWxkYXAtdXNlcnMnIEFQSSByZXF1ZXN0LlxuXHRcdFx0ICogQHBhcmFtIHtvYmplY3R9IHJlc3BvbnNlIC0gVGhlIHJlc3BvbnNlIG9iamVjdC5cblx0XHRcdCAqL1xuXHRcdFx0b25GYWlsdXJlOiBmdW5jdGlvbihyZXNwb25zZSkge1xuXHRcdFx0XHQkKCcjZGl2LXJlc3VsdC10ZXh0JykuaHRtbChyZXN1bHQubWVzc2FnZXMuZXJyb3IucmVwbGFjZSgnXFxuJywgJzxicj4nKSk7XG5cdFx0XHRcdCQoJyNkaXYtd2FpdGluZycpLmhpZGUoKTtcblx0XHRcdFx0JCgnI2Rpdi1yZXN1bHQnKS5zaG93KCk7XG5cdFx0XHR9LFxuXHRcdH0pXG5cdH0sXG5cblx0LyoqXG5cdCAqIFBlcmlvZGljYWxseSBjaGVja3MgdGhlIHJlc3VsdCBvZiB0aGUgU1NMIGNlcnRpZmljYXRlIGdlbmVyYXRpb24uXG5cdCAqIFRoaXMgbWV0aG9kIGNhbGxzIHRoZSBzZXJ2ZXIgdG8gY2hlY2sgaWYgdGhlIHByb2Nlc3MgaXMgY29tcGxldGVkLlxuXHQgKi9cblx0Y2hlY2tSZXN1bHQoKSB7XG5cdFx0Ly8gU2VuZCBHRVQgcmVxdWVzdCB0byBjaGVjayB0aGUgU1NMIGNlcnRpZmljYXRlIGdlbmVyYXRpb24gc3RhdHVzXG5cdFx0JC5hcGkoe1xuXHRcdFx0dXJsOiBgJHtnbG9iYWxSb290VXJsfXBieGNvcmUvYXBpL21vZHVsZXMvJHtpZFVybH0vY2hlY2stcmVzdWx0YCxcblx0XHRcdG9uOiAnbm93Jyxcblx0XHRcdG1ldGhvZDogJ0dFVCcsXG5cdFx0XHRiZWZvcmVTZW5kKHNldHRpbmdzKSB7XG5cdFx0XHRcdHJldHVybiBzZXR0aW5ncztcblx0XHRcdH0sXG5cdFx0XHRzdWNjZXNzVGVzdChyZXNwb25zZSl7XG5cdFx0XHRcdHJldHVybiByZXNwb25zZS5zdWNjZXNzO1xuXHRcdFx0fSxcblx0XHRcdC8qKlxuXHRcdFx0ICogSGFuZGxlcyB0aGUgc3VjY2Vzc2Z1bCByZXNwb25zZSBvZiB0aGUgJ2dldC1hdmFpbGFibGUtbGRhcC11c2VycycgQVBJIHJlcXVlc3QuXG5cdFx0XHQgKiBAcGFyYW0ge29iamVjdH0gcmVzcG9uc2UgLSBUaGUgcmVzcG9uc2Ugb2JqZWN0LlxuXHRcdFx0ICovXG5cdFx0XHRvblN1Y2Nlc3M6IGZ1bmN0aW9uIChyZXNwb25zZSkge1xuXHRcdFx0XHQvLyBVcGRhdGUgdGhlIHJlc3VsdCB0ZXh0IHdpdGggdGhlIHNlcnZlciByZXNwb25zZSBhbmQgc3RvcCBjaGVja2luZ1xuXHRcdFx0XHQkKCcjZGl2LXJlc3VsdC10ZXh0JykuaHRtbChyZXN1bHQuZGF0YS5yZXN1bHQucmVwbGFjZSgnXFxuJywgJzxicj4nKSk7XG5cdFx0XHRcdCQoJyNkaXYtd2FpdGluZycpLmhpZGUoKTtcblx0XHRcdFx0JCgnI2Rpdi1yZXN1bHQnKS5zaG93KCk7XG5cdFx0XHRcdGNsZWFySW50ZXJ2YWwoTW9kdWxlR2V0U3NsLiRpbnRlcnZhbElkKTtcblx0XHRcdH0sXG5cdFx0XHQvKipcblx0XHRcdCAqIEhhbmRsZXMgdGhlIGZhaWx1cmUgcmVzcG9uc2Ugb2YgdGhlICdnZXQtYXZhaWxhYmxlLWxkYXAtdXNlcnMnIEFQSSByZXF1ZXN0LlxuXHRcdFx0ICogQHBhcmFtIHtvYmplY3R9IHJlc3BvbnNlIC0gVGhlIHJlc3BvbnNlIG9iamVjdC5cblx0XHRcdCAqL1xuXHRcdFx0b25GYWlsdXJlOiBmdW5jdGlvbihyZXNwb25zZSkge1xuXHRcdFx0XHQkKCcjZGl2LXJlc3VsdC10ZXh0JykuaHRtbChyZXN1bHQubWVzc2FnZXMuZXJyb3IucmVwbGFjZSgnXFxuJywgJzxicj4nKSk7XG5cdFx0XHRcdCQoJyNkaXYtd2FpdGluZycpLmhpZGUoKTtcblx0XHRcdFx0JCgnI2Rpdi1yZXN1bHQnKS5zaG93KCk7XG5cdFx0XHR9LFxuXHRcdH0pXG5cdH0sXG5cblx0LyoqXG5cdCAqIFRvZ2dsZXMgdGhlIGZvcm0gZmllbGRzIGFuZCBzdGF0dXMgdmlzaWJpbGl0eSBiYXNlZCBvbiB0aGUgbW9kdWxlJ3Mgc3RhdHVzLlxuXHQgKiBFbmFibGVzIG9yIGRpc2FibGVzIGZvcm0gZmllbGRzIGRlcGVuZGluZyBvbiB3aGV0aGVyIHRoZSBtb2R1bGUgaXMgYWN0aXZlLlxuXHQgKi9cblx0Y2hlY2tTdGF0dXNUb2dnbGUoKSB7XG5cdFx0Ly8gSWYgdGhlIG1vZHVsZSBzdGF0dXMgaXMgYWN0aXZlLCBlbmFibGUgZm9ybSBmaWVsZHMgYW5kIHNob3cgc3RhdHVzXG5cdFx0aWYgKE1vZHVsZUdldFNzbC4kc3RhdHVzVG9nZ2xlLmNoZWNrYm94KCdpcyBjaGVja2VkJykpIHtcblx0XHRcdE1vZHVsZUdldFNzbC4kZGlzYWJpbGl0eUZpZWxkcy5yZW1vdmVDbGFzcygnZGlzYWJsZWQnKTtcblx0XHRcdE1vZHVsZUdldFNzbC4kbW9kdWxlU3RhdHVzLnNob3coKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gSWYgdGhlIG1vZHVsZSBzdGF0dXMgaXMgaW5hY3RpdmUsIGRpc2FibGUgZm9ybSBmaWVsZHMgYW5kIGhpZGUgc3RhdHVzXG5cdFx0XHRNb2R1bGVHZXRTc2wuJGRpc2FiaWxpdHlGaWVsZHMuYWRkQ2xhc3MoJ2Rpc2FibGVkJyk7XG5cdFx0XHRNb2R1bGVHZXRTc2wuJG1vZHVsZVN0YXR1cy5oaWRlKCk7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBDYWxsYmFjayBleGVjdXRlZCBiZWZvcmUgc2VuZGluZyB0aGUgZm9ybSBkYXRhLlxuXHQgKiBJdCBjb2xsZWN0cyBmb3JtIGRhdGEgYW5kIGFwcGVuZHMgaXQgdG8gdGhlIHJlcXVlc3QgcGF5bG9hZC5cblx0ICogQHBhcmFtIHtPYmplY3R9IHNldHRpbmdzIC0gVGhlIGN1cnJlbnQgZm9ybSBzZXR0aW5ncy5cblx0ICogQHJldHVybnMge09iamVjdH0gTW9kaWZpZWQgc2V0dGluZ3Mgd2l0aCBmb3JtIGRhdGEuXG5cdCAqL1xuXHRjYkJlZm9yZVNlbmRGb3JtKHNldHRpbmdzKSB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gc2V0dGluZ3M7XG5cdFx0Ly8gR2V0IGFsbCBmb3JtIHZhbHVlcyBhbmQgYXNzaWduIHRoZW0gdG8gdGhlIHJlcXVlc3QgZGF0YVxuXHRcdHJlc3VsdC5kYXRhID0gTW9kdWxlR2V0U3NsLiRmb3JtT2JqLmZvcm0oJ2dldCB2YWx1ZXMnKTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBJbml0aWFsaXplcyB0aGUgZm9ybSB2YWxpZGF0aW9uIGFuZCBzdWJtaXNzaW9uIGxvZ2ljLlxuXHQgKiBTZXRzIHVwIGNhbGxiYWNrcyBhbmQgdmFsaWRhdGlvbiBydWxlcyBmb3IgdGhlIGZvcm0uXG5cdCAqL1xuXHRpbml0aWFsaXplRm9ybSgpIHtcblx0XHQvLyBBc3NpZ24gZm9ybS1yZWxhdGVkIHNldHRpbmdzIHRvIHRoZSBGb3JtIG9iamVjdFxuXHRcdEZvcm0uJGZvcm1PYmogPSBNb2R1bGVHZXRTc2wuJGZvcm1PYmo7XG5cdFx0Rm9ybS51cmwgPSBgJHtnbG9iYWxSb290VXJsfSR7aWRVcmx9LyR7aWRVcmx9L3NhdmVgO1xuXHRcdEZvcm0udmFsaWRhdGVSdWxlcyA9IE1vZHVsZUdldFNzbC52YWxpZGF0ZVJ1bGVzO1xuXHRcdEZvcm0uY2JCZWZvcmVTZW5kRm9ybSA9IE1vZHVsZUdldFNzbC5jYkJlZm9yZVNlbmRGb3JtO1xuXHRcdEZvcm0uY2JBZnRlclNlbmRGb3JtID0gTW9kdWxlR2V0U3NsLmNiQWZ0ZXJTZW5kRm9ybTtcblx0XHQvLyBJbml0aWFsaXplIHRoZSBmb3JtIHdpdGggdGhlIHNwZWNpZmllZCBwYXJhbWV0ZXJzXG5cdFx0Rm9ybS5pbml0aWFsaXplKCk7XG5cdH0sXG59O1xuXG4vLyBJbml0aWFsaXplIHRoZSBNb2R1bGVHZXRTc2wgY2xhc3Mgd2hlbiB0aGUgZG9jdW1lbnQgaXMgcmVhZHlcbiQoZG9jdW1lbnQpLnJlYWR5KCgpID0+IHtcblx0TW9kdWxlR2V0U3NsLmluaXRpYWxpemUoKTtcbn0pOyJdfQ==