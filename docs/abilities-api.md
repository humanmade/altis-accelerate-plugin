# Accelerate Abilities API: A Vision for the Agentic Era

> **The Delta is Everything.**
>
> In the digital world, growth is not found in uniformity but in purposeful, intelligent deviation. The most significant gains are unlocked by the smallest, most insightful changes—the delta between a hypothesis and a result.

---

## The Paradigm Shift

We are witnessing a tectonic shift from **Direct Manipulation**—where users manually configure settings, interpret dashboards, and click buttons—to the **Agentic Era**, where AI agents act as intermediaries that execute complex workflows, analyze vast datasets, and autonomously suggest optimizations based on natural language intent.

For Accelerate, this isn't just a feature update. It's an opportunity to become the **neuromuscular system of the website**—allowing AI agents to physically manipulate site structure, execute server-side tests, and personalize content with deep context awareness.

---

## Our Competitive Moat: Content Awareness

External CRO tools like Optimizely and VWO operate via JavaScript overlays and disconnected dashboards. They create a "black box" where the CMS is unaware that an experiment is running.

**Accelerate is different.**

By integrating via the WordPress Abilities API, we give AI agents the power to:
- **Read block structure** via `parse_blocks`
- **Understand content semantics** (knowing a block is a "Pricing Table" rather than just a collection of divs)
- **Modify underlying HTML/JSON reliably** at the server level

While a generic AI agent struggles to edit a VWO test via a screenshot, an Accelerate-empowered agent can precisely manipulate block attributes, ensuring rendering stability and performance.

**This is our moat: The AI doesn't just see the page—it understands it.**

---

## Design Philosophy: The Four Domains

Our abilities are organized into four functional domains that mirror how an intelligent system operates:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    THE FOUR DOMAINS                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   👁️  DISCOVERY (Eyes)                                              │
│       MCP Resources - Read-only context streams                     │
│       "What is happening on this site?"                             │
│                                                                     │
│   🤚 EXECUTION (Hands)                                              │
│       MCP Tools - Write capabilities                                │
│       "Make this change to the site"                                │
│                                                                     │
│   🗣️  INTEGRATION (Voice)                                           │
│       Cross-platform data exposure                                  │
│       "Connect this to the broader business"                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Beyond CRUD: Cognitive Abilities

Traditional APIs expose Create, Read, Update, Delete operations. We go further.

**Cognitive Abilities** are tools that allow an AI to:
- **Reason** about conversion data
- **Formulate** hypotheses
- **Validate** statistical significance
- **Execute** experiments autonomously
- **Learn** from outcomes

This transforms the AI from a passive data fetcher into an active growth partner.

---

## The Complete Ability Loadout

### Domain A: Discovery & Context (Eyes)

Before an agent can act, it must perceive. These abilities provide the necessary context to prevent hallucinations.

#### `accelerate/get-performance-summary`

**Purpose**: Retrieves aggregated performance metrics with unprecedented granularity.

```json
{
  "input_schema": {
    "type": "object",
    "properties": {
      "entity_type": { "enum": ["block", "post", "experiment", "site"] },
      "entity_id": { "type": "integer" },
      "date_range": {
        "type": "object",
        "properties": {
          "start": { "type": "string", "format": "date-time" },
          "end": { "type": "string", "format": "date-time" }
        }
      },
      "granularity": { "enum": ["hourly", "daily", "weekly", "aggregate"] },
      "segment": { "type": "string", "description": "e.g., 'mobile', 'returning'" }
    }
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "views": { "type": "integer" },
      "visitors": { "type": "integer" },
      "conversions": { "type": "integer" },
      "conversion_rate": { "type": "number" },
      "confidence_interval": { "type": "object" },
      "time_series": { "type": "array" }
    }
  }
}
```

**Why it matters**: AI Agents are pattern recognition engines. By feeding raw performance data rather than just "winner/loser" status, the Agent can detect subtle trends: "Module A performs better on weekends" or "Variant B has high clicks but low form completion."

