/**
 * This file defines the development build configuration
 */
const { helpers, loaders, presets } = require( '@humanmade/webpack-helpers' );
const externals = require( './externals' );
const { choosePort, filePath } = helpers;

// Mutate the loader defaults.
loaders.ts.defaults.loader = 'babel-loader';

module.exports = choosePort( 8080 ).then( port =>
	presets.development( {
		externals,
		devServer: {
			port,
			https: true,
			client: {
				overlay: {
					runtimeErrors: ( error ) => {
						if ( error.message === 'ResizeObserver loop completed with undelivered notifications.' ) {
							return false;
						}
						return true;
					},
				},
			},
		},
		entry: {
			"accelerate-admin": filePath( 'src/accelerate/index.tsx' ),
			"accelerate-settings": filePath( 'src/accelerate/settings/index.tsx' ),
			"dashboard": filePath( 'src/dashboard/index.tsx' ),
			"global-blocks": filePath( 'src/global-blocks/index.js' ),
			'accelerate': filePath( 'src/accelerate.js' ),
			'audiences/data': filePath( 'src/audiences/data/index.ts' ),
			'audiences/preview': filePath( 'src/audiences/preview/index.js' ),
			'audiences/ui': filePath( 'src/audiences/index.js' ),
			'blocks/data': filePath( 'src/blocks/data/index.js' ),
			'blocks/ui': filePath( 'src/blocks/index.js' ),
			'blocks/ab-test-preview': filePath( 'src/ab-test-preview.js' ),
			'blocks/altis-xb-preview': filePath( 'src/preview/altis-xb-preview.js' ),
			'blocks/broadcast': filePath( 'inc/blocks/broadcast/index.js' ),
			'experiments': filePath( 'src/experiments.js' ),
			'titles': filePath( 'src/experiments/titles/index.js' ),
			'featured-images': filePath( 'src/experiments/featured-images/index.js' ),
		},
		output: {
			path: filePath( 'build' ),
			publicPath: `https://localhost:${ port }/`,
			filename: '[name].[hash:8].js',
			chunkFilename: 'chunk.[id].[chunkhash:8].js',
		},
		optimization: {
			runtimeChunk: 'single',
			nodeEnv: 'development',
			splitChunks: false,
		},
		resolve: {
			extensions: [
				'.ts',
				'.tsx',
				'.wasm',
				'.mjs',
				'.js',
				'.json'
			],
			alias: {
				'@': filePath( 'src' ),
			},
		},
	} ),
);

helpers.cleanOnExit( [
	filePath( 'build' ) + '/asset-manifest.json',
] );
