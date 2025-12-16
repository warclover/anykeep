/**
 * V4.2 Migration Validation Script
 * 验证数据库迁移文件的正确性和依赖顺序
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import * as fs from "fs";
import * as path from "path";

interface MigrationInfo {
  filename: string;
  timestamp: string;
  description: string;
  tables: string[];
  columns: string[];
  dependencies: string[];
  issues: string[];
}

interface ValidationResult {
  valid: boolean;
  migrations: MigrationInfo[];
  errors: string[];
  warnings: string[];
}

// 迁移目录
const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

// V4.2 迁移文件模式
const V42_MIGRATION_PATTERN = /^20251211\d+_.*\.sql$/;

/**
 * 解析迁移文件
 */
function parseMigration(filename: string, content: string): MigrationInfo {
  const tables: string[] = [];
  const columns: string[] = [];
  const dependencies: string[] = [];
  const issues: string[] = [];

  // 提取时间戳
  const timestamp = filename.substring(0, 14);
  const description = filename.substring(15).replace(".sql", "");

  // 解析 CREATE TABLE
  const createTableMatches = content.matchAll(
    /CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?(\w+)/gi,
  );
  for (const match of createTableMatches) {
    tables.push(match[1]);
  }

  // 解析 ALTER TABLE ... ADD COLUMN
  const addColumnMatches = content.matchAll(
    /ALTER TABLE (?:public\.)?(\w+)\s+ADD COLUMN (?:IF NOT EXISTS )?(\w+)/gi,
  );
  for (const match of addColumnMatches) {
    columns.push(`${match[1]}.${match[2]}`);
  }

  // 解析 REFERENCES (依赖)
  const referencesMatches = content.matchAll(
    /REFERENCES (?:public\.)?(\w+)\(/gi,
  );
  for (const match of referencesMatches) {
    if (!tables.includes(match[1])) {
      dependencies.push(match[1]);
    }
  }

  // 检查常见问题
  if (content.includes("DROP TABLE") && !content.includes("IF EXISTS")) {
    issues.push("DROP TABLE without IF EXISTS - may fail on clean DB");
  }

  if (content.includes("DROP COLUMN") && !content.includes("IF EXISTS")) {
    issues.push("DROP COLUMN without IF EXISTS - may fail if column missing");
  }

  // 检查是否缺少 RLS
  if (
    content.includes("CREATE TABLE") &&
    !content.includes("ENABLE ROW LEVEL SECURITY")
  ) {
    const isSystemTable = tables.some((t) =>
      ["classification_outcomes", "folder_exclusions"].includes(t),
    );
    if (!isSystemTable) {
      issues.push("Table created without RLS enabled");
    }
  }

  return {
    filename,
    timestamp,
    description,
    tables,
    columns,
    dependencies,
    issues,
  };
}

/**
 * 验证迁移顺序
 */
function validateOrder(migrations: MigrationInfo[]): string[] {
  const errors: string[] = [];
  const definedTables = new Set<string>([
    // 预定义的现有表
    "auth.users",
    "bookmarks",
    "folders",
    "folder_profiles",
    "profiles",
    "user_preferences",
  ]);

  for (const migration of migrations) {
    // 检查依赖是否已定义
    for (const dep of migration.dependencies) {
      if (!definedTables.has(dep)) {
        errors.push(
          `${migration.filename}: References undefined table "${dep}"`,
        );
      }
    }

    // 添加本迁移定义的表
    for (const table of migration.tables) {
      definedTables.add(table);
    }
  }

  return errors;
}

/**
 * 验证迁移文件
 */
function validateMigrations(): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    migrations: [],
    errors: [],
    warnings: [],
  };

  // 获取所有 V4.2 迁移文件
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => V42_MIGRATION_PATTERN.test(f))
    .sort();

  console.log(`\n📁 Found ${files.length} V4.2 migration files:\n`);

  for (const file of files) {
    const filepath = path.join(MIGRATIONS_DIR, file);
    const content = fs.readFileSync(filepath, "utf-8");
    const info = parseMigration(file, content);
    result.migrations.push(info);

    console.log(`  ✓ ${file}`);
    if (info.tables.length > 0) {
      console.log(`    📋 Tables: ${info.tables.join(", ")}`);
    }
    if (info.columns.length > 0) {
      console.log(
        `    📝 Columns: ${info.columns.slice(0, 5).join(", ")}${info.columns.length > 5 ? "..." : ""}`,
      );
    }
    if (info.dependencies.length > 0) {
      console.log(`    🔗 Dependencies: ${info.dependencies.join(", ")}`);
    }
    if (info.issues.length > 0) {
      for (const issue of info.issues) {
        console.log(`    ⚠️ ${issue}`);
        result.warnings.push(`${file}: ${issue}`);
      }
    }
    console.log("");
  }

  // 验证顺序
  const orderErrors = validateOrder(result.migrations);
  result.errors.push(...orderErrors);

  if (result.errors.length > 0) {
    result.valid = false;
  }

  return result;
}

/**
 * 生成验证报告
 */
function generateReport(result: ValidationResult): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 MIGRATION VALIDATION REPORT");
  console.log("=".repeat(60));

  console.log(`\n📁 Total migrations: ${result.migrations.length}`);

  const totalTables = result.migrations.reduce(
    (sum, m) => sum + m.tables.length,
    0,
  );
  const totalColumns = result.migrations.reduce(
    (sum, m) => sum + m.columns.length,
    0,
  );

  console.log(`📋 New tables: ${totalTables}`);
  console.log(`📝 New columns: ${totalColumns}`);

  if (result.errors.length > 0) {
    console.log(`\n❌ ERRORS (${result.errors.length}):`);
    for (const error of result.errors) {
      console.log(`   - ${error}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log(`\n⚠️ WARNINGS (${result.warnings.length}):`);
    for (const warning of result.warnings) {
      console.log(`   - ${warning}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  if (result.valid) {
    console.log("✅ VALIDATION PASSED - All migrations are valid");
  } else {
    console.log("❌ VALIDATION FAILED - Please fix errors before deploying");
  }
  console.log("=".repeat(60) + "\n");
}

// 执行验证
const result = validateMigrations();
generateReport(result);

// 退出码
process.exit(result.valid ? 0 : 1);