**MCP Mapping**: Exposed as Resource URI `accelerate://analytics/summary/{entity_type}/{id}`

---

#### `accelerate/list-active-experiments`

**Purpose**: Returns a registry of all currently running experiments.

**Why it matters**: Contextual safety. If an Agent is asked to "optimize the pricing page," it must first check this resource to ensure it doesn't disrupt an ongoing test.

---

#### `accelerate/list-experiments`

**Purpose**: Historical experiment discovery with filtering, pagination, and date ranges. Queries the experiments table directly for all experiment types and statuses.

**Input**:
- `status` — `all` | `active` | `running` | `completed` | `paused` | `draft` (default: `all`)
- `type` — `all` | `abtest` | `personalization` (default: `all`)
- `date_range` — `{ start, end }` in ISO 8601
- `subject_post_id` — filter by WordPress post being tested
- `annotation_key` / `annotation_value` — filter by consumer-attached metadata
- `page` / `per_page` — pagination (max 100 per page)

**Output**: `{ experiments: [...], total, pages }`

**Why it matters**: Enables autonomous learning loops. An agent can walk a site's full experiment history, identify winning patterns, and propose future tests based on what has worked before. `list-active-experiments` remains as a backward-compatible alias.

---

#### `accelerate/get-audience-segments`

**Purpose**: Provides detailed definitions of available personalization segments.

**Why it matters**: Personalization capabilities are often opaque. Giving the Agent visibility allows it to proactively suggest: "I see we have a 'High Value' segment defined but no personalized content for them on the homepage. Shall I draft a rule?"

---

#### `accelerate/get-audience-fields`

**Purpose**: Lists all available targeting fields and their possible values.

**Why it matters**: Enables natural language to boolean logic translation. User says "Show French pricing to visitors from France" → Agent builds the precise targeting rule.

---

#### `accelerate/get-top-content`

**Purpose**: Returns best-performing content with full metrics.

---

#### `accelerate/get-content-diff`

**Purpose**: Compares content performance between two time periods.

---

#### `accelerate/get-traffic-breakdown`

**Purpose**: Traffic breakdown by source, country, device, or custom dimension.

---

### Domain B: Execution & Configuration (Hands)

These are the "write" capabilities—robust, with strict validation to prevent site breakage.

#### `accelerate/create-ab-test`

**Purpose**: The core engine. Converts a standard block into an Experiment Block with defined variants.

```json
{
  "input_schema": {
    "type": "object",
    "properties": {
      "post_id": { "type": "integer" },
      "selector": { "$ref": "#/definitions/fuzzy_selector" },
      "hypothesis": { "type": "string", "description": "Natural language description" },
      "goal_metric": { "enum": ["engagement", "click_any_link", "form_submission", "custom_event"] },
      "variants": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "attributes": { "type": "object" },
            "inner_content": { "type": "string" }
          }
        }
      },
      "traffic_split": { "type": "array", "items": { "type": "number" } }
    },
    "required": ["post_id", "selector", "variants"]
  }
}
```

**Annotations**: Both `create-ab-test` and `create-personalization-rule` accept an optional `annotations` object — arbitrary key/value metadata using a `namespace:key` convention (e.g. `"recommendation:pattern": "headline_match_intent"`). Annotations are stored per-experiment (not per-block) so historical experiments keep their own metadata. Returned on `get-experiment-results` and `list-experiments`, and filterable via `annotation_key`/`annotation_value` on `list-experiments`.

**User Value**: "Create a variant of this headline that is more punchy and run a 50/50 test." The Agent generates the copy, formats the block, and schedules the test in a single turn.

---

#### `accelerate/create-personalization-rule`

**Purpose**: Sets up conditional display rules for targeted content.

