# Evidence and verification

22 October 2026. This pack is a local, simulated design review. It is not an implementation or hosted acceptance report.

## Source evidence

| Source | Observation | What it supports / does not support |
| --- | --- | --- |
| User walkthrough screenshots, approximately 08:50–08:57 Bangkok | Fresh local WordPress installation, account creation/connection, optional preferences and later direct website sign-in; supplied dashboard shows two page views alongside a disconnected/install instruction | Demonstrates the conflicting experience in that walkthrough. Does not establish the state of every customer site. |
| Website backend `mu-plugins/accelerate-backend/inc/namespace.php`, site creation | New site metadata starts with `connected = false` | The initial display can lack a positive legacy flag even after account creation. |
| Website backend `inc/heartbeat/namespace.php`, `run_heartbeat()` | Remote request failures set `connected` false; successful calls set it true. Scheduled daily. | This flag primarily reflects server-to-site reachability, not OAuth completion or collector receipt. |
| Website `static/src/pages/dashboard.tsx`, site detail branch around line 1040 | The legacy disconnected state leads to an installation action | Explains why a local or unreachable site can receive a misleading instruction. |
| Website site model, endpoint, CLI, admin and email readers | The same legacy field has additional consumers | A UI fix must not silently redefine API or weekly-email eligibility semantics. |
| Plugin `inc/admin/namespace.php`, callback around lines 738–741 | Successful path tracks `site_connected` and redirects to `admin.php?page=accelerate&connected=1` | Useful integration surface. The future cross-repo acknowledgement still requires tracing and verification. |
| Existing `growth/onboarding-flow` design files | A/B/C first-improvement explorations already exist | Reuse and attach that work; this pack does not select or overwrite it. |

All website paths are relative to `/Users/noeltock/dev/accelerate-website`. Source review was read-only. Line numbers are navigation aids for this snapshot, not stable API contracts.

## Live PostHog receipt check

Project 151355 was inspected in the live PostHog interface. The relevant signup was the only `signup_completed` shown in the preceding 24 hours. Account email is intentionally omitted from this review artifact.

| Time, Bangkok on 22 October | Receipt |
| --- | --- |
| 08:54:34 | `signup_completed` |
| 08:54:37 | Site provisioning started |
| 08:54:38 | Site provisioning succeeded for the local site |
| 08:54:41 | `site_connected` |
| 08:55:07 | `telemetry_opted_in` |
| 08:55:39 | Later website login |
| 09:03:35 | `onboarding_checklist_viewed` |

The server account identity, website browser identity and plugin hashed identity appeared separately. These receipts confirm activity, not a verified unified funnel. Product telemetry is also distinct from the visitor page-view evidence shown in the supplied screenshot. No new live events, users, preferences or emails were created for the storyboard.

## Local storyboard verification

- All **12 frames / 37 selectable states** rendered a non-empty product heading through browser-driven navigation. Raw results: [state-checks.json](evidence/state-checks.json).
- All **37 states** were checked in the 390px artboard with no body-level horizontal overflow. Raw results: [narrow-checks.json](evidence/narrow-checks.json). This is viewport simulation, not physical-device or screen-reader acceptance.
- Rendered desktop setup, account form, paired colour comparison and narrow status layouts were visually inspected. [Colour comparison](evidence/setup-comparison.png) and [390px status](evidence/status-390.png) are captured browser views.
- Simulated plugin-origin recovery retained its entry through the reset-request confirmation and password-updated state; Continue to sign in returned to `signin-plugin`. Direct website recovery returned to `signin-web`. No password was changed and no reset email was sent.
- Review navigation, colour comparison and narrow-view controls were exercised. Unimplemented help/editor/first-improvement actions explicitly display simulation messages.
- JavaScript syntax, local asset/link targets and final newlines were checked. Existing tracked source/prototypes remain unchanged.

One browser log entry reported a MutationObserver error without a source URL. The storyboard has no MutationObserver code, and the state/interaction checks completed; its origin was not established. A clean production browser console is not claimed.

## Limits and implementation gates

This verifies the review artifact only. It does not verify real OAuth, password reset email continuation, capability checks, nonce expiry, token persistence, migrations, account enumeration behaviour, email eligibility, collector acceptance, consent payloads, cross-domain funnel joins or experiment creation. Those have explicit acceptance cases in [SIGNOFF.md](SIGNOFF.md).

No implementation code changed, no commit or push was made, and no website deployment or production write was performed. The local branch remains ahead of its remote by the pre-existing commits; switching branches did not publish them.
