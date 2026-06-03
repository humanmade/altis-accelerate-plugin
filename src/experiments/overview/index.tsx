import React from 'react';
import ReactDOM from 'react-dom';

import { register, select } from '@wordpress/data';

import Dashboard from './Dashboard';
import { store } from './data/store';

// Register store (only if not already registered).
if ( ! select( 'accelerate/experiments' ) ) {
	register( store );
}

const root = document.getElementById( 'altis-experiments-overview' );

const render = ( App: typeof Dashboard ) => {
	if ( ! root ) {
		return;
	}
	ReactDOM.render( <App />, root );
};

render( Dashboard );

// @ts-ignore
if ( module.hot ) {
	// @ts-ignore
	module.hot.accept( './Dashboard', async () => {
		const App = await import( './Dashboard' );
		render( App.default );
	} );
}
