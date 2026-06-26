# Mixpanel Integration Audit & Analysis

> **Audit Date:** January 2025
> **Scope:** Full codebase review of Accelerate WordPress plugin
> **Cross-referenced with:** [Mixpanel Documentation](https://docs.mixpanel.com/docs/what-is-mixpanel) (January 2025)

---

## Executive Summary

The Altis Accelerate WordPress plugin uses **Segment.io as a Customer Data Platform (CDP)** to collect telemetry data. **Mixpanel is NOT directly integrated** into the codebase—instead, data flows from Segment.io to Mixpanel as a downstream destination configured in Segment's dashboard.

### Key Findings

| Finding | Status | Severity |
|---------|--------|----------|
| Identity management has Mixpanel-aware code | Working | N/A |
| Onboarding funnel appears broken (Issue #426) | **Broken** | High |
| Segment integrations need cleanup (Issue #427) | Open | Medium |
| SHA1 hashing used for user IDs | Deprecated | Low |
| Alias implementation may conflict with modern Mixpanel | **Potential Issue** | Medium |

---

## 1. Architecture Overview

### Data Flow

```
WordPress Admin User
        │
        ▼
┌───────────────────────┐
│  Segment.io SDK       │
│  (PHP + JavaScript)   │
│                       │
│  • identify()         │
│  • track()            │
│  • group()            │
│  • alias()            │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│  Segment.io Cloud     │
│  (CDP Router)         │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│  Mixpanel             │
│  (Downstream Dest.)   │
│                       │
│  Project: 2455091     │
│  EU Data Residency    │
└───────────────────────┘
```

### Integration Method

The plugin uses the **Segment Actions destination** for Mixpanel, which:
- Maps Segment `userId` → Mixpanel `distinct_id`
- Maps Segment user traits → Mixpanel user profile properties
- Maps Segment `track()` → Mixpanel `import` API
- Maps Segment `group()` → Mixpanel group analytics

---

## 2. Codebase Audit

### 2.1 Primary Telemetry File

**Location:** `inc/telemetry/namespace.php`

#### Segment Configuration
```php
// Line 19: Hardcoded Segment write key
const SEGMENT_ID = 'qUQDZEDMJNA49bRaqGxBQTmW7ywBf8EG';

// Lines 52-54: Environment override available
function get_segment_id() : string {
    if ( defined( 'ALTIS_SEGMENT_ID' ) ) {
        return ALTIS_SEGMENT_ID;
    }
    return SEGMENT_ID;
}
```

#### Mixpanel-Specific Code References

**Lines 194-198:** Local environment handling for Mixpanel `distinct_id`:
```php
if ( wp_get_environment_type() === 'local' ) {
    // Create distinct_id (important for Mixpanel).
    $id = $auto_id;
    $email = 'no-reply+' . $auto_id . '@altis.dev';
}
```

**Lines 265-266:** Environment ID handling for Mixpanel:
```php
if ( $type === 'local' ) {
    // Create distinct_id (important for Mixpanel).
    $id = get_local_install_id();
}
```

**Purpose:** These comments indicate awareness that Segment routes data to Mixpanel, and that `distinct_id` consistency is critical for Mixpanel's identity resolution.

### 2.2 User Identification Strategy

#### Current Implementation

| User State | ID Method | Mixpanel Result |
|------------|-----------|-----------------|
| Opted-In | `sha1(email)` | Identified user with `distinct_id` |
| Opted-Out | `sha1(user_id + registered)` (8 chars) | Anonymous `$device_id` |
| Local Dev | Override with synthetic ID | Prevents data pollution |

#### Code Analysis

**Anonymous ID Generation (Line 160-163):**
```php
function get_anonymous_id() : string {
    $current_user = wp_get_current_user();
    return substr( sha1( $current_user->ID . $current_user->user_registered ), 0, 8 );
}
```

**Identified ID Generation (Line 170-173):**
```php
function get_id() : string {
    $current_user = wp_get_current_user();
    return sha1( $current_user->user_email );
}
```

### 2.3 Alias Implementation (Critical for Mixpanel)

**Lines 344-353:** When a user opts in, an alias is created:
```php
function opt_in( bool $did_opt_in, ?WP_User $user = null ) {
    // ...
    if ( $did_opt_in ) {
        if ( ! initialize() ) {
            return;
        }
        Segment::alias( [
            'userId' => get_id(),          // sha1(email)
            'previousId' => get_anonymous_id(), // sha1(id+registered)[0:8]
        ] );
    }
}
```

#### Mixpanel Documentation Cross-Reference

> **From Mixpanel Docs (2025):**
> "The `.alias()` method predates modern ID merge (pre-2020). While still supported, it's non-retroactive and limited. Current best practices recommend the `.identify()` approach instead."

**Issue Identified:** The codebase uses `Segment::alias()` which maps to Mixpanel's legacy alias method. Modern Mixpanel (post-2020) recommends using `.identify()` with proper `$device_id` → `$user_id` mapping for retroactive event stitching.

### 2.4 Event Tracking Inventory

#### PHP Events (Server-Side)

| Event | Trigger | Properties |
|-------|---------|------------|
| `Experiments` | A/B test created/updated | `action`, `test: block` |
| `Content` | Post saved (audience/wp_block/broadcast) | `action`, `type`, `content_type`, `content_action` |
| `Activation` | Feature first used | `action`, custom properties |

#### JavaScript Events (Client-Side)

**Helper Function (`src/utils/admin.ts:353-360`):**
```typescript
export function trackEvent(module: string, action: string, parameters: {} = {}) {
  if (window.analytics) {
    window.analytics.track(module, {
      action,
      ...parameters,
    });
  }
}
```

| Event | Module | Location |
|-------|--------|----------|
| `Experiments` | Pause/Start/Cancel | `src/experiments/components/settings.js` |
| `Audiences` | Search | `src/audiences/ui/list.tsx:288` |
| `Content Explorer` | Period/Filter/Search | `src/accelerate/components/ListFilters.tsx` |
| `Broadcast View` | Dashboard | `src/accelerate/broadcast-manager/` |

---

## 3. Known Issues

### 3.1 Issue #426: Broken Onboarding Funnel

**Status:** OPEN
**Impact:** Cannot track sign-up to activation conversion metrics

**Problem Description:**
The onboarding analytics flow broke after a sign-up flow migration. The Mixpanel funnel at `eu.mixpanel.com/project/2455091/view/2998175/app/funnels/?discover=1#view/33105493` shows incomplete conversion data.

**Root Cause Analysis:**

Based on codebase review and Mixpanel documentation, potential causes include:

1. **Identity Mismatch:** The alias call may not be properly linking anonymous pre-signup events to identified post-signup events
2. **Missing Events:** Onboarding events may not be firing after the migration
3. **Segment Configuration:** The Segment → Mixpanel destination may need reconfiguration

**Mixpanel Funnel Requirements:**

> **From Mixpanel Docs:**
> "Funnels measure conversions through a series of events. For accurate attribution, all events in a funnel must share the same `distinct_id` or be properly merged via identity resolution."

**Recommended Investigation:**

1. Verify events are reaching Segment (check Segment Source Debugger)
2. Verify events are reaching Mixpanel (check Mixpanel Live View)
3. Check if `distinct_id` is consistent across funnel steps
4. Review if alias mapping is working correctly

### 3.2 Issue #427: Segment Integration Cleanup

**Status:** OPEN
**Assigned:** @noeltock

**Scope:** Clean up Segment integrations after new Accelerate setup. May involve:
- Removing deprecated destinations
- Updating destination configurations
- Aligning EU data residency settings

---

## 4. Mixpanel Best Practices vs. Current Implementation

### 4.1 Identity Management

| Best Practice | Current State | Recommendation |
|---------------|---------------|----------------|
| Use immutable IDs (database IDs) | Uses `sha1(email)` | Consider using WordPress user ID + site hash |
| Call `.identify()` on login/signup | Uses legacy `.alias()` | Migrate to modern identify pattern |
| Call `.reset()` on logout | Not implemented | Add reset on WordPress logout |
| Cache properties until identification | Properties sent with anonymous | Consider deferring profile properties |

### 4.2 Segment-Mixpanel Integration

| Best Practice | Current State | Recommendation |
|---------------|---------------|----------------|
| Avoid `id` as event property | Not sending `id` | OK |
| Configure EU endpoints for both | EU endpoints used | Verify Segment EU setting |
| Use Actions destination | Unknown | Verify in Segment dashboard |
| Avoid autocapture with Segment | Not using autocapture | OK |

### 4.3 Hashing Algorithm

| Current | Recommendation | Reason |
|---------|----------------|--------|
| SHA1 | SHA256 or HMAC-SHA256 | SHA1 is cryptographically deprecated |

**Affected Locations:**
- `inc/telemetry/namespace.php:162` - Anonymous ID
- `inc/telemetry/namespace.php:172` - User ID
- `inc/telemetry/namespace.php:244` - Local install ID
- `inc/telemetry/namespace.php:249` - Local install ID

---

## 5. Data Flow Analysis

### 5.1 User Traits Sent to Mixpanel (via Segment)

When user opts in, these traits are sent:

```php
$traits = [
    'first_name' => $current_user->first_name,
    'last_name' => $current_user->last_name,
    'email' => $email,  // Actual email or dev override
    'username' => $current_user->user_login,
    'created' => $current_user->user_registered,
    'avatar' => get_avatar_url( $current_user->ID ),
    'roles' => (array) $current_user->roles,
];
```

**Privacy Note:** PII (email, name) is sent to Segment and forwarded to Mixpanel. Both services process data in EU (GDPR compliant).

### 5.2 Environment/Group Traits

```php
$traits = [
    'site_name' => get_site_option( 'site_name', get_option( 'blogname', '' ) ),
    'environment' => $type,
    'domain' => get_site_url(),
    'multisite' => is_multisite(),
    'feature_tier' => defined( 'ALTIS_FEATURE_TIER' ) ? ALTIS_FEATURE_TIER : 'free',
    'environment_tier' => defined( 'ALTIS_ENVIRONMENT_TIER' ) ? ALTIS_ENVIRONMENT_TIER : 'free',
    'support_tier' => defined( 'ALTIS_SUPPORT_TIER' ) ? ALTIS_SUPPORT_TIER : 'free',
    'version' => Accelerate\VERSION,
];
```

### 5.3 Filter Hooks for Customization

Developers can modify traits before sending:

```php
// Customize user traits
add_filter( 'altis.telemetry.user_traits', function( $traits ) {
    unset( $traits['avatar'] ); // Remove avatar URL
    return $traits;
});

// Customize environment traits
add_filter( 'altis.telemetry.env_traits', function( $traits ) {
    $traits['custom_field'] = 'value';
    return $traits;
});
```

---

## 6. Recommendations

### 6.1 Immediate Actions (High Priority)

#### Fix Onboarding Funnel (Issue #426)

1. **Audit Segment Source Debugger**
   - Verify signup events are being sent
   - Check `distinct_id` values match across funnel steps

2. **Verify Mixpanel Live View**
   - Confirm events arrive in Mixpanel
   - Check user profiles are being created

3. **Test Identity Flow**
   ```
   Anonymous Visit → Signup → Check if events merge
   ```

4. **Consider Migrating from Alias to Identify**

   Current (legacy):
   ```php
   Segment::alias( [
       'userId' => get_id(),
       'previousId' => get_anonymous_id(),
   ] );
   ```

   Modern approach would use Segment's identify with proper anonymous ID handling, letting Mixpanel's Simplified ID Merge handle the connection.

### 6.2 Medium Priority

#### Segment Integration Cleanup (Issue #427)

1. Review all Segment destinations in dashboard
2. Remove any deprecated/unused integrations
3. Verify Mixpanel Actions destination is properly configured
4. Ensure EU data residency is set on both Segment and Mixpanel

#### Upgrade Hashing Algorithm

Replace SHA1 with SHA256:

```php
// Before
return sha1( $current_user->user_email );

// After
return hash( 'sha256', $current_user->user_email );
```

### 6.3 Low Priority (Future Improvements)

1. **Add Logout Reset**
   ```php
   add_action( 'wp_logout', function() {
       // Reset Segment anonymous ID on logout
   });
   ```

2. **Make Avatar Collection Optional**
   - Avatar URLs could identify users via image metadata
   - Consider removing or making configurable

3. **Add Telemetry Documentation**
   - Document what data is collected
   - Make consent UI more prominent

---

## 7. Testing Checklist

### Identity Flow Testing

- [ ] Create new WordPress user
- [ ] Verify anonymous events tracked before opt-in
- [ ] Opt-in to telemetry
- [ ] Verify alias/identify call sent to Segment
- [ ] Check Mixpanel for merged user profile
- [ ] Verify funnel shows complete conversion

### Event Tracking Testing

- [ ] Create A/B test block → Check "Experiments" event
- [ ] Create audience → Check "Content" event
- [ ] Create broadcast → Check "Content" event
- [ ] Use Content Explorer → Check filter/search events
- [ ] First feature use → Check "Activation" event

### Environment Testing

- [ ] Local dev uses synthetic IDs (not real emails)
- [ ] CI environment skips telemetry
- [ ] Production uses real hashed IDs

---

## 8. Configuration Reference

### Environment Variables / Constants

| Constant | Purpose | Default |
|----------|---------|---------|
| `ALTIS_SEGMENT_ID` | Override Segment write key | `qUQDZEDMJNA49bRaqGxBQTmW7ywBf8EG` |
| `CI` | Disable telemetry in CI | Check env |
| `HM_ENV` | Environment identifier | Site URL |
| `ALTIS_FEATURE_TIER` | Feature tier trait | `free` |
| `ALTIS_ENVIRONMENT_TIER` | Environment tier trait | `free` |
| `ALTIS_SUPPORT_TIER` | Support tier trait | `free` |

### User Meta

| Meta Key | Purpose | Values |
|----------|---------|--------|
| `altis_tracking_opt_in` | User consent | `1` (opted in), `0` (opted out), empty (no decision) |

### Options

| Option | Purpose |
|--------|---------|
| `altis_activations` | Array of one-time activation events already tracked |
| `accelerate_telemetry_site_id` | Persistent local environment identifier (fun name for localhost) |

---

## 9. Files Reference

| File | Purpose | Key Functions |
|------|---------|---------------|
| `inc/telemetry/namespace.php` | Primary telemetry system | `bootstrap()`, `initialize()`, `track()`, `opt_in()` |
| `src/utils/admin.ts` | JS tracking helper | `trackEvent()` |
| `inc/api/namespace.php` | Activation events | `maybe_track_activation_event()` |
| `src/experiments/components/settings.js` | Experiment tracking | A/B test events |
| `src/audiences/ui/list.tsx` | Audience tracking | Search events |
| `src/accelerate/components/ListFilters.tsx` | Dashboard tracking | Filter events |
| `composer.json` | Dependencies | `segmentio/analytics-php: ^2.0 || ^3.0` |

---

## 10. Mixpanel Documentation References

- [What is Mixpanel](https://docs.mixpanel.com/docs/what-is-mixpanel)
- [Identifying Users](https://docs.mixpanel.com/docs/tracking-methods/id-management/identifying-users)
- [JavaScript SDK](https://docs.mixpanel.com/docs/tracking-methods/sdks/javascript)
- [Segment Integration](https://docs.mixpanel.com/docs/tracking-methods/integrations/segment)
- [Funnels Report](https://docs.mixpanel.com/docs/analysis/reports/funnels)

---

## Appendix: Full Code Audit Details

### A. Bootstrap Flow

```
1. Plugin loads (plugin.php)
   ↓
2. inc/namespace.php::bootstrap()
   ↓
3. Check if Altis\Telemetry exists (skip if Altis Cloud)
   ↓
4. Load inc/telemetry/namespace.php
   ↓
5. telemetry\bootstrap() registers hooks:
   - admin_init: handle_opt_in_form
   - admin_head: load_segment_js
   - admin_footer: render_identity_tag
   - in_admin_header: render_opt_in_form
   - profile_personal_options: user_profile_options
   - personal_options_update: handle_profile_form
   - rest_api_init: register_api_routes
   - save_post: track_new_or_updated_content
```

### B. Consent Flow

```
1. User visits WP Admin
   ↓
2. is_user_opted_in() returns null (no decision)
   ↓
3. render_opt_in_form() displays consent banner
   ↓
4. User clicks "Sounds good" or "No thanks"
   ↓
5. handle_opt_in_form() processes choice
   ↓
6. opt_in(true/false) updates user meta
   ↓
7. If opted in: Segment::alias() links anonymous → identified
```

### C. Tracking Flow

```
1. User performs action (e.g., saves A/B test)
   ↓
2. track_new_or_updated_content() hook fires
   ↓
3. Checks: is autosave? is tracked post type?
   ↓
4. track() called with event data
   ↓
5. initialize() ensures Segment is ready
   ↓
6. Segment::track() sends to Segment Cloud
   ↓
7. Segment routes to Mixpanel (and other destinations)
```

---

## 11. Mixpanel MCP Integration (AI-Assisted Analytics)

Mixpanel offers an MCP (Model Context Protocol) integration that enables AI assistants like Claude to directly query your Mixpanel data using natural language. This is currently a **beta feature**.

### What It Enables

- **Natural language queries**: Ask questions like "Which channels drive users who retain best?" or "Show me signup conversion rates by source"
- **Funnel analysis**: Conversational exploration of conversion funnels
- **Session replay analysis**: Link qualitative session data to quantitative events
- **Data discovery**: Browse events, properties, and anomalies through AI

### Setup for Claude

**Claude Pro (Recommended):**
1. Navigate to **Settings → Connectors → Add Custom Connector**
2. Configure with MCP URL:
   - **EU (our data)**: `https://mcp-eu.mixpanel.com/mcp`
   - US: `https://mcp.mixpanel.com/mcp`
3. Complete OAuth authorization

**Claude Desktop/CLI:**
Requires Node.js setup and config file editing. See [Mixpanel MCP docs](https://docs.mixpanel.com/docs/features/mcp).

### Prerequisites

1. **Org admin must enable**: Settings → Org → Overview → Enable MCP
2. **User permissions**: Users can only access projects they already have Mixpanel access to
3. **Security review**: Queries route through AI services - review data handling policies

### Example Queries for Accelerate

Once configured, you could ask Claude:

- "How many Registration completed events happened this month?"
- "Show me the signup funnel conversion rate over the last 30 days"
- "Which users activated but then churned?"
- "What's the trend for Content Explorer events?"
- "Compare Experiments events week over week"

### Documentation

- [Mixpanel MCP Integration](https://docs.mixpanel.com/docs/features/mcp)

---

*Document generated by automated codebase audit. Last updated: January 2025.*
