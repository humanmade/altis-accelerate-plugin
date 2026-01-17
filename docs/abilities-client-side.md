# Accelerate Abilities: Client-Side AI Agent Configuration

> **How to configure AI agents (Claude, GPT, etc.) to effectively use Accelerate's Abilities API**
>
> This is the "plugin" layer - vendor-specific configuration that helps AI agents choose the right abilities and use them efficiently.

---

## The Problem

Accelerate exposes ~15 abilities via MCP. When a user asks "How is Sarah's content performing?", the AI agent sees:

```
Available abilities:
  - accelerate/get-performance-summary
  - accelerate/get-author-performance
  - accelerate/get-top-content
  - accelerate/get-metrics
  - ... 12 more
```

Without guidance, the agent might:
- Call the wrong ability entirely
- Use a primitive when a convenience exists
- Make multiple redundant calls
- Miss the most efficient path

**This document defines client-side configuration to solve this.**

---

## Architecture: Server vs Client

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ABILITIES ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     SERVER SIDE (WordPress)                      │   │
│  │                                                                  │   │
│  │  • Ability registration (wp_register_ability)                   │   │
│  │  • Input/output schemas                                         │   │
│  │  • Execute callbacks                                            │   │
│  │  • Permission checks                                            │   │
│  │  • ClickHouse queries                                           │   │
│  │                                                                  │   │
│  │  Defined in: abilities-api.md, abilities-api-2.md               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              │ MCP Protocol                             │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     CLIENT SIDE (AI Agent)                       │   │
│  │                                                                  │   │
│  │  • Ability discovery & selection                                │   │
│  │  • Query → ability routing                                      │   │
│  │  • System prompt configuration                                  │   │
│  │  • Response interpretation                                      │   │
│  │  • Multi-ability orchestration                                  │   │
│  │                                                                  │   │
│  │  Defined in: THIS DOCUMENT                                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Ability Taxonomy (Client Reference)

The client needs to understand ability types to route effectively:

| Type | Characteristics | When to Use | Examples |
|------|-----------------|-------------|----------|
| **Primitive** | Flexible, composable, higher token cost | Complex/custom queries | `get-metrics`, `get-performance-summary` |
| **Convenience** | Pre-packaged, lower token cost | Common questions | `get-author-performance`, `get-realtime-pulse` |
| **Cognitive** | Synthesizes data into recommendations | "What should I do?" questions | `suggest-experiment` |
| **Execution** | Creates/modifies site content | Action requests | `create-ab-test`, `create-audience` |
| **Terminal** | Output/export, doesn't feed further analysis | Reporting requests | `export-author-report` |

**Rule**: Prefer convenience over primitive when the convenience matches the query.

---

## Claude MCP Configuration

### Basic Setup

```json
{
  "mcpServers": {
    "accelerate": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-remote", "https://example.com/wp-json/mcp/v1"],
      "env": {
        "MCP_AUTH": "Bearer <application-password>"
      }
    }
  }
}
```

### System Prompt Extension

Add this to Claude's system prompt for optimal ability selection:

```markdown
## Accelerate Analytics Integration

You have access to Accelerate abilities for WordPress analytics, A/B testing, and personalization.

### Ability Selection Guide

**For specific questions, use these convenience abilities:**
- Author performance → `accelerate/get-author-performance`
- Real-time/trending → `accelerate/get-realtime-pulse`
- Traffic sources/attribution → `accelerate/get-traffic-attribution`
- Topic/category analysis → `accelerate/get-taxonomy-performance`
- Engagement quality → `accelerate/get-engagement-depth`
- Content velocity/trends → `accelerate/get-content-velocity`

**For recommendations:**
- "What should I test?" → `accelerate/suggest-experiment`

**For actions:**
- Create A/B test → `accelerate/create-ab-test`
- Create audience → `accelerate/create-audience`
- Set up personalization → `accelerate/create-personalization-rule`

**For custom/complex queries:**
- Use `accelerate/get-performance-summary` (primitive)
- Use `accelerate/get-metrics` when no convenience matches

### Selection Priority
1. Check if a convenience ability matches the query exactly
2. If yes, use the convenience (lower token cost, pre-optimized)
3. If no, use a primitive with appropriate parameters
4. For "what should I do?" questions, use cognitive abilities

### Common Patterns

**"How is [author] doing?"**
→ `get-author-performance` with author_id

**"What's trending right now?"**
→ `get-realtime-pulse` with time_window: "15m"

**"Where is our traffic coming from?"**
→ `get-traffic-attribution` with models: ["first_touch", "last_touch"]

**"Which topics perform best?"**
→ `get-taxonomy-performance` with taxonomy: "category"

**"What should we test on [page]?"**
→ `suggest-experiment` with scope: "page", entity_id: [post_id]
```

