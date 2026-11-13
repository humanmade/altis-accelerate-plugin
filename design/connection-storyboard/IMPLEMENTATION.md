# Onboarding implementation — 22 October 2026

Implemented on `growth/onboarding-flow` in both `altis-accelerate` and `accelerate-website`. The approved direction is charcoal primary actions, visible progress for confirmation actions, and connection plus optional preferences on the same plugin screen. The separate Preferences prototype is superseded.

## Scope after separating activation

Activation wizard work is preserved on `feature/activation-wizard` at `47b4352`. This branch now covers signup, connection, settings and connection status only. Connected users see no getting-started banner or first-test prompt. Historical storyboard screens are design records, not the current acceptance scope. See `REVIEW.md` for the current review summary.

## Delivered

- One plugin setup card, returning to the same card after connection. Product usage and weekly email preferences stay together. Existing preferences are preserved; new website sites start with weekly reports off.
- Neutral setup notices, no large welcome interruption, no beta marketing banner in the plugin header. The existing Content Explorer is the content handoff; no A/B/C first-improvement route was selected or implemented.
- Branded website account creation and sign-in, with email and one password, reveal, duplicate-submit protection, errors, cancellation, and explicit confirmation for a known account. No WordPress admin identity is prefilled.
- Core WordPress password recovery with an opaque, server-stored continuation in the reset email. It works in a fresh browser session, expires after 24 hours, and never trusts a raw external return URL. Direct website sign-in goes to Your sites.
- Callback capability and nonce checks, an in-memory token until provisioning succeeds, bounded polling, matching-site reuse, and restoration of prior credentials if persistence fails.
- Independent account acknowledgement, visitor activity, and dated remote-access results. Failed heartbeat never implies that the plugin must be installed. Analytics errors preserve account controls and the WordPress link.

## Compatibility and state contract

`connected` retains its existing heartbeat meaning for API clients, email logic, and admin filters. New fields are additive:

| Field | Meaning |
| --- | --- |
| `account_connection` | `connected`, `disconnected`, or `unknown`; updated on the existing authenticated, owner-only site route after plugin persistence |
| `remote_checked_at` | Timestamp of an actual heartbeat attempt; absent legacy values remain unknown |
| `collection_checked` | Whether the current aggregate query succeeded; unavailable data is not an empty result or a zero |

Recent activity means the latest hourly aggregate is within 24 hours. Older observations are dated approximately; a quiet site is not classified as broken. An explicit disconnect takes precedence. Existing plugin versions can remain unknown until a supported acknowledgement or collector result exists. New plugins tolerate older websites that ignore the acknowledgement field.

Ship the website before the plugin for the complete new account experience. No deployment, push, release, or real provider activation was performed. Rollback does not require removing additive metadata or resetting any preferences. The narrowed OAuth callback accepts HTTP(S) WordPress settings callbacks, including subdirectories, and rejects unrelated destinations, credentials, and fragments.

## Verification performed

The proof used two fresh local WordPress installations on OrbStack, isolated from the existing development sites: plugin on port 8092, website on 8093. Test accounts and data are synthetic. Site provisioning is a local fixture, mail is captured locally, server-side outbound requests are blocked, and no real visitor events were fabricated.

| Proof layer | Result |
| --- | --- |
| Plugin JavaScript and CSS production builds | Passed; three existing lint warnings plus bundle/deprecation warnings |
| Website full production build and prerender | Passed |
| Changed PHP syntax, focused plugin ESLint, JavaScript syntax, whitespace checks | Passed |
| Plugin WordPress integration checks | 15 assertions passed: nonce nesting, no identity prefill, network/token/provisioning failure preservation, matching-site reuse, persistence and acknowledgement |
| Website WordPress integration checks | 19 assertions passed: callback validation, opaque recovery, expiration, legacy compatibility, collector unknown/empty distinction, permissions, provisioning and saved preferences |
| Website local HTTP checks | 15 assertions passed: invalid credentials, captured reset mail, fresh-session reset, return continuation, direct sign-in, tampered nonce, code exchange/replay, invalid callback |
| Status-state checks | Six cases passed, including unknown, unavailable, waiting, recent, stale, and disconnected |
| Browser round trips | New account and existing account returned to connected WordPress; account switching retained the destination; direct website login reached Your sites; weekly preference saved and survived reconnect without a duplicate site |
| Rendered UI | Desktop and 390px setup/auth screens inspected; no horizontal overflow in those checks. Customer site details remained usable with analytics unavailable |
| Repository-wide website TypeScript | Not clean: 108 diagnostics in untouched sources, mainly responsive-image declarations and unrelated unused/type errors; none reference the changed dashboard/status/API files |

The Content Explorer route was reached; collector-dependent content inventory and the existing experiment/editor flow are outside this local proof. Actual AWS provisioning, email delivery, collector receipts, PostHog identity correlation, hosted/CDN behavior, and minimum-version PHP/WordPress compatibility remain release verification work. The screenshots prove the local rendered implementation, not those provider or production boundaries.

## Evidence

- [Connected plugin at 390px](implementation-evidence/plugin-connected-mobile.png)
- [Website sign-in at 390px](implementation-evidence/website-signin-mobile.png)
- [Connected plugin on desktop](implementation-evidence/plugin-connected-desktop.png)
- [Website connection details with unavailable analytics](implementation-evidence/website-details-mobile.png)

Plugin regression source: `tests/integration/onboarding-connection.php`. Website regression sources: `tests/integration/onboarding.php`, `onboarding-http.py`, and `connection-status.mjs`. Local fixture files and generated website assets were retained under `/tmp/accelerate-onboarding-check/`; generated `static/dist` changes are not part of the commits.
