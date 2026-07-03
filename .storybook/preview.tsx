import type { Decorator, Preview } from '@storybook/react-vite';
import * as React from 'react';

import './wordpress-globals';
import './fixture-handler';
import '@wordpress/block-editor/build-style/style.css';
import '@wordpress/block-library/build-style/style.css';
import '@wordpress/block-library/build-style/theme.css';
import '@wordpress/components/build-style/style.css';
import '../src/tailwind.css';
// @ts-expect-error Vite raw-loads CSS text for the BlockPreview iframe settings.
import blockEditorCss from '@wordpress/block-editor/build-style/style.css?raw';
// @ts-expect-error Vite raw-loads CSS text for the BlockPreview iframe settings.
import blockLibraryCss from '@wordpress/block-library/build-style/style.css?raw';
// @ts-expect-error Vite raw-loads CSS text for the BlockPreview iframe settings.
import blockLibraryThemeCss from '@wordpress/block-library/build-style/theme.css?raw';
// @ts-expect-error Vite raw-loads CSS text for the BlockPreview iframe settings.
import componentsCss from '@wordpress/components/build-style/style.css?raw';

( globalThis as typeof globalThis & { React?: typeof React } ).React = React;

const blockPreviewStyles = `
	body {
		color: #1e1e1e;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
		font-size: 16px;
		line-height: 1.5;
	}
	p {
		margin: 0 0 1em;
	}
	.wp-block-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5em;
	}
	.wp-block-button__link {
		background: #32373c;
		border-radius: 9999px;
		color: #fff;
		display: inline-block;
		padding: 0.667em 1.333em;
		text-decoration: none;
	}
	img {
		height: auto;
		max-width: 100%;
	}
`;

if ( typeof document !== 'undefined' ) {
	let style = document.getElementById( 'wp-block-library-storybook-preview-styles' );
	if ( ! style ) {
		style = document.createElement( 'style' );
		style.id = 'wp-block-library-storybook-preview-styles';
		document.head.appendChild( style );
	}
	style.textContent = [
		blockEditorCss,
		blockLibraryCss,
		blockLibraryThemeCss,
		componentsCss,
		blockPreviewStyles,
	].join( '\n' );
}

const withAccelerateWrapper: Decorator = ( Story, context ) => {
	const padding = context.parameters.accelerateLayout === 'page' ? 0 : '2rem';
	// Dark mode can be re-wired here once the plugin ships dark theme variables.
	const className = 'tailwind accelerate-ui';

	return (
		<div className={ className } style={ { padding } }>
			<Story />
		</div>
	);
};

const preview: Preview = {
	decorators: [
		withAccelerateWrapper,
	],
	parameters: {
		controls: {
			expanded: true,
		},
		options: {
			storySort: {
				method: 'alphabetical',
				order: [
					'Content Explorer',
					[
						'List',
						'*',
					],
					'Analytics',
					[
						'Overview',
						'*',
					],
					'Audiences',
					[
						'Manager',
						'*',
					],
					'Experiments',
					[
						'Overview',
						'*',
					],
					'Broadcast',
					[
						'Manager',
						'*',
					],
					'Settings',
					[
						'Panel',
						'*',
					],
					'Editor Controls',
					[
						'HeaderBar',
						'*',
					],
					'Components',
					[
						'*',
						'Admin',
						'UI',
					],
				],
			},
		},
	},
};

export default preview;
