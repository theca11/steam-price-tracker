import streamDeck, { action, DidReceiveSettingsEvent, KeyDownEvent, KeyUpEvent, MessageRequest, MessageResponder, PropertyInspectorDidAppearEvent, route, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import Cron from "croner";
import sharp from "sharp";
import { ActionSettings, AppInfo, GlobalSettings, SteamApiAppsResponse, SteamApiData, SteamApiResponse } from "../../types";
import { IAction } from "./IAction";

@action({ UUID: "dev.theca11.steam-price-tracker.tracker" })
export class PriceTracker extends IAction<ActionSettings> {
	currentContexts = new Set<string>()
	updatesCache = new Map<string, { appId: string, timestamp: number }>();

	steamApps: AppInfo[] = []
	appListLastUpdated = 0;

	countryCode = '';

	constructor() {
		super();
		Cron('0 * * * *', () => {
			for (const ctx of this.currentContexts) {
				if (!this.updatesCache.has(ctx)) return;
				this.update(ctx, this.updatesCache.get(ctx)!.appId, true);
			}
		});

		// Global settings
		streamDeck.settings.getGlobalSettings<GlobalSettings>().then(settings => this.countryCode = settings.cc ?? '');
		streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((ev) => {
			this.countryCode = ev.settings.cc ?? '';
			for (const ctx of this.currentContexts) {
				if (!this.updatesCache.has(ctx)) return;
				this.update(ctx, this.updatesCache.get(ctx)!.appId, true);
			}
		})
	}


	onPropertyInspectorDidAppear(ev: PropertyInspectorDidAppearEvent<ActionSettings>): Promise<void> | void {
		this.fetchAppList()
	}

	async fetchAppList() {
		// to-do: try-catch
		if (Date.now() - this.appListLastUpdated < 15 * 60 * 1000) return;
		const req = await fetch('https://api.steampowered.com/ISteamApps/GetAppList/v2/')
		const json = (await req.json()) as SteamApiAppsResponse;
		console.time('fetch')
		this.steamApps = json.applist.apps.filter(app => app.name);
		console.timeEnd('fetch')
		console.log(this.steamApps.length)
		this.appListLastUpdated = Date.now()
	}

	@route("/search")
	public search(req: MessageRequest<string>, res: MessageResponder): void {
		console.log('hit route')
		const app = this.steamApps.find(app => app.name.toLowerCase().trim() === req.body?.toLowerCase().trim() || app.appid.toString() === req.body?.trim())
		if (app) {
			console.log('app found', app)
			req.action.setSettings({ name: app.name, appId: app.appid });
			this.update(req.action.id, app.appid, true)
		}
		else { console.log('app NOT found', req.body) }
	}

	isUpToDate(context: string): boolean {
		if (this.updatesCache.has(context) && ((Date.now() - this.updatesCache.get(context)!.timestamp) < 60 * 60 * 1000)) {
			console.log('Not updating, recent update available')
			return true;
		}
		return false;
	}

	async update(context: string, appId: string | undefined, force = false) {
		if (!appId) return;
		if (!force && this.isUpToDate(context)) return;
		const controller = streamDeck.actions.createController(context);

		try {
			const { name, capsule_image, price_overview } = await this.fetchAppStoreInfo(appId);
			const image = await this.generateImg(capsule_image, price_overview?.final_formatted, price_overview?.discount_percent);
			controller.setImage('data:image/png;base64,' + image.toString('base64'), { target: 0 })
			console.log('Updated', name, price_overview?.final_formatted)
			this.updatesCache.set(context, { appId, timestamp: Date.now() })
		}
		catch (e) {
			console.log('Error updating', e)
		}
	}

	onWillAppear(ev: WillAppearEvent<ActionSettings>): Promise<void> | void {
		this.currentContexts.add(ev.action.id);
		const { appId } = ev.payload.settings;
		this.update(ev.action.id, appId);
	}

	onWillDisappear(ev: WillDisappearEvent<ActionSettings>): Promise<void> | void {
		this.currentContexts.delete(ev.action.id);
	}

	onDidReceiveSettings(ev: DidReceiveSettingsEvent<ActionSettings>): Promise<void> | void {
		const { appId } = ev.payload.settings;
		this.update(ev.action.id, appId);
	}

	protected onSinglePress(ev: KeyUpEvent<ActionSettings>): void | Promise<void> {
		streamDeck.system.openUrl(`https://store.steampowered.com/app/${ev.payload.settings.appId}`)
	}

	protected onLongPress(ev: KeyDownEvent<ActionSettings>): void | Promise<void> {
		ev.action.showOk();
		console.log('forcing update here')
		for (const ctx of this.currentContexts) {
			if (!this.updatesCache.has(ctx)) return;
			this.update(ctx, this.updatesCache.get(ctx)!.appId, true);
		}
	}

	async fetchAppStoreInfo(appId: string): Promise<SteamApiData> {
		try {
			const req = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic,price_overview&cc=${this.countryCode}`)
			const res = await req.json() as SteamApiResponse;
			return res[appId].data;
		}
		catch (e) {
			console.log('Error fetching api', e);
			throw e;
		}

	}

	async generateImg(artworkUrl: string, finalPrice: string = 'Free', discountPercent: number = 0) {
		const req = await fetch(artworkUrl);
		const buffer = await req.arrayBuffer();
		const artworkBase = await sharp(buffer)
			.resize(144, null, {
				kernel: sharp.kernel.nearest,
				fit: 'contain',
				position: 'center',
			})
			.extend({ top: 1, bottom: 1, background: 'black' })
			.png()
			.toBuffer()

		const artwork = await sharp(artworkBase)
			.extend({ bottom: 29, background: 'transparent' })
			.toBuffer()

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
			</svg>`
		))

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

		const priceText = await sharp({
			text: {
				text: `<span font="Arial" weight="bold" fgcolor="${discountPercent ? '#beee11' : 'white'}" bgcolor="white" bgalpha="1">${finalPrice}</span>`,
				width: 130,
				dpi: 160,
				align: 'center',
				rgba: true,
			},
		})
			.extend({ bottom: 15, background: 'transparent' })
			.png()
			.toBuffer();

		const compositeInputs = [
			{ input: artwork, gravity: 'center' },
			{ input: priceText, gravity: 'south' }
		];
		if (discountPercent) {
			compositeInputs.push({ input: discountText, gravity: 'northeast' })
		}

		const image = await bg.composite(compositeInputs).toFormat('png').toBuffer();
		return image;
	}
}