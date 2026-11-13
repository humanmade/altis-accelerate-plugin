const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

/**
 * Create a synced pattern holding one paragraph and open it in the editor.
 *
 * @param {import('@playwright/test').Page} page Playwright page on the Synced Patterns screen.
 * @param {string} name Pattern name.
 * @param {string} content Paragraph text.
 */
const createPattern = async ( page, name, content ) => {
	await page.locator( '#wpbody-content' ).getByRole( 'link', { name: 'Add New Pattern' } ).click();
	await page.getByRole( 'textbox', { name: 'Name' } ).fill( name );
	await page.getByRole( 'button', { name: 'Create' } ).click();

	await page.waitForSelector( '[aria-label="Welcome to the block editor"]', { timeout: 1000 } ).then( async () => {
		await page.keyboard.press( 'Escape' );
	} ).catch( () => {
		// If welcome modal is not found, continue with the test
	} );

	await page.getByRole( 'button', { name: 'Add default block' } ).click();
	await page.getByRole( 'document', { name: 'Empty block; start writing or' } ).fill( content );
};

const insertWithToolbar = async ( page, blockTitle ) => {
	const toggle = page.getByRole( 'button', { name: 'Toggle block inserter' } );
	if ( await toggle.getAttribute( 'aria-pressed' ) !== 'true' ) {
		await toggle.click();
	}
	await page.getByRole( 'searchbox', { name: 'Search' } ).fill( blockTitle );
	await page.getByRole( 'option', {
		name: blockTitle,
		exact: true,
	} ).click();
};

const getRootNames = page => page.evaluate( () => window.wp.data.select( 'core/block-editor' ).getBlocks().map( block => block.name ) );

const getParentName = ( page, name ) => page.evaluate( blockName => {
	const { getBlocksByName, getBlockRootClientId, getBlockName } = window.wp.data.select( 'core/block-editor' );
	const [ clientId ] = getBlocksByName( blockName );
	return clientId ? getBlockName( getBlockRootClientId( clientId ) ) : 'missing';
}, name );

