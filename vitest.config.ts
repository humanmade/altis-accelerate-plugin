import { defineConfig } from 'vitest/config';

export default defineConfig( {
	test: {
		environment: 'jsdom',
		include: [ 'tests/js/**/*.test.{js,ts}' ],
		setupFiles: [ './tests/js/setup.ts' ],
		globals: false,
	},
} );
