/*
 * MikoPBX - free phone system for small business
 * Copyright © 2017-2023 Alexey Portnov and Nikolay Beketov
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with this program.
 * If not, see <https://www.gnu.org/licenses/>.
 */

/* global globalRootUrl, PbxApi, globalTranslate, UserMessage */

/**
 * @module moduleGetSSLStatusLoopWorker
 */
const moduleGetSSLStatusLoopWorker = {

    /**
     * Time in milliseconds before fetching new status.
     * @type {number}
     */
    timeOut: 10000,

    /**
     * The id of the timer function for status worker.
     * @type {number}
     */
    timeOutHandle: 0,


    /**
     * The event type used for the system event-bus (PBX >= 2024.2.30).
     */
    eventBusType: 'module-getssl-progress',

    /**
     * The identifier for the legacy PUB/SUB channel (PBX < 2024.2.30).
     */
    channelId: 'module-get-ssl-pub',

    /**
     * jQuery selector for the result message element.
     *
     * This property stores a reference to the DOM element with the ID 'div-result' using jQuery.
     */
    $resultBlock: $('#div-result'),

    /**
     * Initializes the moduleGetSSLStatusLoopWorker module by setting up the connection to receive server-sent events.
     */
    initialize(){
        moduleGetSSLStatusLoopWorker.initializeAce();
        moduleGetSSLStatusLoopWorker.loadLastLog();
        if (moduleGetSSLStatusLoopWorker.versionCompare(globalPBXVersion,'2024.2.30')>0){
            moduleGetSSLStatusLoopWorker.startListenPushNotifications();
        } else {
            moduleGetSSLStatusLoopWorker.restartWorker();
        }
    },

    /**
     * Loads the last log file content into the ACE editor on page load.
     */
    loadLastLog() {
        $.api({
            url: `${Config.pbxUrl}/pbxcore/api/modules/ModuleGetSsl/check-result`,
            on: 'now',
            method: 'GET',
            successTest: PbxApi.successTest,
            onSuccess: function (response) {
                if (response.data.result && response.data.result.length > 0) {
                    moduleGetSSLStatusLoopWorker.$resultBlock.show();
                    moduleGetSSLStatusLoopWorker.editor.getSession().setValue(response.data.result);
                }
            },
            onFailure: function() {
                // Silently ignore - no log to show
            },
        })
    },

    /**
     * Restarts the moduleGetSSLStatus worker.
     */
    restartWorker() {
        window.clearTimeout(moduleGetSSLStatusLoopWorker.timeoutHandle);
        moduleGetSSLStatusLoopWorker.worker();
    },

    /**
     * Worker function for fetching status.
     */
    worker() {
        $.api({
            url: `${Config.pbxUrl}/pbxcore/api/modules/ModuleGetSsl/check-result`,
            on: 'now',
            method: 'GET',
            successTest: PbxApi.successTest,
            /**
             * Handles the successful response of the 'check-result' API request.
             * @param {object} response - The response object.
             */
            onSuccess: function (response) {
                if (response.data.result.length > 0) {
                    moduleGetSSLStatusLoopWorker.$resultBlock.show();
                    moduleGetSSLStatusLoopWorker.editor.getSession().setValue(response.data.result);
                }
                moduleGetSSLStatusLoopWorker.timeoutHandle = window.setTimeout(
                    moduleGetSSLStatusLoopWorker.worker,
                    moduleGetSSLStatusLoopWorker.timeOut,
                );
            },
            /**
             * Handles the failure response of the 'get-available-ldap-users' API request.
             * @param {object} response - The response object.
             */
            onFailure: function(response) {
                UserMessage.showMultiString(response.message);
                moduleGetSSLStatusLoopWorker.$resultBlock.hide();
            },
        })
    },

    /**
     * Initializes the Ace editor instance.
     * Sets up Ace editor with a monokai theme and custom options.
     * Attaches change handler to the editor session.
     */
    initializeAce() {
        const aceHeight = window.innerHeight - 480;
        const rowsCount = Math.round(aceHeight / 16.3);
        $(window).load(function () {
            $('.application-code').css('min-height', `${aceHeight}px`);
        });
        moduleGetSSLStatusLoopWorker.editor = ace.edit('user-edit-config');
        let NewMode = ace.require('ace/mode/julia').Mode;
        moduleGetSSLStatusLoopWorker.editor.session.setMode(new NewMode());
        moduleGetSSLStatusLoopWorker.editor.setTheme('ace/theme/monokai');
        moduleGetSSLStatusLoopWorker.editor.resize();
        moduleGetSSLStatusLoopWorker.editor.getSession().on('change', () => {
            // Trigger change event to acknowledge the modification
            Form.dataChanged();
        });

        moduleGetSSLStatusLoopWorker.editor.setOptions({
            maxLines: rowsCount,
            showPrintMargin: false,
            showLineNumbers: false,
        });
    },
    /**
     * Subscribes to system event-bus for real-time certificate progress updates (PBX >= 2024.2.30).
     * Falls back to polling if EventBus is not available.
     */
    startListenPushNotifications() {
        if (typeof EventBus === 'undefined') {
            moduleGetSSLStatusLoopWorker.restartWorker();
            return;
        }
        EventBus.subscribe(moduleGetSSLStatusLoopWorker.eventBusType, (data) => {
            console.debug(data);
            moduleGetSSLStatusLoopWorker.processStatusMessage(data);
        });
    },

    /**
     *
     * @param {Object} response - The data payload of the server-sent event, containing details about the installation stage and progress.
     */
    processStatusMessage(response){
        if (response.stageDetails.result){
            moduleGetSSLStatusLoopWorker.$resultBlock.show();
            let resultText = moduleGetSSLStatusLoopWorker.editor.getSession().getValue();
            if (response.stage === 'STAGE_1_GENERATE_CONFIG'){
                resultText += '\n' + response.stageDetails.data.result;
            } else if(response.stage === 'STAGE_2_REQUEST_CERT') {
                resultText += '\n' + response.stageDetails.data.result;
            } else if(response.stage === 'STAGE_3_PARSE_RESPONSE' && response.stageDetails.data.result.length > 0) {
                resultText = response.stageDetails.data.result;
            } else if(response.stage === 'STAGE_4_FINAL_RESULT' && response.stageDetails.data.result.length > 0 ) {
                resultText = response.stageDetails.data.result;
            }
            moduleGetSSLStatusLoopWorker.editor.getSession().setValue(resultText);
        } else {
            UserMessage.showMultiString(response.stageDetails.messages);
            moduleGetSSLStatusLoopWorker.$resultBlock.hide();
        }
    },

    /**
     * Compare versions of modules.
     * @param {string} v1 - The first version to compare.
     * @param {string} v2 - The second version to compare.
     * @param {object} [options] - Optional configuration options.
     * @param {boolean} [options.lexicographical] - Whether to perform lexicographical comparison (default: false).
     * @param {boolean} [options.zeroExtend] - Weather to zero-extend the shorter version (default: false).
     * @returns {number} - A number indicating the comparison result: 0 if versions are equal, 1 if v1 is greater, -1 if v2 is greater, or NaN if the versions are invalid.
     */
    versionCompare(v1, v2, options) {
        const lexicographical = options && options.lexicographical;
        const zeroExtend = options && options.zeroExtend;
        let v1parts = String(v1).split('.');
        let v2parts = String(v2).split('.');

        function isValidPart(x) {
            return (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x);
        }

        if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
            return NaN;
        }

        if (zeroExtend) {
            while (v1parts.length < v2parts.length) v1parts.push('0');
            while (v2parts.length < v1parts.length) v2parts.push('0');
        }

        if (!lexicographical) {
            v1parts = v1parts.map(Number);
            v2parts = v2parts.map(Number);
        }

        for (let i = 0; i < v1parts.length; i += 1) {
            if (v2parts.length === i) {
                return 1;
            }
            if (v1parts[i] === v2parts[i]) {
                //
            } else if (v1parts[i] > v2parts[i]) {
                return 1;
            } else {
                return -1;
            }
        }

        if (v1parts.length !== v2parts.length) {
            return -1;
        }

        return 0;
    },

};

// Initializes the moduleGetSSLStatusLoopWorker module when the DOM is fully loaded.
$(document).ready(() => {
    moduleGetSSLStatusLoopWorker.initialize();
});