test.describe( 'Synced Patterns screen', () => {
	test.beforeEach( async ( { admin, editor } ) => {
		await admin.visitAdminPage( 'edit.php?post_type=wp_block' );
	} );

	test( 'Add new synced pattern', async ( { page } ) => {
		await page.locator( '#wpbody-content' ).getByRole( 'link', { name: 'Add New Pattern' } ).click();
		await page.getByRole( 'textbox', { name: 'Name' } ).click();
		await page.getByRole( 'textbox', { name: 'Name' } ).fill( 'A Global Block' );
		await page.getByRole( 'button', { name: 'Create' } ).click();

		await page.waitForSelector( '[aria-label="Welcome to the block editor"]', { timeout: 1000 } ).then( async () => {
			await page.keyboard.press( 'Escape' );
		} ).catch( () => {
			// If welcome modal is not found, continue with the test
		} );

		await page.getByRole( 'button', { name: 'Add default block' } ).click();
		await page.getByRole( 'document', { name: 'Empty block; start writing or' } ).fill( 'A Global Block' );
		await page.getByRole( 'button', {
			name: 'Publish',
			exact: true,
		} ).click();
		await page.getByLabel( 'Editor publish' ).getByRole( 'button', {
			name: 'Publish',
			exact: true,
		} ).click();
		await page.getByRole( 'link', { name: 'View Patterns' } ).click();
		await page.getByRole( 'link', {
			name: 'Pages',
			exact: true,
		} ).click();
		await page.locator( '#wpbody-content' ).getByRole( 'link', { name: 'Add New Page' } ).click();

		await expect( page.getByRole( 'heading', { name: 'Choose a pattern' } ) ).toBeVisible();
		await page.press( 'body', 'Escape' ); // Dismiss the pattern popup
		await page.getByRole( 'textbox', { name: 'Add title' } ).click();
		await page.getByRole( 'textbox', { name: 'Add title' } ).fill( 'Global Block Page' );
		await page.getByRole( 'button', { name: 'Add default block' } ).click();
		await page.getByRole( 'document', { name: 'Empty block; start writing or' } ).fill( '/patter' );
		await page.getByRole( 'option', { name: 'A Global Block' } ).first().click();
		await page.waitForTimeout( 1000 );
		await page.getByRole( 'button', {
			name: 'Publish',
			exact: true,
		} ).click();
		await page.getByLabel( 'Editor publish' ).getByRole( 'button', {
			name: 'Publish',
			exact: true,
		} ).click();
		await page.getByTestId( 'snackbar' ).getByRole( 'link', { name: 'View Page' } ).click();
		await expect( page.getByText( 'A Global Block' ) ).toBeVisible();
	} );

	test( 'Switching between variants in Document Overview', async ( { page } ) => {
		await page.locator( '#wpbody-content' ).getByRole( 'link', { name: 'Add New Pattern' } ).click();
		await page.getByRole( 'textbox', { name: 'Name' } ).click();
		await page.getByRole( 'textbox', { name: 'Name' } ).fill( 'A AB Block' );
		await page.getByRole( 'button', { name: 'Create' } ).click();

		await page.waitForSelector( '[aria-label="Welcome to the block editor"]', { timeout: 1000 } ).then( async () => {
			await page.keyboard.press( 'Escape' );
		} ).catch( () => {
			// If welcome modal is not found, continue with the test
		} );

		await page.getByRole( 'button', { name: 'Add default block' } ).click();
		await page.getByRole( 'document', { name: 'Empty block; start writing or' } ).fill( 'A Global Block' );
		await page.press( 'body', 'Escape' ); // Dismiss the pattern popup
		await page.getByRole( 'button', { name: 'A/B test' } ).click();
		await page.getByRole( 'button', { name: 'Duplicate' } ).click();
		await page.getByRole( 'cell', { name: 'Variant B' } ).click();

		// Wait for the variant switch to complete - the editor needs time to update
		await page.waitForTimeout( 500 );

		// Get paragraph blocks after waiting
		const paragraphBlocks = page.getByRole( 'document', { name: 'Block: Paragraph' } );

		// Wait for at least one paragraph block to be visible
		await expect( paragraphBlocks.first() ).toBeVisible();

		// Click the last visible paragraph block (which should be in the active variant)
		const count = await paragraphBlocks.count();
		if ( count >= 2 ) {
			await paragraphBlocks.nth( count - 1 ).click();
		} else {
			await paragraphBlocks.first().click();
		}
		await page.getByRole( 'document', { name: 'Block: Paragraph' } ).fill( 'A Global Block B' );
		await page.getByRole( 'button', { name: 'Document Overview' } ).click();
		await page.locator( 'td' ).filter( { hasText: 'Experience Block VariantBlock 1 of 2, Level' } ).getByRole( 'link' ).click();
		await page.getByRole( 'document', { name: 'Block: Paragraph' } ).click( { button: 'right' } );
		await expect( page.getByLabel( 'Editor content' ) ).toContainText( 'A Global Block' );
		await page.locator( 'td' ).filter( { hasText: 'Experience Block VariantBlock 2 of 2, Level' } ).getByRole( 'link' ).click();
		await expect( page.getByLabel( 'Editor content' ) ).toContainText( 'A Global Block B' );

	} );

	test( 'Blocks added to a personalized pattern go inside the selected variant', async ( { editor, page } ) => {
		await createPattern( page, 'A Personalized Block', 'Fallback content' );
		await page.getByRole( 'button', {
			name: 'Personalized block',
			exact: true,
		} ).click();
		await expect( page.getByRole( 'cell', { name: 'Fallback' } ) ).toBeVisible();

		// Converting wraps the existing blocks and leaves nothing else behind.
		await expect.poll( () => page.evaluate( () => window.wp.data.select( 'core/block-editor' ).getBlocks().map( block => [
			block.name,
			block.innerBlocks.map( innerBlock => innerBlock.name ),
		] ) ) ).toEqual( [ [ 'altis/variant', [ 'core/paragraph' ] ] ] );

		// Add a block with the top toolbar inserter, as an editor would.
		await insertWithToolbar( page, 'Heading' );
		await expect.poll( () => getParentName( page, 'core/heading' ) ).toBe( 'altis/variant' );
		await expect.poll( () => getRootNames( page ) ).toEqual( [ 'altis/variant' ] );

		// Selecting a variant from the header also targets that variant.
		await page.getByRole( 'cell', { name: 'Fallback' } ).click();
		await insertWithToolbar( page, 'Separator' );
		await expect.poll( () => getParentName( page, 'core/separator' ) ).toBe( 'altis/variant' );
		await expect.poll( () => getRootNames( page ) ).toEqual( [ 'altis/variant' ] );

		// A block added beside the variants some other way is moved into one.
		const strayClientId = await page.evaluate( () => {
			const block = window.wp.blocks.createBlock( 'core/paragraph', { content: 'Stray' } );
			window.wp.data.dispatch( 'core/block-editor' ).insertBlock( block, 0, '' );
			return block.clientId;
		} );
		await expect.poll( () => page.evaluate( clientId => {
			const { getBlockName, getBlockRootClientId } = window.wp.data.select( 'core/block-editor' );
			return getBlockName( getBlockRootClientId( clientId ) );
		}, strayClientId ) ).toBe( 'altis/variant' );
		await expect.poll( () => getRootNames( page ) ).toEqual( [ 'altis/variant' ] );

		// One undo removes the block rather than putting it back at the top level.
		await page.getByRole( 'button', {
			name: 'Undo',
			exact: true,
		} ).click();
		await expect.poll( () => page.evaluate( clientId => !! window.wp.data.select( 'core/block-editor' ).getBlock( clientId ), strayClientId ) ).toBe( false );
		await expect.poll( () => getRootNames( page ) ).toEqual( [ 'altis/variant' ] );

		// Downgrading still unwraps the variant's blocks to the top level.
		await editor.openDocumentSettingsSidebar();
		await page.getByRole( 'region', { name: 'Editor settings' } ).getByRole( 'tab', { name: 'Pattern' } ).click();
		const downgradePanel = page.getByRole( 'region', { name: 'Editor settings' } ).getByRole( 'button', { name: 'Downgrade Block' } );
		if ( await downgradePanel.getAttribute( 'aria-expanded' ) !== 'true' ) {
			await downgradePanel.click();
		}
		page.once( 'dialog', dialog => dialog.accept() );
		await page.getByRole( 'region', { name: 'Editor settings' } ).getByRole( 'button', {
			name: 'Fallback',
			exact: true,
		} ).click();
		await expect.poll( () => getRootNames( page ) ).toEqual( [ 'core/paragraph', 'core/heading', 'core/separator' ] );
	} );

	test( 'Blocks added with nothing selected go inside the active A/B variant', async ( { page } ) => {
		await createPattern( page, 'An AB Inserter Block', 'Variant A content' );
		await page.getByRole( 'button', {
			name: 'A/B test',
			exact: true,
		} ).click();
		await page.getByRole( 'button', { name: 'Duplicate' } ).click();
		await page.getByRole( 'cell', { name: 'Variant B' } ).click();
		await page.evaluate( () => window.wp.data.dispatch( 'core/block-editor' ).clearSelectedBlock() );

		await insertWithToolbar( page, 'Heading' );
		await expect.poll( () => page.evaluate( () => {
			const { getBlocks, getBlocksByName, getBlockRootClientId } = window.wp.data.select( 'core/block-editor' );
			const [ headingClientId ] = getBlocksByName( 'core/heading' );
			return getBlocks().findIndex( block => block.clientId === getBlockRootClientId( headingClientId ) );
		} ) ).toBe( 1 );
		await expect.poll( () => getRootNames( page ) ).toEqual( [ 'altis/variant', 'altis/variant' ] );

		// A block landing before the variants still goes to the selected one, which stays selected.
		const strayClientId = await page.evaluate( () => {
			const block = window.wp.blocks.createBlock( 'core/paragraph', { content: 'Stray' } );
			window.wp.data.dispatch( 'core/block-editor' ).insertBlock( block, 0, '' );
			return block.clientId;
		} );
		await expect.poll( () => page.evaluate( clientId => {
			const { getBlocks, getBlockRootClientId } = window.wp.data.select( 'core/block-editor' );
			return getBlocks().findIndex( block => block.clientId === getBlockRootClientId( clientId ) );
		}, strayClientId ) ).toBe( 1 );
		await expect( page.getByRole( 'cell', { name: 'Variant B' } ).locator( '..' ) ).toHaveClass( /bg-white/ );
	} );

	test( 'Edit embedded synced pattern', async ( { page } ) => {
		await page.locator( '#wpbody-content' ).getByRole( 'link', { name: 'Add New Pattern' } ).click();
		await page.getByRole( 'textbox', { name: 'Name' } ).click();
		await page.getByRole( 'textbox', { name: 'Name' } ).fill( 'A Global Block' );
		await page.getByRole( 'button', { name: 'Create' } ).click();

		await page.waitForSelector( '[aria-label="Welcome to the block editor"]', { timeout: 1000 } ).then( async () => {
			await page.keyboard.press( 'Escape' );
		} ).catch( () => {
			// If welcome modal is not found, continue with the test
		} );

		await page.getByRole( 'button', { name: 'Add default block' } ).click();
		await page.getByRole( 'document', { name: 'Empty block; start writing or' } ).fill( 'A Global Block' );
		await page.getByRole( 'button', {
			name: 'Publish',
			exact: true,
		} ).click();
		await page.getByLabel( 'Editor publish' ).getByRole( 'button', {
			name: 'Publish',
			exact: true,
		} ).click();
		await page.getByRole( 'link', { name: 'View Patterns' } ).click();
		await page.getByRole( 'link', {
			name: 'Pages',
			exact: true,
		} ).click();
		await page.locator( '#wpbody-content' ).getByRole( 'link', { name: 'Add New Page' } ).click();

		await expect( page.getByRole( 'heading', { name: 'Choose a pattern' } ) ).toBeVisible();
		await page.press( 'body', 'Escape' ); // Dismiss the pattern popup
		await page.getByRole( 'textbox', { name: 'Add title' } ).click();
		await page.getByRole( 'textbox', { name: 'Add title' } ).fill( 'Global Block Page' );
		await page.getByRole( 'button', { name: 'Add default block' } ).click();
		await page.getByRole( 'document', { name: 'Empty block; start writing or' } ).fill( '/patter' );
		await page.getByRole( 'option', { name: 'A Global Block' } ).first().click();

		// Wait for the pattern block to be inserted and selected before clicking toolbar button
		await expect( page.getByLabel( 'Block: Pattern' ) ).toBeVisible();

		// Click on the pattern block to ensure it's selected and toolbar is visible
		await page.getByLabel( 'Block: Pattern' ).click();

		// Verify clicking "Edit original" opens the pattern editor for the expected pattern.
		await page.getByRole( 'button', { name: 'Edit original' } ).click();
		await expect( page.getByRole( 'document', { name: 'Block: Paragraph' } ) ).toContainText( 'A Global Block' );

		await page.getByRole( 'document', { name: 'Block: Paragraph' } ).click();
		await page.getByRole( 'document', { name: 'Block: Paragraph' } ).fill( 'A Global Block (updated)' );

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
		await expect( page.getByLabel( 'Block: Pattern' ) ).toContainText( 'A Global Block (updated)' );
	} );
} );
