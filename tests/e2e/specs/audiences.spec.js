const { test, expect } = require('@wordpress/e2e-test-utils-playwright');

test.describe('Audience screen', () => {
	test.beforeEach(async ({ admin, editor }) => {
		await admin.visitAdminPage('admin.php?page=audience');
	});

	test('Add new audience', async ({ page }) => {
		// Click the "Add New" button
		await page.getByRole("button", { name: "Add New" }).click();

		// Set the title input to "Firefox"
		await page.fill('input#title', 'Firefox');

		// Click on the sele
		// ct field to open the dropdown
		await page.locator( 'select[name="audience[groups][0][rules][0][field]"]' ).selectOption( { label: 'Browser' } );
		await page.locator( 'select[name="audience[groups][0][rules][0][value]"]' ).selectOption( { label: 'Other, please specify...' } );
		await page.locator( 'input[name="audience[groups][0][rules][0][value]"]' ).fill( 'Firefox' );

		// Click the "Active" checkbox
		await page.getByLabel('Active').check();

		// Click the "Publish" button
		await page.click('button:has-text("Publish")');

		await expect(page.locator('button:has-text("Update")')).toBeVisible();
	});

	test('Intentional failure test', async ({ page }) => {
		// This assertion will always fail
		await expect(page.locator('text=This text does not exist')).toBeVisible();
	});
});
