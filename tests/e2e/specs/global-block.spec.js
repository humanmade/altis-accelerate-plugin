const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

const paragraph = text => `<!-- wp:paragraph --><p>${ text }</p><!-- /wp:paragraph -->`;

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

/**
 * Fill in the pattern name dialog if the editor shows one.
 *
 * @param {import('@playwright/test').Page} page Page.
 * @param {string} title Pattern title.
 */
const setPatternTitle = async ( page, title ) => {
	await getCanvas( page );
	const nameField = page.getByRole( 'textbox', { name: 'Name' } );
	try {
		await nameField.waitFor( { timeout: 3000 } );
		await nameField.fill( title );
		await page.getByRole( 'button', { name: 'Create' } ).click();
	} catch {
		await page.evaluate( postTitle => {
			window.wp.data.dispatch( 'core/editor' ).editPost( { title: postTitle } );
		}, title );
	}
	await expect.poll( () => page.evaluate( () => window.wp.data.select( 'core/editor' ).getEditedPostAttribute( 'title' ) ) ).toBe( title );
};

/**
 * Open a new synced pattern in the editor with the given content.
 *
 * @param {Object} fixtures Test fixtures.
 * @param {string} title Pattern title.
 * @param {string} content Serialized block markup.
 */
const createPattern = async ( { admin, editor, page }, title, content ) => {
	await admin.createNewPost( {
		postType: 'wp_block',
		title,
	} );
	await setPatternTitle( page, title );
	await editor.setContent( content );
};

/**
 * Start a new page, insert the synced pattern with the given name through the
 * block inserter and return the canvas root.
 *
 * @param {Object} fixtures Test fixtures.
 * @param {string} patternTitle Pattern to insert.
 */
const insertPatternInNewPage = async ( { admin, page }, patternTitle ) => {
	await admin.createNewPost( {
		postType: 'page',
		title: 'Global Block Page',
	} );
	const canvas = await getCanvas( page );
	await canvas.getByRole( 'button', { name: 'Add default block' } )
		.or( canvas.getByRole( 'document', { name: 'Add default block' } ) )
		.click();
	await canvas.getByRole( 'document', { name: 'Empty block; start writing or' } ).fill( '/patter' );
	await page.getByRole( 'option', { name: patternTitle } ).first().click();
};

test.describe( 'Synced Patterns screen', () => {
	// Save the welcome guide, fullscreen mode and the page pattern chooser as off before any editor opens.
	test.beforeEach( async ( { requestUtils } ) => {
		await requestUtils.rest( {
			path: '/wp/v2/users/me',
			method: 'PUT',
			data: {
				meta: {
					persisted_preferences: {
						core: { enableChoosePatternModal: false },
						'core/edit-post': {
							welcomeGuide: false,
							fullscreenMode: false,
						},
						_modified: new Date().toISOString(),
					},
				},
			},
		} );
	} );

	test( 'Add new synced pattern', async ( { admin, editor, page } ) => {
		await admin.visitAdminPage( 'edit.php?post_type=wp_block' );
		await page.locator( '#wpbody-content' ).getByRole( 'link', { name: /^Add (New )?Pattern$/ } ).click();
		await setPatternTitle( page, 'A Global Block' );
		await editor.insertBlock( {
			name: 'core/paragraph',
			attributes: { content: 'A Global Block' },
		} );
		await editor.publishPost();

		await insertPatternInNewPage( {
			admin,
			page,
		}, 'A Global Block' );
		await page.waitForTimeout( 1000 );
		await editor.publishPost();
		const pageUrl = await page.getByTestId( 'snackbar' ).getByRole( 'link', { name: 'View Page' } ).getAttribute( 'href' );
		await page.goto( pageUrl );
		await expect( page.getByText( 'A Global Block' ) ).toBeVisible();
	} );

	test( 'Switching between variants in Document Overview', async ( { admin, editor, page } ) => {
		await createPattern( {
			admin,
			editor,
			page,
		}, 'A AB Block', paragraph( 'A Global Block' ) );

		await page.getByRole( 'button', { name: 'A/B test' } ).click();
		await page.getByRole( 'button', { name: 'Duplicate' } ).click();
		await page.getByRole( 'cell', { name: 'Variant B' } ).click();

		// Wait for the variant switch to complete - the editor needs time to update
		await page.waitForTimeout( 500 );

		// Get paragraph blocks after waiting
		const canvas = await getCanvas( page );
		const paragraphBlocks = canvas.getByRole( 'document', { name: 'Block: Paragraph' } );

		// Wait for at least one paragraph block to be visible
		await expect( paragraphBlocks.first() ).toBeVisible();

		// Click the last visible paragraph block (which should be in the active variant)
		const count = await paragraphBlocks.count();
		if ( count >= 2 ) {
			await paragraphBlocks.nth( count - 1 ).click();
		} else {
			await paragraphBlocks.first().click();
		}
		await canvas.getByRole( 'document', { name: 'Block: Paragraph' } ).fill( 'A Global Block B' );
		await page.getByRole( 'button', { name: 'Document Overview' } ).click();
		await page.locator( 'td' ).filter( { hasText: 'Experience Block VariantBlock 1 of 3, Level' } ).getByRole( 'link' ).click();
		await canvas.getByRole( 'document', { name: 'Block: Paragraph' } ).click( { button: 'right' } );
		await expect( canvas.locator( '.is-root-container' ) ).toContainText( 'A Global Block' );
		await page.locator( 'td' ).filter( { hasText: 'Experience Block VariantBlock 2 of 3, Level' } ).getByRole( 'link' ).click();
		await expect( canvas.locator( '.is-root-container' ) ).toContainText( 'A Global Block B' );
	} );

	test( 'Edit embedded synced pattern', async ( { admin, editor, page } ) => {
		await createPattern( {
			admin,
			editor,
			page,
		}, 'A Global Block', paragraph( 'A Global Block' ) );
		await editor.publishPost();

		await insertPatternInNewPage( {
			admin,
			page,
		}, 'A Global Block' );
		let canvas = await getCanvas( page );

		// Wait for the pattern block to be inserted and selected before clicking toolbar button
		await expect( canvas.getByLabel( 'Block: Pattern' ) ).toBeVisible();

		// Click on the pattern block to ensure it's selected and toolbar is visible
		await canvas.getByLabel( 'Block: Pattern' ).click();

		// Verify clicking "Edit original" opens the pattern editor for the expected pattern.
		await page.getByRole( 'toolbar', { name: 'Block tools' } ).getByRole( 'button', { name: 'Edit original' } ).click();
		canvas = await getCanvas( page );
		await expect( canvas.getByRole( 'document', { name: 'Block: Paragraph' } ) ).toContainText( 'A Global Block' );

		await canvas.getByRole( 'document', { name: 'Block: Paragraph' } ).click();
		await canvas.getByRole( 'document', { name: 'Block: Paragraph' } ).fill( 'A Global Block (updated)' );

		// Save the pattern, verify the updated version is on the "back" edit page.
		await page.getByRole( 'button', {
			name: 'Save',
			exact: true,
		} ).click();
		await page.getByLabel( 'Editor publish' ).getByRole( 'button', { name: 'Save' } ).click();
		await page.getByRole( 'button', {
			name: 'Back',
			exact: true,
		} ).click();
		canvas = await getCanvas( page );
		await expect( canvas.getByLabel( 'Block: Pattern' ) ).toContainText( 'A Global Block (updated)' );
	} );
} );
