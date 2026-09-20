# Laura & Sergio — Lemoncello (local)

Ejecutar desde backend-altezza: `node seeds/invitation_projects/bodlauser/seed.js`.
Crea bodlauser, wedding_lemoncello y cuatro módulos: Sobre → Hero → Bienvenida → Frase bíblica.
Incluye lausprueba con TEST GUEST TO REPLACE para revisar el enlace real.
Solo base local, transacción y comprobación de identidad y propiedad. Al repetir,
no sobrescribe contenido existente ni respuestas. No envía mensajes.

Para actualizar el texto de un evento ya creado:
`node seeds/invitation_projects/bodlauser/configure-envelope.js`.
Guarda respaldo del JSON anterior, sincroniza el Hero con el seed vigente, mueve la frase del Word a
biblical_quote.passageText sin referencia religiosa y quita únicamente el override
INVITATION LABEL TO REPLACE para usar el label real de la invitación. Idempotente.

Para actualizar únicamente el Hero del evento existente:
`node seeds/invitation_projects/bodlauser/configure-hero.js`.
Guarda respaldo y modifica solo `hero_image_1.config.text1` («Nos casamos») y
`logoImage` (PNG con alfa del monograma original). Fecha y nombres siguen viniendo
del contrato compartido. La imagen se sirve desde el frontend:
`/images/invitaciones/bodlauser/laura-sergio-monogram.png`.

Para agregar o actualizar la bienvenida del evento existente:
`node seeds/invitation_projects/bodlauser/configure-welcome.js`.
Guarda respaldo, inserta `welcome_message` después del Hero y coloca la frase del
Word en `config.subtitle`. Conserva los demás módulos y el estado de publicación.
Es idempotente y solo permite la base local. La plantilla presenta el texto editable
en un letrero de la terraza y conecta las escenas horizontalmente con un mesero animado.

Word: ceremonia 19/12/2026 14:30 America/Bogota, Paipa, Capilla Señora del Rosario
del Pantano de Vargas; recepción Villa Germana. Frase: Celebramos nuestro amor y
queremos compartirlo con nuestras personas favoritas.

Pendientes:
- TEST INVITATION TO REPLACE y TEST GUEST TO REPLACE son datos ficticios de prueba.
- RECEPTION TIME TO REPLACE: 16:00 del mismo día es provisional porque la columna
  fechaHoraRecepcion no admite NULL; no se muestra en estos cuatro módulos.
- Fecha límite NULL. Capilla sin coordenadas; Villa Germana reutiliza su registro
  existente, incluidas las coordenadas que ya tuviera.

Los recursos del sobre y la animación pertenecen a la plantilla frontend.
El Hero tiene dos planos de acuarela independientes y monograma recoloreable;
la frase conserva presentación básica. Sin cambios de esquema ni estado de publicación.