```json
{
  "input_schema": {
    "type": "object",
    "properties": {
      "block_selector": { "$ref": "#/definitions/fuzzy_selector" },
      "segment_id": { "type": "string" },
      "personalized_content": { "type": "object", "description": "Block JSON" },
      "fallback_content": { "type": "object", "description": "Default block JSON" },
      "priority": { "type": "integer" }
    }
  }
}
```

**Why it matters**: Enables "Hyper-Personalization at Scale." An Agent analyzing behavior can autonomously suggest: "Users from LinkedIn drop off at the hero section. I can show them a relevant case study instead."

---

#### `accelerate/broadcast-content`

**Purpose**: Pushes content to multiple locations site-wide.

**Why it matters**: "Update the Black Friday banner across all landing pages" becomes a single prompt.

---

#### `accelerate/create-audience`

**Purpose**: Creates a new audience segment from natural language or structured rules.

---

#### `accelerate/update-audience`

**Purpose**: Modifies existing audience targeting rules.

---

#### `accelerate/set-block-goal`

**Purpose**: Defines the conversion goal for a block.

---

#### `accelerate/set-traffic-percentage`

**Purpose**: Adjusts traffic allocation for an experiment.

---

### Domain C: Integration & Export (Voice)

Connecting Accelerate to the broader business intelligence stack.

#### `accelerate/export-events`

**Purpose**: Exports raw analytics events for external analysis.

**Why it matters**: By exposing analytics as MCP Resources, BI tools can ingest experimentation data, enabling queries like "Correlate our A/B test results with Salesforce lead quality data."

---

#### `accelerate/get-export-status`

**Purpose**: Check status of async export jobs.

---

## Solving the Anchor Problem: Fuzzy Selectors

A critical technical challenge: Block IDs are volatile. `client_id` changes on every page load, making it a poor target for persistent Agent commands.

**Our Solution: Fuzzy Selectors**

Instead of requiring a UUID, abilities accept a selector object:

```json
{
  "selector": {
    "type": "object",
    "properties": {
      "block_type": { "type": "string", "example": "core/heading" },
      "contains_text": { "type": "string", "example": "Sign Up Now" },
      "anchor_slug": { "type": "string", "description": "HTML anchor attribute" },
      "nth_of_type": { "type": "integer", "description": "1st, 2nd, etc. of this type" }
    }
  }
}
```

The Accelerate plugin scans the `parse_blocks` tree to find blocks matching these criteria. This abstraction makes Agent requests robust against minor ID shifts.

---

## Agentic Workflows: Personas in Action

### The Growth Marketer: "Passive Monitor"

**Goal**: Keep an eye on landing page performance without daily manual checks.

**Workflow**:
1. **Monitor**: Agent polls `get-performance-summary` daily
2. **Detect**: Notices significant bounce rate increase on mobile
3. **Hypothesize**: "Mobile users prefer 'Get Started' over 'Sign Up'"
4. **Draft**: Uses `create-ab-test` to generate a variant
5. **Elicit**: Sends notification: "Mobile bounce rates are high (65%). I've drafted a test. Approve to launch?"
6. **Execute**: User clicks "Approve"—test goes live

---

### The Content Manager: "Broadcast Orchestrator"

**Goal**: Launch a flash sale across the entire blog for 24 hours.

**Workflow**:
1. **Prompt**: "Put a 20% off banner on all blog posts for 24 hours"
2. **Generate**: Agent creates the banner block
3. **Execute**: Calls `broadcast-content` with target and duration
4. **Complete**: Banner appears instantly, auto-removes after 24 hours

**Value**: Single prompt replaces hours of manual template editing.

---

### The Data Scientist: "Hypothesis Engine"

**Goal**: Understand why the Q3 campaign failed.

**Workflow**:
1. **Prompt**: "Correlate this sales drop with our website experiments"
2. **Query**: Agent pulls experiment history via `list-experiments`
3. **Analyze**: Fetches performance data, runs `validate-statistical-significance`
4. **Conclude**: "Experiment B (New Header) had -15% impact on Add to Cart. P-value: 0.02."
5. **Report**: "Recommendation: Revert immediately."

