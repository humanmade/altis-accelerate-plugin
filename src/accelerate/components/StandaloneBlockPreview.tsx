import { BlockEditorProvider, BlockPreview } from '@wordpress/block-editor';
import { BlockInstance, parse } from '@wordpress/blocks';
import { useEffect, useMemo, useState } from '@wordpress/element';

interface Props {
	// Data - provide ONE of these:
	content?: string;              // Raw block content to parse
	blocks?: BlockInstance[];      // Pre-parsed blocks (skip parsing)

	// Dimensions
	width?: number;
	height?: number;

	// Styling
	showShadow?: boolean;          // Default: true (list view has shadow)

	// Other
	variantIndex?: number;
	className?: string;
}

// Cache fetched styles to avoid refetching on each render.
let cachedStyles: { css: string }[] | null = null;
let stylesFetchPromise: Promise<{ css: string }[]> | null = null;

/**
 * Collect block-related stylesheets from the page and fetch their CSS content.
 * This is needed because BlockPreview renders in an iframe that doesn't inherit page styles.
 */
async function getBlockStyles(): Promise<{ css: string }[]> {
	if ( cachedStyles ) {
		return cachedStyles;
	}

	// Prevent multiple simultaneous fetches
	if ( stylesFetchPromise ) {
		return stylesFetchPromise;
	}

	stylesFetchPromise = ( async () => {
		// Fetch external stylesheets
		const styleSheets = Array.from( document.querySelectorAll( 'link[rel="stylesheet"]' ) ) as HTMLLinkElement[];
		const blockStyleUrls = styleSheets
			.map( link => link.href )
			.filter( href =>
				href.includes( 'wp-block-library' ) ||
				href.includes( 'wp-block-editor' ) ||
				href.includes( 'wp-components' )
			);

		const cssPromises = blockStyleUrls.map( async url => {
			try {
				const response = await fetch( url );
				const css = await response.text();
				return { css };
			} catch {
				return null;
			}
		} );

		const results = await Promise.all( cssPromises );
		const fetchedStyles = results.filter( ( result ): result is { css: string } => result !== null );

		// Also grab inline styles (global-styles, theme colors, etc.)
		const inlineStyles = Array.from( document.querySelectorAll( 'style' ) )
			.filter( style =>
				style.id?.includes( 'global-styles' ) ||
				style.id?.includes( 'wp-block' ) ||
				style.id?.includes( 'core-block' ) ||
				// Capture preset color rules (may have no ID)
				style.textContent?.includes( '.has-' ) && style.textContent?.includes( '-background-color' )
			)
			.map( style => ( { css: style.textContent || '' } ) )
			.filter( style => style.css.length > 0 );

		// Also check the editor iframe for preset styles (in block editor context)
		const editorIframe = document.querySelector( 'iframe[name="editor-canvas"]' ) as HTMLIFrameElement;
		if ( editorIframe?.contentDocument ) {
			const editorPresetStyles = Array.from( editorIframe.contentDocument.querySelectorAll( 'style' ) )
				.filter( style => style.textContent?.includes( '.has-' ) && style.textContent?.includes( '-background-color' ) )
				.map( style => ( { css: style.textContent || '' } ) )
				.filter( style => style.css.length > 0 );
			inlineStyles.push( ...editorPresetStyles );
		}

		cachedStyles = [ ...fetchedStyles, ...inlineStyles ];
		return cachedStyles;
	} )();

	return stylesFetchPromise;
}

/**
 * Get the site's background color from CSS custom properties or editor iframe.
 * Returns null if detection fails (preserves current transparent behavior).
 */
function getSiteBackgroundColor(): string | null {
	// Try CSS custom property first (global styles)
	const root = document.documentElement;
	const bgVar = getComputedStyle( root ).getPropertyValue( '--wp--preset--color--background' ).trim();
	if ( bgVar ) {
		return bgVar;
	}

	// Try editor iframe body background
	const editorIframe = document.querySelector( 'iframe[name="editor-canvas"]' ) as HTMLIFrameElement;
	if ( editorIframe?.contentDocument?.body ) {
		const bg = getComputedStyle( editorIframe.contentDocument.body ).backgroundColor;
		if ( bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' ) {
			return bg;
		}
	}

	return null;
}

