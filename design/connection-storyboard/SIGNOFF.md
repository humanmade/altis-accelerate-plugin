# Accelerate connection experience — implementation sign-off

Proposal dated 22 October 2026. Prepared on `growth/onboarding-flow` at `23f4f86`.

[Open storyboard](index.html) · [Evidence and verification](EVIDENCE.md)

## Approved implementation direction

Noel approved implementation on 22 October 2026 with three corrections: use charcoal primary buttons; show spinners while confirming actions are in progress; keep options together with connecting the site. The plugin setup screen is the shared home for connection and options, including the return from authentication. The separate Preferences frame below is retained as the historical review alternative and is superseded by this decision. Work proceeds on `growth/onboarding-flow` in each repository with frequent local commits; pushes and deployment are not authorized.

## What we are agreeing

Make connecting Accelerate feel like one journey across WordPress and accelerateplugin.com. Account creation starts in the plugin. An existing customer signing in directly on the website goes to their sites. A customer connecting from WordPress returns to that WordPress installation, including after password recovery.

This pack proposes the screens, copy, state rules and delivery boundaries for implementation. It contains no product changes. Approval of this experience does not choose the existing A/B/C first-improvement route or authorize deployment, publishing, commits or pushes.

## Decisions for Noel

| Decision | Proposed default | Where to review |
| --- | --- | --- |
| Primary colour | Charcoal inside WordPress, purple on the website. Purple remains available as a primary; this is deliberately undecided. | Use **Compare colours** on setup, account and arrival screens. Both columns contain identical content. Full-size palette options show each in its actual context. |
| Setup and arrival | One compact setup card; after connection, a short confirmation beside useful content actions. Remove large dark covers, duplicate welcome cards, placeholder Notification bar and beta marketing from this journey. | Frames 1, 2, 6, 7 |
| Account forms | Separate Create account and Sign in actions; email and one password with reveal. No company-email restriction, name field, confirm-password field or prefilled WordPress admin identity. | Frames 3–5, 9–10 |
| Status language | Independent account, collection and reachability facts; one short summary, details on demand. Never infer “Install plugin” from a failed heartbeat. | Frames 11–12 |
| Optional preferences | Product usage and weekly reports live in Preferences, outside the connection path. Proposed new-account defaults are off; preserve every existing choice. | Frame 8 |

A sufficient approval can name the colour treatment and accept or amend these five decisions. Backend details below are implementation gates, not implied permission to change authentication or consent contracts.

## Journey and screen inventory

**New account:** Plugins → Set up Accelerate → Create account on website with site context → complete connection in WordPress → Your content → choose or create content → existing first-improvement work.

**Existing account, new site:** WordPress setup → Sign in and connect (or explicit Connect site if already signed in) → complete connection in WordPress → Your content. Switching accounts and cancelling remain available.

**Returning website customer:** website Sign in → Your sites → site details → Open Accelerate in WordPress. There is no website registration entry. Connect another site gives instructions to install/open the plugin on that site.

**Password recovery:** inherit the initiating route → request reset → generic email response → choose new password → sign in → resume that route. A reset email must carry a validated continuation; a raw arbitrary return URL is not acceptable. Expired reset links and expired connection requests are different states.

| Frame | States in this pack | Next step |
| --- | --- | --- |
| 1. Installed, ready to set up | Neutral notice and plugin-row setup link | Setup |
| 2. One connection decision | Not connected | Create account, Sign in, Set up later |
| 3. Create an account | Ready, invalid, existing-account recovery, submitting | Plugin connection |
| 4. Sign in and connect | Ready, wrong credentials, submitting | Plugin connection or reset |
| 5. Already signed in | Account and site confirmation | Connect or switch account |
| 6. Return to plugin | Pending, failed, expired request | Confirm or retry |
| 7. Connected | Starter content, existing content, no content, receiving data | Choose/create content |
| 8. Preferences | Off, saved, failed save | Content |
| 9. Website sign-in | Ready, wrong credentials, submitting | Your sites |
| 10. Password recovery | Website/plugin entry, sent, new password, expired, updated | Original sign-in destination |
| 11. Sites | Waiting, receiving data, unknown | Site details |
| 12. Site details | Waiting, receiving data, unreachable, reconnect, unknown | Open relevant WordPress screen |

The prototype jumps to the successful arrival after a simulated valid account form. Frame 6 exposes the intermediate and failure states separately. It does not implement OAuth, password updates or email delivery. State changes reset mock field values; production must preserve entered values appropriately on recoverable errors. Never persist passwords in URLs, storage, logs or analytics.

## Shared terminology and copy

