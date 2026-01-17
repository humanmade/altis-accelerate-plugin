# Accelerate Abilities API: Ranked Implementation Roadmap

> **Bridging the Gap Analysis to Actionable AI Capabilities**
>
> This document ranks core abilities to build based on competitive gaps identified in `GAP-ANALYSIS.md` and the architectural vision in `abilities-api.md`.

---

## Ranking Methodology

Each ability is evaluated against:

1. **Data Availability** - Does ClickHouse already have this data?
2. **Psychological Driver** - Which competitor-proven attachment mechanism does it address?
3. **AI Leverage** - How much can an agent DO with this beyond reading?
4. **Closed-Loop Potential** - Does this lead to A/B tests or personalization actions?
5. **Competitive Parity** - Which competitor's signature feature does this match?

---

## Ability Architecture: Primitives vs Conveniences

### The Composability Spectrum

Not all abilities are equal. Some are **building blocks**, others are **shortcuts**, and some are **terminal outputs**.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ABILITY COMPOSABILITY SPECTRUM                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PRIMITIVES              CONVENIENCES                        TERMINAL   │
│  (Building Blocks)       (Packaged Queries)                  (Output)   │
│                                                                         │
│  get-metrics             get-author-performance              export     │
│  get-time-series         get-realtime-pulse                             │
│  get-dimensions          get-taxonomy-performance                       │
│  get-attribution         get-content-velocity                           │
│                                                                         │
│  ◄── More flexible                              More opinionated ──►    │
│  ◄── Higher token cost                          Lower token cost ──►    │
│  ◄── AI composes                                Pre-composed     ──►    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Classification Matrix

| Type | Characteristics | Examples |
|------|-----------------|----------|
| **Primitive** | Universal, parameterizable, output feeds other abilities | `get-metrics`, `get-attribution`, `get-engagement-depth` |
| **Convenience** | Pre-composed from primitives, optimized for common use cases | `get-author-performance`, `get-realtime-pulse`, `get-taxonomy-performance` |
| **Terminal** | Output/presentation layer, doesn't feed further analysis | `export-author-report`, `get-top-content` |

### The Dependency Graph

```
                         PRIMITIVES
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    get-metrics         get-attribution    get-engagement
         │                    │               -depth
         │                    │                    │
    ┌────┴────┬───────────────┴────────────┬──────┘
    │         │                            │
    ▼         ▼                            ▼
get-author  get-realtime    get-taxonomy  get-content
-performance  -pulse        -performance   -velocity
    │              │              │             │
    │              │              │             │
    └──────────────┴──────────────┴─────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │    create-ab-test   │  ◄── EXECUTION
              └─────────────────────┘
```

### What This Means for Implementation

**Build primitives first** - they're the foundation. Conveniences can be added later as shortcuts for high-frequency queries.

| Phase | Focus | Abilities |
|-------|-------|-----------|
| Foundation | Primitives | `get-metrics`, `get-attribution`, `get-engagement-depth` |
| Acceleration | Conveniences | `get-author-performance`, `get-realtime-pulse` |

### Server-Side Guidance for AI Selection

While client-side AI agent configuration is covered in `abilities-client-side.md`, the server can help with:

**1. Description Engineering** - Include routing hints in descriptions:
```php
'description' => 'Get author performance metrics. USE THIS when asked about
    a specific author. For multi-author queries, use get-metrics instead.'
```

**2. Category Hierarchy** - Organize by abstraction level:
- `accelerate-primitives` - Low-level building blocks
- `accelerate-insights` - Pre-packaged convenience abilities
- `accelerate-actions` - Execution abilities

**3. Meta Hints** - Machine-readable selection guidance:
```php
'meta' => [
    'abstraction' => 'convenience',  // primitive | convenience | cognitive | terminal
    'use_when'    => ['Single author query', 'Author comparison'],
    'prefer_over' => ['get-metrics'],
    'token_cost'  => 'low',
]
```

> **See Also**: `abilities-client-side.md` for complete AI agent configuration including system prompts, routing rules, and multi-ability orchestration patterns.

---

## Tier 1: Highest Impact / Build First

### 1. `accelerate/get-author-performance`

