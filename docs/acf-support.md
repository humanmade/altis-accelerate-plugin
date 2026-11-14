# ACF Support

**ACF and ACF Pro Blocks are supported in Accelerate Blocks.**

Accelerate treats ACF blocks like any other core block: it round-trips their markup through WordPress's own `parse_blocks()` / `serialize_blocks()` and never mutates ACF's block-comment data. This document covers exactly what's supported, what isn't, and the constraints developers building custom ACF blocks need to know.

---

## Supported versions

| Requirement | Minimum |
|---|---|
| ACF / ACF Pro | **6.8.5+** (recommended floor) |
| WordPress | Accelerate's own floor, **6.7+ required for ACF Block Bindings** |
| ACF Blocks V3 | ACF Pro 6.6+ |
| ACF Block Bindings | ACF Pro 6.8.1+ |

Older ACF/ACF Pro versions may work but aren't tested or supported.

## Supported surfaces

ACF Blocks work inside:

- Standard Global Blocks (synced patterns)
- `altis/variant` (A/B test variants)
- Personalization fallback and audience variants
- Broadcast content

Accelerate stores and round-trips content as standard block markup via core's `parse_blocks()` / `serialize_blocks()`. ACF block comment data — the `data` attribute (including underscore-prefixed field-key entries), `mode`, `align`, `anchor`, `className`, and InnerBlocks — is preserved without mutation. The only change you'll ever see is core's own JSON escaping (e.g. `&` becomes `\u0026` in the serialized comment), which is cosmetic and doesn't affect parsed attributes.

Winner collapse (promoting a variant to the standard block) and downgrading an experiment back to a standard block both preserve ACF content as-is.

## ACF Blocks with InnerBlocks

Supported. ACF blocks that accept InnerBlocks are serialized exactly like any other block with nested content — no special handling required.

## ACF Pro complex fields

Repeater, Flexible Content, Gallery, Clone, Relationship, and Post Object fields are supported for render and round-trip: their values live inside the block's `data` attribute and pass through untouched.

Field-aware editing (reading or writing individual field values) must go through ACF's own APIs — the ACF REST API or PHP API. Accelerate's abilities preserve raw block markup but are **not field-aware**; do not hand-edit the block-comment JSON to change complex field values.

## ACF Block Bindings

`metadata.bindings` (with source `acf/field`) is preserved through variant create, update, save, and winner-collapse.

> [!IMPORTANT]
> Bound values resolve against the post being **viewed**, not against the `wp_block` post that contains the bound block. The same Global Block can show different bound values on different posts it's inserted into.

This follows ACF's own constraints on Block Bindings — simple field types only.

## `usePostMeta` blocks — not supported

ACF documents `usePostMeta` blocks as top-level-only, once-per-page, and unsupported inside reusable blocks/synced patterns.

Since Accelerate Global Blocks **are** synced patterns, these constraints can't be satisfied inside Accelerate-managed content. Accelerate's agent/ability content operations reject content containing `usePostMeta` blocks anywhere in the block tree, returning a `WP_Error` with code:

```
altis.accelerate.acf.unsupported_post_meta_block
```

`usePostMeta` blocks are unsupported in Accelerate-managed content. This is the one documented case where ACF content may be rejected rather than passed through.

## ACF field groups on `wp_block` posts

Read and write field groups attached to a `wp_block` post through ACF's own REST integration — enable `show_in_rest` on the field group and use the standard `/wp/v2/blocks/<id>` endpoint (`acf` key in the response).

Accelerate doesn't wrap or duplicate this integration.

## Frontend lifecycle for custom ACF block JS

Server-rendered ACF block markup survives Accelerate's variant insertion — Accelerate clones the relevant `<template>` content into the DOM rather than re-rendering.

If your ACF block ships custom frontend JS that needs to (re)initialize after content changes, listen for the `altisBlockContentChanged` `CustomEvent` on `window`. It's dispatched after A/B test, personalization, and broadcast content insertion, with `detail.target` set to the custom element that changed. Previews dispatch the same event with `detail.preview = true`.

Standard (non-experiment) Global Blocks are server-rendered in place and do **not** dispatch this event — no re-init is needed for them.

```js
window.addEventListener( 'altisBlockContentChanged', ( event ) => {
	const block = event.detail.target.querySelector( '.my-acf-block' );
	if ( block ) {
		initMyAcfBlock( block );
	}
} );
```

## Integration status for developers

PHP helpers live under `Altis\Accelerate\Integrations\ACF`:

- `is_active()`
- `is_pro()`
- `supports_blocks()`
- `get_version()`
- `meets_recommended_version()`
- `get_status()`

All of these no-op safely (returning `false`/`null` as appropriate) when ACF isn't installed.

The same status is exposed to the editor on the `acf` key of the `altisReusableBlocksSettings` localized settings object.

## Out of scope

- Bundling ACF or ACF Pro with Accelerate
- The standalone Gutenberg (block-only) plugin
- Anything ACF itself documents as unsupported (e.g. `usePostMeta` in synced patterns)
- Editing complex field values via block-comment string manipulation — use ACF's own APIs
