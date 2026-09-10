import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const sourcePath = new URL('../public/assets/js/src/module-get-ssl-index.js', import.meta.url);

function loadController() {
	const elements = new Map();
	const makeElement = selector => ({
		selector,
		value: '',
		visible: false,
		checked: false,
		disabled: false,
		handlers: {},
		val(value) {
			if (arguments.length === 0) return this.value;
			this.value = value;
			return this;
		},
		show() { this.visible = true; return this; },
		hide() { this.visible = false; return this; },
		toggle(visible) { this.visible = Boolean(visible); return this; },
		on(event, handler) { this.handlers[event] = handler; return this; },
		trigger(event) { this.handlers[event]?.call(this); return this; },
		is(selector) { return selector === ':checked' ? this.checked : false; },
		prop(name, value) {
			if (arguments.length === 1) return this[name];
			this[name] = value;
			return this;
		},
		checkbox(action) {
			if (typeof action === 'object') {
				this.handlers.change = action.onChange;
				return this;
			}
			if (action === 'is checked') return this.checked;
			if (action === 'check') this.checked = true;
			if (action === 'uncheck') this.checked = false;
			if (action === 'set disabled') this.disabled = true;
			if (action === 'set enabled') this.disabled = false;
			return this;
		},
		dropdown(action, value) {
			if (action === 'get value') return this.value;
			if (action === 'set selected') this.value = value;
			if (action === 'set disabled') this.disabled = true;
			if (action === 'set enabled') this.disabled = false;
			return this;
		},
		closest() { return this; },
		addClass() { return this; },
		removeClass() { return this; },
	});
	const $ = selector => {
		if (!elements.has(selector)) elements.set(selector, makeElement(selector));
		return elements.get(selector);
	};

	const context = {
		$,
		document: {},
		URL,
		console,
		globalRootUrl: '',
		globalTranslate: {},
		Form: {},
		Config: {},
		PbxApi: {},
		dnsProvidersMeta: [],
		moduleGetSSLStatusLoopWorker: {},
		UserMessage: {},
		suggestedPublicIp: '178.154.243.193',
	};
	vm.createContext(context);
	const source = fs.readFileSync(sourcePath, 'utf8')
		.replace(/\/\/ Initialize the ModuleGetSsl class[\s\S]*$/, '')
		.concat('\n;globalThis.__ModuleGetSsl = ModuleGetSsl;');
	vm.runInContext(source, context);
	return { controller: context.__ModuleGetSsl, elements };
}

test('recognizes valid IP addresses without treating domains or malformed values as IPs', () => {
	const { controller } = loadController();
	const cases = [
		['203.0.113.10', true],
		['2001:db8::1', true],
		['[2001:db8::1]', true],
		['pbx.example.com', false],
		['', false],
		['999.1.1.1', false],
		['2001:::1', false],
		['[2001:db8::1', false],
		['2001:db8::1]', false],
	];

	for (const [value, expected] of cases) {
		assert.equal(controller.isIpAddress(value), expected, value);
	}
});

test('updates the warning immediately when the address input changes', () => {
	const { controller, elements } = loadController();
	const address = elements.get('#domainName');
	const warning = elements.get('#ip-address-certificate-warning');

	controller.bindIpAddressWarning();
	assert.equal(warning.visible, false);

	address.val('203.0.113.10').trigger('input');
	assert.equal(warning.visible, true);

	address.val('pbx.example.com').trigger('input');
	assert.equal(warning.visible, false);
});

test('shows the additional IP option only for a domain and reveals its settings when enabled', () => {
	const { controller, elements } = loadController();
	const address = elements.get('#domainName');
	const option = elements.get('#include-ip-address-field');
	const checkbox = elements.get('#includeIpAddress');
	const settings = elements.get('#public-ip-address-settings');

	address.val('pbx.example.com');
	controller.updateCertificateIdentifierControls();
	assert.equal(option.visible, true);
	assert.equal(settings.visible, false);

	checkbox.checked = true;
	controller.updateCertificateIdentifierControls();
	assert.equal(settings.visible, true);

	address.val('8.8.8.8');
	controller.updateCertificateIdentifierControls();
	assert.equal(option.visible, false);
	assert.equal(settings.visible, false);
	assert.equal(checkbox.checked, false);
});

test('forces HTTP-01 and automatic renewal whenever the requested certificate contains an IP', () => {
	const { controller, elements } = loadController();
	const address = elements.get('#domainName');
	const challenge = elements.get('#challengeType');
	const autoUpdate = elements.get('#autoUpdate');

	address.val('8.8.8.8');
	challenge.value = 'dns';
	autoUpdate.checked = false;
	controller.updateCertificateIdentifierControls();
	assert.equal(challenge.value, 'http');
	assert.equal(challenge.disabled, true);
	assert.equal(autoUpdate.checked, true);
	assert.equal(autoUpdate.disabled, true);

	address.val('pbx.example.com');
	controller.updateCertificateIdentifierControls();
	assert.equal(challenge.disabled, false);
	assert.equal(autoUpdate.disabled, false);
});

test('accepts only public addresses in the additional IP field', () => {
	const { controller } = loadController();
	assert.equal(controller.isPublicIpAddress('8.8.8.8'), true);
	assert.equal(controller.isPublicIpAddress('2606:4700:4700::1111'), true);
	assert.equal(controller.isPublicIpAddress('203.1.1.1'), true);
	assert.equal(controller.isPublicIpAddress('203.0.1.1'), true);
	assert.equal(controller.isPublicIpAddress('198.50.1.1'), true);
	assert.equal(controller.isPublicIpAddress('198.51.1.1'), true);
	assert.equal(controller.isPublicIpAddress('192.1.1.1'), true);
	assert.equal(controller.isPublicIpAddress('192.0.1.1'), true);
	assert.equal(controller.isPublicIpAddress('192.168.1.10'), false);
	assert.equal(controller.isPublicIpAddress('192.0.2.1'), false);
	assert.equal(controller.isPublicIpAddress('198.51.100.1'), false);
	assert.equal(controller.isPublicIpAddress('203.0.113.1'), false);
	assert.equal(controller.isPublicIpAddress('2001:db8::1'), false);
	assert.equal(controller.isPublicIpAddress('pbx.example.com'), false);
});

test('fills an empty additional IP field from the server suggestion when enabled', () => {
	const { controller, elements } = loadController();
	const address = elements.get('#domainName');
	const checkbox = elements.get('#includeIpAddress');
	const publicIp = elements.get('#publicIpAddress');

	address.val('pbx.example.com');
	checkbox.checked = true;
	controller.updateCertificateIdentifierControls();
	assert.equal(publicIp.val(), '178.154.243.193');

	publicIp.val('8.8.8.8');
	controller.updateCertificateIdentifierControls();
	assert.equal(publicIp.val(), '8.8.8.8');
});
