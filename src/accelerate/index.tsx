/// <reference path="../global.d.ts" />

import React from 'react';
import ReactDOM from 'react-dom';

import { SlotFillProvider } from '@wordpress/components';
import { register, select } from '@wordpress/data';

import { store } from '../data';

import AppComponent from './containers/App';

import './index.scss';

// Register core blocks for BlockPreview parsing in admin context.
// Uses WordPress global since @wordpress/block-library isn't bundled.
if ( window.wp?.blockLibrary?.registerCoreBlocks ) {
	window.wp.blockLibrary.registerCoreBlocks();
}

// Set up redux store (only if not already registered).
if ( ! select( 'accelerate' ) ) {
	register( store );
}

const root = document.getElementById( 'altis-analytics-root' );
// eslint-disable-next-line react/no-render-return-value
const render = ( App: typeof AppComponent ) => {
	if ( ! root ) {
		return;
	}
	ReactDOM.render(
		<SlotFillProvider>
			<App
				config={ window.AltisAccelerateDashboardData }
			/>
		</SlotFillProvider>,
		root
	);
};

render( AppComponent );

// @ts-ignore
if ( module.hot ) {
	// @ts-ignore
	module.hot.accept( './containers/App', async () => {
		const App = await import( './containers/App' );
		render( App.default );
	} );
}
