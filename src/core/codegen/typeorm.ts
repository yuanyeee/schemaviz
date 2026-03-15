import { Schema, Table, Column } from '../../types';

function sqlTypeToTs(sqlType: string): string {
  const t = sqlType.toUpperCase().replace(/\(.*\)/, '').trim();
  const map: Record<string, string> = {
    INTEGER: 'number',
    INT: 'number',
    BIGINT: 'number',
    SMALLINT: 'number',
    TINYINT: 'number',
    SERIAL: 'number',
    BIGSERIAL: 'number',
    FLOAT: 'number',
    DOUBLE: 'number',
    REAL: 'number',
    DECIMAL: 'number',
    NUMERIC: 'number',
    MONEY: 'number',
    BOOLEAN: 'boolean',
    BOOL: 'boolean',
    TEXT: 'string',
    VARCHAR: 'string',
    CHAR: 'string',
    NVARCHAR: 'string',
    UUID: 'string',
    JSON: 'object',
    JSONB: 'object',
    TIMESTAMP: 'Date',
    TIMESTAMPTZ: 'Date',
    DATE: 'Date',
    TIME: 'Date',
    DATETIME: 'Date',
    BLOB: 'Buffer',
    BYTEA: 'Buffer',
    BINARY: 'Buffer',
  };
  return map[t] ?? 'string';
}

function sqlTypeToColumnType(sqlType: string): string {
  const t = sqlType.toUpperCase().replace(/\(.*\)/, '').trim();
  const map: Record<string, string> = {
    INTEGER: 'int',
    INT: 'int',
    BIGINT: 'bigint',
    SMALLINT: 'smallint',
    TINYINT: 'tinyint',
    SERIAL: 'int',
    BIGSERIAL: 'bigint',
    FLOAT: 'float',
    DOUBLE: 'double',
    REAL: 'real',
    DECIMAL: 'decimal',
    NUMERIC: 'numeric',
    MONEY: 'money',
    BOOLEAN: 'boolean',
    BOOL: 'boolean',
    TEXT: 'text',
    VARCHAR: 'varchar',
    CHAR: 'char',
    NVARCHAR: 'nvarchar',
    UUID: 'uuid',
    JSON: 'json',
    JSONB: 'jsonb',
    TIMESTAMP: 'timestamp',
    TIMESTAMPTZ: 'timestamptz',
    DATE: 'date',
    TIME: 'time',
    DATETIME: 'datetime',
    BLOB: 'blob',
    BYTEA: 'bytea',
    BINARY: 'binary',
  };
  return map[t] ?? 'varchar';
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function toPascalCase(str: string): string {
  const cc = toCamelCase(str);
  return cc.charAt(0).toUpperCase() + cc.slice(1);
}

function generateEntityClass(table: Table): string {
  const className = toPascalCase(table.name);
  const lines: string[] = [];
  const imports = new Set<string>(['Entity', 'Column', 'PrimaryGeneratedColumn']);

  // Check which decorators we need
  for (const col of table.columns) {
    if (col.isPrimaryKey) {
      const colType = sqlTypeToColumnType(col.type);
      if (colType === 'uuid') imports.add('PrimaryColumn');
      else imports.add('PrimaryGeneratedColumn');
    }
  }
  for (const fk of table.foreignKeys) {
    imports.add('ManyToOne');
    imports.add('JoinColumn');
  }
  for (const idx of table.indexes) {
    if (idx.isUnique) imports.add('Unique');
    if (!idx.isUnique) imports.add('Index');
  }
  if (table.columns.some(c => c.name === 'created_at' || c.name === 'updated_at')) {
    imports.add('CreateDateColumn');
    imports.add('UpdateDateColumn');
  }

  lines.push(`import { ${[...imports].join(', ')} } from 'typeorm';`);
  // Import related entities
  const relatedEntities = new Set(table.foreignKeys.map(fk => toPascalCase(fk.referencedTable)));
  for (const entity of relatedEntities) {
    lines.push(`import { ${entity} } from './${entity}';`);
  }
  lines.push('');

  // Unique indexes as class decorators
  for (const idx of table.indexes) {
    if (idx.isUnique && idx.columns.length > 1) {
      lines.push(`@Unique([${idx.columns.map(c => `'${toCamelCase(c)}'`).join(', ')}])`);
    }
    if (!idx.isUnique && idx.columns.length > 0) {
      lines.push(`@Index([${idx.columns.map(c => `'${toCamelCase(c)}'`).join(', ')}])`);
    }
  }

  lines.push(`@Entity('${table.name}')`);
  lines.push(`export class ${className} {`);

  const fkColNames = new Set(table.foreignKeys.flatMap(fk => fk.columns));

  for (const col of table.columns) {
    const tsType = sqlTypeToTs(col.type);
    const colType = sqlTypeToColumnType(col.type);
    const optional = col.nullable ? '?' : '!';
    const fieldName = toCamelCase(col.name);

    // Skip auto-handled timestamp columns
    if (col.name === 'created_at') {
      lines.push('  @CreateDateColumn({ name: \'created_at\' })');
      lines.push(`  ${fieldName}!: Date;`);
      lines.push('');
      continue;
    }
    if (col.name === 'updated_at') {
      lines.push('  @UpdateDateColumn({ name: \'updated_at\' })');
      lines.push(`  ${fieldName}!: Date;`);
      lines.push('');
      continue;
    }

    if (col.isPrimaryKey) {
      if (colType === 'uuid') {
        lines.push('  @PrimaryColumn(\'uuid\')');
      } else {
        lines.push('  @PrimaryGeneratedColumn()');
      }
      lines.push(`  ${fieldName}!: ${tsType};`);
    } else {
      const colOpts: string[] = [`type: '${colType}'`];
      if (col.name !== fieldName) colOpts.push(`name: '${col.name}'`);
      if (col.nullable) colOpts.push('nullable: true');
      if (col.defaultValue) colOpts.push(`default: ${col.defaultValue}`);

      // Check if unique
      const isUnique = table.indexes.some(i => i.isUnique && i.columns.length === 1 && i.columns[0] === col.name);
      if (isUnique) colOpts.push('unique: true');

      lines.push(`  @Column({ ${colOpts.join(', ')} })`);
      lines.push(`  ${fieldName}${optional}: ${tsType};`);
    }
    lines.push('');
  }

  // Relation fields
  for (const fk of table.foreignKeys) {
    const relatedClass = toPascalCase(fk.referencedTable);
    const fieldName = toCamelCase(fk.referencedTable);
    const joinCols = fk.columns.map((col, i) => ({
      name: col,
      referencedColumnName: fk.referencedColumns[i],
    }));
    lines.push(`  @ManyToOne(() => ${relatedClass})`);
    lines.push(`  @JoinColumn([${joinCols.map(j => `{ name: '${j.name}', referencedColumnName: '${j.referencedColumnName}' }`).join(', ')}])`);
    lines.push(`  ${fieldName}!: ${relatedClass};`);
    lines.push('');
  }

  lines.push('}');
  return lines.join('\n');
}

export function generateTypeOrmEntities(schema: Schema): Map<string, string> {
  const files = new Map<string, string>();

  for (const table of schema.tables) {
    const className = toPascalCase(table.name);
    files.set(`${className}.ts`, generateEntityClass(table));
  }

  // index.ts barrel
  const barrelLines = [
    `// Generated by SchemaViz — ${schema.database}`,
    ...schema.tables.map(t => {
      const name = toPascalCase(t.name);
      return `export { ${name} } from './${name}';`;
    }),
  ];
  files.set('index.ts', barrelLines.join('\n') + '\n');

  return files;
}
