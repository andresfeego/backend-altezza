# Mayra & Samuel — Oliva (local)

## Social sharing image

`/invitations/oliva/mayra-samuel-hero-share-v1.jpg` is a 1200 × 630 JPEG
screenshot of the actual Oliva hero: botanical relief, MS monogram, “Nos casamos”
and the event date. The image lives in the frontend's `public/invitations/oliva/`
directory and is served without authentication. The versioned filename gives the
updated artwork its own URL. The old cover remains available for existing links.

To update an existing local event without reseeding its modules:

```sh
node seeds/invitation_projects/bodmys/configure-share-image.js
```

The script backs up the previous configuration and changes only `seoImage` and
its update timestamp. It verifies the event, preserves the remaining fields and
does nothing on repeat runs. The initial seed uses the same image path. The
existing frontend emits that URL in server-rendered `og:image` and `twitter:image`
tags, with the matching JPEG type and 1200 × 630 dimensions. Deploy the frontend
asset along with the event's SEO configuration when publishing this update.

The screenshot was taken with Playwright after the envelope opened and fonts and
hero images loaded. Only the capture browser used a landscape hero frame
(1200 × 630, 40 px vertical padding and 24 px gaps); invitation CSS is unchanged.
The screenshot disables animation and excludes the envelope, controls and other
modules. No image generation or replacement artwork was used.

## Music

`music_player` uses the 160 kb/s derivative
`ELENA ROSE & Rawayana - Luna de Miel - ELENA ROSE-web-v1.mp3` from
`_local_storage/invitations/bodmys/audio/`. The uploaded file without `-web-v1`
remains intact. The URL encodes spaces and the
ampersand and stays on the invitation's origin. The Oliva envelope starts the song
with sound when opened; the floating music control toggles mute. Playback loops.

```sh
node seeds/invitation_projects/bodmys/configure-music.js
```

This local-only update enables the existing module and sets its audio and track
label, preserving all other modules and playback settings. It backs up the saved
JSON and refuses to replace a different song. The preview gateway allows this file.

## Photo keepsake and closing message

`instant_photos` follows RSVP and holds the two original photos, the MS wax seal,
optional `message` and optional `reliefImageSrc`. Oliva uses the hero's botanical
mask with its own beige paper tone, scoped to the complete photo/message section.

After the photo module exists, run:

```sh
node seeds/invitation_projects/bodmys/merge-closing-into-photos.js
```

This local-only transactional migration copies the saved closing text verbatim
into the photos, copies the hero's relief image path and disables `closing_message`
without discarding its configuration. It preserves ordering, photos, seal and
all unrelated modules; it backs up the previous JSON and does not overwrite later
edits on repeat runs. Fresh seeds already contain the merged configuration.

## Envelope video

The uploaded `Quiero_un_video_de_segundos.mp4` now lives at
`_local_storage/invitations/bodmys/cover/fondo-sobre-loop.mp4` (720 × 1280, about
20 seconds). The active derivative is `fondo-sobre-loop-web-v1.mp4`, H.264 CRF 24,
same dimensions and duration, without the unused sound track. The original is
retained. This is event media, not a template asset. To apply the original setup
to an existing local event, after placing the file:

```sh
node seeds/invitation_projects/bodmys/configure-envelope-video.js
```

The migration verifies the local host, event identity and media file, backs up
the previous JSON and only adds `envelop_intro.config.backgroundVideoSrc`.
Existing portrait/desktop images, copy, order and other modules are preserved.
It is safe to repeat. Clear `backgroundVideoSrc` in the saved config to return
to image-only mode; all three frontend templates support both media types.

## Media optimization — September 22, 2026

The local event and seed now reference versioned derivatives from
[`media-optimized.json`](media-optimized.json). Its 21 entries contain original
and derivative paths, byte counts, SHA-256 hashes and profiles. Total inventory:
52,720,686 → 13,258,148 bytes (74.85% less); images 32,348,684 → 4,181,985,
video 11,738,608 → 4,758,519, music 8,633,394 → 4,317,644. This includes both
responsive backgrounds, so it is an inventory total, not page transfer size.

`optimize-media.js` prepares derivatives with Sharp and FFmpeg before changing
configuration. It backs up every source before the first conversion, verifies
the copies by hash, and never overwrites originals or existing derivatives.
Small JPEG/WebP files already optimized stay unchanged. Photo/illustration WebP
uses quality 90 with alpha quality 100; masks and monogram use lossless WebP.
The 6000 × 4000 couple photo becomes 1600 × 1067; remaining image dimensions
are preserved. All transformed alpha channels were checked pixel for pixel.
Video uses libx264 slow/CRF 24/yuv420p/faststart, retaining 720 × 1280 and 24 fps;
music uses libmp3lame at 160 kb/s and retains the complete song. The video and
audio derivatives passed a full FFmpeg decode check.