---

## Query Routing Rules

### Pattern-Based Routing

Client-side routing logic to select abilities:

```javascript
const ROUTING_RULES = [
  // Convenience abilities (check first)
  {
    patterns: [/author|writer|creator|byline/i],
    ability: 'accelerate/get-author-performance',
    confidence: 0.9,
    extract: (query) => ({ author_id: extractAuthorId(query) })
  },
  {
    patterns: [/trending|right now|live|concurrent|real.?time/i],
    ability: 'accelerate/get-realtime-pulse',
    confidence: 0.9,
    extract: () => ({ time_window: '15m' })
  },
  {
    patterns: [/attribution|source|referr|utm|first.?touch|last.?touch|where.*from/i],
    ability: 'accelerate/get-traffic-attribution',
    confidence: 0.9,
    extract: () => ({ models: ['first_touch', 'last_touch'] })
  },
  {
    patterns: [/category|tag|topic|taxonomy|section/i],
    ability: 'accelerate/get-taxonomy-performance',
    confidence: 0.85,
    extract: (query) => ({
      taxonomy: query.match(/tag/i) ? 'post_tag' : 'category'
    })
  },
  {
    patterns: [/engag|depth|quality|bounce|recirc|sticky/i],
    ability: 'accelerate/get-engagement-depth',
    confidence: 0.85,
    extract: () => ({})
  },
  {
    patterns: [/velocity|trend|spike|drop|accelerat|decelerat/i],
    ability: 'accelerate/get-content-velocity',
    confidence: 0.8,
    extract: () => ({ compare_periods: ['24h', '7d'] })
  },

  // Cognitive abilities
  {
    patterns: [/suggest|recommend|should.*(test|try)|optimi[sz]e|improve/i],
    ability: 'accelerate/suggest-experiment',
    confidence: 0.85,
    extract: () => ({ scope: 'site' })
  },

  // Execution abilities
  {
    patterns: [/create.*(test|experiment|ab)/i],
    ability: 'accelerate/create-ab-test',
    confidence: 0.9,
    requiresConfirmation: true
  },
  {
    patterns: [/create.*(audience|segment)/i],
    ability: 'accelerate/create-audience',
    confidence: 0.9,
    requiresConfirmation: true
  },

  // Fallback to primitives
  {
    patterns: [/.*/],
    ability: 'accelerate/get-performance-summary',
    confidence: 0.5,
    extract: () => ({ entity_type: 'site' })
  }
];

function routeQuery(userQuery) {
  for (const rule of ROUTING_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(userQuery)) {
        return {
          ability: rule.ability,
          confidence: rule.confidence,
          params: rule.extract ? rule.extract(userQuery) : {},
          requiresConfirmation: rule.requiresConfirmation || false
        };
      }
    }
  }
}
```

### Confidence Thresholds

| Confidence | Action |
|------------|--------|
| ≥ 0.85 | Call ability directly |
| 0.7 - 0.85 | Call ability, but explain choice to user |
| 0.5 - 0.7 | Ask user to confirm ability selection |
| < 0.5 | Ask user to clarify query |

---

## Multi-Ability Orchestration

Some queries require multiple ability calls. Define orchestration patterns:

### Pattern: Compare and Recommend

