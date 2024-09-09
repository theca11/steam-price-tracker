import streamDeck from '@elgato/streamdeck';
import debounce from 'debounce';
import { GlobalSettings, type ActionSettings } from '../types';

const inputField = document.querySelector('#input') as HTMLInputElement;
const selectField = document.querySelector('#cc-select') as HTMLSelectElement;
const indicator = document.querySelector('.indicator') as HTMLImageElement;
let waiting = false;

// Load settings
streamDeck.onDidConnect(async (_, actionInfo) => {
	inputField.value = (actionInfo.payload.settings as ActionSettings).name ?? '';
	const { cc } = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
	selectField.value = cc ?? 'auto';
	indicator.src = inputField.value ? './assets/check.svg' : './assets/error.svg';
});

// Save settings
async function search(input: string) {
	const { body: found } = await streamDeck.plugin.fetch({ path: '/search', body: input });
	indicator.src = found ? './assets/check.svg' : './assets/error.svg';
	waiting = false;
}
const debouncedSearch = debounce(search, 500);

inputField?.addEventListener('input', (ev) => {
	if (!waiting) indicator.src = './assets/three-dots.svg';
	waiting = true;
	debouncedSearch((ev.target as HTMLInputElement).value);
});

selectField?.addEventListener('change', (ev) => {
	streamDeck.settings.setGlobalSettings({ cc: (ev.target as HTMLSelectElement).value });
});

// Open about window
(document.querySelector('.about > div') as HTMLElement)?.addEventListener('click', () => {
	window.open('./about.html');
});