**Gap Addressed**: #2 (Author Attribution)
**Psychological Driver**: Validation
**Data Status**: ✅ Complete - `authorId`, `blockAuthor`, `blockAuthorID` tracked but never surfaced

```json
{
  "input_schema": {
    "type": "object",
    "properties": {
      "author_id": { "type": "integer", "description": "WordPress user ID" },
      "date_range": {
        "type": "object",
        "properties": {
          "start": { "type": "string", "format": "date" },
          "end": { "type": "string", "format": "date" }
        }
      },
      "metrics": {
        "type": "array",
        "items": { "enum": ["views", "conversions", "engagement", "recirculation"] },
        "default": ["views", "conversions"]
      }
    },
    "required": ["author_id"]
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "author": {
        "type": "object",
        "properties": {
          "id": { "type": "integer" },
          "name": { "type": "string" },
          "post_count": { "type": "integer" }
        }
      },
      "summary": {
        "type": "object",
        "properties": {
          "total_views": { "type": "integer" },
          "total_conversions": { "type": "integer" },
          "conversion_rate": { "type": "number" },
          "avg_engagement": { "type": "number" }
        }
      },
      "comparison_to_team": {
        "type": "object",
        "properties": {
          "views_percentile": { "type": "number" },
          "conversion_percentile": { "type": "number" },
          "rank": { "type": "integer" }
        }
      },
      "top_performing_content": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "post_id": { "type": "integer" },
            "title": { "type": "string" },
            "views": { "type": "integer" },
            "conversion_rate": { "type": "number" }
          }
        }
      },
      "trends": {
        "type": "object",
        "properties": {
          "views_change": { "type": "number" },
          "conversions_change": { "type": "number" },
          "trend_direction": { "enum": ["improving", "declining", "stable"] }
        }
      }
    }
  }
}
```

**Why #1 Priority**:
- Parse.ly's stickiest feature - personal metrics create emotional attachment
- Data exists in ClickHouse but is completely hidden from users
- High AI leverage: Agent can proactively message creators about their performance

**AI Agent Use Case**:
> "Your last 5 articles averaged 2.3x the team engagement rate. Your strength appears to be technical deep-dives - they convert 40% better than your news pieces. Should I draft an A/B test for your next headline to optimize for this strength?"

**Closed-Loop Actions**:
- Feeds into `create-ab-test` for author-specific optimization
- Enables `create-personalization-rule` to show author's best content to returning visitors

---

### 2. `accelerate/get-realtime-pulse`

**Gap Addressed**: #1 (Real-Time Experience)
**Psychological Driver**: Situational Awareness
**Data Status**: ✅ Available - requires time-windowed queries

```json
{
  "input_schema": {
    "type": "object",
    "properties": {
      "time_window": {
        "enum": ["5m", "15m", "30m", "1h"],
        "default": "15m",
        "description": "Lookback window for real-time metrics"
      },
      "include_velocity": {
        "type": "boolean",
        "default": true,
        "description": "Include rate-of-change calculations"
      },
      "limit": {
        "type": "integer",
        "default": 20,
        "description": "Number of items to return per category"
      }
    }
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "concurrent_visitors": {
        "type": "integer",
        "description": "Active visitors in the time window"
      },
      "top_trending": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "post_id": { "type": "integer" },
            "title": { "type": "string" },
            "current_visitors": { "type": "integer" },
            "velocity": { "type": "number", "description": "Rate of change" },
            "top_source": { "type": "string" }
          }
        }
      },
      "rising": {
        "type": "array",
        "description": "Content with positive velocity",
        "items": { "$ref": "#/output_schema/properties/top_trending/items" }
      },
      "falling": {
        "type": "array",
        "description": "Content with negative velocity",
        "items": { "$ref": "#/output_schema/properties/top_trending/items" }
      },
      "velocity_summary": {
        "type": "object",
        "properties": {
          "site_wide_change": { "type": "number" },
          "vs_same_time_yesterday": { "type": "number" },
          "vs_same_time_last_week": { "type": "number" }
        }
      },
      "traffic_sources_now": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "source": { "type": "string" },
            "visitors": { "type": "integer" },
            "percentage": { "type": "number" }
          }
        }
      }
    }
  }
}
```

