# Mayra & Samuel — Oliva (local)

## Envelope video

The uploaded `Quiero_un_video_de_segundos.mp4` now lives at
`_local_storage/invitations/bodmys/cover/fondo-sobre-loop.mp4` (720 × 1280, about
10 seconds). This is event media, not a template asset. To apply only this change
to an existing local event, after placing the file:

```sh
node seeds/invitation_projects/bodmys/configure-envelope-video.js
```

The migration verifies the local host, event identity and media file, backs up
the previous JSON and only adds `envelop_intro.config.backgroundVideoSrc`.
Existing portrait/desktop images, copy, order and other modules are preserved.
It is safe to repeat. Clear `backgroundVideoSrc` in the saved config to return
to image-only mode; all three frontend templates support both media types.

## Initial seed

Run from the backend root:

```sh
node seeds/invitation_projects/bodmys/seed.js
```

The seed uses the existing `.env`, refuses non-loopback database hosts and does not change schema. It checks that `bodmys` belongs to Mayra & Samuel before updating anything. It creates/reuses venues with NULL coordinates, assigns type Boda/Matrimonio, and loads `modules.json` into `evento_invitacion_publica`. It also enables datos_evento, invitados and invitaciones in the client workspace.

It creates `mysprueba` with two explicitly named test guests. Re-running preserves their responses and avoids duplicate events, places, invitations and guests. Do not treat these two people as real invitees. Each run reapplies the event dates and complete module configuration from this directory; review changes to `modules.json` before re-running after editing through the API.

- Ceremony: 2026-11-28 15:00 America/Bogota.
- Reception: 2026-11-28 16:30 America/Bogota.
- Exclusive deadline: 2026-11-19 00:00 America/Bogota (last permitted day: November 18).
- Template: `wedding_oliva`.
- Link printed by seed: `http://localhost:3002/invitacion/mysprueba/{principalId}`.
- Share image served by the frontend: `/invitations/oliva/mayra-samuel-cover.png`.
- Music and photos intentionally disabled until real resources arrive.

The seed sets the MySQL session timezone to -05:00 for TIMESTAMP writes. The backend connection uses the same session timezone and mysql2 decoder setting when reading.

No schema migrations, deployment or message sending are part of this seed. `published` is initially false; the current public reader does not enforce that flag. Only run in local development.

Tests (backend must run on localhost:3022):

```sh
node --test tests/invitation-attendance.test.js
RUN_ALTEZZA_INTEGRATION=1 node --test tests/invitation-public.integration.test.js
```

The integration test creates separate temporary local fixtures and removes them in its cleanup block.

## Align an existing local invitation without reseeding

```sh
node seeds/invitation_projects/bodmys/align-data.js
node --test tests/invitation-contracts.test.js
```

This repeatable, local-only data migration updates only `bodmys.modulesJson`
and its update timestamp. It backs up the original JSON in a temporary directory
and preserves envelope configuration, all event dates, places, guests and responses.
It moves the introduction to `welcome_message`, the ceremony phrase to
`event_details`, the RSVP phrase to `helperText`, and creates `closing_message`.
Names in the hero come from the event; full names remain in the frontend's content
brief. `modules.json` already uses the aligned configuration for fresh seeds.

The public backend now resolves place-coordinate links and existing module-link
fallbacks before returning the invitation, regardless of template. Restart the
backend after deploying this code change; no database schema change is required.

## Store this invitation's editorial copy

```sh
node seeds/invitation_projects/bodmys/configure-copy.js
```

Adds only missing `title` fields for family/locations and countdown messages from
this event's `modules.json`. Existing custom or empty values are preserved. The
script is local-only, checks ownership, backs up JSON, and updates no other event.
Runtime module defaults now leave editorial copy empty instead of injecting
wedding text for customers who did not configure it.

## Use only the invitation phrase

```sh
node seeds/invitation_projects/bodmys/replace-welcome-with-quote.js
```

Replaces this event's `welcome_message` with `biblical_quote` in the same slot,
copying its saved `subtitle` exactly into `passageText`. `passageReference` is
explicitly empty, so the existing shared view omits the reference. The welcome
title and recipient line are no longer part of this card. Fresh seeds use the
same configuration. For older configurations, run this after `align-data.js`.

Local-only, repeatable and transactional, with an ownership check and a JSON
backup. It refuses duplicate/conflicting modules or a missing phrase. It only
updates `bodmys.modulesJson` and its timestamp; other cards and RSVP data remain
unchanged. The shared quote resolver/view require no changes.

## Configure the embossed floral hero

```sh
node seeds/invitation_projects/bodmys/configure-hero.js
```

Updates only this hero's `backgroundImage` and `logoImage`, preserving its copy,
order, enabled state, envelope and all other modules. Local-only, with an ownership
check and JSON backup. The generated event PNG, storage path and generation prompt
are documented in [HERO-ASSETS.md](HERO-ASSETS.md). The image must exist in the
invitation asset storage when using this configuration in another environment.
