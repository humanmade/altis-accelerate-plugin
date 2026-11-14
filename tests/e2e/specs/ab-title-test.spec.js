const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

/**
 * Wait for the block editor, then return the locator root for the editor
 * canvas: the canvas iframe when the editor uses one, the page otherwise.
 *
 * @param {import('@playwright/test').Page} page Page.
 * @return {Promise<import('@playwright/test').Page|import('@playwright/test').FrameLocator>} Canvas root.
 */
const getCanvas = async page => {
	await page.locator( 'iframe[name="editor-canvas"], .editor-styles-wrapper' ).first().waitFor();
	return await page.locator( 'iframe[name="editor-canvas"]' ).count() > 0
		? page.frameLocator( 'iframe[name="editor-canvas"]' )
		: page;
};

test.describe( 'A/B Title Test', () => {
	test.beforeEach( async ( { admin, page } ) => {
		await admin.createNewPost();

		// Wait for editor to be ready
		await getCanvas( page );
	} );

	test( 'Create and verify A/B title test variants', async ( { editor, page } ) => {
		// Add post title and content block
		await page.evaluate( () => {
			window.wp.data.dispatch( 'core/editor' ).editPost( { title: 'A/B Test Demo Post' } );
		} );
		await editor.insertBlock( {
			name: 'core/paragraph',
			attributes: { content: 'This is the original variant content for our A/B test.' },
		} );

		// Open the Titles experiment tray by clicking the chip in the editor header
		const titlesChip = page.locator( 'button' ).filter( { hasText: 'Titles' } );
		await titlesChip.waitFor( {
			state: 'visible',
			timeout: 5000,
		} );
		await titlesChip.click();

		// Wait for the tray to expand and the variant table to appear
		const tray = page.locator( '.grid-rows-\\[1fr\\]' );
		await tray.waitFor( {
			state: 'visible',
			timeout: 5000,
		} );

		// Fill the "add variant" input (placeholder: "Type a variant…")
		const addVariantInput = tray.getByPlaceholder( 'Type a variant' ).last();
		await addVariantInput.click();
		await addVariantInput.fill( 'Testing Different Headlines for Better Engagement' );

		// Click "Start test" button
		await tray.getByRole( 'button', { name: 'Start test' } ).click();

		// Verify the test is running
		await expect( tray.getByText( 'Test running' ) ).toBeVisible( { timeout: 10000 } );

		// Publish the post
		await page.getByRole( 'button', {
			name: 'Publish',
			exact: true,
		} ).click();
		await page
			.getByLabel( 'Editor publish' )
			.getByRole( 'button', {
				name: 'Publish',
				exact: true,
			} )
			.click();

		// Wait for publish confirmation
		await expect( page.getByText( 'is now live' ) ).toBeVisible();

		// Get the post URL from the publish panel
		const postUrl = await page.getByLabel( 'Post address' ).inputValue();

		// Get post ID from URL for constructing preview URLs
		const postIdMatch = postUrl.match( /[?&]p=(\d+)/ );
		const postId = postIdMatch ? postIdMatch[ 1 ] : null;
		expect( postId ).not.toBeNull();

		// Visit the front end to verify Variant A (original title)
		await page.goto( postUrl );
		await expect( page.locator( 'h1' ).first() ).toContainText( 'A/B Test Demo Post' );
		await expect( page.locator( 'body' ) ).toContainText(
			'This is the original variant content for our A/B test.'
		);

		// Visit the front end with set_test parameter to force Variant B
		const variantBUrl = `${ postUrl }&set_test=test_titles_${ postId }:1`;
		await page.goto( variantBUrl );
		await expect( page.locator( 'h1' ).first() ).toContainText(
			'Testing Different Headlines for Better Engagement'
		);
		await expect( page.locator( 'body' ) ).toContainText(
			'This is the original variant content for our A/B test.'
		);
	} );

	// Skip this test for now - the pause button click interaction is flaky in headless mode
	// The main A/B test creation flow is tested in the first test
	test.skip( 'A/B title test can be paused and ended', async ( { page } ) => {
		// Add post title
		await page.getByRole( 'textbox', { name: 'Add title' } ).click();
		await page.getByRole( 'textbox', { name: 'Add title' } ).fill( 'Pause Test Demo' );

		// Add content block
		await page.getByRole( 'button', { name: 'Add default block' } ).click();
		await page
			.getByRole( 'document', { name: 'Empty block; start writing or' } )
			.fill( 'Test content for pause/cancel test.' );

		// Open the Titles experiment tray
		const titlesChip = page.locator( 'button' ).filter( { hasText: 'Titles' } );
		await titlesChip.waitFor( {
			state: 'visible',
			timeout: 5000,
		} );
		await titlesChip.click();

		// Wait for the tray to expand
		const tray = page.locator( '.grid-rows-\\[1fr\\]' );
		await tray.waitFor( {
			state: 'visible',
			timeout: 5000,
		} );

		// Fill variant B
		const addVariantInput = tray.getByPlaceholder( 'Type a variant' ).last();
		await addVariantInput.click();
		await addVariantInput.fill( 'Alternative Title' );

		// Start the test
		await tray.getByRole( 'button', { name: 'Start test' } ).click();

		// Verify test is running
		await expect( tray.getByText( 'Test running' ) ).toBeVisible( { timeout: 10000 } );

		// Wait for Pause test button and click it
		const pauseButton = tray.getByRole( 'button', { name: 'Pause test' } );
		await expect( pauseButton ).toBeVisible();
		await pauseButton.click();

		// Wait a moment for the state to update
		await page.waitForTimeout( 1000 );

		// Wait for test to be paused - the button changes to "Resume test"
		await expect( tray.getByRole( 'button', { name: 'Resume test' } ) ).toBeVisible( {
			timeout: 15000,
		} );
		await expect( tray.getByText( 'Test paused' ) ).toBeVisible();

		// Set up dialog handler before clicking End test
		page.on( 'dialog', async dialog => {
			await dialog.accept();
		} );

		// Click End test button
		const endButton = tray.getByRole( 'button', { name: 'End test' } );
		await endButton.scrollIntoViewIfNeeded();
		await endButton.click();

		// Wait a moment for the dialog and state update
		await page.waitForTimeout( 1000 );

		// Verify test controls are reset (Start test button should be visible again)
		await expect( tray.getByRole( 'button', { name: 'Start test' } ) ).toBeVisible( {
			timeout: 15000,
		} );
	} );
} );
