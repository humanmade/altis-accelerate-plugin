const { test, expect } = require('@wordpress/e2e-test-utils-playwright');

test.describe('Dashboard screen', () => {
	test.beforeEach(async ({ admin, editor }) => {
		await admin.visitAdminPage('admin.php?page=accelerate');
	});

	test('should display the dashboard screen', async ({ page }) => {

	});
});