**Why #2 Priority**:
- Chartbeat/Parse.ly's core competitive hook - "what's winning NOW"
- Creates urgency that drives action
- 1-minute cache already exists in `inc/api/namespace.php` - can reduce for real-time mode

**AI Agent Use Case**:
> "Your pricing page is getting 4x normal traffic right now - 340 concurrent visitors. 65% are from LinkedIn, likely from that post your CEO shared 20 minutes ago. Should I add a personalization rule to show LinkedIn visitors a case study relevant to their industry?"

**Closed-Loop Actions**:
- Triggers `create-personalization-rule` for hot traffic sources
- Enables `create-ab-test` suggestions based on trending content

---

### 3. `accelerate/get-traffic-attribution`

**Gap Addressed**: #6 (Attribution Comparison)
**Psychological Driver**: Justification
**Data Status**: ✅ Complete - `initial_referer`, `referer`, `initial_utm_*`, `utm_*` all tracked

```json
{
  "input_schema": {
    "type": "object",
    "properties": {
      "entity_type": { "enum": ["post", "block", "site"] },
      "entity_id": { "type": "integer" },
      "date_range": {
        "type": "object",
        "properties": {
          "start": { "type": "string", "format": "date" },
          "end": { "type": "string", "format": "date" }
        }
      },
      "models": {
        "type": "array",
        "items": { "enum": ["first_touch", "last_touch", "linear", "time_decay"] },
        "default": ["first_touch", "last_touch"]
      },
      "group_by": {
        "enum": ["source", "medium", "campaign", "channel"],
        "default": "source"
      }
    }
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "by_model": {
        "type": "object",
        "properties": {
          "first_touch": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "source": { "type": "string" },
                "conversions": { "type": "integer" },
                "conversion_rate": { "type": "number" },
                "percentage": { "type": "number" }
              }
            }
          },
          "last_touch": { "$ref": "#/output_schema/properties/by_model/properties/first_touch" }
        }
      },
      "delta_analysis": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "source": { "type": "string" },
            "first_touch_pct": { "type": "number" },
            "last_touch_pct": { "type": "number" },
            "delta": { "type": "number" },
            "interpretation": { "type": "string" }
          }
        }
      },
      "multi_touch_journeys": {
        "type": "object",
        "properties": {
          "avg_touchpoints": { "type": "number" },
          "common_paths": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "path": { "type": "array", "items": { "type": "string" } },
                "frequency": { "type": "integer" }
              }
            }
          }
        }
      }
    }
  }
}
```

**Why #3 Priority**:
- Both `initial_referer` and `referer` tracked but NEVER compared
- UTM arrays (`initial_utm_*` vs `utm_*`) exist but NEVER analyzed
- Answers "Is my ad spend working?" - critical for marketing stakeholder buy-in

**AI Agent Use Case**:
> "First-touch attribution credits Google Ads with 40% of conversions, but last-touch only shows 15%. This means your paid traffic warms up leads that convert later via direct visits. Your Google Ads are more valuable than last-touch reporting suggests. Should I create a lookalike audience segment for these multi-touch converters?"

**Closed-Loop Actions**:
- Enables `create-audience` for multi-touch visitor segments
- Informs `create-ab-test` by identifying which sources deserve optimization focus

---

### 4. `accelerate/get-engagement-depth`

**Gap Addressed**: #4 (Depth Metrics)
**Psychological Driver**: Quality Assessment
**Data Status**: ✅ Available - `endpoint_sessions`, `endpoint_views` exist

```json
{
  "input_schema": {
    "type": "object",
    "properties": {
      "entity_type": { "enum": ["post", "block", "author", "site"] },
      "entity_id": { "type": "integer" },
      "date_range": {
        "type": "object",
        "properties": {
          "start": { "type": "string", "format": "date" },
          "end": { "type": "string", "format": "date" }
        }
      }
    }
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "recirculation_rate": {
        "type": "number",
        "description": "Percentage of visitors viewing 2+ pages"
      },
      "pages_per_session": {
        "type": "number",
        "description": "Average pages viewed per session"
      },
      "bounce_rate": {
        "type": "number",
        "description": "Percentage of single-page sessions"
      },
      "avg_session_duration": {
        "type": "number",
        "description": "Average session length in seconds"
      },
      "engagement_score": {
        "type": "number",
        "description": "Composite 0-100 score"
      },
      "next_page_distribution": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "post_id": { "type": "integer" },
            "title": { "type": "string" },
            "percentage": { "type": "number" }
          }
        }
      },
      "comparison": {
        "type": "object",
        "properties": {
          "vs_site_average": { "type": "number" },
          "vs_category_average": { "type": "number" },
          "percentile": { "type": "number" }
        }
      }
    }
  }
}
```

