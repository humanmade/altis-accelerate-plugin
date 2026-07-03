export interface SettingsAccountFixture {
	connected: boolean;
	user_name: string | null;
	error: string | null;
	manage_url: string;
	unlink_url: string;
	authorize_url: string;
}

export interface SettingsFixture {
	telemetry_enabled: boolean;
	abilities_api_enabled: boolean;
	has_abilities_api: boolean;
	outbound_tracking_enabled: boolean;
	dashboard_takeover_enabled: boolean;
}

export interface WebsiteSettingsFixture {
	weekly_email_enabled: boolean;
}

export const settingsAccount: SettingsAccountFixture = {
	connected: true,
	user_name: 'Mara Ellis',
	error: null,
	manage_url: 'https://accelerateplugin.com/account/pantry-and-plate',
	unlink_url: '/wp-admin/admin.php?page=altis-accelerate-settings&action=unlink',
	authorize_url: '/wp-admin/admin.php?page=altis-accelerate-settings&action=authorize',
};

export const settingsValues: SettingsFixture = {
	telemetry_enabled: true,
	abilities_api_enabled: true,
	has_abilities_api: true,
	outbound_tracking_enabled: true,
	dashboard_takeover_enabled: false,
};

export const websiteSettings: WebsiteSettingsFixture = {
	weekly_email_enabled: true,
};
