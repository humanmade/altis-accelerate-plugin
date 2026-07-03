import type { DiffsResult, Post } from '../utils/admin';

import {
	cakeThumbnail,
	lemonThumbnail,
	saladThumbnail,
	sandwichThumbnail,
	strawberryThumbnail,
	tomatoThumbnail,
} from './thumbnails';

type RuntimeContentPost = Omit<Post, 'title'> & {
	title: string;
	date: string;
	subtype: {
		name: string;
		label: string;
	};
	variants?: number;
	blocks?: number[];
	parent?: {
		title: string;
		editUrl: string;
	};
};

type HistogramPoint = {
	index: number;
	count: number;
};

export type TopEngagedPost = {
	id: number;
	title: string;
	engaged_seconds: number;
};

export type WPContentItem = {
	id: number;
	type: 'post' | 'page';
	date: string;
	link: string;
	title: {
		raw?: string;
		rendered: string;
	};
	content: {
		raw?: string;
		rendered: string;
	};
};

export type WPBlockItem = {
	id: number;
	type: 'wp_block';
	title: {
		raw?: string;
		rendered: string;
	};
	content: {
		raw?: string;
		rendered: string;
	};
};

export type BroadcastRestPost = {
	id: number;
	type: 'broadcast';
	date: string;
	title: {
		rendered: string;
	};
	blocks: number[];
};

const histogram = ( counts: number[] ): HistogramPoint[] => counts.map( ( count, index ) => ( {
	index,
	count,
} ) );

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

const buildRawContent = ( imageSrc: string, title: string, description: string ): string =>
	`<!-- wp:image {"sizeSlug":"large"} --><figure class="wp-block-image size-large"><img src="${ imageSrc }" alt=""/></figure><!-- /wp:image -->`
	+ `<!-- wp:heading --><h2 class="wp-block-heading">${ title }</h2><!-- /wp:heading -->`
	+ `<!-- wp:paragraph --><p>${ description }</p><!-- /wp:paragraph -->`;