**Why #4 Priority**:
- Separates "viral but shallow" from "engaging and sticky" content
- `endpoint_sessions` and `endpoint_views` exist - just needs aggregation
- Quality metrics beyond vanity numbers enable smarter recommendations

**AI Agent Use Case**:
> "This post has 50K views but only 3% recirculation - significantly below your site average of 18%. The content may be disappointing visitors. I analyzed the headline vs content: it promises a 'Complete Guide' but the content is relatively shallow. Should I draft an A/B test with a more honest headline that better matches the content depth?"

**Closed-Loop Actions**:
- Enables quality-aware `create-personalization-rule` decisions
- Provides context for headline vs content quality assessments

---

## Tier 2: High Impact / Strategic Value

### 5. `accelerate/get-taxonomy-performance`

**Gap Addressed**: #3 (Topic Intelligence)
**Psychological Driver**: Strategic Planning
**Data Status**: ⚠️ Partial - requires joining WP taxonomy with ClickHouse

```json
{
  "input_schema": {
    "type": "object",
    "properties": {
      "taxonomy": {
        "enum": ["category", "post_tag", "custom"],
        "default": "category"
      },
      "custom_taxonomy": {
        "type": "string",
        "description": "Custom taxonomy slug if taxonomy='custom'"
      },
      "date_range": {
        "type": "object",
        "properties": {
          "start": { "type": "string", "format": "date" },
          "end": { "type": "string", "format": "date" }
        }
      },
      "metrics": {
        "type": "array",
        "items": { "enum": ["views", "conversions", "engagement", "recirculation"] },
        "default": ["views", "conversions"]
      }
    }
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "by_term": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "term_id": { "type": "integer" },
            "name": { "type": "string" },
            "slug": { "type": "string" },
            "post_count": { "type": "integer", "description": "Supply" },
            "total_views": { "type": "integer", "description": "Demand" },
            "views_per_post": { "type": "number" },
            "conversion_rate": { "type": "number" },
            "demand_supply_ratio": { "type": "number" }
          }
        }
      },
      "gaps": {
        "type": "array",
        "description": "High demand, low supply topics",
        "items": {
          "type": "object",
          "properties": {
            "term": { "type": "string" },
            "demand_supply_ratio": { "type": "number" },
            "recommendation": { "type": "string" }
          }
        }
      },
      "opportunities": {
        "type": "array",
        "description": "High conversion, growth potential topics",
        "items": {
          "type": "object",
          "properties": {
            "term": { "type": "string" },
            "conversion_rate": { "type": "number" },
            "growth_potential": { "type": "string" }
          }
        }
      }
    }
  }
}
```

**Why Tier 2**:
- Answers "What should we write?" - high strategic value
- Requires WordPress taxonomy → ClickHouse join (medium complexity)
- Parse.ly's Topic Report is a signature feature

**AI Agent Use Case**:
> "Category 'Enterprise Security' has a 3.2x higher conversion rate than your site average, but only 5% of your content. That's a significant supply/demand gap. Meanwhile, 'General News' is 40% of content but converts 60% below average. Should I set up an A/B test on your existing Security content to optimize before you scale production?"

---

### 6. `accelerate/get-content-velocity`

**Gap Addressed**: #1 (subset)
**Psychological Driver**: Situational Awareness
**Data Status**: ✅ Available - diff calculation exists in `getDiffs()`

