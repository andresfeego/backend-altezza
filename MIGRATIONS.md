# Migraciones de base de datos

Este backend usa `knex` para versionar cambios de esquema.

## Comandos

Usando Node `v22.22.0`:

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"
```

Crear una nueva migracion:

```bash
npm run migrate:make nombre_de_la_migracion
```

Aplicar migraciones pendientes:

```bash
npm run migrate:latest
```

Revisar estado:

```bash
npm run migrate:status
```

Intentar rollback:

```bash
npm run migrate:rollback
```

## Regla de trabajo

- No editar el esquema manualmente en un entorno si ese cambio debe vivir en otros entornos.
- Todo cambio estructural debe salir primero como migracion.
- Luego se aplica en local, testing, LAB y produccion.
- Las migraciones nuevas deben ser pequenas, claras e idealmente reversibles.

## Estado actual

La migracion base creada para usuarios es:

- `migrations/20260325_001_admin_usuarios_base.js`

Esa migracion deja `usuarioSistema` listo para el modulo `Admin Usuarios` con estos ajustes:

- `estado`
- `telefon` como `varchar(20)`
- `pass` como `varchar(100)`
- `passTemp` como `varchar(100)`
- indice unico en `user`
