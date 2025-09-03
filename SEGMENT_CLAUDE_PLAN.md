Segment Analytics Coverage Plan (Claude-Focused)

Purpose
- Deliver comprehensive product analytics coverage with pragmatic, high-impact event instrumentation centered on user behavior, activation, and feature adoption.

Guiding Principles
- Track actions that explain value realization (what users do, not just where they click).
- Keep events consistent and lightweight; attach clear context (who, where, what).
- Prioritize the highest-traffic, decision-driving surfaces first.

Phase Overview
- Sprint 2: Block Portal interactions (highest engagement) + core error events
- Sprint 3: Block Editor lifecycle (creation/configuration) + validation errors
- Sprint 4: Activation and onboarding milestones + performance telemetry
- Sprint 5: Advanced feature usage + journey optimization

Event Model (lightweight)
- Event name: "<Module> <Action>" (e.g., "Block Portal Variant Switch", "Content Explorer Period Change").
- Required properties: `module`, `action`, `site_id`, `environment`, `plugin_version`.
- Contextual properties per event (examples below).

Sprint 2 — Block Portal (High Impact) + Core Errors
- Why: The portal is where users interpret value; understanding interactions informs product direction.
- Events:
  - Block Portal Period Change
    - Properties: `from_period`, `to_period`, `block_id`, `block_type`, `test_status`.
  - Block Portal Variant Switch
    - Properties: `block_id`, `variant_index`, `total_variants`, `block_type`.
  - Block Portal Goal Change
    - Properties: `from_goal`, `to_goal`, `block_id`.
  - Experiments Start/Pause/Cancel (align existing to schema)
    - Properties: `test_id`, `test_type` (e.g., `block`), `paused` (for pause/resume).
- Errors:
  - Analytics Load Failed
    - Properties: `error_type` (e.g., `api_timeout`), `message`, `retry_count`.
  - Portal API Error
    - Properties: `endpoint`, `status`, `error_type`, `attempts`.
- Done When:
  - All listed events implemented with schema-compliant payloads and error events captured on failures.

Sprint 3 — Block Editor Lifecycle + Validation Errors
- Why: Reveals how blocks are created, configured, and maintained; highlights UX issues.
- Events:
  - Block Inserted / Removed / Duplicated
    - Properties: `block_type`, `parent_context` (template/pattern), `source` (toolbar, / command, pattern).
  - Block Type Switched (standard ↔ abtest ↔ personalization)
    - Properties: `from_type`, `to_type`, `block_id`.
  - Block Configuration Changed
    - Properties: `block_id`, `setting_key`, `change_type` (toggle/select/input), `previous_value_hash`, `new_value_hash`.
  - Audience Assigned to Block
    - Properties: `block_id`, `audience_id`, `audience_name` (optional), `rule_count`.
- Errors:
  - Block Validation Error on Save
    - Properties: `block_type`, `field`, `error_code`.
- Done When:
  - Lifecycle events implemented; validation errors instrumented; noise controlled (sampled if needed).

Sprint 4 — Activation/Onboarding + Performance
- Why: Activation correlates with retention; onboarding gaps and performance issues block success.
- Events:
  - Onboarding Step Completed / Skipped
    - Properties: `step_id`, `step_name`, `duration_ms`, `skipped`.
  - First Milestones (one-time via server helper)
    - Events: `First Audience Created`, `First Experiment Started`, `First Broadcast Sent`.
    - Properties: `time_to_milestone_ms`, `context_feature`.
  - Content Explorer Period Change / Filter / Search (align to schema)
- Performance:
  - View Load Time (Sampled)
    - Properties: `view`, `ttfb_ms`, `dom_ready_ms`, `interactive_ms`.
  - API Latency Bucket (Sampled)
    - Properties: `endpoint`, `bucket` (e.g., `0-200`, `200-500`, `500-1000`, `1000+`).
- Done When:
  - Onboarding funnel events present; one-time milestones recorded; basic perf signals captured without PII.

Sprint 5 — Advanced Features + Journey Optimization
- Why: Understand deep usage to drive roadmap; map paths that lead to successful outcomes.
- Events:
  - Personalization Setup Started / Completed
    - Properties: `rules_count`, `segments_used`, `duration_ms`.
  - Audience Rules Edited Session
    - Properties: `rules_before`, `rules_after`, `duration_ms` (use counts not raw rules for privacy).
  - Broadcast Pattern Usage
    - Properties: `pattern_id`, `blocks_count`, `modified`.
- Journey Signals:
  - Cross-Feature Navigation
    - Properties: `from_view`, `to_view`, `path_id` (session-unique id).
- Done When:
  - Advanced feature usage and cross-feature navigation events are in place and schema-compliant.

Quality & Review
- Consistency: All events follow the standardized schema and attach shared context.
- Minimal PII: Avoid raw PII in properties; rely on userId traits when opted-in.
- Sampling: Apply conservative sampling for performance metrics to cap volume.

Testing
- Unit/UI tests for event firing on core paths.
- JSON Schema validation for representative payloads.
- Dev-mode console logger for quick inspection during QA.

Rollout
- Feature-flag new events; ramp up gradually.
- Monitor event volumes and error rates in Segment dashboard.