```json
{
  "input_schema": {
    "type": "object",
    "properties": {
      "entity_type": { "enum": ["post", "block"] },
      "entity_id": { "type": "integer" },
      "compare_periods": {
        "type": "array",
        "items": { "enum": ["1h", "6h", "24h", "7d", "30d"] },
        "default": ["24h", "7d"]
      }
    },
    "required": ["entity_type", "entity_id"]
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "current_velocity": {
        "type": "object",
        "properties": {
          "views_per_hour": { "type": "number" },
          "conversions_per_hour": { "type": "number" }
        }
      },
      "change_vs_periods": {
        "type": "object",
        "additionalProperties": {
          "type": "object",
          "properties": {
            "views_change_pct": { "type": "number" },
            "conversions_change_pct": { "type": "number" }
          }
        }
      },
      "trending_direction": { "enum": ["rising", "falling", "stable", "volatile"] },
      "anomaly_detected": { "type": "boolean" },
      "anomaly_details": {
        "type": "object",
        "properties": {
          "type": { "enum": ["spike", "drop", "sustained_change"] },
          "magnitude": { "type": "number" },
          "likely_cause": { "type": "string" }
        }
      }
    }
  }
}
```

**Why Tier 2**:
- Diff calculation already exists but not exposed as standalone ability
- Enables proactive monitoring without polling full dashboards
- Critical for alerting and autonomous agent actions

**AI Agent Use Case**:
> "Your homepage hero block is underperforming vs last week - engagement down 35%. You haven't tested this block in 90 days. Based on the velocity trend, this decline started 4 days ago. Should I draft a variant with a refreshed headline?"

---

## Tier 3: Medium Impact / Longer Term

### 7. `accelerate/get-session-paths`

**Gap Addressed**: #5 (Journey Analysis)
**Psychological Driver**: Discovery
**Data Status**: ⚠️ Requires sequential event queries

```json
{
  "input_schema": {
    "type": "object",
    "properties": {
      "starting_page": { "type": "integer", "description": "Post ID to start from" },
      "ending_page": { "type": "integer", "description": "Post ID to end at (conversion page)" },
      "path_depth": {
        "type": "integer",
        "minimum": 2,
        "maximum": 10,
        "default": 5
      },
      "date_range": {
        "type": "object",
        "properties": {
          "start": { "type": "string", "format": "date" },
          "end": { "type": "string", "format": "date" }
        }
      },
      "segment_id": {
        "type": "string",
        "description": "Filter to specific audience segment"
      }
    }
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "paths": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "sequence": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "post_id": { "type": "integer" },
                  "title": { "type": "string" }
                }
              }
            },
            "frequency": { "type": "integer" },
            "conversion_rate": { "type": "number" }
          }
        }
      },
      "drop_offs": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "from_page": { "type": "string" },
            "drop_off_rate": { "type": "number" },
            "visitors_lost": { "type": "integer" }
          }
        }
      },
      "opportunities": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "insight": { "type": "string" },
            "suggested_action": { "type": "string" }
          }
        }
      }
    }
  }
}
```

**Why Tier 3**:
- Adobe's deep moat - don't compete head-on with Flow Visualization
- Requires new sequential event queries (medium-high complexity)
- Useful for identifying personalization opportunities but complex to act on

---

### 8. `accelerate/get-audience-insights`

**Gap Addressed**: Enhances existing personalization
**Psychological Driver**: Prediction (partial)
**Data Status**: ✅ Available

```json
{
  "input_schema": {
    "type": "object",
    "properties": {
      "segment_id": { "type": "string", "description": "Audience segment ID" }
    },
    "required": ["segment_id"]
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "segment": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "rules": { "type": "object" }
        }
      },
      "size": {
        "type": "object",
        "properties": {
          "current": { "type": "integer" },
          "trend": { "enum": ["growing", "shrinking", "stable"] },
          "change_30d": { "type": "number" }
        }
      },
      "performance": {
        "type": "object",
        "properties": {
          "conversion_rate": { "type": "number" },
          "vs_site_average": { "type": "number" },
          "top_converting_content": { "type": "array" }
        }
      },
      "behavioral_patterns": {
        "type": "object",
        "properties": {
          "avg_pages_per_session": { "type": "number" },
          "preferred_content_types": { "type": "array" },
          "peak_activity_times": { "type": "array" }
        }
      },
      "overlap_analysis": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "segment_id": { "type": "string" },
            "segment_name": { "type": "string" },
            "overlap_percentage": { "type": "number" }
          }
        }
      }
    }
  }
}
```

**Why Tier 3**:
- Enhances existing `get-audience-segments` with actionable insights
- Bridges to personalization decisions
- Medium AI leverage compared to Tier 1-2 abilities

