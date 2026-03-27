const TABLE = 'evento_modulo_cliente';
const FK_NAME = 'fk_evento_modulo_cliente_evento';

async function hasForeignKey(knex, tableName, constraintName) {
  const [rows] = await knex.raw(
    `
    SELECT CONSTRAINT_NAME
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND CONSTRAINT_NAME = ?
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    LIMIT 1
    `,
    [tableName, constraintName]
  );

  return Boolean(rows?.length);
}

exports.up = async function up(knex) {
  const hasTable = await knex.schema.hasTable(TABLE);

  if (!hasTable) {
    await knex.schema.createTable(TABLE, (table) => {
      table.specificType('idEvento', 'varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci').notNullable();
      table.string('moduloKey', 50).notNullable();
      table.boolean('estado').notNullable().defaultTo(0);
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now());

      table.primary(['idEvento', 'moduloKey']);
      table.index(['idEvento'], 'idx_evento_modulo_cliente_evento');
      table.index(['moduloKey'], 'idx_evento_modulo_cliente_modulo');
    });
  }

  await knex.raw(
    'ALTER TABLE ?? CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci',
    [TABLE]
  );

  await knex.raw(
    'ALTER TABLE ?? MODIFY COLUMN ?? VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL',
    [TABLE, 'idEvento']
  );

  const fkExists = await hasForeignKey(knex, TABLE, FK_NAME);
  if (!fkExists) {
    await knex.schema.alterTable(TABLE, (table) => {
      table
        .foreign('idEvento', FK_NAME)
        .references('id')
        .inTable('evento')
        .onDelete('CASCADE')
        .onUpdate('CASCADE');
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists(TABLE);
};
