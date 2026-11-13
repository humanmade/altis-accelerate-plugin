const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

const viewports = [
	{ width: 390, height: 844 },
	{ width: 768, height: 1024 },
	{ width: 1440, height: 900 },
];

test.describe( 'Product UI interaction integrity', () => {
	test( 'Content Explorer does not overflow the viewport', async ( { admin, page } ) => {
		for ( const viewport of viewports ) {
			await page.setViewportSize( viewport );
			await admin.visitAdminPage( 'admin.php?page=accelerate' );

			await expect.poll( () => page.evaluate( () => document.documentElement.scrollWidth <= window.innerWidth ) ).toBe( true );
		}
	} );

	test( 'Dashboard does not overflow the viewport', async ( { admin, page } ) => {
		for ( const viewport of viewports ) {
			await page.setViewportSize( viewport );
			await admin.visitAdminPage( 'index.php' );

			await expect.poll( () => page.evaluate( () => document.documentElement.scrollWidth <= window.innerWidth ) ).toBe( true );
		}
	} );
} );
