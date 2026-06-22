import { ReactComponentLike } from 'prop-types';

declare interface Window {
	AltisAccelerateDashboardData: {
		post_types: {
			name: string,
			label: string,
			singular_label: string,
		}[],
		version: string,
		home_url?: string,
		screen: string,
		location?: string,
		tracking: {
			opt_in: boolean,
		},
		user: {
			id?: number,
			name: string,
		},
		id?: number,
		welcomed: boolean,
		title?: string,
		onboarding: {
			connected_at: number | false,
			first_test_created: number | false,
			authorize_url: string,
		},
		outbound_tracking_enabled: boolean,
	};
	posthog: any;
	Altis: {
		Analytics: {
			Experiments: {
				Goals: {
					label: string,
					name: string,
				}[],
				PostABTests: Record<string, {
					label: string,
					singular_label: string,
					suggestion_prompt?: string,
				}>,
			},
			components: ReactComponentLike[],
			OutboundTracking?: boolean,
			Config?: {
				LogEndpoint?: string,
				AppId?: string,
				ExcludeBots?: boolean,
			},
		},
	};
}

interface BlockAnalytics {
	loads: number,
	views: number,
	conversions: number,
	unique: {
		loads: number,
		views: number,
		conversions: number,
	},
	variants?: {
		id: number,
		loads: number,
		views: number,
		conversions: number,
		unique: {
			loads: number,
			views: number,
			conversions: number,
		},
	}[],
}

interface ABTest {
	start_time: number, // JS timestamp.
	end_time: number, // JS timestamp.
	started: boolean,
	paused: boolean,
	results: {
		winner: number | null,
		variants: {
			p: number,
			rate: number,
		}[],
	},
}
