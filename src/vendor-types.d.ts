// Ambient declarations for packages that ship no type definitions.
// (mssql types come from @types/mssql devDependency.)
// NOTE: named vendor-types.d.ts — a `types.d.ts` next to `types.ts` is shadowed
// by the .ts file and never loaded by tsc.
declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }

  export interface Database {
    run(sql: string, params?: unknown[]): void;
    exec(sql: string): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  export interface Statement {
    bind(params?: unknown[]): boolean;
    step(): boolean;
    getAsObject(params?: unknown): Record<string, unknown>;
    free(): void;
  }

  export interface QueryExecResult {
    columns: string[];
    values: unknown[][];
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string;
  }): Promise<SqlJsStatic>;
}
