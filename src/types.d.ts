/**
 * Settings for {@link PriceTracker}.
 */
export type ActionSettings = {
	name?: string;
	appId?: string;
};

export type GlobalSettings = {
	cc?: string;
}

export type SteamApiResponse = {
	[appId: string]: {
		success: boolean,
		data: SteamApiData
	}
}

export type SteamApiData = {
	name: string,
	steam_appid: number,
	capsule_image: string,
	price_overview?: {
		final_formatted: string
		discount_percent: number,
	}
};

export type SteamApiAppsResponse = {
	applist: {
		apps: AppInfo[]
	}
}

export type AppInfo = {
	name: string,
	appid: string
}