```
User: "How is the blog performing and what should we improve?"

Orchestration:
1. get-performance-summary (entity_type: "site", date_range: last 30 days)
2. get-engagement-depth (entity_type: "site")
3. get-taxonomy-performance (taxonomy: "category")
4. suggest-experiment (scope: "site")

Synthesis: Combine results into narrative with recommendations
```

### Pattern: Author Deep Dive

```
User: "Give me a complete picture of Sarah's content"

Orchestration:
1. get-author-performance (author_id: sarah_id)
2. get-top-content (author: sarah_id, limit: 10)
3. get-engagement-depth (entity_type: "author", entity_id: sarah_id)
4. get-content-velocity (filter by author)

Synthesis: Author profile with strengths, trends, and opportunities
```

### Pattern: Real-Time Alert Response

```
User: "Something's spiking, what's happening?"

Orchestration:
1. get-realtime-pulse (time_window: "5m")
2. get-traffic-attribution (for top trending post)
3. get-audience-segments (to identify who's visiting)

Synthesis: Situation report with traffic source and audience breakdown
```

---

## Response Interpretation

### Handling Empty Results

```javascript
function interpretResponse(ability, response) {
  if (!response || Object.keys(response).length === 0) {
    return {
      message: `No data found for this ${ability} query.`,
      suggestions: [
        'Try expanding the date range',
        'Check if the entity exists',
        'Verify you have analytics data for this period'
      ]
    };
  }
  // ... normal processing
}
```

### Contextualizing Metrics

```javascript
const METRIC_CONTEXT = {
  conversion_rate: {
    good: (v) => v > 3,
    average: (v) => v >= 1 && v <= 3,
    poor: (v) => v < 1,
    unit: '%',
    explanation: 'Percentage of visitors who completed a goal action'
  },
  bounce_rate: {
    good: (v) => v < 40,
    average: (v) => v >= 40 && v <= 60,
    poor: (v) => v > 60,
    unit: '%',
    explanation: 'Percentage of single-page sessions'
  },
  recirculation_rate: {
    good: (v) => v > 20,
    average: (v) => v >= 10 && v <= 20,
    poor: (v) => v < 10,
    unit: '%',
    explanation: 'Percentage of visitors viewing 2+ pages'
  }
};

function contextualizeMetric(name, value) {
  const ctx = METRIC_CONTEXT[name];
  if (!ctx) return { value, assessment: 'neutral' };

  let assessment = 'average';
  if (ctx.good(value)) assessment = 'good';
  if (ctx.poor(value)) assessment = 'poor';

  return {
    value: `${value}${ctx.unit}`,
    assessment,
    explanation: ctx.explanation
  };
}
```

---

## Error Handling

### Common Errors and Recovery

| Error | Likely Cause | Recovery |
|-------|--------------|----------|
| `missing_entity_id` | Query didn't specify which post/author | Ask user to clarify |
| `invalid_date_range` | Dates in wrong format | Retry with ISO 8601 format |
| `no_data` | No analytics for this period | Suggest expanding date range |
| `permission_denied` | User lacks capability | Explain required permissions |
| `rate_limited` | Too many requests | Wait and retry with backoff |

### Graceful Degradation

```javascript
async function callAbilityWithFallback(primary, fallback, params) {
  try {
    return await callAbility(primary, params);
  } catch (error) {
    if (error.code === 'ability_not_found' && fallback) {
      console.log(`Falling back from ${primary} to ${fallback}`);
      return await callAbility(fallback, params);
    }
    throw error;
  }
}

// Example: Try convenience, fall back to primitive
const result = await callAbilityWithFallback(
  'accelerate/get-author-performance',
  'accelerate/get-performance-summary',
  { author_id: 123 }
);
```

---

## Caching Strategy (Client-Side)

### Response Caching

