async function tableExists(knex, tableName) {
  return knex.schema.hasTable(tableName);
}

const PAISES = [
  ['AF','Afganistan','+93','🇦🇫'],['AL','Albania','+355','🇦🇱'],['DE','Alemania','+49','🇩🇪'],['AD','Andorra','+376','🇦🇩'],['AO','Angola','+244','🇦🇴'],
  ['AR','Argentina','+54','🇦🇷'],['AM','Armenia','+374','🇦🇲'],['AU','Australia','+61','🇦🇺'],['AT','Austria','+43','🇦🇹'],['AZ','Azerbaiyan','+994','🇦🇿'],
  ['BE','Belgica','+32','🇧🇪'],['BO','Bolivia','+591','🇧🇴'],['BA','Bosnia y Herzegovina','+387','🇧🇦'],['BR','Brasil','+55','🇧🇷'],['BG','Bulgaria','+359','🇧🇬'],
  ['CA','Canada','+1','🇨🇦'],['CL','Chile','+56','🇨🇱'],['CN','China','+86','🇨🇳'],['CO','Colombia','+57','🇨🇴'],['KR','Corea del Sur','+82','🇰🇷'],
  ['CR','Costa Rica','+506','🇨🇷'],['HR','Croacia','+385','🇭🇷'],['CU','Cuba','+53','🇨🇺'],['DK','Dinamarca','+45','🇩🇰'],['EC','Ecuador','+593','🇪🇨'],
  ['EG','Egipto','+20','🇪🇬'],['SV','El Salvador','+503','🇸🇻'],['AE','Emiratos Arabes Unidos','+971','🇦🇪'],['ES','Espana','+34','🇪🇸'],['US','Estados Unidos','+1','🇺🇸'],
  ['EE','Estonia','+372','🇪🇪'],['ET','Etiopia','+251','🇪🇹'],['PH','Filipinas','+63','🇵🇭'],['FI','Finlandia','+358','🇫🇮'],['FR','Francia','+33','🇫🇷'],
  ['GE','Georgia','+995','🇬🇪'],['GH','Ghana','+233','🇬🇭'],['GR','Grecia','+30','🇬🇷'],['GT','Guatemala','+502','🇬🇹'],['HN','Honduras','+504','🇭🇳'],
  ['HU','Hungria','+36','🇭🇺'],['IN','India','+91','🇮🇳'],['ID','Indonesia','+62','🇮🇩'],['IQ','Irak','+964','🇮🇶'],['IE','Irlanda','+353','🇮🇪'],
  ['IS','Islandia','+354','🇮🇸'],['IL','Israel','+972','🇮🇱'],['IT','Italia','+39','🇮🇹'],['JM','Jamaica','+1','🇯🇲'],['JP','Japon','+81','🇯🇵'],
  ['KZ','Kazajistan','+7','🇰🇿'],['KE','Kenia','+254','🇰🇪'],['KW','Kuwait','+965','🇰🇼'],['LV','Letonia','+371','🇱🇻'],['LB','Libano','+961','🇱🇧'],
  ['LT','Lituania','+370','🇱🇹'],['LU','Luxemburgo','+352','🇱🇺'],['MY','Malasia','+60','🇲🇾'],['MA','Marruecos','+212','🇲🇦'],['MX','Mexico','+52','🇲🇽'],
  ['MD','Moldavia','+373','🇲🇩'],['MC','Monaco','+377','🇲🇨'],['ME','Montenegro','+382','🇲🇪'],['NI','Nicaragua','+505','🇳🇮'],['NG','Nigeria','+234','🇳🇬'],
  ['NO','Noruega','+47','🇳🇴'],['NZ','Nueva Zelanda','+64','🇳🇿'],['NL','Paises Bajos','+31','🇳🇱'],['PA','Panama','+507','🇵🇦'],['PY','Paraguay','+595','🇵🇾'],
  ['PE','Peru','+51','🇵🇪'],['PL','Polonia','+48','🇵🇱'],['PT','Portugal','+351','🇵🇹'],['GB','Reino Unido','+44','🇬🇧'],['CZ','Republica Checa','+420','🇨🇿'],
  ['DO','Republica Dominicana','+1','🇩🇴'],['RO','Rumania','+40','🇷🇴'],['RU','Rusia','+7','🇷🇺'],['SA','Arabia Saudita','+966','🇸🇦'],['RS','Serbia','+381','🇷🇸'],
  ['SG','Singapur','+65','🇸🇬'],['SK','Eslovaquia','+421','🇸🇰'],['SI','Eslovenia','+386','🇸🇮'],['ZA','Sudafrica','+27','🇿🇦'],['SE','Suecia','+46','🇸🇪'],
  ['CH','Suiza','+41','🇨🇭'],['TH','Tailandia','+66','🇹🇭'],['TW','Taiwan','+886','🇹🇼'],['TN','Tunez','+216','🇹🇳'],['TR','Turquia','+90','🇹🇷'],
  ['UA','Ucrania','+380','🇺🇦'],['UY','Uruguay','+598','🇺🇾'],['VE','Venezuela','+58','🇻🇪'],['VN','Vietnam','+84','🇻🇳']
];

exports.up = async function up(knex) {
  const hasInvitado = await tableExists(knex, 'invitado');
  if (!hasInvitado) throw new Error('La tabla `invitado` debe existir antes de esta migracion.');

  const hasPaisTelefono = await tableExists(knex, 'pais_telefono');
  if (!hasPaisTelefono) {
    await knex.schema.createTable('pais_telefono', (table) => {
      table.increments('id').primary();
      table.string('iso2', 2).notNullable().unique();
      table.string('nombre', 100).notNullable();
      table.string('codigoTelefono', 8).notNullable();
      table.string('emojiBandera', 8).notNullable();
      table.boolean('activo').notNullable().defaultTo(true);
      table.integer('orden').notNullable().defaultTo(999);
    });
  }

  for (let i = 0; i < PAISES.length; i += 1) {
    const [iso2, nombre, codigoTelefono, emojiBandera] = PAISES[i];
    await knex('pais_telefono')
      .insert({ iso2, nombre, codigoTelefono, emojiBandera, activo: 1, orden: i + 1 })
      .onConflict('iso2')
      .merge({ nombre, codigoTelefono, emojiBandera, activo: 1, orden: i + 1 });
  }

  const hasColumn = await knex.schema.hasColumn('invitado', 'idPaisTelefono');
  if (!hasColumn) {
    await knex.schema.alterTable('invitado', (table) => {
      table.integer('idPaisTelefono').unsigned().nullable().after('telefono');
    });
  }

  const co = await knex('pais_telefono').select('id').where({ iso2: 'CO' }).first();
  if (!co?.id) throw new Error('No se encontro pais CO en el catalogo pais_telefono.');

  await knex('invitado').whereNull('idPaisTelefono').update({ idPaisTelefono: co.id });

  await knex.raw(`
    ALTER TABLE invitado
    MODIFY COLUMN idPaisTelefono INT UNSIGNED NOT NULL
  `);

  await knex.schema.alterTable('invitado', (table) => {
    table.foreign('idPaisTelefono', 'fk_invitado_pais_telefono').references('pais_telefono.id');
    table.index(['idPaisTelefono'], 'idx_invitado_pais_telefono');
  });
};

exports.down = async function down() {
  throw new Error('Rollback no soportado para pais_telefono/idPaisTelefono. Crea una migracion compensatoria si necesitas revertir este cambio.');
};
