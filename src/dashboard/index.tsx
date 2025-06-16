import React from 'react';
import ReactDOM from 'react-dom';
import { SlotFillProvider } from '@wordpress/components';
import { register } from '@wordpress/data';

import AppComponent from './components/App';
import { store } from '../data';

import 'react-dates/initialize';
import 'react-dates/lib/css/_datepicker.css';
import './twreset.css';
import ReactModal from 'react-modal';

register( store );

const root = document.getElementById( 'accelerate-analytics-root' );

// eslint-disable-next-line react/no-render-return-value
const render = ( App: typeof AppComponent ) => {
	if ( ! root ) {
		return;
	}

	ReactDOM.render(
		<SlotFillProvider>
			<App />
		</SlotFillProvider>,
		root
	);
	ReactModal.setAppElement( root );
};

render( AppComponent );

// @ts-ignore
if ( module.hot ) {
	// @ts-ignore
	module.hot.accept( './components/App', async () => {
		const App = await import( './components/App' );
		render( App.default );
	} );
}