---

### 9. `accelerate/export-author-report`

**Gap Addressed**: #2 (extension)
**Psychological Driver**: Validation
**Data Status**: ✅ Available

```json
{
  "input_schema": {
    "type": "object",
    "properties": {
      "author_id": { "type": "integer" },
      "date_range": {
        "type": "object",
        "properties": {
          "start": { "type": "string", "format": "date" },
          "end": { "type": "string", "format": "date" }
        }
      },
      "format": { "enum": ["pdf", "csv", "html"] },
      "delivery": {
        "type": "object",
        "properties": {
          "method": { "enum": ["download", "email"] },
          "email": { "type": "string", "format": "email" }
        }
      }
    },
    "required": ["author_id"]
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "report_url": { "type": "string", "format": "uri" },
      "expires_at": { "type": "string", "format": "date-time" },
      "summary": {
        "type": "object",
        "properties": {
          "total_views": { "type": "integer" },
          "total_conversions": { "type": "integer" },
          "top_post": { "type": "string" }
        }
      }
    }
  }
}
```

**Why Tier 3**:
- Makes author data shareable/actionable outside the platform
- Drives adoption within content teams
- Lower AI leverage but high human value

---

## Tier 4: Strategic Investment / Future

### 10. `accelerate/predict-conversion-likelihood`

**Gap Addressed**: #7 (Predictive Intelligence)
**Psychological Driver**: Prediction
**Data Status**: ❌ Requires ML model

**Why Future**:
- Piano's moat - requires ML model, training data, significant investment
- Consider only after Tiers 1-3 prove value
- Would need: propensity scoring model, training pipeline, real-time scoring

---

### 11. `accelerate/get-scroll-depth`

**Gap Addressed**: #4 (subset)
**Psychological Driver**: Quality Assessment
**Data Status**: ⚠️ May need new client-side tracking

**Why Future**:
- Requires additional client-side tracking implementation
- Chartbeat's HUD overlay feature - significant UI investment
- Consider as part of broader "engagement depth" initiative

---

## Implementation Priority Matrix

| Ability | Effort | Data Ready | AI Leverage | Competitive Parity | Priority Score |
|---------|--------|------------|-------------|-------------------|----------------|
| `get-author-performance` | Low | ✅ | Very High | Parse.ly | **10/10** |
| `get-realtime-pulse` | Medium | ✅ | Very High | Chartbeat | **9/10** |
| `get-traffic-attribution` | Low | ✅ | High | Adobe | **9/10** |
| `get-engagement-depth` | Medium | ✅ | High | Chartbeat | **8/10** |
| `get-taxonomy-performance` | Medium | ⚠️ | High | Parse.ly | **7/10** |
| `get-content-velocity` | Low | ✅ | High | Chartbeat | **7/10** |
| `get-session-paths` | High | ⚠️ | Medium | Adobe | **5/10** |
| `get-audience-insights` | Medium | ✅ | Medium | Piano | **6/10** |
| `export-author-report` | Low | ✅ | Low | Parse.ly | **5/10** |

---

## Recommended Build Phases

### Phase 1: Validation & Awareness (Weeks 1-2)

**Goal**: Create personal attachment and real-time urgency

| Ability | Est. Effort | Key Dependencies |
|---------|-------------|------------------|
| `get-author-performance` | 3-4 days | Author ID → ClickHouse aggregation |
| `get-realtime-pulse` | 4-5 days | Time-windowed queries, cache reduction |

**Success Metrics**:
- Author filter adoption > 15% of sessions
- Dashboard return rate +20%

---

### Phase 2: Attribution & Quality (Weeks 3-4)

**Goal**: Add depth beyond vanity metrics

| Ability | Est. Effort | Key Dependencies |
|---------|-------------|------------------|
| `get-traffic-attribution` | 3-4 days | First/last touch comparison logic |
| `get-engagement-depth` | 4-5 days | Recirculation calculation, session aggregation |

**Success Metrics**:
- Attribution insights drive audience creation
- Quality metrics influence A/B test decisions

---

### Phase 3: Velocity & Paths (Weeks 5-6)

**Goal**: Trend detection and journey analysis

