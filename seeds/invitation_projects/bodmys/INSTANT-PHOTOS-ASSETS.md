# Instantáneas de Mayra y Samuel

Generado el 2026-09-19 con la herramienta integrada ImageGen. Referencias: sello-lacre-abrir-v1.png de Oliva (material y luz) y monograma-MS-transparente.png del evento, visualizado sobre verde para distinguir los trazos blancos.

## Archivos

- Original: `_local_storage/invitations/bodmys/instant_photos/sello-lacre-MS-v1.png`.
- Web: `_local_storage/invitations/bodmys/instant_photos/sello-lacre-MS-v1.webp`, 384 × 384, alpha real, calidad 90, 47 922 bytes.
- Fotos existentes sin edición ni ampliación: `photos/003.jpeg` (234 × 251) y `photos/004.jpeg` (395 × 395), bajo el mismo directorio del evento. Los originales son pequeños, especialmente 003; la nitidez disponible depende de esa resolución.

El almacenamiento local está excluido de Git por la política del proyecto. Copiar los recursos al storage de destino al desplegar. No se reemplazó el sello del sobre.

## Prompt final

Create one isolated, photorealistic metallic gold wax seal for an elegant wedding invitation UI. Use reference 1 solely for the wax material, warm antique gold colour, rounded slightly irregular raised rim, subtle grain, soft top-left lighting and straight-on view. Replace all lettering and the botanical decoration inside that seal with the exact M S monogram from reference 2: tall elegant serif M upper-left and S lower-right with the delicate botanical sprig intertwined between them. Reference 2 has a dark background only to make the white monogram visible; do not reproduce that background or white ink. Emboss the entire monogram and sprig in the same gold wax, as a physically stamped relief with clear highlights and recessed shadow for legibility at small size. No ABRIR lettering, no additional words, no envelope, no paper, no photos, no scene. Single centered circular seal, fully visible with a small transparent margin, authentic cutout alpha transparency, not black, white, coloured or checkerboard background. Square canvas, high quality. The monogram must remain identifiable as M and S and retain the reference's arrangement.

## Configuración

Ejecutar `node seeds/invitation_projects/bodmys/configure-instant-photos.js` después de copiar los recursos y registrar el tipo en el backend. La migración local guarda respaldo temporal, inserta el módulo después de asistencia y establece `closing_message.config.showFrame = false`. Repetirla conserva ediciones posteriores.

## Verificación local

Aplicada a `bodmys` con respaldo de los módulos previos. Backend reiniciado y API con 16 módulos, `instant_photos` en orden 13 y cierre en orden 16. Pruebas: 35 de frontend y 15 de backend aprobadas; build optimizado correcto. Túnel verificado con HTTP 200 para página, API, ambas fotos y sello; apertura y carga de las tres imágenes sin errores de consola en Chrome móvil. Revisión visual adicional en WebKit.
