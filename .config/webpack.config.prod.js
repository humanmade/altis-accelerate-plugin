/**
 * This file defines the production build configuration
*/
const { helpers, externals, loaders, presets } = require( '@humanmade/webpack-helpers' );
const { filePath } = helpers;

// Mutate the loader defaults.
loaders.ts.defaults.loader = 'babel-loader';
// Increase url-loader limit to embed logo inline.
loaders.url.defaults.options.limit = 200000;

module.exports = presets.production( {
	externals,
	entry: {
		"accelerate-admin": filePath( 'src/accelerate/index.tsx' ),
		"dashboard": filePath( 'src/dashboard/index.tsx' ),
		"global-blocks": filePath( 'src/global-blocks/index.js' ),
		'accelerate': filePath( 'src/accelerate.js' ),
		'audiences/data': filePath( 'src/audiences/data/index.js' ),
		'audiences/preview': filePath( 'src/audiences/preview/index.js' ),
		'audiences/ui': filePath( 'src/audiences/index.js' ),
		'blocks/data': filePath( 'src/blocks/data/index.js' ),
		'blocks/ui': filePath( 'src/blocks/index.js' ),
		'blocks/ab-test-preview': filePath( 'src/ab-test-preview.js' ),
		'blocks/altis-xb-preview': filePath( 'src/preview/altis-xb-preview.js' ),
		'blocks/broadcast': filePath( 'inc/blocks/broadcast/index.js' ),
		'blocks/ai': filePath( 'inc/ai/admin/index.js' ),
		'experiments': filePath( 'src/experiments.js' ),
		'experiments/sidebar': filePath( 'src/experiments/index.js' ),
		'titles': filePath( 'src/experiments/titles/index.js' ),
		'featured-images': filePath( 'src/experiments/featured-images/index.js' ),
	},
	output: {
		path: filePath( 'build' ),
		filename: '[name].[hash:8].js',
		chunkFilename: 'chunk.[id].[chunkhash:8].js',
	},
	resolve: {
		extensions: [
			'.ts',
			'.tsx',
			'.wasm',
			'.mjs',
			'.js',
			'.json',
		],
	},
} );