| Ability | Est. Effort | Key Dependencies |
|---------|-------------|------------------|
| `get-content-velocity` | 2-3 days | Expose existing diff calculations |
| `get-session-paths` | 5-7 days | Sequential event queries |

**Success Metrics**:
- Velocity alerts used > 20% of sessions
- Path analysis queries increasing

---

### Phase 4: Strategic Expansion (Weeks 7-8)

**Goal**: Answer "what should we write?"

| Ability | Est. Effort | Key Dependencies |
|---------|-------------|------------------|
| `get-taxonomy-performance` | 5-6 days | WP taxonomy → ClickHouse join |
| `get-audience-insights` | 3-4 days | Extend existing audience data |

**Success Metrics**:
- Content strategy decisions informed by data
- Personalization rule creation +30%

---

## Infrastructure: Tiered Caching Strategy

Real-time abilities like `get-realtime-pulse` and `get-content-velocity` require sub-hour data freshness. The current 1-minute cache works for daily dashboards but creates stale data for "what's happening NOW" queries.

### Current Cache Architecture

| Query Type | Current TTL | File Reference |
|------------|-------------|----------------|
| `get_graph_data()` | 1 min | `api/namespace.php:389` |
| `get_top_data()` | 1 min | `api/namespace.php:648` |
| `get_block_stats()` | 5 min | `api/namespace.php:981` |
| Audience estimates | 1 hour | `audiences/namespace.php:549` |
| Audience field data | 1 hour | `audiences/namespace.php:737` |

### The Problem

Reducing cache globally has significant trickle-down impact:

```
Current (1 min cache):
  10 users × 1 refresh/min = 10 queries/min → 1 actual ClickHouse query

Reduced to 10 sec:
  10 users × 1 refresh/min = 10 queries/min → ~6 actual queries (6x increase)

No cache:
  10 users × 1 refresh/min = 10 actual queries (10x increase)
```

**Impact Areas**:
- **ClickHouse load**: Cloud service at `eu.db.accelerate.altis.cloud` is likely metered
- **Response latency**: Cache miss = ~200-500ms vs ~5-20ms for cache hit
- **WordPress server**: Each query = blocking HTTP request with 20s timeout
- **Concurrent users**: N users on same dashboard = N identical queries without cache

### Solution: Context-Aware Tiered Caching

Rather than globally reducing cache, implement **time-range-aware caching** where recent data has shorter TTL (it's changing) and historical data has longer TTL (it's not):

```php
/**
 * Get appropriate cache TTL based on query time range.
 *
 * Recent data changes frequently, historical data doesn't.
 * This enables near-real-time queries without hammering ClickHouse
 * for historical lookups.
 *
 * @param int $start Start timestamp.
 * @param int $end   End timestamp.
 * @return int Cache TTL in seconds.
 */
function get_cache_ttl_for_range( int $start, int $end ) : int {
    $range_seconds = $end - $start;

    // Last hour: 10 second cache (near real-time)
    if ( $range_seconds <= HOUR_IN_SECONDS ) {
        return 10;
    }

    // Last 24 hours: 30 second cache
    if ( $range_seconds <= DAY_IN_SECONDS ) {
        return 30;
    }

    // Last 7 days: 1 minute cache (current default)
    if ( $range_seconds <= WEEK_IN_SECONDS ) {
        return MINUTE_IN_SECONDS;
    }

    // Older data: 5 minute cache (it's stable)
    return MINUTE_IN_SECONDS * 5;
}
```

### Implementation in Abilities

Update `parse_date_range()` in `inc/abilities/namespace.php` to return TTL:

```php
/**
 * Parse date range from input, with defaults and cache TTL.
 *
 * @param array $input        Input containing optional date_range.
 * @param int   $default_days Default number of days if not specified.
 * @return array Array with 'start', 'end' timestamps and 'cache_ttl'.
 */
function parse_date_range( array $input, int $default_days = 7 ) : array {
    $end = isset( $input['date_range']['end'] )
        ? strtotime( $input['date_range']['end'] )
        : time();

    $start = isset( $input['date_range']['start'] )
        ? strtotime( $input['date_range']['start'] )
        : strtotime( "-{$default_days} days", $end );

    return [
        'start'     => $start,
        'end'       => $end,
        'cache_ttl' => get_cache_ttl_for_range( $start, $end ),
    ];
}
```

