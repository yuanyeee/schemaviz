# SchemaViz

Database ER diagram generator and schema diff tool for developers.

![npm version](https://img.shields.io/npm/v/schemaviz)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

## Quick Setup

```bash
# 1. Clone
git clone https://github.com/yuanyeee/schemaviz.git
cd schemaviz

# 2. Install & Build
npm install
npm run build

# 3. Use CLI
./dist/index.js extract -c examples/postgresql.yaml -o schema.json
./dist/index.js diagram -s schema.json -o er.md
./dist/index.js diff -s1 schema1.json -s2 schema2.json
```

## Features

- 📊 **Generate ER diagrams** from database schema
- 🔄 **Compare schemas** and show differences
- 📝 **Generate migration scripts** with rollback support
- 🖼️ **Export to multiple formats**: Mermaid, PlantUML, PNG, SVG, PDF
- 🗄️ **Support multiple databases**: PostgreSQL, MySQL, SQLite, SQL Server
- ✅ **Validate schema** against best practices (missing PKs, FK indexes, email uniqueness, etc.)
- 🌐 **Interactive Web UI** — pan/zoom ER diagram, table search & detail view in browser
- ⚙️ **Code generation** — Prisma schema, TypeORM entities, GraphQL SDL from schema
- 📚 **Schema history** — snapshot versioning with tag-based diff and rollback
- 🤖 **GitHub Actions integration** for automatic schema review on PRs

## Installation

```bash
# Clone the repository
git clone https://github.com/yuanyeee/schemaviz.git
cd schemaviz

# Install dependencies
npm install

# Build
npm run build
```

## Usage

> **Invoking the CLI**
>
> After cloning and building, you can run commands in either of two ways:
> ```bash
> # Option A: direct path (always works)
> ./dist/index.js <command>
>
> # Option B: link globally once, then use the short alias
> npm link
> schemaviz <command>
> ```
> The examples below use `schemaviz` for readability (Option B).

### Typical Workflow

```
Database ──extract──► schema.json ──diagram──► er.md / er.png
                           │
                           ├──validate──► best-practice report
                           ├──diff──────► migration SQL
                           ├──generate──► Prisma / TypeORM / GraphQL
                           └──snapshot──► version history
```

---

### `extract` — Extract Schema from Database

Connects to a database and saves the schema to a JSON file.

```bash
schemaviz extract -c <config> -o <output>
```

| Option | Required | Description |
|--------|----------|-------------|
| `-c, --config <path>` | Yes | Database config file (YAML or JSON) |
| `-o, --output <path>` | Yes | Output schema file path (JSON) |

```bash
# PostgreSQL
schemaviz extract -c examples/postgresql.yaml -o schema.json

# SQLite
schemaviz extract -c examples/sqlite.yaml -o schema.json
```

---

### `diagram` — Generate ER Diagram

Generates an ER diagram from a schema JSON file.

```bash
schemaviz diagram -s <schema> [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `-s, --schema <path>` | (required) | Schema file path (JSON) |
| `-f, --format <format>` | `mermaid` | Output format: `mermaid` or `plantuml` |
| `-o, --output <path>` | — | Output file path (extension determines format) |

The output format is determined by the file extension when using `-o`:

| Extension | Format |
|-----------|--------|
| `.md` | Mermaid markdown |
| `.puml` | PlantUML |
| `.png` | PNG image (via Puppeteer) |
| `.svg` | SVG vector image |
| `.pdf` | PDF document |

```bash
# Mermaid markdown (default)
schemaviz diagram -s schema.json -o er.md

# PlantUML
schemaviz diagram -s schema.json -f plantuml -o er.puml

# PNG / SVG / PDF (requires Chrome/Chromium)
schemaviz diagram -s schema.json -o er.png
schemaviz diagram -s schema.json -o er.svg
schemaviz diagram -s schema.json -o er.pdf
```

---

### `diff` — Compare Two Schemas

Compares two schema files and optionally generates migration SQL.

```bash
schemaviz diff -s1 <schema1> -s2 <schema2> [options]
```

| Option | Description |
|--------|-------------|
| `-s1, --schema1 <path>` | (required) First (old) schema file |
| `-s2, --schema2 <path>` | (required) Second (new) schema file |
| `-o, --output <path>` | Save diff result as JSON |
| `-m, --migration <path>` | Save migration SQL to file |

```bash
# Show diff in terminal
schemaviz diff -s1 schema_old.json -s2 schema_new.json

# Generate migration SQL
schemaviz diff -s1 schema_old.json -s2 schema_new.json -m migration.sql

# Save diff as JSON and generate migration
schemaviz diff -s1 schema_old.json -s2 schema_new.json -o diff.json -m migration.sql
```

---

### `validate` — Validate Schema

Checks the schema against database best practices and reports issues.

```bash
schemaviz validate -s <schema> [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `-s, --schema <path>` | (required) | Schema file path (JSON) |
| `-f, --format <format>` | `text` | Output format: `text` or `json` |
| `-o, --output <path>` | — | Save report to file |
| `--fail-on-warning` | `false` | Exit with code 1 if any warnings exist (useful in CI) |

```bash
# Print text report
schemaviz validate -s schema.json

# Output as JSON (for CI parsing)
schemaviz validate -s schema.json -f json

# Fail CI pipeline on warnings
schemaviz validate -s schema.json --fail-on-warning

# Save report to file
schemaviz validate -s schema.json -o report.txt
```

**Validation rules:**

| Rule | Level | Description |
|------|-------|-------------|
| `no-primary-key` | Error | Table has no primary key |
| `no-columns` | Error | Table has no columns |
| `fk-missing-index` | Warning | Foreign key column has no index |
| `email-not-unique` | Warning | `email` column has no unique index |
| `id-column-missing-fk` | Warning | `*_id` column with no FK constraint |
| `nullable-id-column` | Warning | ID column is nullable |
| `duplicate-index` | Warning | Multiple indexes on the same columns |
| `missing-timestamps` | Info | No `created_at`/`updated_at` columns |

---

### `serve` — Interactive Web UI

Starts a local web server with an interactive ER diagram viewer.

```bash
schemaviz serve [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `-s, --schema <path>` | — | Schema JSON to load directly (skips login UI) |
| `-p, --port <port>` | `3000` | Port to listen on |
| `-H, --host <host>` | `localhost` | Host to bind to |
| `-w, --watch` | `false` | Reload schema on every request |

**Method 1 — Connect via login screen (recommended)**

```bash
# Start server (opens http://localhost:3000 automatically)
schemaviz serve

# Custom port
schemaviz serve -p 8080

# Accessible from other machines on the network
schemaviz serve -H 0.0.0.0 -p 3000
```

Enter your database connection details in the SSMS-style login dialog:

| Field | Description |
|-------|-------------|
| Server type | PostgreSQL / MySQL / SQL Server / SQLite |
| Server name | Hostname or IP (e.g. `localhost`) |
| Port | Auto-filled by server type |
| Authentication | Username and password |
| Database | Target database name (optional) |

Click **Connect** to view the ER diagram. Use the **Disconnect** button in the header to return to the login screen.

**Method 2 — Load schema JSON directly (skips login)**

```bash
# Extract schema first
schemaviz extract -c examples/postgresql.yaml -o schema.json

# Start server with schema pre-loaded
schemaviz serve -s schema.json

# Auto-reload on file changes
schemaviz serve -s schema.json --watch
```

**Web UI features:**

- Login screen (SSMS-style)
  - Switch between PostgreSQL / MySQL / SQL Server / SQLite
  - Error message on connection failure
  - Light/Dark theme toggle
- ER diagram screen
  - Zoom with mouse wheel (Ctrl+scroll) or buttons
  - Table search sidebar (`Ctrl+K`)
  - Click a table to view columns, indexes, and FK details
  - Copy Mermaid code or download SVG
  - Light/Dark theme toggle
  - **Disconnect** button to return to login screen
- **✔ Validate panel** — run best-practice checks, view issues by table and severity
- **⚙ Generate panel** — generate Prisma / TypeORM / GraphQL code with one click and copy to clipboard
- **📷 Snapshot panel** — save the current schema as a named snapshot, browse and delete snapshots
- **⟺ Diff panel** — compare any two snapshots (or current schema vs snapshot), view added/removed/modified tables and migration SQL

---

### `generate` — Code Generation

Generates ORM schema or GraphQL SDL from the extracted schema.

```bash
schemaviz generate -s <schema> -f <format> [options]
```

| Option | Description |
|--------|-------------|
| `-s, --schema <path>` | (required) Schema file path (JSON) |
| `-f, --format <format>` | (required) `prisma`, `typeorm`, or `graphql` |
| `-o, --output <path>` | Output file or directory path |

```bash
# Prisma schema
schemaviz generate -s schema.json -f prisma -o schema.prisma

# TypeORM entity classes (outputs to directory)
schemaviz generate -s schema.json -f typeorm -o ./entities

# GraphQL SDL
schemaviz generate -s schema.json -f graphql -o schema.graphql
```

---

### `snapshot` / `history` — Schema Versioning

Save schema snapshots and compare across versions.

```bash
# Save a snapshot with an optional tag
schemaviz snapshot -s schema.json -t "v1.0-release"

# Save to a custom directory
schemaviz snapshot -s schema.json -t "v1.0-release" -d ./snapshots
```

| `snapshot` option | Default | Description |
|-------------------|---------|-------------|
| `-s, --schema <path>` | (required) | Schema file to snapshot |
| `-t, --tag <tag>` | — | Human-readable label |
| `-d, --dir <dir>` | `.` | Directory to store snapshots |

```bash
# List all snapshots
schemaviz history list

# List as JSON
schemaviz history list --json

# Show snapshot detail (by tag or ID prefix)
schemaviz history show v1.0-release

# Compare a snapshot to current schema
schemaviz diff -s1 .schemaviz/snapshots/<id>.json -s2 schema.json

# Delete a snapshot
schemaviz history delete v1.0-release
```

---

### GitHub Actions Integration

Add schema diff and validation to your PR workflow by copying the provided workflows:

```bash
cp -r .github/workflows/schema-diff.yml your-repo/.github/workflows/
cp -r .github/workflows/schema-validate.yml your-repo/.github/workflows/
```

When a PR modifies `schema.json`, the bot automatically posts a comment with:
- Validation results (errors, warnings, improvement suggestions)
- Schema diff (added/removed/modified tables and columns)
- Migration SQL (expandable)

## Configuration

### PostgreSQL

```yaml
type: postgresql
host: localhost
port: 5432
database: myapp
user: postgres
password: mypassword
```

### MySQL

```yaml
type: mysql
host: localhost
port: 3306
database: myapp
user: root
password: mypassword
```

### SQLite

```yaml
type: sqlite
filename: ./myapp.db
```

### SQL Server

```yaml
type: sqlserver
host: localhost
port: 1433
database: myapp
user: sa
password: mypassword
```

## Commands

| Command | Description |
|---------|-------------|
| `extract` | Extract schema from database |
| `diagram` | Generate ER diagram from schema |
| `diff` | Compare two schemas |
| `validate` | Validate schema against best practices |
| `serve` | Interactive ER diagram in browser |
| `generate` | Generate Prisma / TypeORM / GraphQL code |
| `snapshot` | Save a schema snapshot |
| `history list` | List all snapshots |
| `history show <ref>` | Show a snapshot |
| `history delete <ref>` | Delete a snapshot |

### Diagram Output Formats

| Format | Description |
|--------|-------------|
| `mermaid` | Mermaid markdown (default) |
| `plantuml` | PlantUML format |
| `.png` | PNG image (via Puppeteer) |
| `.svg` | SVG vector image |
| `.pdf` | PDF document |

## Development

```bash
# Run tests
npm test

# Build
npm run build

# Run in development mode
npm run dev
```

## Project Structure

```
schemaviz/
├── src/
│   ├── index.ts           # CLI entry point
│   ├── types.ts           # TypeScript types
│   ├── commands/          # CLI commands
│   │   ├── extract.ts
│   │   ├── diagram.ts
│   │   ├── diff.ts
│   │   ├── validate.ts
│   │   ├── serve.ts
│   │   ├── generate.ts
│   │   └── snapshot.ts
│   ├── core/
│   │   ├── generator.ts      # Diagram generators (Mermaid / PlantUML)
│   │   ├── imageGenerator.ts # Image export (PNG/SVG/PDF via Puppeteer)
│   │   ├── validator.ts      # Schema validation rules
│   │   ├── diff.ts           # Schema diff and migration SQL logic
│   │   ├── webServer.ts      # Interactive Web UI server
│   │   ├── history.ts        # Snapshot versioning
│   │   └── codegen/
│   │       ├── prisma.ts     # Prisma schema generator
│   │       ├── typeorm.ts    # TypeORM entity generator
│   │       └── graphql.ts    # GraphQL SDL generator
│   └── adapters/          # Database adapters
│       ├── base.ts
│       ├── postgresql.ts
│       ├── mysql.ts
│       ├── sqlite.ts
│       └── sqlserver.ts
├── tests/                 # Test files
├── examples/              # Configuration examples
└── package.json
```

## Roadmap

- [x] PostgreSQL support
- [x] MySQL support
- [x] SQLite support
- [x] SQL Server support
- [x] Mermaid export
- [x] PlantUML export
- [x] PNG/SVG/PDF export
- [x] Schema validation (best practices linting)
- [x] GitHub Actions for CI/CD (schema diff + validate on PRs)
- [x] Interactive Web UI (schemaviz serve)
- [x] Code generation: Prisma / TypeORM / GraphQL
- [x] Schema history / snapshot versioning
- [ ] VS Code extension
- [ ] AI-powered schema optimization suggestions (Claude API)

## License

MIT
