# Hero botánico — Mayra y Samuel

Generado con la herramienta integrada de imágenes el 16 de septiembre de 2026.

- Archivo: `_local_storage/invitations/bodmys/hero/floral-relief-v1.png`
- Ruta pública: `/scrAppaltezza/invitations/bodmys/hero/floral-relief-v1.png`
- PNG RGBA de 1024 × 1536, con transparencia real y centro libre.
- Configuración: `hero_image_1.config.backgroundImage`.
- Monograma: `hero_image_1.config.logoImage`, reutiliza el PNG del evento que también utiliza el sobre.
- El PNG aporta las formas; las máscaras alfa y sombras de Oliva producen el repuje.
- Recurso específico de esta tarjeta, no importado como decoración fija de la plantilla.
- La configuración local se aplica con `node seeds/invitation_projects/bodmys/configure-hero.js`.
- El script respalda los módulos y modifica únicamente `backgroundImage` y `logoImage` del hero.
- Para otro entorno, copiar también el PNG al almacenamiento público de invitaciones antes de aplicar estos datos.
- En la vista de Cloudflare, el gateway local `/tmp/altezza-oliva-tunnel-proxy.cjs`
  debe permitir esta ruta exacta. Se añadió al listado de recursos el 16 de septiembre
  de 2026: sin esa entrada, localhost devolvía el PNG pero el túnel respondía 404.

## Prompt utilizado

```text
Use case: stylized-concept.
Asset type: a production PNG alpha mask for CSS botanical embossing on a wedding invitation.
Create ONE tall portrait image, approximately 1024 x 1536 pixels, TRANSPARENT background, with delicate pure WHITE botanical line art only.
Reference image 1 is ONLY a composition and spacing reference: the embossed flower branches around the edges of the green invitation visible inside the phone. Do NOT reproduce the phone, green surface, text, envelope, initials, or any interface. Match its sparse, irregular perimeter composition: long slender stems rising along the lower left, small branching flowers at the upper left, light sprigs entering from the upper right and right edge, and leafy flowering sprays along the bottom. Leave a large clear central area, roughly the middle 58% of the width and middle 70% of the height, for a separate monogram and date. Decorations should frame the space without a solid rectangular border. Some stems may enter from canvas edges naturally; avoid crowding.
Reference image 2 is ONLY a botanical drawing-style reference, the transparent MS wedding monogram. Match its elegant thin curving stems, pointed oval leaves, tiny buds and small wildflower blossoms. Do not include the M or S or any lettering. The final flowers must feel like they belong to that same stationery.
Style: graceful engraved botanical contour illustration, fine clean organic lines with enough body to remain visible when scaled to a 400px wide mobile page, with small internal vein and petal details. No watercolor shading or photorealism. 
Color: pure white strokes and selected white petal/leaf details; all negative space, including the center and between the branches, must have ACTUAL zero alpha transparency. No painted checkerboard, no opaque white background. Flat artwork only: NO shadows, bevels, emboss, highlights, textures, or colors baked into the PNG; CSS will create the relief.
Do not include ANY typography, monogram, logo, envelope, phone, border outline or watermark. Output only the usable transparent floral PNG.
```
