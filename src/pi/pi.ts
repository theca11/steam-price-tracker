import streamDeck from '@elgato/streamdeck';
import debounce from "debounce";
import { GlobalSettings, type ActionSettings } from '../types';

const inputField = document.querySelector('#input') as HTMLInputElement;
const selectField = document.querySelector('#cc-select') as HTMLSelectElement;

// Load settings
streamDeck.onDidConnect(async (_, actionInfo) => {
	inputField.value = (actionInfo.payload.settings as ActionSettings).name ?? '';
	const { cc } = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
	selectField.value = cc ?? 'auto';
});

// Save settings
function search(input: string) {
	streamDeck.plugin.fetch({ path: '/search', body: input });
}
const debouncedSearch = debounce(search, 500);

inputField?.addEventListener('input', (ev) => {
	debouncedSearch((ev.target as HTMLInputElement).value);
});

selectField?.addEventListener('change', (ev) => {
	streamDeck.settings.setGlobalSettings({ cc: (ev.target as HTMLSelectElement).value });
});

// Open about window
(document.querySelector('.about > div') as HTMLElement)?.addEventListener('click', (ev) => {
	window.open('./about.html');
});
