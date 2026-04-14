async function getColumn(knex, tableName, columnName) {
  const [rows] = await knex.raw(
    `
    SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    LIMIT 1
    `,
    [tableName, columnName]
  );

  return rows?.[0] || null;
}

async function renameColumnIfPresent(knex, tableName, fromName, toName) {
  const source = await getColumn(knex, tableName, fromName);
  if (!source) return false;

  const target = await getColumn(knex, tableName, toName);
  if (target) return false;

  const nullable = source.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
  await knex.raw(
    `ALTER TABLE ?? CHANGE COLUMN ?? ?? ${source.COLUMN_TYPE} ${nullable}`,
    [tableName, fromName, toName]
  );

  return true;
}

exports.up = async function up(knex) {
  const hasInvitacion = await knex.schema.hasTable('invitacion');
  if (!hasInvitacion) {
    throw new Error('La tabla `invitacion` debe existir antes de renombrar sus columnas.');
  }

  await renameColumnIfPresent(knex, 'invitacion', 'mensaje', 'label');

  const renamedObservacion = await renameColumnIfPresent(knex, 'invitacion', 'observacion', 'mensaje_personalizado');
  if (!renamedObservacion) {
    const hasMensajePersonalizado = await knex.schema.hasColumn('invitacion', 'mensaje_personalizado');
    if (!hasMensajePersonalizado) {
      await knex.schema.alterTable('invitacion', (table) => {
        table.text('mensaje_personalizado').nullable();
      });
    }
  }
};

exports.down = async function down() {
  throw new Error('Rollback no soportado para el rename de columnas de invitacion. Crea una migracion compensatoria si necesitas revertir este cambio.');
};