---

## The Self-Healing Site

Using `stop-experiment` and real-time analytics, the Agent can act as an automated circuit breaker:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SELF-HEALING CIRCUIT BREAKER                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Experiment Live                                                   │
│        │                                                            │
│        ▼                                                            │
│   Agent monitors get-performance-summary                            │
│        │                                                            │
│        ▼                                                            │
│   Revenue deviates > 3 standard deviations?                         │
│        │                                                            │
│   ┌────┴────┐                                                       │
│   │         │                                                       │
│   No       Yes                                                      │
│   │         │                                                       │
│   ▼         ▼                                                       │
│ Continue   stop-experiment(action: 'promote_control')               │
│            Notify human: "Experiment killed due to revenue drop"    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**The website doesn't just display content—it actively thinks, tests, and protects itself.**

---

## Security & Governance

### Tiered Permission Model

| Tier | Capability Required | Abilities | Use Case |
|------|---------------------|-----------|----------|
| **1. Read Analytics** | `edit_posts` or `view_accelerate_analytics` | All `get-*` and `list-*` abilities | Safe for monitoring agents and read-only learning loops |
| **2. Create Drafts** | `edit_posts` | `create-*`, `estimate-*` | Agents that propose but don't publish |
| **3. Publish/Destructive** | `manage_options` | `stop-experiment`, `broadcast-content`, `declare-winner` | Full automation |

### Destructive Action Safeguards

All "write" abilities affecting live traffic are registered with `destructive: true`. This signals to the MCP Client that it **must explicitly ask for user confirmation** before execution.

This prevents "runaway agent" scenarios.

### The Thinking Message

The Abilities API supports a `thinking_message` attribute. We use this to build trust:

> "Querying Accelerate Analytics Engine for conversion data..."

Rather than a generic spinner, users see exactly which tool the agent is wielding.

### Privacy by Design

**Aggregation by Default**: `get-performance-summary` returns counts and percentages, never individual user logs. Data passed to LLMs is devoid of PII.

**Consent Gates**: If raw data is requested, the ability verifies user roles AND checks the site's consent management platform status.

---

## Future Vision: AI-Native Features

### Semantic Targeting

**New Ability**: `accelerate/target-semantic-cluster`

Instead of "Users who visited URL X," target based on semantic meaning. The Agent analyzes reading history, determines interest in "Enterprise Security" (concept), and triggers personalization—even without specifically tagged pages.

### Inter-Plugin Orchestration

The true power of the Abilities API is interoperability.

**Scenario**: An SEO plugin detects a keyword opportunity → calls `accelerate/create-ab-test` to test a new H1 optimization automatically.

**Accelerate becomes the execution layer for the entire WordPress ecosystem.**

---

## Implementation

### Rollout: Settings Toggle (Opt-In)

```php
'enable_abilities_api' => [
    'label'       => __( 'Enable AI Abilities', 'altis-accelerate' ),
    'description' => __( 'Expose Accelerate capabilities to AI agents via the WordPress Abilities API.', 'altis-accelerate' ),
    'type'        => 'checkbox',
    'default'     => false,
]
```

### File Structure

```
inc/
├── abilities/
│   ├── namespace.php        # Bootstrap, categories, setting check
│   ├── discovery.php        # Domain A: Eyes
│   ├── execution.php        # Domain B: Hands
│   └── integration.php      # Domain C: Voice
```

### Registration Pattern

