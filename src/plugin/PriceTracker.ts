import streamDeck, { action, KeyDownEvent, KeyUpEvent, MessageRequest, route, WillAppearEvent, WillDisappearEvent } from '@elgato/streamdeck';
import uFuzzy from '@leeoniya/ufuzzy';
import Cron from 'croner';
import open from 'open';
import sharp from 'sharp';
import { ActionSettings, AppInfo, AppsListResponse, GlobalSettings, StoreAppInfo, StoreResponse } from '../types';
import { AbstractAction } from './AbstractAction';


@action({ UUID: 'dev.theca11.steam-price-tracker.tracker' })
export class PriceTracker extends AbstractAction<ActionSettings> {
	visibleContexts = new Map<string, string>(); // <context, appId>
	updatedContexts = new Map<string, number>(); // <context, timestamp>
	appsList: AppInfo[] = [];
	appListLastUpdated = 0;
	countryCode: string | null = null;

	uf = new uFuzzy({ intraMode: 1 });

	constructor() {
		super();
		streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((ev) => {
			this.countryCode = ev.settings.cc ?? 'auto';
			streamDeck.logger.debug(`Country code set to ${this.countryCode}`);
			this.updateVisible();
		});
		Cron('0 * * * *', () => {
			streamDeck.logger.debug('Performing scheduled update');
			this.updateVisible();
		});

		this.fetchAppList();
	}

	onWillAppear(ev: WillAppearEvent<ActionSettings>): Promise<void> | void {
		const { id } = ev.action;
		const { appId } = ev.payload.settings;
		this.visibleContexts.set(id, appId ?? '');
		this.update(id, appId);
	}

	onWillDisappear(ev: WillDisappearEvent<ActionSettings>): Promise<void> | void {
		const { id } = ev.action;
		this.visibleContexts.delete(id);
	}

	onSinglePress(ev: KeyUpEvent<ActionSettings>): void | Promise<void> {
		const { appId } = ev.payload.settings;
		if (!appId) return;
		open(`steam://store/${appId}`);
		ev.action.showOk();
	}

	onLongPress(ev: KeyDownEvent<ActionSettings>): void | Promise<void> {
		streamDeck.logger.debug('Performing forced update');
		ev.action.showOk();
		this.updateVisible();
	}

	onPropertyInspectorDidAppear(): Promise<void> | void {
		this.fetchAppList();
	}

	@route('/fetch-list')
	getList() {
		return [...new Set(this.appsList.map(app => app.name))];
	}

	@route('/search')
	async search(req: MessageRequest<string>): Promise<boolean> {
		const controller = req.action;
		const { id } = controller;
		const input = req.body?.toLowerCase().trim();
		if (!input) return false;

		const foundApp = await this.findApp(input);
		if (foundApp) {
			streamDeck.logger.debug(`Search found app for ${input}`, foundApp);
			controller.setSettings({ name: foundApp.name, appId: foundApp.appid });
			this.visibleContexts.set(id, foundApp.appid);
			const success = await this.update(id, foundApp.appid, true);
			if (success) return true;
		}
		streamDeck.logger.debug(`Search did NOT found app for ${input} or issue updating`);
		controller.setSettings({ name: '', appId: '' });
		this.visibleContexts.set(id, '');
		if (controller.isKey()) controller.setImage();
		return false;
	}

	async fetchAppList() {
		if (Date.now() - this.appListLastUpdated < 15 * 60 * 1000) return;
		try {
			const req = await fetch('https://api.steampowered.com/ISteamApps/GetAppList/v2/');
			const json = await req.json() as AppsListResponse;
			this.appsList = json.applist.apps.filter(app => app.name && app.appid);
			this.appListLastUpdated = Date.now();
		}
		catch (e) {
			streamDeck.logger.error('Error fetching apps list', e);
		}
	}