const runtimeContentPosts: RuntimeContentPost[] = [
	{
		id: 101,
		slug: 'five-summer-salads-for-the-grill',
		type: {
			name: 'post',
			label: 'Post',
		},
		subtype: {
			name: 'post',
			label: 'Post',
		},
		author: demoAuthors.mara,
		title: 'Five Summer Salads for the Grill',
		url: 'https://pantryandplate.example/recipes/five-summer-salads-for-the-grill/',
		editUrl: '/wp-admin/post.php?post=101&action=edit',
		views: 6050,
		lift: {
			views: 6050,
			conversions: 357,
			fallback: {
				views: 3025,
				conversions: 149,
			},
			personalized: {
				views: 3025,
				conversions: 208,
			},
		},
		goal: 'click_any_link',
		blockType: 'standard',
		date: '2026-06-13T09:15:00.000Z',
		rawContent: buildRawContent( saladThumbnail, 'Five Summer Salads for the Grill', 'A bright mix of charred corn, herbs, stone fruit, and pantry dressings for easy outdoor dinners.' ),
		variants: 2,
	},
	{
		id: 102,
		slug: 'weeknight-tomato-tart',
		type: {
			name: 'post',
			label: 'Post',
		},
		subtype: {
			name: 'post',
			label: 'Post',
		},
		author: demoAuthors.jules,
		title: 'A Weeknight Tomato Tart That Still Feels Special',
		url: 'https://pantryandplate.example/recipes/weeknight-tomato-tart/',
		editUrl: '/wp-admin/post.php?post=102&action=edit',
		views: 2410,
		lift: {
			views: 2410,
			conversions: 101,
			fallback: {
				views: 1205,
				conversions: 45,
			},
			personalized: {
				views: 1205,
				conversions: 56,
			},
		},
		goal: 'submit_form',
		blockType: 'abtest',
		date: '2026-06-08T13:35:00.000Z',
		rawContent: buildRawContent( tomatoThumbnail, 'A Weeknight Tomato Tart That Still Feels Special', 'Store-bought puff pastry, ripe tomatoes, and a fast herb ricotta base.' ),
		variants: 2,
	},
	{
		id: 103,
		slug: 'lemon-herb-chicken-new-potatoes',
		type: {
			name: 'post',
			label: 'Post',
		},
		subtype: {
			name: 'post',
			label: 'Post',
		},
		author: demoAuthors.nico,
		title: 'Crispy Lemon Herb Chicken with New Potatoes',
		url: 'https://pantryandplate.example/recipes/lemon-herb-chicken-new-potatoes/',
		editUrl: '/wp-admin/post.php?post=103&action=edit',
		views: 1840,
		lift: {
			views: 1840,
			conversions: 74,
			fallback: {
				views: 920,
				conversions: 35,
			},
			personalized: {
				views: 920,
				conversions: 39,
			},
		},
		goal: 'engagement',
		blockType: 'standard',
		date: '2026-05-28T10:20:00.000Z',
		rawContent: buildRawContent( lemonThumbnail, 'Crispy Lemon Herb Chicken with New Potatoes', 'Crispy skin, garlicky herb butter, and potatoes roasted in the drippings.' ),
		variants: 1,
	},
	{
		id: 104,
		slug: 'better-picnic-sandwiches',
		type: {
			name: 'page',
			label: 'Page',
		},
		subtype: {
			name: 'page',
			label: 'Page',
		},
		author: demoAuthors.mara,
		title: 'The Pantry Guide to Better Picnic Sandwiches',
		url: 'https://pantryandplate.example/guides/better-picnic-sandwiches/',
		editUrl: '/wp-admin/post.php?post=104&action=edit',
		views: 1260,
		lift: {
			views: 1260,
			conversions: 38,
			fallback: {
				views: 630,
				conversions: 21,
			},
			personalized: {
				views: 630,
				conversions: 17,
			},
		},
		goal: 'click_any_link',
		blockType: 'standard',
		date: '2026-05-04T15:05:00.000Z',
		rawContent: buildRawContent( sandwichThumbnail, 'The Pantry Guide to Better Picnic Sandwiches', 'Layering, seasoning, and packing notes for sandwiches that travel well.' ),
		variants: 1,
	},
	{
		id: 105,
		slug: 'strawberry-sheet-cake',
		type: {
			name: 'post',
			label: 'Post',
		},
		subtype: {
			name: 'post',
			label: 'Post',
		},
		author: demoAuthors.jules,
		title: 'Strawberry Sheet Cake with Brown Butter Crumbs',
		url: 'https://pantryandplate.example/recipes/strawberry-sheet-cake/',
		editUrl: '/wp-admin/post.php?post=105&action=edit',
		views: 1040,
		lift: {
			views: 1040,
			conversions: 28,
			fallback: {
				views: 520,
				conversions: 15,
			},
			personalized: {
				views: 520,
				conversions: 13,
			},
		},
		goal: 'engagement',
		blockType: 'standard',
		date: '2026-04-18T11:40:00.000Z',
		rawContent: buildRawContent( cakeThumbnail, 'Strawberry Sheet Cake with Brown Butter Crumbs', 'A sheet-pan cake with macerated strawberries and a browned butter crumb topping.' ),
		variants: 1,
	},
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
];

export const contentPosts: Post[] = runtimeContentPosts as unknown as Post[];

export const contentDiffs: DiffsResult = {
	101: {
		previous: {
			views: 5120,
			by_date: histogram( [ 520, 640, 710, 780, 860, 760, 850 ] ),
		},
		current: {
			views: 6050,
			by_date: histogram( [ 610, 720, 860, 810, 920, 970, 1160 ] ),
		},
	},
	102: {
		previous: {
			views: 2210,
			by_date: histogram( [ 210, 280, 340, 320, 360, 310, 390 ] ),
		},
		current: {
			views: 2410,
			by_date: histogram( [ 260, 310, 350, 330, 410, 350, 400 ] ),
		},
	},
	103: {
		previous: {
			views: 1780,
			by_date: histogram( [ 180, 220, 250, 270, 310, 260, 290 ] ),
		},
		current: {
			views: 1840,
			by_date: histogram( [ 190, 240, 280, 250, 300, 270, 310 ] ),
		},
	},
	104: {
		previous: {
			views: 1450,
			by_date: histogram( [ 170, 210, 240, 220, 230, 190, 190 ] ),
		},
		current: {
			views: 1260,
			by_date: histogram( [ 130, 180, 210, 190, 210, 160, 180 ] ),
		},
	},
	105: {
		previous: {
			views: 1180,
			by_date: histogram( [ 160, 170, 180, 190, 180, 150, 150 ] ),
		},
		current: {
			views: 1040,
			by_date: histogram( [ 120, 150, 170, 160, 180, 130, 130 ] ),
		},
	},
	201: {
		previous: {
			views: 690,
			by_date: histogram( [ 80, 90, 100, 110, 100, 90, 120 ] ),
		},
		current: {
			views: 780,
			by_date: histogram( [ 90, 100, 110, 120, 110, 100, 150 ] ),
		},
	},
};

