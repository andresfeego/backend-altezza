const { renameImageSliderModules } = require('../server/utils/invitationModuleType');

async function migrate(knex, from, to) {
  await knex.transaction(async trx => {
    const rows = await trx('evento_invitacion_publica').select('idEvento', 'modulesJson').forUpdate();
    for (const row of rows) {
      const before = typeof row.modulesJson === 'string' ? JSON.parse(row.modulesJson) : row.modulesJson;
      const next = renameImageSliderModules(before, from, to);
      if (JSON.stringify(before) !== JSON.stringify(next)) {
        await trx('evento_invitacion_publica').where({ idEvento: row.idEvento }).update({ modulesJson: JSON.stringify(next) });
      }
    }
  });
}
exports.up = knex => migrate(knex, 'image_slider_sepia', 'image_slider_1');
exports.down = knex => migrate(knex, 'image_slider_1', 'image_slider_sepia');