	async fetchStoreAppInfo(appId: string): Promise<StoreAppInfo | null> {
		try {
			const req = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic,price_overview,release_date&cc=${this.countryCode}`);
			const res = await req.json() as StoreResponse;
			return res[appId].success ? res[appId].data : null;
		}
		catch (e) {
			streamDeck.logger.error('Error fetching store app info', e);
			return null;
		}
	}

	async findApp(input: string): Promise<{ name: string, appid: string } | undefined> {
		const foundApp = this.appsList.find(app => app.name.toLowerCase().trim() === input || (isFinite(Number(input)) && app.appid.toString() === input));
		if (foundApp) return foundApp;
		if (isFinite(Number(input))) {
			const storeInfo = await this.fetchStoreAppInfo(input);
			if (storeInfo) return { name: storeInfo.name, appid: storeInfo.steam_appid.toString() };
		}
	}

	isUpToDate(context: string): boolean {
		if (this.updatedContexts.has(context) && ((Date.now() - this.updatedContexts.get(context)!) < 60 * 60 * 1000)) {
			streamDeck.logger.debug('Not updating context, recent info available');
			return true;
		}
		return false;
	}

	updateVisible() {
		for (const [ctx, appId] of this.visibleContexts) {
			this.update(ctx, appId, true);
		}
	}

	async update(context: string, appId: string | undefined, force = false): Promise<boolean> {
		if (!this.countryCode || !appId) return false;
		if (!force && this.isUpToDate(context)) return false;

		const info = await this.fetchStoreAppInfo(appId);
		if (!info) return false;
		const { name, capsule_image, is_free, price_overview, release_date } = info;

		try {
			const price = is_free ? 'Free' : price_overview?.final_formatted ?? 'TBA';
			const image = await this.generateImg(capsule_image, price, price_overview?.discount_percent, release_date.coming_soon ? release_date.date : 'Released');
			const controller = streamDeck.actions.getActionById(context);
			if (!controller?.isKey()) return false;
			controller.setImage('data:image/png;base64,' + image.toString('base64'), { target: 0 });
			this.updatedContexts.set(context, Date.now());
			streamDeck.logger.debug(`Updated ${name} - ${price_overview?.final_formatted}`);
			return true;
		}
		catch (e) {
			streamDeck.logger.error('Error while generating image on update', e);
			return false;
		}
	}

	async generateImg(artworkUrl: string, price: string = 'Free', discountPercent: number = 0, releaseDate: string = 'Released') {
		const req = await fetch(artworkUrl);
		const artworkBuffer = await req.arrayBuffer();
		const artworkBase = await sharp(artworkBuffer)
		.resize(144, null, {
			kernel: sharp.kernel.nearest,
			fit: 'contain',
			position: 'center',
		})
		.extend({ top: 1, bottom: 1, background: 'black' })
		.png()
		.toBuffer();

		const artwork = await sharp(artworkBase)
		.extend({ bottom: 29, background: 'transparent' })
		.toBuffer();

		const bg = sharp(Buffer.from(`
			<svg width="144" height="144" viewBox="0 0 144 144" fill="none" xmlns="http://www.w3.org/2000/svg">
				<rect width="144" height="144" fill="url(#gradient-fill)"/>
				<defs>
					<linearGradient id="gradient-fill" x1="100" y1="144" x2="0" y2="0" gradientUnits="userSpaceOnUse">
							<stop offset="0" stop-color="#16202d" />
							<stop offset="0.35" stop-color="#25354b" />
							<stop offset="1" stop-color="#5f8ebb" />
					</linearGradient>
				</defs>
			</svg>`,
		));

		const priceText = await sharp({
			text: {
				text: `<span font="Arial" weight="bold" fgcolor="${discountPercent ? '#beee11' : 'white'}" bgcolor="white" bgalpha="1">${price}</span>`,
				width: 130,
				dpi: 160,
				align: 'center',
				rgba: true,
			},
		})
		.extend({ bottom: 15, background: 'transparent' })
		.png()
		.toBuffer();

		const discountText = await sharp({
			text: {
				text: `<span font="Arial" weight="bold" font_style="italic" fgcolor="#beee11" bgcolor="#4c6b22">- ${discountPercent}%</span>`,
				width: 120,
				height: 19,
				align: 'center',
				rgba: true,
			},
		})
		.extend({ top: 8, bottom: 8, left: 8, right: 8, background: '#4c6b22' })
		.png()
		.toBuffer();

		const releaseTextBg = sharp({
			create: {
				width: 144,
				height: 30,
				channels: 4,
				background: '#1d80b8',
			},
		});
		const releaseText = await sharp({
			text: {
				text: `<span font="Arial" weight="bold" font_style="italic" fgcolor="#ffffff" fgalpha="90%" bgcolor="#000000" bgalpha="1">${releaseDate}</span>`,
				width: 120,
				height: 20,
				wrap: 'none',
				align: 'center',
				rgba: true,
			},
		})
		.png()
		.toBuffer();
		const releaseInput = await releaseTextBg.composite([{ input: releaseText, gravity: 'center' }]).png().toBuffer();

		const compositeInputs = [];
		if (releaseDate !== 'Released') {
			compositeInputs.push({ input: releaseInput, gravity: 'north' });
		}
		compositeInputs.push({ input: artwork, gravity: 'center' });
		compositeInputs.push({ input: priceText, gravity: 'south' });
		if (discountPercent && releaseDate == 'Released') {
			compositeInputs.push({ input: discountText, gravity: 'northeast' });
		}

		const image = await bg.composite(compositeInputs).png().toBuffer();
		return image;
	}
}