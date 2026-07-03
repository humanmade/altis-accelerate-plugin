import type { Post } from '../utils/admin';

import { coffeeThumbnail, strawberryThumbnail, tomatoThumbnail } from './thumbnails';

const buildRawContent = ( imageSrc: string, title: string, description: string ): string =>
	`<!-- wp:image {"sizeSlug":"large"} --><figure class="wp-block-image size-large"><img src="${ imageSrc }" alt=""/></figure><!-- /wp:image -->`
	+ `<!-- wp:heading --><h2 class="wp-block-heading">${ title }</h2><!-- /wp:heading -->`
	+ `<!-- wp:paragraph --><p>${ description }</p><!-- /wp:paragraph -->`;

type RuntimeBroadcastPost = Omit<Post, 'title'> & {
	title: string;
	date: string;
	subtype: {
		name: string;
		label: string;
	};
	blocks?: number[];
	variants?: number;
};

const demoAuthors = {
	mara: {
		ID: 11,
		name: 'Mara Ellis',
		avatar: '',
	},
	jules: {
		ID: 12,
		name: 'Jules Hart',
		avatar: '',
	},
	nico: {
		ID: 13,
		name: 'Nico Reyes',
		avatar: '',
	},
};

const broadcastBlockItems: RuntimeBroadcastPost[] = [
	{
		id: 201,
		slug: 'seasonal-recipe-promo',
		type: {
			name: 'wp_block',
			label: 'Pattern',
		},
		subtype: {
			name: 'wp_block',
			label: 'Pattern',
		},
		author: demoAuthors.nico,
		title: 'Seasonal Recipe Promo',
		url: null,
		editUrl: '/wp-admin/post.php?post=201&action=edit',
		views: 780,
		lift: {
			views: 780,
			conversions: 36,
			fallback: {
				views: 390,
				conversions: 15,
			},
			personalized: {
				views: 390,
				conversions: 21,
			},
		},
		goal: 'click_any_link',
		blockType: 'personalization',
		date: '2026-06-10T08:00:00.000Z',
		rawContent: buildRawContent( strawberryThumbnail, 'Seasonal Recipe Promo', 'A rotating pick of the season\'s best recipes, refreshed as new posts land.' ),
		variants: 3,
	},
	{
		id: 202,
		slug: 'newsletter-sunday-prep',
		type: {
			name: 'wp_block',
			label: 'Pattern',
		},
		subtype: {
			name: 'wp_block',
			label: 'Pattern',
		},
		author: demoAuthors.mara,
		title: 'Sunday Prep Newsletter CTA',
		url: null,
		editUrl: '/wp-admin/post.php?post=202&action=edit',
		views: 640,
		lift: {
			views: 640,
			conversions: 42,
			fallback: {
				views: 320,
				conversions: 18,
			},
			personalized: {
				views: 320,
				conversions: 24,
			},
		},
		goal: 'submit_form',
		blockType: 'abtest',
		date: '2026-06-12T12:30:00.000Z',
		rawContent: buildRawContent( coffeeThumbnail, 'Sunday Prep Newsletter CTA', 'Get the Sunday prep list before everyone else.' ),
		variants: 2,
	},
	{
		id: 203,
		slug: 'tomato-tart-save-recipe',
		type: {
			name: 'wp_block',
			label: 'Pattern',
		},
		subtype: {
			name: 'wp_block',
			label: 'Pattern',
		},
		author: demoAuthors.jules,
		title: 'Tomato Tart Save Recipe CTA',
		url: null,
		editUrl: '/wp-admin/post.php?post=203&action=edit',
		views: 520,
		lift: {
			views: 520,
			conversions: 31,
			fallback: {
				views: 260,
				conversions: 13,
			},
			personalized: {
				views: 260,
				conversions: 18,
			},
		},
		goal: 'click_any_link',
		blockType: 'standard',
		date: '2026-06-14T10:20:00.000Z',
		rawContent: buildRawContent( tomatoThumbnail, 'Tomato Tart Save Recipe CTA', 'Save this weeknight tomato tart to make again.' ),
		variants: 1,
	},
];

const broadcastPostItems: RuntimeBroadcastPost[] = [
	{
		id: 301,
		slug: 'june-recipe-picks',
		type: {
			name: 'broadcast',
			label: 'Broadcast',
		},
		subtype: {
			name: 'broadcast',
			label: 'Broadcast',
		},
		author: demoAuthors.mara,
		title: 'June Recipe Picks',
		url: null,
		editUrl: '/wp-admin/post.php?post=301&action=edit',
		views: 2140,
		lift: null,
		goal: 'click_any_link',
		blockType: 'standard',
		date: '2026-06-18T12:00:00.000Z',
		blocks: [ 201, 202 ],
	},
	{
		id: 302,
		slug: 'weeknight-tomato-tart-follow-up',
		type: {
			name: 'broadcast',
			label: 'Broadcast',
		},
		subtype: {
			name: 'broadcast',
			label: 'Broadcast',
		},
		author: demoAuthors.jules,
		title: 'Weeknight Tomato Tart Follow-up',
		url: null,
		editUrl: '/wp-admin/post.php?post=302&action=edit',
		views: 1360,
		lift: null,
		goal: 'submit_form',
		blockType: 'standard',
		date: '2026-06-20T09:30:00.000Z',
		blocks: [ 203 ],
	},
	{
		id: 303,
		slug: 'summer-salad-welcome-series',
		type: {
			name: 'broadcast',
			label: 'Broadcast',
		},
		subtype: {
			name: 'broadcast',
			label: 'Broadcast',
		},
		author: demoAuthors.nico,
		title: 'Summer Salad Welcome Series',
		url: null,
		editUrl: '/wp-admin/post.php?post=303&action=edit',
		views: 980,
		lift: null,
		goal: 'engagement',
		blockType: 'standard',
		date: '2026-06-23T15:45:00.000Z',
		blocks: [],
	},
];

export const broadcastBlocks: Post[] = broadcastBlockItems as unknown as Post[];
export const broadcastPosts: Post[] = broadcastPostItems as unknown as Post[];
