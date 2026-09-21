# Icono de lluvia de sobres

- Archivo del evento: `_local_storage/invitations/bodmys/gift_envelopes/sobre-botanico-v1.png`.
- URL de configuración: `/scrAppaltezza/invitations/bodmys/gift_envelopes/sobre-botanico-v1.png`.
- Generado con la herramienta integrada `image_gen.imagegen`; PNG RGBA de 1536 × 1024 con transparencia.
- Original conservado: `/Volumes/01_SSD_1TB/USUARIO/.codex/generated_images/01a09819-196b-74b2-a638-146267c52ad8/exec-3e135cb7-ea13-40a6-95ea-46b0de0ab847.png`.

La configuración de `gift_envelopes` guarda título, imagen y texto alternativo
en DB. `leadText` queda vacío. Oliva define el fondo verde y la tipografía beige
en su CSS; el módulo compartido conserva sus campos y funcionamiento.

Aplicación: `node seeds/invitation_projects/bodmys/configure-gift-envelopes.js`.
Agrega una sola instancia antes de `dresscode`, con respaldo del JSON previo.
Las posteriores ejecuciones conservan las ediciones del cliente.

El storage está ignorado por Git. Transferir el PNG al publicar y permitir su
ruta en el proxy del túnel (`altezza/scripts/oliva-preview-gateway.cjs`).

## Prompt final — herramienta integrada

Use case: stylized-concept.
Asset type: small transparent PNG gift-envelope icon for an elegant olive-green and warm beige wedding invitation.
Primary request: ONE refined closed ivory/beige stationery envelope, front-facing, slightly wider than tall, centered. Clearly recognizable triangular flap, delicate folded paper edges. A small round muted olive-green wax seal at the flap point embossed with a tiny simple flowering botanical sprig. Fine understated warm pencil contours and softly washed watercolor shading, subtly tactile cotton paper, consistent with romantic botanical wedding stationery. Only the envelope and its seal; no additional objects.
Composition: compact, balanced, nearly square canvas. Envelope fills about 80 percent of the canvas width and 55 percent of the height. Complete object with clear transparent margin on all sides. Readable silhouette and simple details when displayed at about 112-128 CSS pixels wide.
Palette: warm ivory and beige envelope, muted olive seal, restrained warm pale highlights; enough contrast to show clearly on a #767c5a olive section. Avoid bright gold, yellow, pink or black. Delicate and elegant, not cartoonish, not glossy plastic.
Background: genuine transparent alpha. No white rectangular background, scenery, table, floor, large cast shadow or backdrop. No banknotes, money symbols, gift boxes, hearts floating around it or large decorative flowers. No text, lettering, names, monograms, digits, logo or watermark. This is the final isolated icon, not a website mockup.
