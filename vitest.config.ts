import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig( {
	resolve: {
		alias: {
			'@': path.resolve( __dirname, 'src' ),
		},
	},
	test: {
		environment: 'jsdom',
		include: [ 'tests/js/**/*.test.{js,ts}' ],
		setupFiles: [ './tests/js/setup.ts' ],
		globals: false,
	},
} );
