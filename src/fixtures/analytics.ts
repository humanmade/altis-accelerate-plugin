import type { StatsResult } from '../utils/admin';

export const analyticsAggregations: Record<string, Record<string, number>> = {
	by_url: {
		'/recipes/five-summer-salads-for-the-grill/': 6050,
		'/recipes/weeknight-tomato-tart/': 2410,
		'/recipes/lemon-herb-chicken-new-potatoes/': 1840,
		'/guides/better-picnic-sandwiches/': 1260,
		'/recipes/strawberry-sheet-cake/': 1040,
		'/': 3910,
	},
	by_referer: {
		'Direct traffic': 14280,
		'google.com': 12640,
		'pinterest.com': 6420,
		'instagram.com': 4880,
		'mail.google.com': 3220,
		'flipboard.com': 1040,
	},
	by_country: {
		US: 19320,
		GB: 5650,
		CA: 3260,
		AU: 2410,
		DE: 1990,
		NL: 1120,
	},
	by_search_term: {
		'summer dinner': 1260,
		'tomato tart': 920,
		'picnic salads': 810,
		'strawberry cake': 690,
		'lemon chicken': 610,
	},
	by_os: {
		iOS: 14240,
		'Mac OS': 11360,
		Windows: 8520,
		Android: 6330,
		Linux: 820,
	},
	by_browser: {
		Chrome: 24480,
		Safari: 13220,
		Edge: 3920,
		Firefox: 2910,
		Samsung: 760,
	},
	by_campaign: {
		'june-menu': 3210,
		'summer-sides': 2440,
		'picnic-week': 1810,
		'tomato-season': 1430,
	},
	by_source_campaign: {
		'newsletter / june-menu': 3210,
		'pinterest / summer-sides': 2440,
		'instagram / picnic-week': 1810,
		'google / tomato-season': 1430,
	},
	by_source_medium: {
		'newsletter / email': 3210,
		'pinterest / social': 2440,
		'instagram / social': 1810,
		'google / organic': 12640,
	},
	by_outbound_host: {
		'instacart.com': 640,
		'kingarthurbaking.com': 410,
		'oxo.com': 290,
		'farmersmarketcoalition.org': 180,
	},
};

export const analyticsStats: StatsResult = {
	by_interval: {
		'2026-06-13 00:00:00': {
			views: 5210,
			visitors: 2050,
		},
		'2026-06-14 00:00:00': {
			views: 6080,
			visitors: 2360,
		},
		'2026-06-15 00:00:00': {
			views: 6490,
			visitors: 2520,
		},
		'2026-06-16 00:00:00': {
			views: 7120,
			visitors: 2780,
		},
		'2026-06-17 00:00:00': {
			views: 7350,
			visitors: 2860,
		},
		'2026-06-18 00:00:00': {
			views: 6840,
			visitors: 2670,
		},
		'2026-06-19 00:00:00': {
			views: 8028,
			visitors: 3162,
		},
	},
	stats: {
		summary: {
			views: 47118,
			visitors: 18402,
			search: analyticsAggregations.by_search_term,
			bounce: 6993,
			returning: 7545,
			engaged: {
				total_seconds: 5088744,
				avg_seconds: 108,
				pageviews: 47118,
				sessions: 18402,
				first_seen: '2026-05-21T00:00:00.000Z',
			},
		},
		by_browser: analyticsAggregations.by_browser,
		by_country: analyticsAggregations.by_country,
		by_device: {
			desktop: 23890,
			mobile: 20340,
			tablet: 2888,
		},
		by_os: analyticsAggregations.by_os,
		by_referer: analyticsAggregations.by_referer,
		by_user: {
			'Editorial team': 22620,
			'Recipe contributors': 12480,
			'Guest columnists': 5040,
		},
		by_url: analyticsAggregations.by_url,
		by_search_term: analyticsAggregations.by_search_term,
		by_outbound_host: analyticsAggregations.by_outbound_host,
		by_campaign: analyticsAggregations.by_campaign,
		by_source_campaign: analyticsAggregations.by_source_campaign,
		by_source_medium: analyticsAggregations.by_source_medium,
	},
};

export const priorAnalyticsStats: StatsResult = {
	by_interval: {
		'2026-06-06 00:00:00': {
			views: 4820,
			visitors: 1910,
		},
		'2026-06-07 00:00:00': {
			views: 5260,
			visitors: 2110,
		},
		'2026-06-08 00:00:00': {
			views: 5710,
			visitors: 2260,
		},
		'2026-06-09 00:00:00': {
			views: 6120,
			visitors: 2410,
		},
		'2026-06-10 00:00:00': {
			views: 6390,
			visitors: 2510,
		},
		'2026-06-11 00:00:00': {
			views: 6010,
			visitors: 2360,
		},
		'2026-06-12 00:00:00': {
			views: 6670,
			visitors: 2620,
		},
	},
	stats: {
		...analyticsStats.stats,
		summary: {
			...analyticsStats.stats.summary,
			views: 40980,
			visitors: 16180,
			bounce: 6796,
			returning: 6200,
			engaged: {
				total_seconds: 4138980,
				avg_seconds: 101,
				pageviews: 40980,
				sessions: 16180,
				first_seen: '2026-05-21T00:00:00.000Z',
			},
		},
	},
};
