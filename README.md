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

### Extract Schema

Extract database schema to JSON:

```bash
# Using YAML config
schemaviz extract -c examples/postgresql.yaml -o schema.json

# Using JSON config
schemaviz extract -c config.json -o schema.json
```

### Generate ER Diagram

Generate ER diagram from schema:

```bash
# Mermaid format (default)
schemaviz diagram -s schema.json -o er.md

# PlantUML format
schemaviz diagram -s schema.json -f plantuml -o er.puml

# Export to PNG
schemaviz diagram -s schema.json -o er.png

# Export to SVG
schemaviz diagram -s schema.json -o er.svg

# Export to PDF
schemaviz diagram -s schema.json -o er.pdf
```

### Compare Schemas

Compare two schemas and generate migration:

```bash
# Compare and show diff
schemaviz diff -s1 schema1.json -s2 schema2.json

# Generate migration SQL
schemaviz diff -s1 schema1.json -s2 schema2.json -m migration.sql
```

### Validate Schema

Validate schema against best practices:

```bash
# Validate and print report
schemaviz validate -s schema.json

# Output as JSON
schemaviz validate -s schema.json --format json

# Fail CI if warnings are found
schemaviz validate -s schema.json --fail-on-warning
```

Validation rules:

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

### GitHub Actions Integration

Add schema diff and validation to your PR workflow by copying the provided workflows:

```bash
cp -r .github/workflows/schema-diff.yml your-repo/.github/workflows/
cp -r .github/workflows/schema-validate.yml your-repo/.github/workflows/
```

When a PR modifies `schema.json`, the bot will automatically post a comment with:
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
│   ├── core/
│   │   ├── generator.ts      # Diagram generators
│   │   └── imageGenerator.ts # Image export (PNG/SVG/PDF)
│   ├── commands/          # CLI commands
│   │   ├── extract.ts
│   │   ├── diagram.ts
│   │   ├── diff.ts
│   │   └── validate.ts
│   ├── core/
│   │   ├── generator.ts      # Diagram generators
│   │   ├── imageGenerator.ts # Image export (PNG/SVG/PDF)
│   │   └── validator.ts      # Schema validation rules
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
- [ ] VS Code extension
- [ ] Interactive Web UI
- [ ] AI-powered schema optimization suggestions

## License

MIT