```sh
# Requires FFmpeg (or an absolute FFMPEG_BIN) and the existing Sharp dependency.
FFMPEG_BIN=/path/to/ffmpeg node seeds/invitation_projects/bodmys/optimize-media.js --prepare
node seeds/invitation_projects/bodmys/optimize-media.js --apply
node --test tests/bodmys-media-optimization.test.js
```

With the manifest already present, `--prepare` verifies its originals and
derivatives instead of recompressing. `--apply` verifies every file, targets only
the local Mayra/Samuel event and transactionally replaces matching media URLs in
`modulesJson`, preserving copy, order, dates, guests and answers. It also updates
the seed URLs; rerunning is a no-op for the event. It does not replay older
configuration migrations or reset the whole event.

Local backups, outside the public invitations directory:

- `_local_storage/_backups/bodmys-media-20260922-axage0/`: every source, original
  seed, hashes and derivative manifest. `storage/` and `frontend/` retain paths.
- `_local_storage/_backups/bodmys-media-config-5O9yNA/event-before.json`: event
  configuration immediately before applying the optimized URLs.

Original paths remain available for rollback; restoring their URLs is sufficient
to use them again. Do not overwrite a newer event configuration with the backup
without checking later edits. For another environment, copy the storage originals
and derivatives listed in the manifest, deploy the four new frontend assets, and
apply the reviewed URL changes there through its normal deployment process.
Storage and backups are intentionally ignored by Git; pushing code alone does
not upload them. The local Oliva gateway explicitly permits the new derivative
paths. The frontend must be rebuilt before verifying the optimized preview.

Manual checks: open with empty cache, delay the envelope/video/dress palette/music
separately, confirm the loading layer remains until prepared, simulate a failed
download and retry, then inspect the full invitation in Chrome/WebKit and via the
tunnel. No RSVP submission is needed for these checks.

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
- Share image served by the frontend: `/invitations/oliva/mayra-samuel-hero-share-v1.jpg`.
- Music is enabled; the photo slider remains disabled. The approved couple photo uses `simple_image` between the hero and invitation phrase.

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

## Approved couple photo between the hero and phrase

```sh
node seeds/invitation_projects/bodmys/configure-couple-photo.js
```

Adds `simple_image` after `hero_image_1` and before `biblical_quote`, with `imageSrc` and `alt`
stored in this event's module configuration. Remaining modules keep their relative
order and data. Local-only and transactional, with an event identity check, media
existence check and JSON backup; running it again does not duplicate the image.
Conflicting image modules or an invalid/missing hero or quote are rejected.

Event media under `_local_storage/invitations/bodmys/photos/`:

- Original: `DSC_0044 - copia.JPG` (untouched).
- Approved background-blur master: `mayra-samuel-fondo-desenfocado.png`.
- Preserved full-resolution asset: `mayra-samuel-fondo-desenfocado.webp`, lossless, 6000 × 4000,
  8,410,876 bytes. Decoded RGB pixels were compared with the PNG and are identical.
- Current display derivative: `mayra-samuel-fondo-desenfocado-web-v1.webp`,
  1600 × 1067, quality 90, 92,264 bytes. The master and full-resolution asset remain intact.

Deploy the WebP with the event assets; storage is ignored by Git. No template
component or shared data contract changes are needed. The local tunnel gateway
also allowlists this exact image path.

Manual verification: open the envelope, scroll past the hero, confirm
the photo appears before the phrase on mobile and desktop, without
horizontal overflow. Oliva displays it edge-to-edge with a centered 4:5 CSS crop;
the stored image keeps its full resolution. Confirm the image returns HTTP 200 and repeat the migration
to verify no duplicate appears. Other events' module JSON was compared unchanged.

## Independent couple names after the family

```sh
node seeds/invitation_projects/bodmys/configure-couple-names.js
```

Adds `couple_names` after `couple_family`, with `brideName` and `groomName` stored
in this event's config. Other modules retain their content and relative order.
The current card order is `couple_family` → `couple_names` → `countdown` →
`save_the_date_calendar` → `event_details`.
The local transaction checks event identity and saves a JSON backup; reruns
preserve any customized names/enabled state and never duplicate the module.