/**
 * Standalone BlockPreview component for use outside the block editor context.
 * Wraps BlockPreview in a BlockEditorProvider to enable rendering in admin pages.
 */
export default function StandaloneBlockPreview( {
	content,
	blocks: providedBlocks,
	width = 105,
	height = 47,
	showShadow = true,
	variantIndex = 0,
	className,
}: Props ) {
	const [ styles, setStyles ] = useState<{ css: string }[]>( cachedStyles || [] );
	const [ isLoading, setIsLoading ] = useState( ! cachedStyles );

	useEffect( () => {
		if ( ! cachedStyles ) {
			getBlockStyles().then( fetchedStyles => {
				setStyles( fetchedStyles );
				setIsLoading( false );
			} );
		}
	}, [] );

	const blocks = useMemo( () => {
		// If blocks provided directly, use them (skip parsing)
		// Check for actual blocks (not just truthy - empty array is truthy but has no content)
		if ( providedBlocks && providedBlocks.length > 0 ) {
			return providedBlocks;
		}

		// Otherwise parse content string
		if ( ! content ) {
			return [];
		}

		try {
			const parsed = parse( content );
			// For A/B test blocks with multiple variants, show the variant at variantIndex.
			// WordPress parses unregistered blocks like altis/variant as core/missing,
			// but preserves their innerBlocks which contain the real content.
			const variants = parsed.filter(
				block => block.name === 'core/missing' && block.innerBlocks?.length
			);

			if ( variants.length > 0 ) {
				// Get specific variant by index, fallback to first if index out of bounds
				const targetVariant = variants[ variantIndex ] || variants[ 0 ];
				return targetVariant.innerBlocks;
			}
			// No variant wrapper found - return blocks as-is (standard block).
			return parsed;
		} catch {
			return [];
		}
	}, [ content, providedBlocks, variantIndex ] );

	// Show loading placeholder while styles are being fetched
	if ( isLoading ) {
		return (
			<div
				className={ `record-thumbnail__empty ${ className || '' }` }
				style={ {
					width,
					height,
				} }
			/>
		);
	}

	if ( ! blocks.length ) {
		return (
			<div
				className={ `record-thumbnail__empty ${ className || '' }` }
				style={ {
					width,
					height,
				} }
			/>
		);
	}

	// Get site background color for preview (fixes white-on-transparent color inversion)
	const siteBackground = getSiteBackgroundColor();

	// Custom CSS to remove editor bottom padding and last-block margins
	const previewOverrides = {
		css: `
			${ siteBackground ? `body { background-color: ${ siteBackground }; }` : '' }
			/* Remove appender/insertion area padding */
			.block-editor-block-list__layout {
				padding-bottom: 0 !important;
			}
			/* Remove margin from last block */
			.block-editor-block-list__layout > *:last-child {
				margin-bottom: 0 !important;
			}
			/* Remove default block appender if present */
			.block-editor-default-block-appender {
				display: none !important;
			}
		`,
	};

	const settings = {
		styles: [ ...styles, previewOverrides ],
	};

	// Use 1200px viewport for desktop layout (wider than previous 800px)
	const viewportWidth = 1200;

	return (
		<div
			className={ `standalone-block-preview ${ className || '' }`.trim() }
			style={ {
				borderRadius: '2px',
				boxShadow: showShadow ? '0 4px 7px 0 rgba(21, 42, 79, 0.2)' : 'none',
				maxWidth: width,
			} }
		>
			<div
				style={ {
					width,
					maxHeight: height,
					overflow: 'hidden',
					borderRadius: '2px',
				} }
			>
				<BlockEditorProvider settings={ settings } value={ blocks }>
					<BlockPreview
						blocks={ blocks }
						viewportWidth={ viewportWidth }
					/>
				</BlockEditorProvider>
			</div>
		</div>
	);
}
