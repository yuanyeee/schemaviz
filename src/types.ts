export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

export interface Index {
  name: string;
  columns: string[];
  isUnique: boolean;
}

export interface ForeignKey {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
}

export interface Table {
  name: string;
  columns: Column[];
  indexes: Index[];
  foreignKeys: ForeignKey[];
}

export interface Schema {
  database: string;
  tables: Table[];
  generatedAt: string;
}

export interface TableDiff {
  name: string;
  type: 'added' | 'removed' | 'modified';
  columns?: ColumnDiff[];
}

export interface ColumnDiff {
  name: string;
  type: 'added' | 'removed' | 'modified';
  oldType?: string;
  newType?: string;
  oldNullable?: boolean;
  newNullable?: boolean;
}

export interface SchemaDiff {
  added: Table[];
  removed: Table[];
  modified: TableDiff[];
}

export type DatabaseType = 'postgresql' | 'mysql' | 'sqlite' | 'sqlserver';

export interface DatabaseConfig {
  type: DatabaseType;
  host?: string;
  port?: number;
  database: string;
  user?: string;
  password?: string;
  filename?: string; // For SQLite
}
