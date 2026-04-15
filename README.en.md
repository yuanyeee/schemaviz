# SchemaViz (English)

> Other languages: [日本語](./README.ja.md) | [中文](./README.zh-CN.md)

SchemaViz is a TypeScript CLI tool for database schema extraction, visualization, validation, diffing, code generation, and snapshot history.

## Features (implementation-aligned)

- Schema extraction (`extract`) from PostgreSQL / MySQL / SQLite / SQL Server
- ER diagram generation (`diagram`) in Mermaid / PlantUML
- Image export (`.png`, `.svg`, `.pdf`) via Mermaid rendering
- Schema diff + migration SQL generation (`diff`)
- Schema validation (`validate`)
- Interactive web UI (`serve`)
- Code generation (`generate`) for Prisma / TypeORM / GraphQL
- Snapshot history (`snapshot` / `history`)

## Setup

```bash
git clone https://github.com/yuanyeee/schemaviz.git
cd schemaviz
npm install
npm run build
```

Run CLI:

```bash
node dist/index.js --help
# or
npm link
schemaviz --help
```

## Web Usage (important)

The `serve` command supports two modes.

### 1) Start with a schema file (skip login screen)

```bash
schemaviz serve -s schema.json -p 3000
# open http://localhost:3000
```

- Loads schema JSON at startup and opens the diagram view directly.
- Add `--watch` to reload schema file on each request.

### 2) Start without `-s` (use connection login screen)

```bash
schemaviz serve -p 3000
# open http://localhost:3000
```

- Shows a login screen to input DB connection information.
- After successful connection, it moves to the diagram view.

### `serve` options

- `-s, --schema <path>`: Preload schema JSON
- `-p, --port <port>`: Port (default `3000`)
- `-H, --host <host>`: Bind host (default `localhost`)
- `-w, --watch`: Reload schema for each request

### Main Web UI capabilities

- Mermaid / PlantUML toggle
- Validate / Generate / Snapshot / Diff panels
- Table search, table detail, SVG export, theme toggle, disconnect

## Common commands

```bash
schemaviz extract -c examples/postgresql.yaml -o schema.json
schemaviz diagram -s schema.json -o er.md
schemaviz validate -s schema.json
schemaviz diff -s1 schema_old.json -s2 schema_new.json -m migration.sql
schemaviz generate -s schema.json -f prisma -o schema.prisma
schemaviz snapshot -s schema.json -t v1
schemaviz history list
```

## Notes

- Image export depends on Puppeteer; some environments require extra Chromium setup.
- Migration SQL is generic and may require manual edits for DB-specific dialects.
