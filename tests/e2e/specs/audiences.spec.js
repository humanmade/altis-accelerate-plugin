const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

test.describe( 'Audience screen', () => {
	test.beforeEach( async ( { admin, editor } ) => {
		await admin.visitAdminPage( 'admin.php?page=audience' );
	} );

	test( 'Add new audience', async ( { page } ) => {
		// Open the editor from either the empty state or the populated list.
		await page.getByRole( 'button', { name: /^(Create audience|Add New)$/ } ).click();

		// Set the title input to "Firefox"
		await page.fill( 'input#title', 'Firefox' );

		// Select field using shadcn/Radix Select component
		// First, click the field selector trigger to open dropdown
		await page.locator( '[data-testid="rule-field-select"]' ).first().click();
		await page.getByRole( 'option', {
			name: 'Browser',
			exact: true,
		} ).click();

		// Select "Other, please specify..." from the value dropdown
		await page.locator( '[data-testid="rule-value-select"]' ).first().click();
		await page.getByRole( 'option', { name: 'Other, please specify...' } ).click();

		// Fill in the custom value input
		await page.locator( 'input[type="text"]' ).last().fill( 'Firefox' );

		// Click the "Active" checkbox
		await page.getByLabel( 'Active' ).check();

		// Click the "Publish" button
		await page.click( 'button:has-text("Publish")' );

		await expect( page.locator( 'button:has-text("Update")' ) ).toBeVisible();
	} );
} );
