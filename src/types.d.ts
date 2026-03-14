declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }

  export interface Database {
    run(sql: string, params?: any[]): void;
    exec(sql: string): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  export interface Statement {
    bind(params?: any[]): boolean;
    step(): boolean;
    getAsObject(params?: any): any;
    free(): void;
  }

  export interface QueryExecResult {
    columns: string[];
    values: any[][];
  }

  export default function initSqlJs(config?: any): Promise<SqlJsStatic>;
}

declare module 'mssql' {
  export interface IConfig {
    server: string;
    port: number;
    database: string;
    user: string;
    password: string;
    options?: {
      encrypt?: boolean;
      trustServerCertificate?: boolean;
    };
  }

  export interface Pool {
    query(sql: string, params?: any): Promise<any>;
    close(): Promise<void>;
  }

  export function connect(config: IConfig): Promise<Pool>;
}
