async function getColumnInfo(knex, tableName, columnName) {
  const [rows] = await knex.raw(
    `
    SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE
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

async function hasIndex(knex, tableName, indexName) {
  const [rows] = await knex.raw(
    `
    SELECT INDEX_NAME
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND INDEX_NAME = ?
    LIMIT 1
    `,
    [tableName, indexName]
  );

  return Boolean(rows?.length);
}

exports.up = async function up(knex) {
  // NOTE: In the current Altezza DB schema, the table name is `usuariosistema`.
  // Keep migrations aligned to the real DB to avoid breaking existing installs.
  const TABLE = 'usuariosistema';

  const hasUsuarioSistema = await knex.schema.hasTable(TABLE);

  if (!hasUsuarioSistema) {
    throw new Error(`La tabla ${TABLE} no existe. La migracion base de usuarios no puede ejecutarse.`);
  }

  const hasEstado = await knex.schema.hasColumn(TABLE, 'estado');
  if (!hasEstado) {
    await knex.schema.alterTable(TABLE, (table) => {
      table.boolean('estado').notNullable().defaultTo(1);
    });
  }

  const telefonInfo = await getColumnInfo(knex, TABLE, 'telefon');
  if (telefonInfo && telefonInfo.DATA_TYPE !== 'varchar') {
    await knex.raw('ALTER TABLE ?? MODIFY COLUMN ?? VARCHAR(20) NOT NULL', [TABLE, 'telefon']);
  }

  const passInfo = await getColumnInfo(knex, TABLE, 'pass');
  if (passInfo && !String(passInfo.COLUMN_TYPE || '').toLowerCase().startsWith('varchar(100')) {
    await knex.raw('ALTER TABLE ?? MODIFY COLUMN ?? VARCHAR(100) NOT NULL', [TABLE, 'pass']);
  }

  const passTempInfo = await getColumnInfo(knex, TABLE, 'passTemp');
  if (passTempInfo && !String(passTempInfo.COLUMN_TYPE || '').toLowerCase().startsWith('varchar(100')) {
    await knex.raw('ALTER TABLE ?? MODIFY COLUMN ?? VARCHAR(100) NULL', [TABLE, 'passTemp']);
  }

  const hasUserUnique = await hasIndex(knex, TABLE, 'uq_usuarioSistema_user');
  if (!hasUserUnique) {
    await knex.schema.alterTable(TABLE, (table) => {
      table.unique(['user'], 'uq_usuarioSistema_user');
    });
  }
};

exports.down = async function down() {
  throw new Error('Rollback no soportado para la migracion base de usuarios. Crea una migracion compensatoria si necesitas revertir estos cambios.');
};