### Tiered Caching Matrix

| Time Range | Cache TTL | Use Case | Query Cost |
|------------|-----------|----------|------------|
| ≤ 1 hour | 10 sec | Real-time pulse, concurrent visitors | Higher |
| ≤ 24 hours | 30 sec | Today's trending, velocity | Medium |
| ≤ 7 days | 1 min | Weekly dashboard (current default) | Low |
| > 7 days | 5 min | Historical analysis, month-over-month | Lowest |

### Optional: Explicit Real-Time Mode

For abilities that specifically need real-time data, add an opt-in flag:

```json
{
  "input_schema": {
    "properties": {
      "realtime": {
        "type": "boolean",
        "default": false,
        "description": "Bypass cache for fresh data (higher latency)"
      }
    }
  }
}
```

```php
// In ability execution
function execute_get_realtime_pulse( array $input ) {
    $realtime = $input['realtime'] ?? false;

    if ( $realtime ) {
        // Bypass cache entirely, use lightweight query
        return execute_realtime_query_no_cache( $input );
    }

    // Use tiered caching based on time window
    $dates = parse_date_range( $input, 0.0417 ); // ~1 hour default
    // ... rest of execution with $dates['cache_ttl']
}
```

### Cost/Benefit Summary

| Approach | Query Volume Impact | Latency | Implementation |
|----------|---------------------|---------|----------------|
| Global reduction to 10s | 6x increase | Worse | Simple |
| **Tiered by time range** | 2-3x increase | Balanced | Medium |
| Opt-in realtime flag | Minimal increase | User-controlled | Medium |
| Separate realtime endpoint | Isolated | Fast (optimized) | Complex |

**Recommendation**: Implement **tiered caching** first (low risk, immediate benefit for real-time abilities), then add **opt-in realtime flag** for `get-realtime-pulse` specifically.

---

## The Key Insight

From the Gap Analysis:

> **"Most gaps are UI gaps, not data gaps."**

For the Abilities API, this means:

1. **Abilities 1-6 should be fast to build** - the data queries already exist or are simple aggregations
2. **The real leverage is in the AI reasoning layer** - client-side AI agents synthesize these primitives into recommendations (see `abilities-client-side.md`)
3. **Closed-loop is everything** - Discovery abilities that don't lead to Execution abilities are incomplete

The psychological driver sequence:

```
Validation (Author) → Situational Awareness (Real-time) → Quality Assessment (Depth) → Strategic Planning (Taxonomy)
```

This mirrors exactly how competitors create user attachment. Build in this order.

---

## Appendix: Data Column Reference

| Ability | Primary ClickHouse Columns |
|---------|---------------------------|
| `get-author-performance` | `attributes['authorId']`, `attributes['blockAuthor']` |
| `get-realtime-pulse` | `event_timestamp`, `endpoint_id`, `attributes['referer']` |
| `get-traffic-attribution` | `initial_referer`, `referer`, `initial_utm_*`, `utm_*` |
| `get-engagement-depth` | `endpoint_sessions`, `endpoint_views` |
| `get-taxonomy-performance` | Requires WP `term_relationships` join |
| `get-content-velocity` | Time-series aggregation on existing metrics |
| `get-session-paths` | Sequential `event_timestamp` queries |
| `get-audience-insights` | Existing audience segment data + aggregations |

---

## Related Documents

### Internal
- `abilities-api.md` - Core Abilities API architecture and vision
- `abilities-client-side.md` - AI agent configuration (Claude/GPT system prompts, routing rules, orchestration)
- `GAP-ANALYSIS.md` - Competitive analysis identifying these gaps
- `analytics.md` - Technical documentation of analytics system
- `experiments.md` - A/B testing system documentation

### External (WordPress)
- [Abilities API REST Endpoints](https://developer.wordpress.org/apis/abilities-api/rest-api-endpoints/) - Official REST endpoint documentation
- [Introducing the WordPress Abilities API](https://developer.wordpress.org/news/2025/11/introducing-the-wordpress-abilities-api/) - WordPress Developer Blog announcement
- [WordPress MCP Adapter](https://github.com/WordPress/mcp-adapter) - MCP protocol bridge for abilities
