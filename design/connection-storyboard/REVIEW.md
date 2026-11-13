# Signup and connection review

Current branch: `growth/onboarding-flow` in both repositories.

## Separated activation work

`feature/activation-wizard` in the plugin repository preserves the complete pre-split tree at `47b4352`, including the original A–D modal prototypes, wizard/card/data source, research and earlier design explorations. The later minimal-review experiment is retained as history, not an approved direction. The wizard source is work in progress, not an integrated or accepted implementation. No history was rewritten.

The current branch removes activation prototype files and the generic connected-state Choose content / Create a page banner. The setup prompt appears only before connection. Existing experiment/editor functionality remains available normally. No new activation wizard, recommendations, AI generation or automatic tests are introduced.

## Plugin changes to review

- One connection/settings screen with create-account and sign-in paths, return to WordPress, disconnect and a link to the account's sites.
- Original preference labels and explanatory copy restored, all preferences visible, no More settings accordion. Existing stored preferences retained.
- Charcoal primary actions, confirmation/save progress, duplicate-action prevention, save errors and retry.
- Capability and callback nonce validation. New credentials stay in memory until provisioning succeeds; prior credentials are preserved/restored on failure. Existing matching sites are reused.
- Account acknowledgement follows successful local persistence. Disconnect clears the local connection and attempts to update the website.
- Neutral setup notices; duplicate welcome/success interruptions and beta marketing banner removed. Connected dashboard has no onboarding prompt.

## Website changes to review

Website remains at `2f8368b9`; this separation makes no website source changes.

- Branded account creation, sign-in and password recovery, preserving the destination back to WordPress.
- Known-account confirmation, password reveal, confirmation progress and duplicate-submit prevention.
- Opaque, expiring password-reset continuation and callback validation.
- Your sites distinguishes account connection, observed visitor activity, and remote reachability. Unknown/unavailable states do not claim missing installation or zero traffic.
- Open WordPress/reconnect actions and existing weekly email preference management; new sites start with weekly reports off.

## Evidence and limits

Prior paired local verification: both builds; 15 plugin assertions; 19 website assertions; 15 HTTP assertions; six status cases; new/existing account browser round trips, recovery and mobile inspection. Full website TypeScript still has 108 diagnostics in untouched sources. Detailed evidence is in IMPLEMENTATION.md.

After separation: focused plugin lint, JavaScript production build, PHP syntax and all 15 connection integration assertions passed. The connected WordPress dashboard was inspected in the browser with no activation banner; collector data is unavailable in the isolated fixture. Local fixture provisioning and captured email do not prove real provider provisioning, email delivery or visitor collection. Nothing pushed or deployed.

Local review: http://127.0.0.1:8092/wp-admin/admin.php?page=altis-accelerate-settings (admin/admin). Website: http://127.0.0.1:8093/dashboard/ .
