import { decodeEntities } from '@wordpress/html-entities';
import { __ } from '@wordpress/i18n';

const ROW_LIMIT = 10;

// Subset of the /accelerate/v1/top post shape this tile needs. `url` is the
// post permalink (absolute, or null for non-public types) — used for the
// click-to-drill path filter (#669).
export type TopPost = {
	id: number;
	title: string;
	views: number;
	url?: string | null;
};

// Matches the BreakdownPanel HostList row contract (key + value), with an
// optional label override so the row can show a decoded title while keeping
// the post id as its stable rank/React identity. `path` is the relative URL
// used to drill the view by this post (#669); absent for non-public posts.
export type ContentItem = {
	key: string;
	value: number;
	label: string;
	path?: string;
};

/**
 * Map view-ranked /top posts to HostList rows. Pure (no fetch, no React) so
 * the decode + fallback + slice logic is unit-testable in isolation, like
 * prettyLabel. `/top` already returns posts ordered by views, so we just cap
 * the list. Post id is the row key (stable identity); the decoded title is the
 * display label, falling back to a localized "(no title)" for untitled posts.
 */
/**
 * Reduce an absolute permalink to the relative path the `filter.path` facet
 * expects (the server reconstructs it via `home_url( $filter->path )`). Returns
 * undefined for a missing/unparseable url so the row falls back to inert.
 */
function toRelativePath( url?: string | null ): string | undefined {
	if ( ! url ) {
		return undefined;
	}
	try {
		const parsed = new URL( url );
		const home = window.AltisAccelerateDashboardData?.home_url;
		const base = home ? new URL( home ) : null;
		// Guard against external permalinks using the home origin when known,
		// falling back to window.location.origin.
		const expectedOrigin = base ? base.origin : window.location.origin;
		if ( parsed.origin !== expectedOrigin ) {
			return undefined;
		}
		// Strip the home base path so filter.path is relative to home_url,
		// matching how the server reconstructs it via home_url( $filter->path ).
		// Handles subdirectory installs (e.g. home_url = https://site.com/wp).
		let path = parsed.pathname;
		const basePath = base ? base.pathname.replace( /\/+$/, '' ) : '';
		if ( basePath ) {
			if ( path === basePath || path.startsWith( basePath + '/' ) ) {
				path = path.slice( basePath.length ) || '/';
			} else {
				// Same-origin but outside the WP install's base path — not a
				// drillable content path, so leave the row inert.
				return undefined;
			}
		}
		return path + parsed.search;
	} catch {
		return undefined;
	}
}

export function toContentItems( posts: TopPost[], limit: number = ROW_LIMIT ): ContentItem[] {
	return posts
		.slice( 0, limit )
		.map( post => ( {
			key: String( post.id ),
			value: post.views,
			label: decodeEntities( post.title || '' ) || __( '(no title)', 'altis' ),
			path: toRelativePath( post.url ),
		} ) );
}
