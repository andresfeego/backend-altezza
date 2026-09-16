# Mayra & Samuel — Oliva (local)

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
