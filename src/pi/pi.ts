import streamDeck from '@elgato/streamdeck';
import debounce from 'debounce';
import { type GlobalSettings, type ActionSettings } from '../types';

const inputField = document.querySelector('#input') as HTMLInputElement;
const selectField = document.querySelector('#cc-select') as HTMLSelectElement;
const indicator = document.querySelector('.indicator') as HTMLImageElement;
const currencyCheckbox = document.querySelector('#currency') as HTMLInputElement;

let waiting = false;

// Load settings
streamDeck.onConnected(async (_, actionInfo) => {
	const { appId, name } = actionInfo.payload.settings as ActionSettings;
	inputField.value = `${appId} (${name})`;
	const { cc, hideCurrency } = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
	selectField.value = cc ?? 'auto';
	currencyCheckbox.checked = !!hideCurrency;
	indicator.src = inputField.value ? './assets/check.svg' : './assets/error.svg';
});

// Save settings
async function search(input: string) {
	const { body: appName } = await streamDeck.plugin.fetch({ path: '/search', body: input });
	if (appName) {
		indicator.src = './assets/check.svg';
		inputField.value = `${input} (${appName})`;
	}
	else {
		indicator.src = './assets/error.svg';
	}
	waiting = false;
}
const debouncedSearch = debounce(search, 500);

inputField.addEventListener('input', (ev) => {
	const { value } = ev.target as HTMLInputElement;
	if (!waiting) indicator.src = './assets/three-dots.svg';
	waiting = true;
	debouncedSearch(value);
});

selectField.addEventListener('change', (ev) => {
	streamDeck.settings.setGlobalSettings({ cc: (ev.target as HTMLSelectElement).value, hideCurrency: currencyCheckbox.checked });
});

currencyCheckbox.addEventListener('input', (ev) => {
	streamDeck.settings.setGlobalSettings({ cc: selectField.value, hideCurrency: (ev.target as HTMLInputElement).checked });
});

// Open about window
(document.querySelector('.about > div') as HTMLElement)?.addEventListener('click', () => {
	window.open('./about.html');
});