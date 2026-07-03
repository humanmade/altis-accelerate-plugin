import React from 'react';
import ReactDOM from 'react-dom';

import StyleguideApp from './StyleguideApp';

const root = document.getElementById( 'accelerate-styleguide-root' );

if ( root ) {
	// eslint-disable-next-line react/no-render-return-value
	ReactDOM.render( <StyleguideApp />, root );
}
