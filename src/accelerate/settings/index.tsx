/// <reference path="../../global.d.ts" />

import React from 'react';
import ReactDOM from 'react-dom';

import Settings from './Settings';

import '../../tailwind.css';

const root = document.getElementById( 'accelerate-settings-root' );

if ( root ) {
	ReactDOM.render(
		<div className="tailwind">
			<Settings />
		</div>,
		root
	);
}

// Hot module replacement for development
// @ts-ignore
if ( module.hot ) {
	// @ts-ignore
	module.hot.accept( './Settings', async () => {
		const { default: SettingsComponent } = await import( './Settings' );
		if ( root ) {
			ReactDOM.render(
				<div className="tailwind">
					<SettingsComponent />
				</div>,
				root
			);
		}
	} );
}
