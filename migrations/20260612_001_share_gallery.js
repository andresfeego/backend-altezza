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
  if (!hasEvento) {
    throw new Error('La tabla `evento` debe existir antes de crear Fotos Compartidas.');
  }

  const hasUsuarios = await knex.schema.hasTable('usuariosistema');

  const hasAlbums = await knex.schema.hasTable('evento_album_fotos');
  if (!hasAlbums) {
    await knex.schema.createTable('evento_album_fotos', (table) => {
      table.increments('id').primary();
      table.specificType('idEvento', 'varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci').notNullable();
      table.string('nombre', 140).notNullable();
      table.text('descripcion').nullable();
      table.string('publicCode', 64).notNullable().unique();
      table.string('r2Prefix', 255).notNullable();
      table.text('qrUrl').nullable();
      table.string('estado', 20).notNullable().defaultTo('activo');
      table.integer('createdBy').nullable();
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now());

      table.index(['idEvento'], 'idx_evento_album_fotos_evento');
      table.index(['estado'], 'idx_evento_album_fotos_estado');
    });
  }

  const hasVisitantes = await knex.schema.hasTable('evento_album_visitante');
  if (!hasVisitantes) {
    await knex.schema.createTable('evento_album_visitante', (table) => {
      table.increments('id').primary();
      table.string('publicCode', 64).notNullable().unique();
      table.string('displayName', 140).nullable();
      table.timestamp('firstSeenAt').notNullable().defaultTo(knex.fn.now());
      table.timestamp('lastSeenAt').notNullable().defaultTo(knex.fn.now());
      table.timestamp('expiresAt').nullable();
    });
  }

  const hasMedia = await knex.schema.hasTable('evento_album_media');
  if (!hasMedia) {
    await knex.schema.createTable('evento_album_media', (table) => {
      table.increments('id').primary();
      table.integer('albumId').unsigned().notNullable();
      table.integer('visitorId').unsigned().nullable();
      table.string('publicCode', 64).notNullable().unique();
      table.string('uploaderName', 140).nullable();
      table.string('mediaType', 20).notNullable();
      table.string('mimeType', 120).notNullable();
      table.string('originalFilename', 255).nullable();
      table.bigInteger('sizeBytes').unsigned().notNullable().defaultTo(0);
      table.string('r2KeyOriginal', 500).notNullable();
      table.string('r2KeyThumb', 500).nullable();
      table.string('r2KeyPoster', 500).nullable();
      table.text('internalUrl').nullable();
      table.timestamp('capturedAt').nullable();
      table.timestamp('fileLastModifiedAt').nullable();
      table.timestamp('uploadedAt').notNullable().defaultTo(knex.fn.now());
      table.integer('width').nullable();
      table.integer('height').nullable();
      table.decimal('durationSeconds', 12, 3).nullable();
      table.string('status', 20).notNullable().defaultTo('activo');

      table.index(['albumId', 'uploadedAt'], 'idx_evento_album_media_album_uploaded');
      table.index(['visitorId', 'albumId'], 'idx_evento_album_media_visitor_album');
      table.index(['mediaType'], 'idx_evento_album_media_type');
    });
  }

  const fkAlbumExists = await hasIndex(knex, 'evento_album_media', 'idx_evento_album_media_album_uploaded');
  if (fkAlbumExists) {
    try {
      await knex.raw('ALTER TABLE `evento_album_media` ADD CONSTRAINT `fk_evento_album_media_album` FOREIGN KEY (`albumId`) REFERENCES `evento_album_fotos` (`id`) ON DELETE CASCADE');
    } catch (error) {}
  }

  try {
    await knex.raw('ALTER TABLE `evento_album_media` ADD CONSTRAINT `fk_evento_album_media_visitante` FOREIGN KEY (`visitorId`) REFERENCES `evento_album_visitante` (`id`) ON DELETE SET NULL');
  } catch (error) {}

  try {
    await knex.raw('ALTER TABLE `evento_album_fotos` ADD CONSTRAINT `fk_evento_album_fotos_evento` FOREIGN KEY (`idEvento`) REFERENCES `evento` (`id`) ON DELETE CASCADE ON UPDATE CASCADE');
  } catch (error) {}

  if (hasUsuarios) {
    try {
      await knex.raw('ALTER TABLE `evento_album_fotos` ADD CONSTRAINT `fk_evento_album_fotos_created_by` FOREIGN KEY (`createdBy`) REFERENCES `usuariosistema` (`id`) ON DELETE SET NULL');
    } catch (error) {}
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('evento_album_media');
  await knex.schema.dropTableIfExists('evento_album_visitante');
  await knex.schema.dropTableIfExists('evento_album_fotos');
};
