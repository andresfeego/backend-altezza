exports.up = async function up(knex) {
  const hasAlbums = await knex.schema.hasTable('evento_album_fotos');
  if (!hasAlbums) return;

  const hasLogoUrl = await knex.schema.hasColumn('evento_album_fotos', 'logoUrl');
  if (!hasLogoUrl) {
    await knex.schema.alterTable('evento_album_fotos', (table) => {
      table.text('logoUrl').nullable().after('descripcion');
    });
  }
};

exports.down = async function down(knex) {
  const hasAlbums = await knex.schema.hasTable('evento_album_fotos');
  if (!hasAlbums) return;

  const hasLogoUrl = await knex.schema.hasColumn('evento_album_fotos', 'logoUrl');
  if (hasLogoUrl) {
    await knex.schema.alterTable('evento_album_fotos', (table) => {
      table.dropColumn('logoUrl');
    });
  }
};
