# SchemaViz

Database ER diagram generator and schema diff tool.

## Features

- 📊 Generate ER diagrams from database schema
- 🔄 Compare schemas and show differences
- 📝 Generate migration scripts
- 🖼️ Export to Mermaid, PNG, SVG

## Installation

```bash
npm install -g schemaviz
```

## Usage

```bash
# Extract schema from database
schemaviz extract -c db.yaml -o schema.json

# Generate ER diagram
schemaviz diagram -s schema.json -f mermaid -o er.md

# Compare two schemas
schemaviz diff -s1 schema1.json -s2 schema2.json
```

## Supported Databases

- PostgreSQL
- MySQL
- SQLite
- SQL Server

## License

MIT
