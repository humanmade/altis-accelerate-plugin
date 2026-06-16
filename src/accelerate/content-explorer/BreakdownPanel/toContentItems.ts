import { decodeEntities } from '@wordpress/html-entities';
import { __ } from '@wordpress/i18n';

const ROW_LIMIT = 10;

// Subset of the /accelerate/v1/top post shape this tile needs.
export type TopPost = {
	id: number;
	title: string;
	views: number;
};

// Matches the BreakdownPanel HostList row contract (key + value), with an
// optional label override so the row can show a decoded title while keeping
// the post id as its stable rank/React identity.
export type ContentItem = {
	key: string;
	value: number;
	label: string;
};

/**
 * Map view-ranked /top posts to HostList rows. Pure (no fetch, no React) so
 * the decode + fallback + slice logic is unit-testable in isolation, like
 * prettyLabel. `/top` already returns posts ordered by views, so we just cap
 * the list. Post id is the row key (stable identity); the decoded title is the
 * display label, falling back to a localized "(no title)" for untitled posts.
 */
export function toContentItems( posts: TopPost[], limit: number = ROW_LIMIT ): ContentItem[] {
	return posts
		.slice( 0, limit )
		.map( post => ( {
			key: String( post.id ),
			value: post.views,
			label: decodeEntities( post.title || '' ) || __( '(no title)', 'altis' ),
		} ) );
}
