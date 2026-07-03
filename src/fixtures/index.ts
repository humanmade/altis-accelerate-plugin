import type { Estimate, Field, Post as AudiencePost } from '../audiences/types';
import type { Experiment } from '../experiments/overview/data/store';
import type { DiffsResult, Post, StatsResult } from '../utils/admin';

import { analyticsAggregations, analyticsStats } from './analytics';
import { audienceFields, audiencePosts, returningVisitorsEstimate } from './audiences';
import { broadcastBlocks, broadcastPosts } from './broadcast';
import {
	broadcastMutationResponse,
	contentDiffs,
	contentPosts,
	topEngagedPosts,
	wpBlocks,
	wpPages,
	wpPosts,
} from './content';
import type { TopEngagedPost, WPBlockItem, WPContentItem } from './content';
import { experiments } from './experiments';
import {
	settingsAccount,
	settingsValues,
	websiteSettings,
	type SettingsAccountFixture,
	type SettingsFixture,
	type WebsiteSettingsFixture,
} from './settings';

export * from './analytics';
export * from './audiences';
export * from './broadcast';
export * from './content';
export * from './experiments';
export * from './settings';

export type FixtureRouteMatcher = string | RegExp;

export type FixtureRouteBody =
	| StatsResult
	| Record<string, Record<string, number>>
	| Post[]
	| TopEngagedPost[]
	| DiffsResult
	| Experiment[]
	| AudiencePost[]
	| AudiencePost
	| Field[]
	| Estimate
	| WPContentItem[]
	| WPBlockItem[]
	| typeof broadcastMutationResponse
	| SettingsAccountFixture
	| SettingsFixture
	| WebsiteSettingsFixture;

export type FixtureRouteResponse = {
	body: FixtureRouteBody;
	headers?: Record<string, string>;
	status?: number;
};

const totalHeaders = ( total: number, pages: number = 1 ): Record<string, string> => ( {
	'X-WP-Total': String( total ),
	'X-WP-TotalPages': String( pages ),
} );

export const fixtureRoutes: Map<FixtureRouteMatcher, FixtureRouteResponse> = new Map( [
	[
		/^\/?accelerate\/v1\/stats(?:\?.*)?$/,
		{
			body: analyticsStats,
		},
	],
	[
		/^\/?accelerate\/v1\/stats\/aggregations(?:\?.*)?$/,
		{
			body: analyticsAggregations,
		},
	],
	[
		/^\/?accelerate\/v1\/top-engaged(?:\?.*)?$/,
		{
			body: topEngagedPosts,
		},
	],
	[
		/^\/?accelerate\/v1\/top\?(?:.*&)?type=broadcast(?:&.*)?$/,
		{
			body: broadcastPosts,
			headers: totalHeaders( broadcastPosts.length ),
		},
	],
	[
		/^\/?accelerate\/v1\/top\?(?:.*&)?type=wp_block(?:&.*)?$/,
		{
			body: broadcastBlocks,
			headers: totalHeaders( broadcastBlocks.length ),
		},
	],
	[
		/^\/?accelerate\/v1\/top(?:\?.*)?$/,
		{
			body: contentPosts,
			headers: totalHeaders( contentPosts.length ),
		},
	],
	[
		/^\/?accelerate\/v1\/diff(?:\?.*)?$/,
		{
			body: contentDiffs,
		},
	],
	[
		/^\/?accelerate\/v1\/broadcast(?:\?.*)?$/,
		{
			body: broadcastMutationResponse,
		},
	],
	[
		/^\/?accelerate\/v1\/broadcast\/\d+(?:\?.*)?$/,
		{
			body: broadcastMutationResponse,
		},
	],
	[
		/^\/?accelerate\/v1\/experiments(?:\?.*)?$/,
		{
			body: experiments,
			headers: totalHeaders( experiments.length ),
		},
	],
	[
		/^\/?accelerate\/v1\/settings\/account(?:\?.*)?$/,
		{
			body: settingsAccount,
		},
	],
	[
		/^\/?accelerate\/v1\/settings\/website(?:\?.*)?$/,
		{
			body: websiteSettings,
		},
	],
	[
		/^\/?accelerate\/v1\/settings(?:\?.*)?$/,
		{
			body: settingsValues,
		},
	],
	[
		/^\/?accelerate\/v1\/audiences\/fields(?:\?.*)?$/,
		{
			body: audienceFields,
		},
	],
	[
		/^\/?accelerate\/v1\/audiences\/estimate(?:\?.*)?$/,
		{
			body: returningVisitorsEstimate,
		},
	],
	[
		/^\/?accelerate\/v1\/audiences\/\d+(?:\?.*)?$/,
		{
			body: audiencePosts[0],
		},
	],
	[
		/^\/?accelerate\/v1\/audiences(?:\?.*)?$/,
		{
			body: audiencePosts,
			headers: totalHeaders( audiencePosts.length ),
		},
	],
	[
		/^\/wp\/v2\/posts(?:\?.*)?$/,
		{
			body: wpPosts,
			headers: totalHeaders( wpPosts.length ),
		},
	],
	[
		/^\/wp\/v2\/pages(?:\?.*)?$/,
		{
			body: wpPages,
			headers: totalHeaders( wpPages.length ),
		},
	],
	[
		/^\/wp\/v2\/blocks(?:\?.*)?$/,
		{
			body: wpBlocks,
			headers: totalHeaders( wpBlocks.length ),
		},
	],
] );