export const topEngagedPosts: TopEngagedPost[] = [
	{
		id: 101,
		title: 'Five Summer Salads for the Grill',
		engaged_seconds: 154,
	},
	{
		id: 102,
		title: 'A Weeknight Tomato Tart That Still Feels Special',
		engaged_seconds: 142,
	},
	{
		id: 103,
		title: 'Crispy Lemon Herb Chicken with New Potatoes',
		engaged_seconds: 129,
	},
	{
		id: 104,
		title: 'The Pantry Guide to Better Picnic Sandwiches',
		engaged_seconds: 118,
	},
	{
		id: 105,
		title: 'Strawberry Sheet Cake with Brown Butter Crumbs',
		engaged_seconds: 104,
	},
];

export const wpPosts: WPContentItem[] = [
	{
		id: 101,
		type: 'post',
		date: '2026-06-13T09:15:00.000Z',
		link: 'https://pantryandplate.example/recipes/five-summer-salads-for-the-grill/',
		title: {
			raw: 'Five Summer Salads for the Grill',
			rendered: 'Five Summer Salads for the Grill',
		},
		content: {
			raw: '<!-- wp:paragraph --><p>A bright mix of charred corn, herbs, stone fruit, and pantry dressings for easy outdoor dinners.</p><!-- /wp:paragraph -->',
			rendered: '<p>A bright mix of charred corn, herbs, stone fruit, and pantry dressings for easy outdoor dinners.</p>',
		},
	},
	{
		id: 102,
		type: 'post',
		date: '2026-06-08T13:35:00.000Z',
		link: 'https://pantryandplate.example/recipes/weeknight-tomato-tart/',
		title: {
			raw: 'A Weeknight Tomato Tart That Still Feels Special',
			rendered: 'A Weeknight Tomato Tart That Still Feels Special',
		},
		content: {
			raw: '<!-- wp:paragraph --><p>Store-bought puff pastry, ripe tomatoes, and a fast herb ricotta base.</p><!-- /wp:paragraph -->',
			rendered: '<p>Store-bought puff pastry, ripe tomatoes, and a fast herb ricotta base.</p>',
		},
	},
];

export const wpPages: WPContentItem[] = [
	{
		id: 104,
		type: 'page',
		date: '2026-05-04T15:05:00.000Z',
		link: 'https://pantryandplate.example/guides/better-picnic-sandwiches/',
		title: {
			raw: 'The Pantry Guide to Better Picnic Sandwiches',
			rendered: 'The Pantry Guide to Better Picnic Sandwiches',
		},
		content: {
			raw: '<!-- wp:paragraph --><p>Layering, seasoning, and packing notes for sandwiches that travel well.</p><!-- /wp:paragraph -->',
			rendered: '<p>Layering, seasoning, and packing notes for sandwiches that travel well.</p>',
		},
	},
];

export const wpBlocks: WPBlockItem[] = [
	{
		id: 201,
		type: 'wp_block',
		title: {
			raw: 'Seasonal Recipe Promo',
			rendered: 'Seasonal Recipe Promo',
		},
		content: {
			raw: '<!-- wp:buttons --><div class="wp-block-buttons"><!-- wp:button --><div class="wp-block-button"><a class="wp-block-button__link">Start with summer recipes</a></div><!-- /wp:button --></div><!-- /wp:buttons -->',
			rendered: '<div class="wp-block-buttons"><div class="wp-block-button"><a class="wp-block-button__link">Start with summer recipes</a></div></div>',
		},
	},
];

export const broadcastMutationResponse: BroadcastRestPost = {
	id: 301,
	type: 'broadcast',
	date: '2026-06-18T12:00:00.000Z',
	title: {
		rendered: 'June Recipe Picks',
	},
	blocks: [ 201 ],
};
