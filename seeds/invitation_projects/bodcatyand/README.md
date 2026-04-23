# Catalina & Andres

## Evento local

- `idEvento`: `bodcatyand`
- `templateKey`: `wedding_terracota`
- assets publicos: `/scrAppaltezza/invitations/bodcatyand/*`

## Estructura esperada de assets

```text
_local_storage/
  invitations/
    bodcatyand/
```

Por ahora la carpeta se deja vacia a proposito para validar visualmente la plantilla aun cuando algunas rutas de imagen/audio no existan.

## Seed

El script crea o actualiza:

- el evento `bodcatyand`
- una invitacion de prueba `catyand001`
- dos invitados ficticios de prueba
- la configuracion publica en `evento_invitacion_publica`

Resuelve `idTipoEvento` e `idLugarRecepcion` por nombre:

- tipo de evento: `Boda`
- lugar: `Villa Germana`

Si esos nombres no coinciden exactamente en la base, ajusta las subqueries del `seed.sql`.

## Datos provisionales

- `hashtag`: vacio
- `fechaHoraLimiteConfirmar`: `2026-06-19 18:00:00`
- assets por evento: se dejan apuntando a rutas futuras en `/scrAppaltezza/invitations/bodcatyand/*`

## Notas

- La nueva plantilla `wedding_terracota` nace como copia funcional de `wedding-classic`.
- Se removieron hardcodes decorativos ligados a `bodnatyand` del front para que la plantilla no dependa de assets del evento, salvo fotos/logos que si vengan desde backend.
