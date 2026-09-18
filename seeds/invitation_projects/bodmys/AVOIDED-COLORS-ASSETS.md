# Muestras de marfil y beige

Generadas con la herramienta integrada `image_gen.imagegen`, una llamada por color. Referencia de textura: `paleta-telas-referencia-v1.png` (franja inferior). Se conservaron los PNG originales en el storage del evento y se exportaron copias WebP de 512 × 512 para la tarjeta, sin recolorear. La muestra de marfil conserva el canal alfa generado y usa un recorte central por CSS (`x:25, y:25, width:50, height:50`).

## Archivos finales

- `_local_storage/invitations/bodmys/dresscode/tela-marfil-v1.png`
- `_local_storage/invitations/bodmys/dresscode/tela-marfil-v1.webp`
- `_local_storage/invitations/bodmys/dresscode/tela-beige-v1.png`
- `_local_storage/invitations/bodmys/dresscode/tela-beige-v1.webp`

El storage local está ignorado por Git; copiar estos recursos al storage del entorno antes de aplicar su configuración. Ejecutar `node seeds/invitation_projects/bodmys/add-ivory-beige-avoided.js` para agregar las dos muestras con respaldo e idempotencia. Cambia el título a «Evita blanco, marfil y beige» y conserva las ocho muestras sugeridas y el resto de los textos.

Validación manual: abrir vestuario en móvil y escritorio, comprobar tres muestras a evitar con sus cruces, nombres accesibles Blanco / Marfil / Beige, diferencias de tono, carga de las dos imágenes y ausencia de desbordamiento.

## marfil

Original generado: `/Volumes/01_SSD_1TB/USUARIO/.codex/generated_images/01a0b168-ff2d-7f23-8aff-b5182538f4d6/exec-783c8fb0-0493-4af7-a2c3-4043b765bb56.png`.

### Prompt final

Use case: product-mockup. Asset type: single square fabric color swatch for the 'colors to avoid' section of a wedding invitation. Input image 1: texture and photographic style reference ONLY, especially the bottom row of draped fabric samples. Derive a new standalone MARFIL / IVORY fabric swatch matching that bottom row's soft matte dress fabric and broad flowing diagonal folds. Only ivory fabric fills the entire square canvas edge to edge, close-up macro product photograph, 2–3 broad soft diagonal drapes with realistic fine weave and gentle diffuse daylight from the upper left. The fabric is pale warm ivory, subtly creamy, visibly warmer than pure bridal white but much lighter than beige, approximate midtone #EEE3CA. Keep shadows light and warm so this reads as ivory even as a small circular thumbnail. Natural low-sheen crepe, no metallic satin shine. No people, no flowers, no garment silhouette, no background, no circle, no border, no labels, no letters, no cross, no watermark. Square 1024x1024.

## beige

Original generado: `/Volumes/01_SSD_1TB/USUARIO/.codex/generated_images/01a0b168-ff2d-7f23-8aff-b5182538f4d6/exec-b374f7d6-37d9-401d-94ce-cfca941c41a2.png`.

### Prompt final

Use case: product-mockup. Asset type: single square fabric color swatch for the 'colors to avoid' section of a wedding invitation. Input image 1: texture and photographic style reference ONLY, especially the bottom row of draped fabric samples. Derive a new standalone BEIGE fabric swatch matching that bottom row's soft matte dress fabric and broad flowing diagonal folds. Only beige fabric fills the entire square canvas edge to edge, close-up macro product photograph, 2–3 broad soft diagonal drapes with realistic fine weave and gentle diffuse daylight from the upper left. The fabric is a light-medium warm sandy beige, clearly deeper than ivory or white, approximate midtone #C9B38F. Avoid green, gray or pink cast and avoid dark brown. Keep shadows soft and restrained so this reads as beige even as a small circular thumbnail. Natural low-sheen crepe, no metallic satin shine. No people, no flowers, no garment silhouette, no background, no circle, no border, no labels, no letters, no cross, no watermark. Square 1024x1024.
