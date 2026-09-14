const LEGACY_TABLE = 'usuarioSistema';
const CANONICAL_TABLE = 'usuariosistema';
const TEMP_TABLE = 'usuariosistema_case_normalization_tmp';

async function hasExactTable(knex, tableName) {
  const [rows] = await knex.raw(
    `
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND BINARY TABLE_NAME = BINARY ?
    LIMIT 1
    `,
    [tableName]
  );

  return Boolean(rows?.length);
}

async function getLowerCaseTableNames(knex) {
  const [rows] = await knex.raw("SHOW VARIABLES LIKE 'lower_case_table_names'");
  return Number(rows?.[0]?.Value ?? rows?.[0]?.VALUE ?? 0);
}

exports.up = async function up(knex) {
  const [hasLegacy, hasCanonical, hasTemporary] = await Promise.all([
    hasExactTable(knex, LEGACY_TABLE),
    hasExactTable(knex, CANONICAL_TABLE),
    hasExactTable(knex, TEMP_TABLE),
  ]);

  if (hasCanonical && !hasLegacy && !hasTemporary) return;

  if (hasTemporary && !hasLegacy && !hasCanonical) {
    await knex.raw('RENAME TABLE ?? TO ??', [TEMP_TABLE, CANONICAL_TABLE]);
    return;
  }

  if (hasTemporary || (hasLegacy && hasCanonical)) {
    throw new Error('Existen tablas de usuario ambiguas. Revisa usuarioSistema, usuariosistema y la tabla temporal antes de continuar.');
  }

  if (!hasLegacy) {
    throw new Error('No existe la tabla usuarioSistema ni su nombre canonico usuariosistema.');
  }

  const lowerCaseTableNames = await getLowerCaseTableNames(knex);

  if (lowerCaseTableNames === 0) {
    await knex.raw('RENAME TABLE ?? TO ??', [LEGACY_TABLE, CANONICAL_TABLE]);
    return;
  }

  // Filesystems with case-insensitive table names need an intermediate name
  // to persist a case-only rename reliably.
  await knex.raw('RENAME TABLE ?? TO ??', [LEGACY_TABLE, TEMP_TABLE]);
  await knex.raw('RENAME TABLE ?? TO ??', [TEMP_TABLE, CANONICAL_TABLE]);
};

exports.down = async function down() {
  throw new Error('Rollback no soportado: restaurar usuarioSistema rompe las consultas canonicas del backend en Linux.');
};

exports.config = { transaction: false };
