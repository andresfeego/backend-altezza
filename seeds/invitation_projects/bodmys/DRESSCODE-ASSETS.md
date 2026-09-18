# Dresscode de Mayra y Samuel

## Archivos del evento

- `_local_storage/invitations/bodmys/dresscode/grupo-vestidos-acuarela-v1.png`: ilustración de nueve mujeres generada mediante la herramienta integrada `image_gen.imagegen`, con fondo transparente.
- `_local_storage/invitations/bodmys/dresscode/paleta-telas-referencia-v1.png`: copia sin modificar de la fotografía aportada por el usuario. Los círculos encuadran las telas de la franja inferior mediante CSS; no se regeneraron ni recolorearon.
- Original generado conservado en `/Volumes/01_SSD_1TB/USUARIO/.codex/generated_images/01a09819-196b-74b2-a638-146267c52ad8/exec-f9596676-21c3-45ba-96d4-8d98523546f1.png`.

Estos recursos pertenecen al evento y sus URL se guardan en DB. No se importan
desde la plantilla Oliva. El storage local está ignorado por Git: al desplegar,
transferir ambos PNG junto con los otros recursos del evento.

Referencias: `codex-clipboard-3bd7559e-1e97-4f32-a5f2-a2d41c698fcb.png`
(estilo de acuarela) y `codex-clipboard-f38681d9-d171-48ca-846f-d7cb2074af01.png`
(nueve mujeres, composición y paleta, original de 1476 × 911).

Se conservan ocho muestras sugeridas en el orden de la fotografía, incluidos
los matices similares. Las muestras a evitar son blanco, marfil y beige. Las dos últimas se generaron
por separado; archivos y prompts en [AVOIDED-COLORS-ASSETS.md](AVOIDED-COLORS-ASSETS.md). Los campos
`crop.x/y/width/height` representan porcentajes de la imagen original.
Para usar una imagen individual basta con su URL, sin `crop`.

## Aplicación

Desde el backend, ejecutar `node seeds/invitation_projects/bodmys/configure-dresscode.js`.
Solo agrega el módulo a `bodmys`, después de `event_details`, con respaldo
previo del JSON. Es idempotente y no sobrescribe ediciones posteriores.

## Prompt final — herramienta integrada

Use case: style-transfer.
Asset type: transparent wedding dress-code illustration for a beige and olive invitation, landscape composition.
Input image 1: style reference ONLY, the single woman wearing a yellow dress. Match this delicate, airy watercolor fashion illustration style: fine warm pencil contours, transparent washes, elegant natural proportions, understated shading, simplified blank faces without detailed facial features.
Input image 2: composition and color reference ONLY, the photograph of NINE women standing together with flower bouquets; the bottom row of fabric swatches is NOT part of the finished illustration.
Primary request: paint the entire group of exactly NINE adult women in the same left-to-right order and poses as image 2, converting all nine into the watercolor fashion drawing style of image 1. Preserve the group arrangement, each woman's body silhouette, varied gown neckline and draping, hairstyle, head direction toward the others, hands holding bouquets at waist level, and the full arrangement of bouquets with cream, muted rust flowers and sage foliage.
Dress colors from left to right: 1 dark muted charcoal olive green halter gown, 2 pale sage/sand one-shoulder gown, 3 rust/terracotta thin-strap V-neck gown, 4 muted olive/sage thin-strap gown, 5 WHITE bridal thin-strap V-neck gown at the center, 6 warm cinnamon/bronze one-shoulder gown, 7 rust/terracotta thin-strap ruffled gown, 8 pale sage/sand thin-strap gown, 9 dark muted charcoal olive green halter gown.
Keep all nine women standing in one cohesive horizontal row, full length from hair to the floor-length gown hems, with small clear margins around the group. Do not stretch or elongate their bodies unnaturally. Their bouquets remain distinct. Central woman remains white because she represents the bride. Do not recolor anyone yellow: the yellow example controls illustration style, NOT the group color palette.
Background: truly transparent alpha, no scenery, no mountains, arch or photo background, no floor, no cast shadow, no opaque white rectangle. Only the nine figures and their bouquets. Gentle watercolor edge texture, light and refined, no heavy outlines, no photorealistic faces. No text, names, typography, swatches, circles, border or watermark. Wide landscape image with the group filling the canvas and very little empty margin.
