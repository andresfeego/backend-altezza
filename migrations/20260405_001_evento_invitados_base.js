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
  const hasEvento = await knex.schema.hasTable('evento');
  const hasInvitado = await knex.schema.hasTable('invitado');

  if (!hasEvento || !hasInvitado) {
    throw new Error('Las tablas base `evento` e `invitado` deben existir antes de crear `evento_has_invitado`.');
  }

  const hasEventoHasInvitado = await knex.schema.hasTable('evento_has_invitado');

  // Ensure column types match the referenced PK (`invitado.id` is INT signed).
  if (hasEventoHasInvitado) {
    await knex.raw('ALTER TABLE `evento_has_invitado` MODIFY COLUMN `idInvitado` INT(11) NOT NULL');
  }

  if (!hasEventoHasInvitado) {
    await knex.schema.createTable('evento_has_invitado', (table) => {
      table.string('idEvento', 20).notNullable();
      table.integer('idInvitado').notNullable();
      table.primary(['idEvento', 'idInvitado']);
      table.foreign('idInvitado').references('invitado.id').onDelete('CASCADE');
    });
  }

  const hasEventoIdx = await hasIndex(knex, 'evento_has_invitado', 'idx_evento_has_invitado_evento');
  if (!hasEventoIdx) {
    await knex.schema.alterTable('evento_has_invitado', (table) => {
      table.index(['idEvento'], 'idx_evento_has_invitado_evento');
    });
  }

  // Ensure FK exists (best-effort).
  try {
    await knex.raw('ALTER TABLE `evento_has_invitado` ADD CONSTRAINT `evento_has_invitado_idinvitado_foreign` FOREIGN KEY (`idInvitado`) REFERENCES `invitado` (`id`) ON DELETE CASCADE');
  } catch (e) { /* ignore if already exists */ }

  const hasInvitadoIdx = await hasIndex(knex, 'evento_has_invitado', 'idx_evento_has_invitado_invitado');
  if (!hasInvitadoIdx) {
    await knex.schema.alterTable('evento_has_invitado', (table) => {
      table.index(['idInvitado'], 'idx_evento_has_invitado_invitado');
    });
  }

  await knex.raw(`
    INSERT IGNORE INTO evento_has_invitado (idEvento, idInvitado)
    SELECT ehi.idEvento, ihi.idInvitado
    FROM evento_has_invitacion AS ehi
    JOIN invitacion_has_invitado AS ihi
      ON ihi.idInvitacion = ehi.idInvitacion
  `);
};

exports.down = async function down() {
  throw new Error('Rollback no soportado para evento_has_invitado. Crea una migracion compensatoria si necesitas revertir este cambio.');
};