```javascript
const CACHE_TTL = {
  'get-realtime-pulse': 10,           // 10 seconds (real-time)
  'get-content-velocity': 30,         // 30 seconds
  'get-author-performance': 60,       // 1 minute
  'get-performance-summary': 60,      // 1 minute
  'get-taxonomy-performance': 300,    // 5 minutes (stable)
  'get-audience-segments': 300,       // 5 minutes (stable)
  'suggest-experiment': 0,            // No cache (dynamic)
};

function getCacheTTL(ability) {
  return CACHE_TTL[ability.replace('accelerate/', '')] || 60;
}
```

### Cache Invalidation

Invalidate when user takes action:
- After `create-ab-test` → invalidate `list-active-experiments`
- After `create-audience` → invalidate `get-audience-segments`
- After any execution ability → invalidate related discovery abilities

---

## Conversation Patterns

### Initial Discovery

```
User: "I want to understand my site analytics"

Agent:
1. Call get-performance-summary for site overview
2. Call get-top-content for best performers
3. Present high-level metrics
4. Offer drill-down options:
   - "Want to see author breakdown?"
   - "Want to see traffic sources?"
   - "Want recommendations for improvements?"
```

### Drill-Down Flow

```
User: "Tell me more about our enterprise content"

Agent:
1. Recognize "enterprise" as likely category/tag
2. Call get-taxonomy-performance filtered to "enterprise"
3. If low confidence, ask: "Did you mean the 'Enterprise' category,
   or content about enterprise topics?"
4. Present category performance with comparison to site average
```

### Action Flow

```
User: "Let's test a new headline on the pricing page"

Agent:
1. Recognize as create-ab-test intent
2. Call get-performance-summary for pricing page baseline
3. Present current metrics: "The pricing page has X views, Y% conversion"
4. Ask for variant details: "What headline would you like to test?"
5. Confirm before calling create-ab-test
6. Report success with experiment tracking info
```

---

## Vendor-Specific Extensions

### Claude-Specific

```markdown
# Claude System Prompt Addition

When using Accelerate abilities:

1. **Think step-by-step** about which ability matches the query
2. **Prefer convenience abilities** over primitives for standard queries
3. **Explain your reasoning** when ability choice isn't obvious
4. **Confirm before execution** abilities (create-*, update-*, delete-*)
5. **Summarize insights** rather than dumping raw JSON
6. **Suggest next steps** after presenting data
```

### GPT-Specific

```json
{
  "name": "accelerate_analytics",
  "description": "WordPress analytics, A/B testing, and personalization",
  "instructions": "Use convenience abilities for common queries. Always confirm before creating experiments. Summarize data into actionable insights.",
  "tools": [
    {"type": "mcp", "server": "accelerate"}
  ]
}
```

### Generic MCP Client

For clients without custom configuration, rely on:
1. Well-engineered ability descriptions (server-side)
2. Clear category organization
3. Descriptive parameter names and enums

---

## Testing Client Configuration

### Test Queries

| Query | Expected Ability | Expected Params |
|-------|------------------|-----------------|
| "How is John doing?" | `get-author-performance` | `author_id: <john's id>` |
| "What's trending?" | `get-realtime-pulse` | `time_window: "15m"` |
| "Where's traffic from?" | `get-traffic-attribution` | `models: ["first_touch", "last_touch"]` |
| "Best categories?" | `get-taxonomy-performance` | `taxonomy: "category"` |
| "Improve homepage" | `suggest-experiment` | `scope: "page", entity_id: <homepage>` |

### Validation Checklist

- [ ] Convenience abilities selected over primitives for matching queries
- [ ] Primitives used for complex/custom queries
- [ ] Execution abilities require confirmation
- [ ] Empty results handled gracefully
- [ ] Errors explained with recovery suggestions
- [ ] Multi-ability queries orchestrated correctly
- [ ] Metrics contextualized (good/average/poor)
- [ ] Cache TTLs appropriate for ability type

---

## Related Documents

- `abilities-api.md` - Server-side ability architecture and vision
- `abilities-api-2.md` - Ranked ability roadmap and implementation details
- `GAP-ANALYSIS.md` - Competitive gaps driving ability design
