import { BlockEditorProvider, BlockPreview } from '@wordpress/block-editor';
import { BlockInstance, parse } from '@wordpress/blocks';
import { useEffect, useMemo, useRef, useState } from '@wordpress/element';

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
	lazy?: boolean;
}

function getBlockStyles(): { css: string }[] {
	const w = window as any;
	return w.AltisAccelerateDashboardData?.previewStyles
		?? w.altisReusableBlocksSettings?.previewStyles
		?? [];
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
 * Wrapper that hides the iframe preview briefly, then fades it in.
 * Avoids the flash of unstyled content while the iframe loads its styles.
 */
function PreviewReveal( { children, className, width, height, showShadow }: {
	children: React.ReactNode;
	className: string;
	width: number;
	height: number;
	showShadow: boolean;
} ) {
	const [ visible, setVisible ] = useState( false );

	useEffect( () => {
		const timer = setTimeout( () => setVisible( true ), 150 );
		return () => clearTimeout( timer );
	}, [] );

	return (
		<div
			className={ className }
			style={ {
				borderRadius: '2px',
				boxShadow: showShadow ? '0 4px 7px 0 rgba(21, 42, 79, 0.2)' : 'none',
				maxWidth: width,
				position: 'relative',
			} }
		>
			{ /* Skeleton placeholder visible until preview fades in */ }
			{ ! visible && (
				<div
					style={ {
						width,
						height,
						borderRadius: '2px',
						backgroundColor: '#f0f0f0',
					} }
				/>
			) }
			<div
				style={ {
					width,
					maxHeight: height,
					overflow: 'hidden',
					borderRadius: '2px',
					opacity: visible ? 1 : 0,
					transition: 'opacity 150ms ease-out',
					position: visible ? 'relative' : 'absolute',
					top: 0,
					left: 0,
				} }
			>
				{ children }
			</div>
		</div>
	);
}

/**
 * Standalone BlockPreview component for use outside the block editor context.
 *
 * BlockPreview creates an iframe-backed editor, so defer that work until the
 * thumbnail is near the viewport. The fixed-size placeholder prevents layout
 * shift while it waits to be loaded.
 */
export default function StandaloneBlockPreview( props: Props ) {
	const {
		className,
		height = 47,
		lazy = true,
		showShadow = true,
		width = 105,
	} = props;
	const previewRef = useRef<HTMLDivElement>( null );
	const [ isVisible, setIsVisible ] = useState( ! lazy );

	useEffect( () => {
		if ( ! lazy ) {
			setIsVisible( true );
			return;
		}

		if ( isVisible ) {
			return;
		}

		const preview = previewRef.current;
		if ( ! preview || typeof IntersectionObserver === 'undefined' ) {
			setIsVisible( true );
			return;
		}

		const observer = new IntersectionObserver( entries => {
			if ( entries.some( entry => entry.isIntersecting ) ) {
				setIsVisible( true );
				observer.disconnect();
			}
		}, { rootMargin: '200px 0px' } );

		observer.observe( preview );

		return () => observer.disconnect();
	}, [ isVisible, lazy ] );

	if ( ! isVisible ) {
		return (
			<div
				ref={ previewRef }
				aria-hidden="true"
				className={ `standalone-block-preview ${ className || '' }`.trim() }
				style={ {
					width,
					height,
					borderRadius: '2px',
					boxShadow: showShadow ? '0 4px 7px 0 rgba(21, 42, 79, 0.2)' : 'none',
					backgroundColor: '#f0f0f0',
				} }
			/>
		);
	}

	return <LoadedBlockPreview { ...props } />;
}

function LoadedBlockPreview( {
	content,
	blocks: providedBlocks,
	width = 105,
	height = 47,
	showShadow = true,
	variantIndex = 0,
	className,
}: Props ) {
	const styles = useMemo( getBlockStyles, [] );

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
		<PreviewReveal
			className={ `standalone-block-preview ${ className || '' }`.trim() }
			height={ height }
			showShadow={ showShadow }
			width={ width }
		>
			<BlockEditorProvider settings={ settings } value={ blocks }>
				<BlockPreview
					blocks={ blocks }
					viewportWidth={ viewportWidth }
				/>
			</BlockEditorProvider>
		</PreviewReveal>
	);
}
