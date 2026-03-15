import * as fs from 'fs';
import * as path from 'path';
import { Schema } from '../types';
import { generatePrismaSchema } from '../core/codegen/prisma';
import { generateTypeOrmEntities } from '../core/codegen/typeorm';
import { generateGraphQLSchema } from '../core/codegen/graphql';

type GenerateFormat = 'prisma' | 'typeorm' | 'graphql';

interface GenerateOptions {
  schema: string;
  format: GenerateFormat;
  output: string;
}

const FORMAT_DESCRIPTIONS: Record<GenerateFormat, string> = {
  prisma: 'Prisma schema (.prisma)',
  typeorm: 'TypeORM entity classes (TypeScript)',
  graphql: 'GraphQL SDL (.graphql)',
};

export async function generate(options: GenerateOptions) {
  const schema: Schema = JSON.parse(fs.readFileSync(options.schema, 'utf-8'));

  console.log(`Generating ${FORMAT_DESCRIPTIONS[options.format]} from schema: ${schema.database}`);

  switch (options.format) {
    case 'prisma': {
      const content = generatePrismaSchema(schema);
      const outPath = options.output || 'schema.prisma';
      fs.writeFileSync(outPath, content, 'utf-8');
      console.log(`Prisma schema written to: ${outPath}`);
      console.log(`  ${schema.tables.length} models generated`);
      break;
    }

    case 'typeorm': {
      const files = generateTypeOrmEntities(schema);
      const outDir = options.output || './entities';
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      for (const [filename, content] of files) {
        const filePath = path.join(outDir, filename);
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`  Written: ${filePath}`);
      }
      console.log(`TypeORM entities written to: ${outDir}`);
      console.log(`  ${schema.tables.length} entity classes + index.ts`);
      break;
    }

    case 'graphql': {
      const content = generateGraphQLSchema(schema);
      const outPath = options.output || 'schema.graphql';
      fs.writeFileSync(outPath, content, 'utf-8');
      console.log(`GraphQL SDL written to: ${outPath}`);
      console.log(`  ${schema.tables.length} types + Query + Mutation`);
      break;
    }

    default:
      console.error(`Unknown format: ${options.format}`);
      console.error('Supported formats: prisma, typeorm, graphql');
      process.exit(1);
  }
}
