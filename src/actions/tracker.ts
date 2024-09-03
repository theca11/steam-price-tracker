import streamDeck, { action, DidReceiveSettingsEvent, KeyDownEvent, KeyUpEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import Cron from "croner";
import sharp from "sharp";


@action({ UUID: "dev.theca11.steam-price-tracker.watcher" })
export class PriceTracker extends SingletonAction<ActionSettings> {
	currentContexts = new Set<string>()
	updatesCache = new Map<string, { appId: string, timestamp: number }>();
	longPressCache = new Set<string>();

	constructor() {
		super();
		Cron('0 * * * *', () => {
			for (const ctx of this.currentContexts) {
				if (!this.updatesCache.has(ctx)) return;
				this.update(ctx, this.updatesCache.get(ctx)!.appId);
			}
		});
	}

	isUpToDate(context: string): boolean {
		if (this.updatesCache.has(context) && ((Date.now() - this.updatesCache.get(context)!.timestamp) < 60 * 60 * 1000)) {
			console.log('Not updating, recent update available')
			return true;
		}
		return false;
	}

	async update(context: string, appId?: string, force = false) {
		if (!appId) return;
		if (!force && this.isUpToDate(context)) return;

		const controller = streamDeck.actions.createController(context);
		const { name, capsule_image, price_overview } = await this.fetchData(appId);
		const image = await this.generateImg(capsule_image, price_overview?.final_formatted, price_overview?.discount_percent);
		controller.setImage('data:image/png;base64,' + image.toString('base64'), { target: 0 })
		console.log('Updated', name, price_overview?.final_formatted)
		this.updatesCache.set(context, { appId, timestamp: Date.now() })
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

	onKeyDown(ev: KeyDownEvent<ActionSettings>): void {
		this.longPressCache.add(ev.action.id);
		setTimeout(() => {
			this.longPressCache.delete(ev.action.id);
		}, 500)
	}

	onKeyUp(ev: KeyUpEvent<ActionSettings>): void {
		if (this.longPressCache.has(ev.action.id)) {
			this.longPressCache.delete(ev.action.id);
			streamDeck.system.openUrl(`https://store.steampowered.com/app/${ev.payload.settings.appId}`)
		}
		else {
			ev.action.showOk();
			console.log('forcing update here')
			for (const ctx of this.currentContexts) {
				if (!this.updatesCache.has(ctx)) return;
				this.update(ctx, this.updatesCache.get(ctx)!.appId, true);
			}
		}
	}

	async fetchData(appId: string): Promise<SteamApiData> {
		const req = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic,price_overview`)
		const res = await req.json() as SteamApiResponse;
		return res[appId].data;
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
			.extend({ top: 2, bottom: 2, background: 'black' })
			.png()
			.toBuffer()

		const artwork = await sharp(artworkBase)
			.extend({ bottom: 28, background: 'transparent' })
			.toBuffer()

		const bg = sharp(Buffer.from(`
		<svg width="144" height="144" viewBox="0 0 144 144" fill="none" xmlns="http://www.w3.org/2000/svg">
			<rect width="144" height="144" fill="url(#gradient-fill)"/>
			<defs>
				<linearGradient id="gradient-fill" x1="100" y1="144" x2="0" y2="0" gradientUnits="userSpaceOnUse">
						<stop offset="0" stop-color="#1b2838" />
						<stop offset="0.14285714285714285" stop-color="#1c3448" />
						<stop offset="0.5714285714285714" stop-color="#177283" />
						<stop offset="0.8571428571428571" stop-color="#0cb2ac" />
						<stop offset="1" stop-color="#04ccb1" />
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
				width: 120,
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



/**
 * Settings for {@link PriceTracker}.
 */
type ActionSettings = {
	appId?: string;
};

type SteamApiResponse = {
	[appId: string]: {
		success: boolean,
		data: SteamApiData
	}
}

type SteamApiData = {
	name: string,
	steam_appid: number,
	capsule_image: string,
	price_overview?: {
		final_formatted: string
		discount_percent: number,
	}
};