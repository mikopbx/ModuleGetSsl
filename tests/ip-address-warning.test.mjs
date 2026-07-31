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
		handlers: {},
		val(value) {
			if (arguments.length === 0) return this.value;
			this.value = value;
			return this;
		},
		show() { this.visible = true; return this; },
		hide() { this.visible = false; return this; },
		on(event, handler) { this.handlers[event] = handler; return this; },
		trigger(event) { this.handlers[event]?.call(this); return this; },
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
