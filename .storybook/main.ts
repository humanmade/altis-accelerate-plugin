import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineMain } from '@storybook/react-vite/node';
import type { Plugin } from 'vite';

const currentDir = dirname( fileURLToPath( import.meta.url ) );

/*
 * Some `src/.../*.js` files (webpack/Babel-compiled elsewhere in the repo)
 * contain JSX. Vite's default esbuild transform only enables JSX parsing for
 * `.jsx`/`.tsx` files, so re-loader these specific files as JSX before Vite's
 * own transform runs.
 */
const jsxInJsPlugin: Plugin = {
	name: 'accelerate-jsx-in-js',
	enforce: 'pre',
	async transform( code, id ) {
		if ( ! /\/src\/.*\.js$/.test( id.split( '?' )[ 0 ] ) ) {
			return null;
		}

		const esbuild = await import( 'esbuild' );
		const result = await esbuild.transform( code, {
			loader: 'jsx',
			jsx: 'automatic',
			sourcefile: id,
			sourcemap: true,
		} );

		return {
			code: result.code,
			map: result.map,
		};
	},
};

export default defineMain( {
	framework: '@storybook/react-vite',
	stories: [
		'../src/**/*.stories.@(ts|tsx)',
	],
	typescript: {
		reactDocgen: false,
	},
	viteFinal: async config => {
		const srcAlias = {
			find: '@',
			replacement: resolve( currentDir, '../src' ),
		};
		const wordpressDataAlias = {
			find: '@wordpress/data',
			replacement: resolve( currentDir, '../node_modules/@wordpress/block-library/node_modules/@wordpress/data' ),
		};
		const hudOverlaysAlias = {
			find: './components/HudOverlays',
			replacement: resolve( currentDir, './hud-overlays-stub.tsx' ),
		};
		const alias = Array.isArray( config.resolve?.alias )
			? [
				...config.resolve.alias,
				hudOverlaysAlias,
				wordpressDataAlias,
				srcAlias,
			]
			: {
				...config.resolve?.alias,
				'./components/HudOverlays': hudOverlaysAlias.replacement,
				'@wordpress/data': wordpressDataAlias.replacement,
				'@': srcAlias.replacement,
			};

		return {
			...config,
			resolve: {
				...config.resolve,
				alias,
			},
			optimizeDeps: {
				...config.optimizeDeps,
				esbuildOptions: {
					...( config.optimizeDeps?.esbuildOptions ?? {} ),
					loader: {
						...( config.optimizeDeps?.esbuildOptions?.loader ?? {} ),
						'.js': 'jsx',
					},
				},
			},
			plugins: [
				...( config.plugins ?? [] ),
				jsxInJsPlugin,
			],
		};
	},
} );
