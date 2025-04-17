const { test, expect } = require('@wordpress/e2e-test-utils-playwright');

test.describe('Synced Patterns screen', () => {
	test.beforeEach(async ({ admin, editor }) => {
		await admin.visitAdminPage('edit.php?post_type=wp_block');
	});

	test('Add new synced pattern', async ({ page }) => {
		await page.getByRole('link', { name: 'Add New Pattern' }).click();
		await page.getByRole('textbox', { name: 'Name' }).click();
		await page.getByRole('textbox', { name: 'Name' }).fill('A Global Block');
		await page.getByRole('button', { name: 'Create' }).click();


		await page.waitForSelector('[aria-label="Welcome to the block editor"]', { timeout: 1000 }).then(async () => {
			await page.keyboard.press('Escape');
		}).catch(() => {
			// If welcome modal is not found, continue with the test
		});

		await page.getByRole('button', { name: 'Add default block' }).click();
		await page.getByRole('document', { name: 'Empty block; start writing or' }).fill('A Global Block');
		await page.getByRole('button', { name: 'Publish', exact: true }).click();
		await page.getByLabel('Editor publish').getByRole('button', { name: 'Publish', exact: true }).click();
		await page.getByRole('link', { name: 'View Patterns' }).click();
		await page.getByRole('link', { name: 'Pages', exact: true }).click();
		await page.locator('#wpbody-content').getByRole('link', { name: 'Add New Page' }).click();

		await expect(page.getByRole('heading', { name: 'Choose a pattern' })).toBeVisible();
		await page.press('body', 'Escape'); // Dismiss the pattern popup
		await page.getByRole('textbox', { name: 'Add title' }).click();
		await page.getByRole('textbox', { name: 'Add title' }).fill('Global Block Page');
		await page.getByRole('button', { name: 'Add default block' }).click();
		await page.getByRole('document', { name: 'Empty block; start writing or' }).fill('/patter');
		await page.getByRole('option', { name: 'Synced Pattern' }).click();
		await page.waitForTimeout(1000);
		await page.locator('button.accelerate__block-list_item--add').first().click({force: true});
		await page.getByRole('button', { name: 'Publish', exact: true }).click();
		await page.getByLabel('Editor publish').getByRole('button', { name: 'Publish', exact: true }).click();
		await page.getByTestId('snackbar').getByRole('link', { name: 'View Page' }).click();
		await expect(page.getByText('A Global Block')).toBeVisible();
	} );
} );
