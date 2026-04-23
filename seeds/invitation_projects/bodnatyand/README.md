# Natalia & Andres

## Evento local

- `idEvento`: `bodnatyand`
- `templateKey`: `wedding-classic`
- assets publicos: `/scrAppaltezza/invitations/bodnatyand/*`

## Estructura esperada de assets

```text
_local_storage/
  invitations/
    bodnatyand/
      cover/
        seo_cover.webp
      photo_slider/
        slide_01.jpg
        slide_02.jpg
        slide_03.jpg
        slide_04.jpg
      audio/
        background_track.mp3
      decorative/
        butterfly_overlay.png
      motion/
        hero_background.mp4
```

## Seed

Ejecutar en la base donde ya exista:

- el evento `bodnatyand`
- la tabla `evento_invitacion_publica`

Comando sugerido:

```bash
/opt/homebrew/bin/mysql -uroot -proot -D feegosys_Altezza < seeds/invitation_projects/bodnatyand/seed.sql
```

## Ajustes antes de produccion

- actualizar datos del evento base:
  - `fechaHoraCeremonia`
  - `fechaHoraRecepcion`
  - `fechaHoraLimiteConfirmar`
  - `hashtag`
  - `idLugarCeremonia`
  - `idLugarRecepcion`
- reemplazar `seoTitle`, `seoDescription`, mensaje personalizado y nombres de familiares por datos reales
- reemplazar URLs `localhost` por el dominio publico real
- subir los archivos reales a la carpeta `invitations/bodnatyand`
- crear al menos una `invitacion` real y asociar sus `invitados` para obtener links del tipo `/invitacion/{idInvitacion}/{idInvitado}`
