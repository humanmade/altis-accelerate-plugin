const { externals } = require( '@humanmade/webpack-helpers' );

const myExternals = {
	'@wordpress/preferences': 'wp.preferences',
	...externals,
};

module.exports = myExternals;
