import type { Audience, Estimate, Field, Post as AudiencePost } from '../audiences/types';

export const returningVisitorsAudience: Audience = {
	include: 'all',
	groups: [
		{
			include: 'all',
			rules: [
				{
					field: 'endpoint.visits',
					operator: 'gte',
					value: '2',
					type: 'number',
				},
			],
		},
	],
};

export const unitedStatesAudience: Audience = {
	include: 'all',
	groups: [
		{
			include: 'all',
			rules: [
				{
					field: 'country',
					operator: '=',
					value: 'US',
					type: 'string',
				},
			],
		},
	],
};

export const newsletterAudience: Audience = {
	include: 'all',
	groups: [
		{
			include: 'all',
			rules: [
				{
					field: 'utm_source',
					operator: '=',
					value: 'newsletter',
					type: 'string',
				},
			],
		},
	],
};

export const audienceFields: Field[] = [
	{
		name: 'endpoint.visits',
		label: 'Visit count',
		type: 'number',
		options: {
			description: 'Total visits from this browser profile.',
		},
		stats: {
			avg: 2.4,
			min: 1,
			max: 18,
		},
	},
	{
		name: 'country',
		label: 'Country',
		type: 'string',
		options: {},
		data: [
			{
				label: 'United States',
				value: 'US',
				percent: 41,
				count: 7545,
			},
			{
				label: 'United Kingdom',
				value: 'GB',
				percent: 12,
				count: 2208,
			},
			{
				label: 'Canada',
				value: 'CA',
				percent: 7,
				count: 1288,
			},
		],
	},
	{
		name: 'utm_source',
		label: 'UTM source',
		type: 'string',
		options: {},
		data: [
			{
				label: 'newsletter',
				value: 'newsletter',
				percent: 9,
				count: 1656,
			},
			{
				label: 'pinterest',
				value: 'pinterest',
				percent: 7,
				count: 1288,
			},
		],
	},
	{
		name: 'browser',
		label: 'Browser',
		type: 'string',
		options: {},
		data: [
			{
				label: 'Chrome',
				value: 'Chrome',
				percent: 52,
				count: 9569,
			},
			{
				label: 'Safari',
				value: 'Safari',
				percent: 28,
				count: 5153,
			},
		],
	},
];

export const returningVisitorsEstimate: Estimate = {
	count: 7545,
	isLoading: false,
	total: 18402,
	histogram: [
		{ count: 140 },
		{ count: 156 },
		{ count: 168 },
		{ count: 172 },
		{ count: 188 },
		{ count: 176 },
		{ count: 194 },
		{ count: 210 },
		{ count: 205 },
		{ count: 226 },
		{ count: 232 },
		{ count: 244 },
		{ count: 251 },
		{ count: 268 },
		{ count: 274 },
		{ count: 286 },
		{ count: 292 },
		{ count: 305 },
		{ count: 318 },
		{ count: 326 },
		{ count: 334 },
		{ count: 348 },
		{ count: 360 },
		{ count: 372 },
		{ count: 388 },
		{ count: 402 },
		{ count: 416 },
		{ count: 430 },
	],
};

export const audiencePosts: AudiencePost[] = [
	{
		id: 601,
		title: {
			raw: 'Returning visitors',
			rendered: 'Returning visitors',
		},
		status: 'publish',
		menu_order: 1,
		slug: 'returning-visitors',
		type: 'audience',
		audience: returningVisitorsAudience,
		estimate: returningVisitorsEstimate,
	},
	{
		id: 602,
		title: {
			raw: 'United States readers',
			rendered: 'United States readers',
		},
		status: 'publish',
		menu_order: 2,
		slug: 'united-states-readers',
		type: 'audience',
		audience: unitedStatesAudience,
		estimate: {
			count: 7545,
			isLoading: false,
			total: 18402,
			histogram: returningVisitorsEstimate.histogram.map( point => ( {
				count: Math.round( point.count * 0.63 ),
			} ) ),
		},
	},
	{
		id: 603,
		title: {
			raw: 'Newsletter subscribers',
			rendered: 'Newsletter subscribers',
		},
		status: 'draft',
		menu_order: 3,
		slug: 'newsletter-subscribers',
		type: 'audience',
		audience: newsletterAudience,
		estimate: {
			count: 1656,
			isLoading: false,
			total: 18402,
			histogram: returningVisitorsEstimate.histogram.map( point => ( {
				count: Math.round( point.count * 0.22 ),
			} ) ),
		},
	},
];
