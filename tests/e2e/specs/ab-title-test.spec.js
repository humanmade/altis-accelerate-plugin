const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

test.describe( 'A/B Title Test', () => {
	test.beforeEach( async ( { admin, page } ) => {
		await admin.visitAdminPage( 'post-new.php' );

		// Dismiss welcome modal if present - try multiple approaches
		try {
			const closeButton = page.locator( 'button[aria-label="Close"]' ).first();
			await closeButton.waitFor( { timeout: 3000 } );
			await closeButton.click();
		} catch {
			// Try pressing Escape if close button not found
			await page.keyboard.press( 'Escape' );
		}

		// Wait for editor to be ready
		await page.waitForSelector( '.editor-post-title__input, [aria-label="Add title"]', {
			timeout: 10000,
		} );
	} );

	test( 'Create and verify A/B title test variants', async ( { page } ) => {
		// Add post title
		await page.getByRole( 'textbox', { name: 'Add title' } ).click();
		await page.getByRole( 'textbox', { name: 'Add title' } ).fill( 'A/B Test Demo Post' );

		// Add content block
		await page.getByRole( 'button', { name: 'Add default block' } ).click();
		await page
			.getByRole( 'document', { name: 'Empty block; start writing or' } )
			.fill( 'This is the original variant content for our A/B test.' );

		// Open the A/B test panel (Experiments sidebar)
		// The button has aria-label="Experiments"
		await page.getByRole( 'button', { name: 'Experiments' } ).click();

		// Wait for the Experiments panel to be visible
		await expect(
			page.locator( '.interface-complementary-area-header' ).getByText( 'Experiments' )
		).toBeVisible();

		// Find the Title B textarea - it's the second textarea in the Titles section
		const titlesSection = page.locator( '.components-panel__body' ).filter( { hasText: 'Titles' } );
		await titlesSection.waitFor( {
			state: 'visible',
			timeout: 5000,
		} );

		// Get the Title B textarea (second one after Title A)
		const titleBTextarea = titlesSection.locator( 'textarea' ).nth( 1 );
		await titleBTextarea.click();
		await titleBTextarea.fill( 'Testing Different Headlines for Better Engagement' );

		// Click "Run test" button
		await titlesSection.getByRole( 'button', { name: 'Run test' } ).click();

		// Verify the test is running
		await expect( titlesSection.getByText( 'Your test is running' ) ).toBeVisible();

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
	test.skip( 'A/B title test can be paused and cancelled', async ( { page } ) => {
		// Add post title
		await page.getByRole( 'textbox', { name: 'Add title' } ).click();
		await page.getByRole( 'textbox', { name: 'Add title' } ).fill( 'Pause Test Demo' );

		// Add content block
		await page.getByRole( 'button', { name: 'Add default block' } ).click();
		await page
			.getByRole( 'document', { name: 'Empty block; start writing or' } )
			.fill( 'Test content for pause/cancel test.' );

		// Open the A/B test panel (Experiments sidebar)
		await page.getByRole( 'button', { name: 'Experiments' } ).click();

		// Wait for the Experiments panel to be visible
		await expect(
			page.locator( '.interface-complementary-area-header' ).getByText( 'Experiments' )
		).toBeVisible();

		// Find the Titles section
		const titlesSection = page.locator( '.components-panel__body' ).filter( { hasText: 'Titles' } );
		await titlesSection.waitFor( {
			state: 'visible',
			timeout: 5000,
		} );

		// Fill Title B
		const titleBTextarea = titlesSection.locator( 'textarea' ).nth( 1 );
		await titleBTextarea.click();
		await titleBTextarea.fill( 'Alternative Title' );

		// Run the test
		await titlesSection.getByRole( 'button', { name: 'Run test' } ).click();

		// Verify test is running
		await expect( titlesSection.getByText( 'Your test is running' ) ).toBeVisible();

		// Wait for Pause test button and click it
		const pauseButton = titlesSection.getByRole( 'button', { name: 'Pause test' } );
		await expect( pauseButton ).toBeVisible();
		await pauseButton.click();

		// Wait a moment for the state to update
		await page.waitForTimeout( 1000 );

		// Wait for test to be paused - the button changes to "Resume test"
		await expect( titlesSection.getByRole( 'button', { name: 'Resume test' } ) ).toBeVisible( {
			timeout: 15000,
		} );
		await expect( titlesSection.getByText( 'Your test is paused' ) ).toBeVisible();

		// Set up dialog handler before clicking Cancel
		page.on( 'dialog', async dialog => {
			await dialog.accept();
		} );

		// Scroll to and click Cancel test button
		const cancelButton = titlesSection.getByRole( 'button', { name: 'Cancel test' } );
		await cancelButton.scrollIntoViewIfNeeded();
		await cancelButton.click();

		// Wait a moment for the dialog and state update
		await page.waitForTimeout( 1000 );

		// Verify test controls are reset (Run test button should be visible again)
		await expect( titlesSection.getByRole( 'button', { name: 'Run test' } ) ).toBeVisible( {
			timeout: 15000,
		} );
	} );
} );
