import streamDeck from '@elgato/streamdeck';
import uFuzzy from '@leeoniya/ufuzzy';
import debounce from 'debounce';
import { type GlobalSettings, type ActionSettings } from '../types';

const combobox = document.querySelector('#combobox') as HTMLDivElement;
const inputField = document.querySelector('#input') as HTMLInputElement;
const applist = document.querySelector('#applist') as HTMLDivElement;
const selectField = document.querySelector('#cc-select') as HTMLSelectElement;
const indicator = document.querySelector('.indicator') as HTMLImageElement;
const currencyCheckbox = document.querySelector('#currency') as HTMLInputElement;

const uf = new uFuzzy();
let apps: string[] = [];
let options: HTMLOptionElement[] = [];
let currentOption = -1;
let waiting = false;

// Load settings
streamDeck.onConnected(async (_, actionInfo) => {
	inputField.value = (actionInfo.payload.settings as ActionSettings).name ?? '';
	const { cc, hideCurrency } = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
	selectField.value = cc ?? 'auto';
	currencyCheckbox.checked = !!hideCurrency;
	indicator.src = inputField.value ? './assets/check.svg' : './assets/error.svg';
	fetchAppList();
});

// Save settings
async function search(input: string) {
	const { body: found } = await streamDeck.plugin.fetch({ path: '/search', body: input });
	indicator.src = found ? './assets/check.svg' : './assets/error.svg';
	waiting = false;
}
const debouncedSearch = debounce(search, 500);

function showSuggestions(input: string) {
	applist.innerHTML = '';
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const [_, info, order] = uf.search(apps, input, 0, 2e3);
	if (info && order) {
		for (let i = 0; i < order.length && i < 50; i++) {
			const suggestion = apps[info.idx[order[i]]];
			applist.insertAdjacentHTML('beforeend', `<option value="${suggestion}">${suggestion}</option>`);
		}
	}
	options = Array.from(document.querySelectorAll('#applist option'));
	options.forEach((option, idx) => option?.addEventListener('click', (ev) => {
		ev.preventDefault();
		ev.stopPropagation();
		currentOption = idx;
		setActiveOption();
		inputField.value = (ev.target as HTMLOptionElement).value;
		applist.style.visibility = 'hidden';
		if (!waiting) indicator.src = './assets/three-dots.svg';
		waiting = true;
		debouncedSearch((ev.target as HTMLOptionElement).value);
	}));
}
const debouncedSuggestions = debounce(showSuggestions, 100);

inputField.addEventListener('input', (ev) => {
	const { value } = ev.target as HTMLInputElement;
	if (!waiting) indicator.src = './assets/three-dots.svg';
	waiting = true;
	findCurrentOption(value);
	setActiveOption();
	debouncedSearch(value);
	debouncedSuggestions(value);
});

selectField.addEventListener('change', (ev) => {
	streamDeck.settings.setGlobalSettings({ cc: (ev.target as HTMLSelectElement).value, hideCurrency: currencyCheckbox.checked });
});

currencyCheckbox.addEventListener('input', (ev) => {
	streamDeck.settings.setGlobalSettings({ cc: selectField.value, hideCurrency: (ev.target as HTMLInputElement).checked });
});

// Get app list
async function fetchAppList() {
	const req = await streamDeck.plugin.fetch({ path: '/fetch-list' });
	apps = req.body as string[];
}

// Combobox
inputField.addEventListener('focus', (ev) => {
	findCurrentOption((ev.target as HTMLInputElement).value);
	setActiveOption();
	applist.style.visibility = 'visible';
});

document.addEventListener('click', (ev) => {
	if (combobox !== ev.target && inputField !== ev.target && applist !== ev.target) {
		applist.style.visibility = 'hidden';
	}
});

combobox.addEventListener('keydown', (ev) => {
	const { key } = ev;
	if (key === 'Enter' && currentOption !== -1) {
		options[currentOption].click();
		inputField.blur();
		return;
	}
	else if (key === 'Esc' || key === 'Escape') {
		applist.style.visibility = 'hidden';
		currentOption = -1;
		setActiveOption();
		inputField.blur();
		return;
	}
	else if (key === 'ArrowUp' || key === 'Up') {
		ev.preventDefault();
		currentOption = Math.max(currentOption - 1, 0);
		setActiveOption();
		options[currentOption].scrollIntoView({ behavior: 'instant', block: 'nearest' });
	}
	else if (key === 'ArrowDown' || key === 'Down') {
		ev.preventDefault();
		currentOption = Math.min(currentOption + 1, options.length - 1);
		setActiveOption();
		options[currentOption].scrollIntoView({ behavior: 'instant', block: 'nearest' });
	}
});

function findCurrentOption(input: string) {
	const idx = Array.from(options).findIndex(option => option.value === input);
	currentOption = idx;
	return idx;
}

function setActiveOption() {
	options.forEach(option => option.classList.remove('active'));
	if (currentOption !== -1) {
		options[currentOption].classList.add('active');
	}
}

// Open about window
(document.querySelector('.about > div') as HTMLElement)?.addEventListener('click', () => {
	window.open('./about.html');
});