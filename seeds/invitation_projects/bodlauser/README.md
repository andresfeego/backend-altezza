# Laura & Sergio — Lemoncello (local)

Ejecutar desde backend-altezza: `node seeds/invitation_projects/bodlauser/seed.js`.
Crea bodlauser, wedding_lemoncello y diez módulos: Sobre → Hero → Frase bíblica → Image Slider 1 → Cuenta regresiva → Calendario → Detalles del evento → Lluvia de sobres → Recomendaciones → Vestuario.
Incluye lausprueba con TEST GUEST TO REPLACE para revisar el enlace real.
Solo base local, transacción y comprobación de identidad y propiedad. Al repetir,
no sobrescribe contenido existente ni respuestas. No envía mensajes.

Para añadir la escena de sobres a un evento ya creado:
`node seeds/invitation_projects/bodlauser/configure-gift-envelopes.js`.
Configura `title`, `leadText`, `imageSrc` e `imageAlt` después de `event_details`,
con respaldo y transacción local. Conserva los demás módulos, invitados y respuestas.
Idempotente; validaciones y prueba de preservación en `tests/lemoncello-gift-envelopes.test.js`.

Para actualizar el texto de un evento ya creado:
`node seeds/invitation_projects/bodlauser/configure-envelope.js`.
Guarda respaldo del JSON anterior, sincroniza el Hero con el seed vigente, mueve la frase del Word a
biblical_quote.passageText sin referencia religiosa y quita únicamente el override
INVITATION LABEL TO REPLACE para usar el label real de la invitación. Idempotente.

Para actualizar únicamente el Hero del evento existente:
`node seeds/invitation_projects/bodlauser/configure-hero.js`.
Guarda respaldo y modifica solo `hero_image_1.config.text1` («Nos casamos») y
`logoImage` (PNG con alfa del monograma original). Fecha y nombres siguen viniendo
del contrato compartido. Hero y cierre comparten el archivo del Storage del evento:
`/scrAppaltezza/invitations/bodlauser/cover/laura-sergio-monogram.png`.
El original recibido también está en `cover/laura-sergio-monogram-source.jpg`.
`node seeds/invitation_projects/bodlauser/configure-monogram-storage.js` actualiza
solamente `hero_image_1.config.logoImage` y `closing_message.config.imageSrc`,
con respaldo y transacción local, sin modificar los demás datos.

Para corregir la escena de la frase del evento existente:
`node seeds/invitation_projects/bodlauser/configure-quote-scene.js`.
Guarda respaldo, retira el `welcome_message` agregado por error y coloca el
`biblical_quote` existente después del Hero. Conserva su `passageText` y su
`passageReference` intencionalmente vacío, las fotos y el estado de publicación.
Es idempotente y solo permite la base local. `configure-welcome.js` se conserva
como alias de este corrector. El letrero de sombrillas presenta únicamente el
contrato de frase bíblica: no incluye invitado ni mensaje personalizado.

## Fotografías

`organize-photos.js` organizó los 22 JPEG originales como `photos/001.jpeg` a
`photos/022.jpeg`, eliminó los siete ZIP y retiró las carpetas que quedaron vacías.
`photos-manifest.json`, junto a esa carpeta, conserva rutas originales, SHA-256
y la selección aleatoria de siete fotos distintas; ninguna foto original se convirtió.

Las fotos seleccionadas son 017, 005, 012, 004, 011, 015 y 006. El seed guarda sus
copias WebP en `/scrAppaltezza/invitations/bodlauser/image_slider_1/`.
`node seeds/invitation_projects/bodlauser/prepare-photo-slider.js` reproduce esas
copias optimizadas. `configure-photos.js` agrega el módulo después de la frase bíblica
en la DB local, con respaldo, validación de identidad y comportamiento idempotente.

La migración `20260920_001_rename_image_slider_1.js` cambia solamente el tipo
`image_slider_sepia` por `image_slider_1` en las tarjetas existentes. Los archivos
y URLs antiguas no se renombran: así se conservan fotos, recortes y configuración.
Lecturas y escrituras del backend aceptan el alias antiguo y devuelven el nombre nuevo.

Word: ceremonia 19/12/2026 14:30 America/Bogota, Paipa, Capilla Señora del Rosario
del Pantano de Vargas; recepción Villa Germana. Frase: Celebramos nuestro amor y
queremos compartirlo con nuestras personas favoritas.

Pendientes:
- TEST INVITATION TO REPLACE y TEST GUEST TO REPLACE son datos ficticios de prueba.
- RECEPTION TIME TO REPLACE: 16:00 del mismo día es provisional porque la columna
  fechaHoraRecepcion no admite NULL; ahora se muestra en detalles junto al mensaje
  inglés «RECEPTION TIME TO REPLACE» para identificarlo como provisional.
