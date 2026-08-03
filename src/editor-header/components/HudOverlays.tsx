import { createPortal, useEffect, useState } from '@wordpress/element';

import { useCanvasDocument } from '../../data/hooks';
import { useAccelerateBlocks, AccelerateBlock } from '../hooks/useAccelerateBlocks';

interface HudOverlaysProps {
	enabled: boolean;
}

const TYPE_LABELS: Record<AccelerateBlock['blockType'], string> = {
	standard: 'Global Block',
	abtest: 'A/B Testing',
	personalization: 'Personalization',
	broadcast: 'Broadcast',
};

const COUNT_LABELS: Record<AccelerateBlock['blockType'], ( count: number ) => string> = {
	standard: () => '', // Goal shown separately for standard
	abtest: count => count === 1 ? '1 Variant' : `${ count } Variants`,
	personalization: count => count === 1 ? '1 Audience' : `${ count } Audiences`,
	broadcast: count => count === 1 ? '1 Block In Rotation' : `${ count } Blocks In Rotation`,
};

// Map goal values to display labels
const GOAL_LABELS: Record<string, string> = {
	engagement: 'Engagement',
	click: 'Link Click',
	submission: 'Form Submission',
};

const sharedStyles: React.CSSProperties = {
	color: 'white',
	fontSize: '11px',
	padding: '0 8px',
	height: '26px',
	display: 'flex',
	alignItems: 'center',
	pointerEvents: 'none',
	fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
};

const line1Styles: React.CSSProperties = {
	...sharedStyles,
	fontWeight: 700,
	background: '#9332ff',
	borderRadius: '3px 3px 3px 0', // Missing bottom-left
};

const line2Styles: React.CSSProperties = {
	...sharedStyles,
	fontWeight: 400,
	background: '#333',
	borderRadius: '0 0 3px 3px', // Missing top-left and top-right
};

/**
 * Get line 2 text based on block type
 */
const getLine2Text = ( block: AccelerateBlock ): string => {
	if ( block.blockType === 'standard' ) {
		const goalText = block.goal ? ( GOAL_LABELS[ block.goal ] || block.goal ) : 'No goal selected';
		return `Goal: ${ goalText }`;
	}
	if ( block.variantCount > 0 ) {
		return COUNT_LABELS[ block.blockType ]( block.variantCount );
	}
	return '';
};

/**
 * Generate CSS rules for HUD overlay borders.
 */
const generateBorderCss = ( blocks: AccelerateBlock[], enabled: boolean ): string => {
	if ( blocks.length === 0 ) {
		return '';
	}

	const opacity = enabled ? 1 : 0;
	const rules: string[] = [];

	for ( const block of blocks ) {
		rules.push( `
[data-block="${ block.clientId }"] {
	position: relative !important;
}

[data-block="${ block.clientId }"]::after {
	content: '';
	position: absolute;
	inset: 0;
	border: 5px solid rgba(147, 50, 255, 0.5);
	pointer-events: none;
	z-index: 20;
	opacity: ${ opacity };
	transition: opacity 0.2s ease-in-out;
}
` );
	}

	return rules.join( '\n' );
};

// Give up resolving a block's DOM node after ~5s (300 frames) so the retry
// loop can't spin forever if a block in the store never paints.
const MAX_FIND_FRAMES = 300;

/**
 * Individual block label component
 */
const BlockLabel = ( { block, enabled, canvasDoc }: { block: AccelerateBlock; enabled: boolean; canvasDoc: Document } ) => {
	const [ container, setContainer ] = useState<Element | null>( null );

	useEffect( () => {
		let frame = 0;
		let attempts = 0;

		// Clear any stale target while we re-resolve (e.g. canvas remount).
		setContainer( null );

		const find = () => {
			const el = canvasDoc.querySelector( `[data-block="${ block.clientId }"]` );

			if ( el ) {
				setContainer( el );
			} else if ( attempts < MAX_FIND_FRAMES ) {
				attempts++;
				frame = requestAnimationFrame( find );
			}
		};

		find();

		return () => {
			cancelAnimationFrame( frame );
		};
	}, [ block.clientId, canvasDoc ] );

	if ( ! container ) {
		return null;
	}

	const line1 = `${ TYPE_LABELS[ block.blockType ] } - ${ block.blockName }`;
	const line2 = getLine2Text( block );

	return createPortal(
		<div
			style={ {
				position: 'absolute',
				top: '10px',
				left: '10px',
				zIndex: 20,
				pointerEvents: 'none',
				opacity: enabled ? 1 : 0,
				transition: 'opacity 0.2s ease-in-out',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'flex-start',
			} }
		>
			<div style={ line1Styles }>{ line1 }</div>
			{ line2 && <div style={ line2Styles }>{ line2 }</div> }
		</div>,
		container
	);
};

export const HudOverlays = ( { enabled }: HudOverlaysProps ) => {
	const blocks = useAccelerateBlocks();
	const canvasDoc = useCanvasDocument();

	if ( blocks.length === 0 || ! canvasDoc ) {
		return null;
	}

	const borderCss = generateBorderCss( blocks, enabled );

	return (
		<>
			{ createPortal(
				<style id="accelerate-hud-overlays">{ borderCss }</style>,
				canvasDoc.head
			) }
			{ blocks.map( block => (
				<BlockLabel key={ block.clientId } block={ block } canvasDoc={ canvasDoc } enabled={ enabled } />
			) ) }
		</>
	);
};