| Use | Avoid / replace |
| --- | --- |
| Accelerate account | Using the WordPress username as the customer's name |
| Set up Accelerate | Red activation error implying installation failed |
| Connect your site to Accelerate | Activate account / activate plugin when installation already succeeded |
| Create account and connect | Ambiguous Continue on the account creation submit |
| Sign in and connect | Generic sign-in action when adding a site |
| Your sites | Competing Sites / Dashboard / Account labels for the same destination |
| Your content | Welcome cover and onboarding questionnaire after connection |
| Connected · Waiting for first visit | Not connected when authorization succeeded but no eligible visit arrived |
| Receiving data | Live / Active / Healthy unless the precise claim is defined |
| Connection not verified | Not installed when evidence is absent |
| Remote access unavailable | Install plugin based only on a failed remote request |
| Reconnect in WordPress | An unqualified install action when authorization expired |
| Share product usage | Vague “help improve your experience” consent |

Canonical screen copy lives in `frame.js`; rationale and state names live in `screens.js`. Use these together with this contract. Prototype labels such as “frozen example” belong only to the review, not the product. Existing production legal/privacy notices must be reviewed and retained where required; this sketch does not approve removing them.

## Visual and interaction contract

Use the current Accelerate logo and Geist typography. Carry the existing brand token into implementation (`--color-brand`, `bg-brand`, `text-brand` or `$acc-brand` as appropriate); do not scatter literal purple values. The standalone prototype defines its own token for comparison only. Keep the WordPress admin shell native, with a light product header, restrained borders and compact content. The dark WordPress navigation is context, not a new branded cover.

Each screen gets one primary action. Secondary actions are outlined; tertiary actions are readable links. “Set up later” is a working action, not disabled text. Buttons need focus, hover, submitting and disabled treatment. Colour is never the only status signal. Use visible field labels, correct autocomplete, password reveal names, inline associated errors and announced submission results. On a server failure, restore the action and retain non-sensitive form context. Prevent duplicate submits and handle retry idempotently. Choose exact password requirements from the existing backend and display them before validation.

At 390px, forms and status cards stack without horizontal scrolling. Site identity and return context remain readable. Keep the primary action reachable at enlarged text and with keyboard navigation. Product component integration must use the repository's existing Tailwind/WordPress patterns; these independent HTML frames are not a new component system to copy wholesale.

## Connection facts and display rules

These are independent facts, not successive steps in one status ladder.

| Fact | Evidence required | Possible states |
| --- | --- | --- |
| Account authorization | Successful token exchange, persisted plugin credentials, and a trustworthy acknowledgement of the site/account binding | Connected, pending, reconnect required, unknown |
| Analytics collection | Accepted eligible visitor event for the correct site; retain last received time | No eligible event yet, receiving data, previously received/stale, unknown |
| Remote reachability | Dated server-to-site check and its result | Reachable, unavailable, unchecked/unknown |

OAuth login, an issued authorization code and a PostHog signup event are not connection completion. A server heartbeat is not visitor collection. A page-view count is evidence of collection at a time, not perpetual health. “Receiving data” needs a documented recency rule; until defined, use explicit “Last received …” for old observations. Do not classify low-traffic sites as broken solely because no new visit occurred.

Summary precedence: verified authorization failure → **Reconnect your account**; fresh collection → **Receiving data**, with remote-access caveat only when relevant; confirmed authorization with no collected visit → **Connected · Waiting for first visit**; insufficient evidence → **Connection not verified**. If data arrives but authorization is unknown, report the collection fact while keeping account verification unknown in details. Missing plugin requires direct evidence before any installation instruction.

Local development labels require explicit URL/environment evidence. A timeout can also mean a firewall, staging protection or a temporary outage. Local sites can send analytics outbound even when the hosted service cannot call them. A connection check must not generate visitor events or bypass preview/exclusion/consent gates.

### Migration and handshake gate

The current website `connected` field starts false and is updated by remote checks. It is also consumed by the API, admin filtering, CLI and weekly email eligibility. Do not change its meaning to “OAuth succeeded” or “an event arrived” in place.

Before implementation, trace the precise authorization callback and choose the smallest authenticated acknowledgement compatible with older plugin versions. Record authorization and collection facts separately from legacy reachability semantics. Version or add fields as needed; name and migration shape belong in the implementation plan after tracing current contracts. Never backfill positive authorization from a failed/successful heartbeat alone. Existing sites without evidence start unknown, not disconnected.

Document all readers/writers, backfill eligibility, stale-time handling, retries, revocation and rollback. Preserve weekly-email eligibility until its intended rule has been explicitly decided. Validate source site URLs and callbacks, bind the continuation to the initiating admin/site, enforce existing capabilities/nonces, and reject tampered/replayed/expired state. No new open redirect, arbitrary remote probe or credential exposure.

## Implementation ownership and order