```php
// inc/abilities/namespace.php
namespace Altis\Accelerate\Abilities;

function maybe_register_abilities() {
    if ( ! function_exists( 'wp_register_ability' ) ) {
        return; // WordPress < 6.9
    }

    if ( ! get_option( 'accelerate_enable_abilities_api', false ) ) {
        return; // Feature not enabled
    }

    add_action( 'wp_abilities_api_categories_init', __NAMESPACE__ . '\\register_categories' );
    add_action( 'wp_abilities_api_init', __NAMESPACE__ . '\\register_abilities' );
}
add_action( 'init', __NAMESPACE__ . '\\maybe_register_abilities' );

function register_categories() {
    // IMPORTANT: Category slugs must use dashes only, not slashes
    wp_register_ability_category( 'accelerate-discovery', [
        'label'       => __( 'Discovery & Analytics', 'altis-accelerate' ),
        'description' => __( 'Query site analytics, traffic data, and content performance.', 'altis-accelerate' ),
    ]);

    wp_register_ability_category( 'accelerate-execution', [
        'label'       => __( 'Experimentation & Personalization', 'altis-accelerate' ),
        'description' => __( 'Create and manage A/B tests, audiences, and broadcasts.', 'altis-accelerate' ),
    ]);

    wp_register_ability_category( 'accelerate-integration', [
        'label'       => __( 'Data Integration', 'altis-accelerate' ),
        'description' => __( 'Export analytics data for external tools.', 'altis-accelerate' ),
    ]);
}
```

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AI AGENT AUTHENTICATION                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   1. User creates Application Password in WordPress                 │
│      └─> Users > Profile > Application Passwords                    │
│                                                                     │
│   2. User configures AI tool with credentials                       │
│      └─> Site URL + Username + Application Password                 │
│                                                                     │
│   3. AI agent discovers abilities                                   │
│      └─> GET /wp-abilities/v1/abilities                             │
│                                                                     │
│   4. Permission callback validates user capabilities                │
│      └─> current_user_can() enforced on every call                  │
│                                                                     │
│   5. Destructive actions require explicit confirmation              │
│      └─> MCP Elicitation pattern                                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### MCP Adapter Configuration

```json
{
  "mcpServers": {
    "accelerate": {
      "command": "wp",
      "args": ["mcp", "serve", "--server=default"],
      "env": {
        "WP_URL": "https://example.com",
        "WP_USER": "admin",
        "WP_APP_PASSWORD": "xxxx xxxx xxxx xxxx"
      }
    }
  }
}
```

---

## Summary: The Complete Loadout

| Domain | Abilities | Purpose |
|--------|-----------|---------|
| **Discovery (Eyes)** | `get-performance-summary`, `list-active-experiments`, `list-experiments`, `get-experiment-results`, `get-audience-segments`, `get-audience-fields`, `get-top-content`, `get-content-diff`, `get-traffic-breakdown` | Context & perception |
| **Execution (Hands)** | `create-ab-test`, `create-personalization-rule`, `broadcast-content`, `create-audience`, `update-audience`, `set-block-goal`, `set-traffic-percentage` | Action & configuration |
| **Integration (Voice)** | `export-events`, `get-export-status` | Cross-platform data |

**Total: ~16 core abilities across 3 domains**

---

## The Vision

Accelerate's integration with the Abilities API isn't about exposing features to AI. It's about redefining what a website can be.

**Today**: Websites display content.
**Tomorrow**: Websites think, test, and improve themselves.

By providing the most robust experimentation toolset for AI agents, we transition from being a "tool for marketers" to a **platform for autonomous growth**.

The delta between a hypothesis and a result. That's where we live.

**That's Accelerate.**

---

## Implementation Gotchas & Caveats

Based on real-world testing with MCP clients, here are critical implementation details that can cause silent failures.

### 1. Category Slugs: Dashes Only

WordPress category slugs only accept lowercase alphanumeric characters and dashes. **Slashes will silently fail.**

```php
// ❌ WRONG - will not register
wp_register_ability_category( 'accelerate/discovery', [...] );

// ✅ CORRECT
wp_register_ability_category( 'accelerate-discovery', [...] );
```

### 2. MCP Public Meta: Nested Array Format

