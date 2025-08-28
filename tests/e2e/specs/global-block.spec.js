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
		await page.getByRole('option', { name: 'A Global Block' }).first().click();
		await page.waitForTimeout(1000);
		await page.getByRole('button', { name: 'Publish', exact: true }).click();
		await page.getByLabel('Editor publish').getByRole('button', { name: 'Publish', exact: true }).click();
		await page.getByTestId('snackbar').getByRole('link', { name: 'View Page' }).click();
		await expect(page.getByText('A Global Block')).toBeVisible();
	} );

	test( 'Switching between variants in Document Overview', async ({ page }) => {
		await page.getByRole('link', { name: 'Add New Pattern' }).click();
		await page.getByRole('textbox', { name: 'Name' }).click();
		await page.getByRole('textbox', { name: 'Name' }).fill('A AB Block');
		await page.getByRole('button', { name: 'Create' }).click();

		await page.waitForSelector('[aria-label="Welcome to the block editor"]', { timeout: 1000 }).then(async () => {
			await page.keyboard.press('Escape');
		}).catch(() => {
			// If welcome modal is not found, continue with the test
		});

		await page.getByRole('button', { name: 'Add default block' }).click();
		await page.getByRole('document', { name: 'Empty block; start writing or' }).fill('A Global Block');
		await page.press('body', 'Escape'); // Dismiss the pattern popup
		await page.getByRole('button', { name: 'A/B test' }).click();
		await page.getByRole('button', { name: 'Duplicate' }).click();
		await page.getByRole('cell', { name: 'Variant B' }).click();

		const paragraphBlocks = page.getByRole('document', { name: 'Block: Paragraph' });

		// Spooky behaviour with block editor
		if (await paragraphBlocks.count() === 2) {
			await paragraphBlocks.nth(1).click();``
		} else {
			await paragraphBlocks.first().click();
		}
		await page.getByRole('document', { name: 'Block: Paragraph' }).fill('A Global Block B');
		await page.getByRole('button', { name: 'Document Overview' }).click();
		await page.locator('td').filter({ hasText: 'Experience Block VariantBlock 1 of 3, Level' }).getByRole('link').click();
		await page.getByRole('document', { name: 'Block: Paragraph' }).click({button: 'right'});
  		await expect(page.getByLabel('Editor content')).toContainText('A Global Block');
		await page.locator('td').filter({ hasText: 'Experience Block VariantBlock 2 of 3, Level' }).getByRole('link').click();
		await expect(page.getByLabel('Editor content')).toContainText('A Global Block B');

	} );

	test('Edit embedded synced pattern', async ({ page }) => {
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
		await page.getByRole('option', { name: 'A Global Block' }).first().click();

		// Verify clicking the synced pattern toolbar and "edit synced pattern" takes you to the edit pattern screen
		await page.getByRole('button', { name: 'Edit original' }).click();
		await expect(page.getByLabel('Pattern', { exact: true })).toContainText('A Global Block');

		await page.getByRole('document', { name: 'Block: Paragraph' }).click();
		await page.getByRole('document', { name: 'Block: Paragraph' }).fill('A Global Block (updated)');

		// Save the pattern, verify the updated version is on the "back" edit page.
		await page.getByRole('button', { name: 'Save', exact: true }).click();
		await page.getByLabel('Editor publish').getByRole('button', { name: 'Save' }).click();
		await page.getByRole('button', { name: 'Back', exact: true }).click();
		await expect(page.getByLabel('Block: Pattern')).toContainText('A Global Block (updated)');
	} );
} );