The new type is accepted by the backend catalog, so restart the backend after
the code update. It is not injected into other cards or default configurations.
All three frontend templates support the same two-field contract; botanical
assets and WindSong belong only to Oliva, not to event data. Check that opening
the card shows the family, then the two names and `&`, then event details. Clear
both fields in a fixture to verify no empty section is rendered.

## Date composition and calendar

Run `node seeds/invitation_projects/bodmys/configure-date-section.js` to apply the
current card design: names → countdown → calendar → event details. The script
backs up the existing module JSON, targets only this local event, and is
idempotent. It enables `showDate` when the flag is absent, changes the previous
seed countdown title to `Faltan`, and adds a calendar with the configured message
`El gran día`. Later explicit flags, custom titles and calendar settings survive
reruns. Other countdown messages remain unchanged. New invitation defaults use
`showDate: false`.

Validation: run `node --test tests/invitation-contracts.test.js`, repeat the
migration to confirm it does not duplicate modules, and verify the public API
returns the configured boolean and the consecutive countdown/calendar order.

## Dress code: watercolor group and fabric palette

`configure-dresscode.js` inserts the module after event details, preserving later
customer edits on repeated runs. Its eight suggested fabric samples and white
excluded sample are stored in module config. Both event images, provenance,
original generation prompt and deployment notes are documented in
[DRESSCODE-ASSETS.md](DRESSCODE-ASSETS.md). Classic and Terracota retain their
existing color-code arrays.

## Gift envelopes before dress code

Run `node seeds/invitation_projects/bodmys/configure-gift-envelopes.js` to insert
the existing module before dress code. It uses the configured title
`Lluvia de sobres` and a transparent botanical-envelope icon on Oliva's green
section. Its configuration remains event data; styles belong to the template.
See [GIFT-ENVELOPES-ASSET.md](GIFT-ENVELOPES-ASSET.md) for the PNG path, generation
prompt and deployment notes. The migration backs up the old JSON and preserves
later custom edits when repeated.

## Family and gift wording

Run `node seeds/invitation_projects/bodmys/update-family-gift-copy.js` to replace
the family title and fill the existing gift `leadText` from `modules.json`.
It only updates `bodmys`, saves a backup, preserves module order and other fields,
and refuses to overwrite wording edited after this update. Run it again to check
idempotency, then reload the invitation to verify both paragraphs.

## Names section: garden background

Run `node seeds/invitation_projects/bodmys/configure-names-background.js` after
copying `_local_storage/invitations/bodmys/couple_names/jardin-luz-natural-v1.png`.
The PNG is the user-supplied original (1064 × 1600), unchanged. SHA-256:
`13ccc082ed82a64abeefe763a8cc1a8d1cc3ba0911f3fceb5f5a9c0909e528a9`.
The migration adds only `couple_names.config.sectionBackground`, backs up the
previous JSON, and preserves subsequent background edits or an explicit null.
The optional common config works across templates; this event uses a beige
overlay at 0.10 opacity (90% transparency). Other module configuration remains unchanged.

Run `node seeds/invitation_projects/bodmys/adjust-names-opacity.js` to update
the existing names overlay from 0.78 to 0.83. It backs up the configuration
and preserves other modules, refusing to overwrite a different background.

Run `node seeds/invitation_projects/bodmys/adjust-names-opacity-50.js` to update
the existing names overlay from 0.83 to 0.50 with a configuration backup.

Run `node seeds/invitation_projects/bodmys/adjust-names-opacity-20.js` to update
the existing names overlay from 0.50 to 0.20 with a configuration backup.
Reload the local invitation and verify the garden remains visible behind
the green names, now supported by a soft beige text halo and shadow.

Run `node seeds/invitation_projects/bodmys/adjust-names-opacity-10.js` to update
the existing names overlay from 0.20 or 0.32 to 0.10 with a configuration backup.

Run `node seeds/invitation_projects/bodmys/adjust-names-opacity-32.js` to update
the existing names overlay from 0.10 to 0.32 with a configuration backup.

## Garden Elegance dress code

Run `node seeds/invitation_projects/bodmys/update-dresscode-copy.js` to set
`attireLabel` to Garden Elegance and put the style description and evening
outerwear recommendation in the visible `message`, separated by a blank line.
The image alt text and palettes retain their existing values. Reload the
invitation and verify both paragraphs above the illustration on mobile.

## Ivory and beige excluded fabrics

Run `node seeds/invitation_projects/bodmys/add-ivory-beige-avoided.js` after
copying both new WebP assets. The script appends Marfil and Beige to the existing
white sample and updates the excluded-colors title with a JSON backup.
See [AVOIDED-COLORS-ASSETS.md](AVOIDED-COLORS-ASSETS.md) for assets, prompts and checks.