For abilities to appear via MCP, the `mcp.public` flag must be a **nested array**, not a flat key.

```php
// ❌ WRONG - abilities won't be discoverable
'meta' => [
    'mcp.public' => true,
],

// ✅ CORRECT
'meta' => [
    'mcp' => [ 'public' => true ],
],
```

**Important:** This meta must be added to **every ability registration**, not just once per file.

### 3. Always Handle WP_Error Before Array Access

API calls may return `WP_Error` objects. Attempting to access them as arrays causes PHP fatal errors.

```php
// ❌ WRONG - crashes if API returns error
$data = API\get_graph_data( $post_id, $args );
$views = $data['stats']['summary']['views']; // Fatal if WP_Error

// ✅ CORRECT
$data = API\get_graph_data( $post_id, $args );
$views = 0;
if ( ! is_wp_error( $data ) ) {
    $views = $data['stats']['summary']['views'] ?? 0;
}
```

### 4. ClickHouse Query Results: stdClass vs Array

The `\Altis\Accelerate\Utils\query()` function may return rows as either `stdClass` objects or arrays depending on the query format parameter.

```php
// ✅ Handle both types
$row = $result[0];
$count = is_array( $row ) ? ( $row['count'] ?? 0 ) : ( $row->count ?? 0 );
```

### 5. Input Schema: Avoid Empty Properties

MCP validation may reject input schemas with empty `properties`. Always include at least one optional property.

```php
// ❌ WRONG - MCP may reject {} as "not of type object"
'input_schema' => [
    'type'       => 'object',
    'properties' => [],
],

// ✅ CORRECT - add optional property
'input_schema' => [
    'type'       => 'object',
    'properties' => [
        'refresh' => [
            'type'        => 'boolean',
            'default'     => false,
            'description' => __( 'Force refresh of cached data.', 'altis' ),
        ],
    ],
],
```

### 6. Audience Rule Values: Accept Multiple Types

Audience targeting rules may use numeric comparisons (e.g., `metrics.hour >= 9`). The schema must accept both strings and numbers.

```php
// ❌ WRONG - rejects numeric values
'value' => [ 'type' => 'string' ],

// ✅ CORRECT
'value' => [ 'type' => [ 'string', 'number' ] ],
```

### 7. Field Name Mapping for Analytics

The underlying analytics data uses specific field paths that may differ from intuitive names:

| Dimension | Actual Field Path |
|-----------|-------------------|
| Country | `endpoint.Location.Country` |
| Browser | `endpoint.Demographic.Model` |
| OS/Platform | `endpoint.Demographic.Platform` |
| Referrer | `attributes.referer` |

### 8. Filter Zero-Count Results

Analytics breakdowns may return entries with zero counts (from predefined options). Filter and sort before returning.

```php
// Filter out zero values and sort by count descending
$results = array_filter( $results, fn( $item ) => $item['value'] > 0 );
usort( $results, fn( $a, $b ) => $b['value'] <=> $a['value'] );
```

### 9. ClickHouse Timezone Configuration

The analytics database may have timezone configuration requirements. If you see errors like `Timezone XXX does not exist`, this is a server-level ClickHouse configuration issue, not an ability bug.

### 10. Testing Abilities via MCP

Always test abilities through the actual MCP interface, not just direct PHP calls. MCP adds layers of:
- JSON schema validation
- Permission checks
- Response serialization

An ability that works in unit tests may fail via MCP due to schema mismatches or serialization issues.

---

## Sources

- [Abilities API in WordPress 6.9](https://make.wordpress.org/core/2025/11/10/abilities-api-in-wordpress-6-9/)
- [WordPress MCP Adapter](https://github.com/WordPress/mcp-adapter)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [WS Form MCP Tutorial](https://wsform.com/how-to-create-an-mcp-server-in-wordpress-with-the-abilities-api-and-mcp-adapter/)
