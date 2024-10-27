// -- Plugin settings
export type GlobalSettings = {
	cc?: string;
}

export type ActionSettings = {
	name?: string;
	appId?: string;
};

//  -- Steam Apps List API
export type AppsListResponse = {
	applist: {
		apps: AppInfo[]
	}
}

export type AppInfo = {
	name: string,
	appid: string
}

// -- Steam Store API
export type StoreResponse = {
	[appId: string]: {
		success: false
	} | {
		success: true,
		data: StoreAppInfo
	}
}

export type StoreAppInfo = {
	name: string,
	steam_appid: number,
	capsule_image: string,
	is_free: boolean,
	price_overview?: {
		final_formatted: string
		discount_percent: number,
	},
	release_date: {
		coming_soon: boolean,
		date: string
	}
};