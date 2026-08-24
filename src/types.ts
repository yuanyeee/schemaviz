export interface Column {
  name: string;
  /** Base type name (e.g. "varchar", "character varying"); parameters live in length/precision/scale. */
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  /** Character maximum length (e.g. varchar(255) -> 255). */
  length?: number;
  /** Numeric precision (e.g. decimal(10,2) -> 10). */
  precision?: number;
  /** Numeric scale (e.g. decimal(10,2) -> 2). */
  scale?: number;
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
  /** Dialect of the database this schema was extracted from (set by adapters; absent in older files). */
  type?: DatabaseType;
  tables: Table[];
  generatedAt: string;
}

export interface TableDiff {
  name: string;
  type: 'added' | 'removed' | 'modified';
  columns?: ColumnDiff[];
  /** Index changes within this table. */
  indexes?: IndexDiff[];
  /** Foreign key changes within this table. */
  foreignKeys?: ForeignKeyDiff[];
}

export interface IndexDiff {
  name: string;
  type: 'added' | 'removed' | 'modified';
  /** Current columns ('added'/'modified') or previous columns ('removed'). */
  columns?: string[];
  /** Current uniqueness ('added'/'modified') or previous ('removed'). */
  isUnique?: boolean;
  /** Previous definition (set for 'modified'). */
  oldColumns?: string[];
  oldIsUnique?: boolean;
}

export interface ForeignKeyDiff {
  name: string;
  type: 'added' | 'removed' | 'modified';
  /** Current definition ('added'/'modified') or previous ('removed'). */
  columns?: string[];
  referencedTable?: string;
  referencedColumns?: string[];
  /** Previous definition (set for 'modified'). */
  oldColumns?: string[];
  oldReferencedTable?: string;
  oldReferencedColumns?: string[];
}

export interface ColumnDiff {
  name: string;
  type: 'added' | 'removed' | 'modified';
  oldType?: string;
  newType?: string;
  oldNullable?: boolean;
  newNullable?: boolean;
  /** Definition of the column before the change (set for 'removed' / 'modified'). */
  oldDefault?: string;
  /** Definition of the column after the change (set for 'added' / 'modified'). */
  newDefault?: string;
  oldLength?: number;
  newLength?: number;
  oldPrecision?: number;
  newPrecision?: number;
  oldScale?: number;
  newScale?: number;
}

export interface SchemaDiff {
  added: Table[];
  removed: Table[];
  modified: TableDiff[];
}

export type DatabaseType = 'postgresql' | 'mysql' | 'sqlite' | 'sqlserver';

export type DiagramFormat = 'mermaid' | 'plantuml';

export interface DatabaseConfig {
  type: DatabaseType;
  host?: string;
  port?: number;
  database: string;
  user?: string;
  password?: string;
  filename?: string; // For SQLite
  instanceName?: string; // SQL Server named instance
  authType?: string; // 'sql' | 'windows' (SQL Server)
  domain?: string; // Windows auth domain (SQL Server)
  ssl?: string | boolean;
  connectionTimeout?: number;
}