- Fecha límite NULL. Capilla sin coordenadas; Villa Germana reutiliza su registro
  existente, incluidas las coordenadas que ya tuviera.

Los recursos del sobre y la animación pertenecen a la plantilla frontend.
El Hero tiene dos planos de acuarela independientes y monograma recoloreable;
la frase se presenta en el letrero de la terraza. Sin cambios de esquema ni estado de publicación.

## Fecha, cuenta regresiva y calendario

`node seeds/invitation_projects/bodlauser/configure-date-scene.js` inserta
`countdown` y `save_the_date_calendar` juntos después de las fotos. Guarda respaldo,
valida identidad/plantilla, conserva datos existentes y no cambia la publicación.
Es idempotente. El mensaje, título y calendario iniciales se toman del seed de Oliva
(`bodmys`), mientras la fecha sigue siendo la ceremonia de Laura y Sergio.

Lemoncello presenta estos dos módulos compartidos en un único letrero con arco;
al cambiar de plantilla siguen siendo módulos independientes con los mismos datos.
`node seeds/invitation_projects/bodlauser/configure-event-details.js` inserta
`event_details` después del calendario, con respaldo, identidad y transacción.
Conserva horarios/lugares y cualquier configuración previa; es idempotente.
La plantilla aleja la cámara desde el letrero para mostrar iglesia y jardín,
manteniendo los datos en el cielo. El Word exige recalcar puntualidad en la
ceremonia, recogida en `ceremonyMessage`. No se inventa mapa para la capilla.

## Recomendaciones de hospedaje

`node seeds/invitation_projects/bodlauser/configure-recommendations.js` inserta
`recommendations` después de sobres. Configura título, dos textos, imagen y enlace;
respaldo, identidad, transacción local e idempotencia. Conserva el resto del evento,
invitados y respuestas. Pruebas: `tests/lemoncello-recommendations.test.js`.
Contacto de https://hoteldescansoreal.com/ consultado el 24/09/2026: WhatsApp
318 393 1186 (el enlace incluye 57). El teléfono mostrado en la web es distinto
del WhatsApp; se usa el destino oficial de WhatsApp sin enviar mensajes.

## Vestuario

`node seeds/invitation_projects/bodlauser/configure-dresscode.js` añade el módulo
compartido `dresscode` después de recomendaciones. Textos de elegancia fresca,
seis figuras sin novia y paleta de seis telas sugeridas; amarillo mantequilla y
azul cielo reservados. Imagen y atlas viven en el frontend. No cambia invitados,
respuestas, horarios ni publicación. Local, transaccional, con respaldo e
idempotente; pruebas en `tests/lemoncello-dresscode.test.js`.

## Asistencia

`node seeds/invitation_projects/bodlauser/configure-attendance.js` inserta
`attendance_confirm` después de vestuario, con el título e instrucciones de Oliva.
Reutiliza contrato, invitados, fecha límite y guardado existentes. Solo cambia
modulesJson de Laura y Sergio en local, con respaldo, transacción y validación de
identidad; es idempotente. No altera invitados ni respuestas.
Pruebas: `tests/lemoncello-attendance.test.js`.

## Cierre

`node seeds/invitation_projects/bodlauser/configure-closing.js` inserta
`closing_message` tras asistencia con «Te esperamos», `imageSrc` del monograma
existente y `imageAlt`, sin marco. Los campos de imagen son opcionales en el
contrato compartido. Solo cambia modulesJson en local; respaldo, transacción,
validación de identidad e idempotencia. No modifica invitados ni respuestas.
Pruebas: `tests/lemoncello-closing.test.js`.

## Ajustes editoriales (2026-09-24)

`node seeds/invitation_projects/bodlauser/configure-editorial-copy.js` actualiza
el mensaje de adultos a frase normal, el título de vestuario a «Vestuario ·
Elegancia fresca» y agrega blanco a los colores reservados. Solo modifica esos
campos de Laura y Sergio en local, con respaldo, transacción y control de identidad.
Es idempotente; no cambia invitados, respuestas, orden ni contratos. Seed y preview
mantienen el mismo contenido. Las fuentes y el árbol son recursos de plantilla.

## Música desde el inicio

`node seeds/invitation_projects/bodlauser/configure-music.js` habilita `music_player`
con «Eres tú · Carla Morrison», `autoplay: true` e `initiallyMuted: false`. No altera
el orden de módulos visuales; respaldo, transacción local e idempotencia. Canción
en `_local_storage/invitations/bodlauser/music/carla-morrison-eres-tu.mp3`; copia
íntegra del MP3 entregado en `muisc`, cuyo original se conserva. Seed/preview/DB
comparten la URL. Prueba: `node --test tests/lemoncello-music.test.js`.
La presentación Lemoncello espera ahora el clic en su flecha inicial para iniciar
la canción y el recorrido de la moto al mismo tiempo; conserva el contrato del
módulo y no requiere modificar esta configuración.
