# HubSpot Integration

Captures three high-value HubSpot visitor signals as Accelerate analytics
events and durable endpoint attributes, making each one a targetable audience
criterion for personalization:

| Signal | When it fires | Event | Audience field |
|---|---|---|---|
| Form submission | A HubSpot form embed completes submission | `formSubmission` | HubSpot forms submitted |
| Email arrival | The visitor lands from a HubSpot marketing email (`_hsmi` URL param) | `emailArrival` | HubSpot email arrivals |
| Chat engagement | The visitor sends their first message in the chat widget | `chatInteraction` | HubSpot chat engagement |

Only the *fact* of the interaction and the identity of the asset (which form,
which email) are captured. Form field values, chat message content, and the
recipient-identifying `_hsenc` parameter are never read or stored.

## Enabling

The integration is **off by default**. Enable it under **Accelerate →
Settings → HubSpot**. When disabled, no script, configuration, or scheduled
task exists at all.

## Private app access token (optional)

HubSpot's client-side events identify assets by ID (form GUID, email send
ID). Without further configuration, signals are captured with those raw IDs
as audience values. To resolve them to human-readable names ("P&ED RFI"
instead of a GUID), add a HubSpot **private app access token**:

1. In HubSpot: **Settings → Integrations → Private Apps → Create private
   app**.
2. Grant two read-only scopes: **Forms** and **Marketing Email**.
3. Paste the token into Accelerate → Settings → HubSpot and choose
   **Save & validate**.

Accelerate then syncs ID → name directories daily (and immediately on token
save; a **Sync now** button is available). The token is only ever used
server-side and is never sent to visitors' browsers.

**Configure the token up front when possible:** attribute values are written
at capture time and do not retro-rename once a directory appears. Signals
captured before the first sync keep their raw IDs.

## Audience examples

- **Submitted a specific form**: *HubSpot forms submitted* `is` "P&ED RFI" —
  e.g. swap the RFI promo block for "what happens next" content after
  submission. The endpoint attribute updates in-page, so personalization can
  react on the same page view.
- **Arrived from a nurture email**: *HubSpot email arrivals* `is`
  "Certificate nurture #3" — continue the email's thread on-page.
- **Engaged chat but never submitted a form**: *HubSpot chat engagement*
  `is` "started" combined with a *HubSpot forms submitted* exclusion — a
  prime retargeting segment.

## Per-signal control

All three signals are captured when the integration is enabled. To disable
individual signals programmatically:

```php
add_filter( 'altis.accelerate.hubspot.signals', function ( array $signals ) : array {
    $signals['chat'] = false;
    return $signals;
} );
```

## Consent and privacy

- Signal listeners only register after the visitor's analytics consent is
  granted (the same gate as page view tracking), and nothing records in
  preview/no-op mode.
- `_hsenc` (recipient-identifying) is never read beyond existence or stored.
- No form field values, no chat message content, no conversation IDs.

## Supported HubSpot assets

- **Forms**: both embed generations — the legacy v2 embed
  (`js.hsforms.net/forms/embed/v2.js`, including leadin plugin forms and
  popups) and the modern portal embed (`embed/{portalId}.js`) — emit the same
  submission callback, and both are supported.
- **Chat**: any chatflow using the standard HubSpot Conversations widget. The
  widget may load lazily; registration is deferred via HubSpot's
  `hsConversationsOnReady` contract.
- **Email**: any HubSpot marketing email with tracked links (`_hsmi`
  present).