| Work | Primary source surfaces | Acceptance gate |
| --- | --- | --- |
| Plugin setup and callback | `inc/admin/namespace.php`, `inc/admin/views/notice.php`, existing account URL helpers in `inc/namespace.php` | Activation remains native; both account paths return correctly; no unexpected redirect on bulk/CLI activation |
| Plugin arrival and preferences | `src/accelerate/content-explorer/OnboardingBar.tsx`, its Content Explorer caller, existing settings surfaces, `inc/dashboard/namespace.php` | Starter/existing/empty content are truthful; preferences don't block setup; existing first-improvement work retained |
| Website forms and continuation | `mu-plugins/accelerate-backend/inc/oauth2/namespace.php`, `authorize-template.php`, existing theme/login routes | Both origins, cancellation, switching account and reset round-trip work without weakening WordPress auth |
| Website status and compatibility | Backend `inc/namespace.php`, `class-site.php`, `heartbeat/namespace.php`, `class-accelerate-sites-endpoint.php`, `class-cli-command.php`, admin/email consumers; `static/src/pages/dashboard.tsx` | Independent facts; new and legacy sites; no false installation instruction; API/email regression checks |
| Measurement | Plugin `inc/telemetry/namespace.php` and existing frontend tracking; website `inc/posthog/namespace.php` | Correct consent, site correlation, event semantics and deduplication |

Paths in the website rows are relative to `/Users/noeltock/dev/accelerate-website`; all others are relative to this plugin repo. These are starting surfaces, not authorization to refactor every file. Read scoped instructions and trace callers before changing contracts.

Implement in this order after approval: settle status/continuation contracts; build plugin and website screens against them; integrate the round-trip and optional settings; verify eligible event receipt and measurement; attach the separately selected first-improvement route. Do not estimate this as a half-day flag change: the compatibility and acknowledgement work must first be scoped.

## Measurement without a second telemetry system

Reuse existing events before adding names. Live receipts already include `signup_completed`, provisioning start/success, `site_connected`, `telemetry_opted_in` and `onboarding_checklist_viewed`. They prove parts of the journey happened; their different identities do not yet prove a joinable funnel.

| Milestone | Required measurement meaning |
| --- | --- |
| Activation / setup viewed | Eligible denominator only where collection is permitted; explicit coverage gap when opted out |
| Connect clicked | Distinguish create-account vs existing-account intent |
| Account created | Reuse server `signup_completed`; never emit success from merely clicking submit |
| Back in WordPress, connected | Reuse/verify `site_connected` at successful persisted callback; distinguish reconnect and retry |
| First eligible page view | Collector receipt for that site, separate from product-usage telemetry |
| First improvement prepared / first test launched | Distinct actions; attach to existing route and do not count a prototype or draft as a running test |

Use an opaque validated attempt/site correlation key where permitted. Do not send email, full URLs with query strings, credentials, reset tokens, form contents or visitor PII to events. Avoid joining private visitor identities to product-user identities. Existing consent gates remain authoritative; funnel completion must not be a reason to bypass them. Document denominator coverage before reporting conversion.

Primary outcomes: completed connections per eligible initiated attempt; time back to connected WordPress; retry/failure reasons; first eligible data receipt; first prepared improvement and first intentional test launch. Segment new/existing account and local/public site. Event deduplication and cross-domain/site identity verification are required before treating these as reliable conversion metrics. No conversion target or expected lift is claimed without a baseline.

## Required implementation acceptance

These checks are for the future implementation, not claims about this prototype.

- Fresh plugin activation on a supported WordPress installation; neutral notice, functional later/setup links, no repeated welcome interruption for an already connected site.
- New account; existing account; already signed in; switch account; cancellation. Assert correct site/account binding and final WordPress destination.
- Direct website sign-in ends at Your sites, with no registration entry. Adding another site directs to that site's plugin.
- Password reset from each origin, opened from email in a new browser session; invalid/expired reset token; expired connection state after a valid reset; no open redirect.
- Invalid credentials, existing email, network error, pending timeout, double submit, callback replay, interrupted token persistence and retry. No duplicate account/site record and no false success.
- Starter, empty and populated content inventories; no fabricated opportunity, auto-created experiment, publication or visitor event.
- New public site awaiting heartbeat; local site with accepted page view; firewalled public site; expired authorization; legacy site with missing facts; stale receipt; unreachable site still receiving data. Verify each displayed claim against its source.
- Product usage and email toggles: existing values retained, save confirmed by server, failed save rolled back, opt-out respected. Verify exact payload/disclosure and existing weekly-email compatibility.
- 390px and desktop, keyboard-only completion, focus after errors, readable contrast, enlarged text, labels and announced state changes in actual WordPress and website pages.
- Relevant PHP/JS checks, focused integration tests for callback/status/migration, browser round-trips, collector receipt and permitted PostHog event correlation. Separate local proof from hosted acceptance.

Release requires a coordinated compatibility plan for old/new plugin and website versions, preserved legacy values, and a rollback that does not revoke valid connections or overwrite consent. Hosted testing and deployment require their own explicit authorized scope.
