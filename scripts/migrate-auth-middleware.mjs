/**
 * Migration script: Convert API routes to use withAuthMiddleware
 *
 * This script applies the migration pattern to all remaining unmigrated files.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = 'C:/anykeep';

const files = [
  'src/app/api/knowledge-studio/billing/usage/route.ts',
  'src/app/api/knowledge-studio/conversion/analytics/route.ts',
  'src/app/api/knowledge-studio/conversion/events/route.ts',
  'src/app/api/knowledge-studio/conversion/prompts/route.ts',
  'src/app/api/knowledge-studio/conversion/trial/route.ts',
  'src/app/api/knowledge-studio/generate/route.ts',
  'src/app/api/knowledge-studio/mastery/review/route.ts',
  'src/app/api/knowledge-studio/mastery/route.ts',
  'src/app/api/knowledge-studio/mastery/sessions/[id]/route.ts',
  'src/app/api/knowledge-studio/mastery/sessions/route.ts',
  'src/app/api/knowledge-studio/materials/route.ts',
  'src/app/api/knowledge-studio/quota/route.ts',
  'src/app/api/knowledge-studio/reports/[id]/edit/route.ts',
  'src/app/api/knowledge-studio/reports/[id]/route.ts',
  'src/app/api/knowledge-studio/reports/route.ts',
  'src/app/api/knowledge-studio/templates/[id]/clone/route.ts',
  'src/app/api/knowledge-studio/templates/[id]/route.ts',
  'src/app/api/knowledge-studio/templates/route.ts',
  'src/app/api/knowledge-studio/v2/adapt-style/route.ts',
  'src/app/api/knowledge-studio/v2/blueprints/route.ts',
  'src/app/api/knowledge-studio/v2/briefing/route.ts',
  'src/app/api/knowledge-studio/v2/condense/route.ts',
  'src/app/api/knowledge-studio/v2/generate/route.ts',
  'src/app/api/knowledge-studio/v2/iterate/route.ts',
  'src/app/api/knowledge-studio/v2/outline/route.ts',
  'src/app/api/knowledge-studio/v2/recommendations/blueprints/route.ts',
  'src/app/api/knowledge-studio/v2/recommendations/materials/route.ts',
  'src/app/api/knowledge-studio/v2/tts/route.ts',
  'src/app/api/knowledge-studio/v2/usage/record/route.ts',
  'src/app/api/md-collections/[id]/highlights/[highlightId]/route.ts',
  'src/app/api/md-collections/[id]/highlights/route.ts',
  'src/app/api/md-collections/[id]/process/route.ts',
  'src/app/api/md-collections/[id]/route.ts',
  'src/app/api/md-collections/batch-status/route.ts',
  'src/app/api/md-collections/check-duplicate/route.ts',
  'src/app/api/md-collections/route.ts',
  'src/app/api/md-collections/search/route.ts',
  'src/app/api/md-collections/upload/route.ts',
];

/**
 * Core migration logic for each file
 */
function migrateFile(filePath) {
  let content = readFileSync(filePath, 'utf8');

  // Skip if already migrated
  if (content.includes('withAuthMiddleware')) {
    console.log(`SKIP (already migrated): ${filePath}`);
    return false;
  }

  // Step 1: Add withAuthMiddleware import
  if (content.includes('import { withAuthMiddleware }')) {
    // Already has import
  } else {
    // Add import after the last import line
    // Find if there's an existing middleware import line to add after
    const importInsertPoint = findImportInsertPoint(content);
    content = content.slice(0, importInsertPoint) +
      'import { withAuthMiddleware } from "@/lib/api/middleware";\n' +
      content.slice(importInsertPoint);
  }

  // Step 2: Remove unauthorizedError from imports if it exists
  content = content.replace(
    /,\s*unauthorizedError/g,
    ''
  );
  content = content.replace(
    /unauthorizedError,\s*/g,
    ''
  );
  // Handle case where it's the only import or first
  content = content.replace(
    /\{\s*unauthorizedError\s*\}/g,
    '{}'
  );

  // Step 3: Remove getCachedUser import if present
  content = content.replace(
    /import\s*\{[^}]*getCachedUser[^}]*\}\s*from\s*['"@][^'"]+['"];\n?/g,
    (match) => {
      // If getCachedUser is the only import, remove the whole line
      const cleaned = match.replace(/,?\s*getCachedUser\s*,?/, (m) => m.startsWith(',') ? '' : '');
      if (cleaned.match(/\{\s*\}/)) return '';
      return cleaned;
    }
  );

  // Step 4: Detect route params pattern
  const hasRouteParams = detectRouteParams(content);

  // Step 5: Transform each exported handler
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

  for (const method of methods) {
    content = transformHandler(content, method, hasRouteParams, filePath);
  }

  // Step 6: Remove local RouteContext/RouteParams interfaces that are no longer needed
  // Only remove if they were simple { params: Promise<...> } patterns
  content = content.replace(
    /interface Route(?:Context|Params)\s*\{[\s\S]*?params:\s*Promise<\{[^}]+\}>\s*;?\s*\}\n*/g,
    ''
  );

  // Clean up empty import braces
  content = content.replace(/import\s*\{\s*\}\s*from\s*['"][^'"]+['"];\n?/g, '');

  writeFileSync(filePath, content, 'utf8');
  console.log(`MIGRATED: ${filePath}`);
  return true;
}

function findImportInsertPoint(content) {
  // Find the position after the last import statement
  const importRegex = /^import\s+.*?;\s*$/gm;
  let lastImportEnd = 0;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    lastImportEnd = match.index + match[0].length;
  }
  // Find the next newline after last import
  const nextNewline = content.indexOf('\n', lastImportEnd);
  return nextNewline !== -1 ? nextNewline + 1 : lastImportEnd;
}

function detectRouteParams(content) {
  // Check for { params } or context.params patterns
  return /\{\s*params\s*\}/.test(content) || /context\.params/.test(content);
}

function transformHandler(content, method, hasRouteParams, filePath) {
  // Pattern 1: export async function METHOD(request: NextRequest, { params }: RouteParams/RouteContext)
  // Pattern 2: export async function METHOD(request: NextRequest, context: RouteContext)
  // Pattern 3: export async function METHOD(request: NextRequest)
  // Pattern 4: export async function METHOD(_request: NextRequest)
  // Pattern 5: export async function METHOD() - no params at all

  // Try to find the function declaration
  const patterns = [
    // With { params } destructuring and type annotation
    new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(\\s*(\\w+):\\s*NextRequest\\s*,\\s*\\{\\s*params\\s*\\}\\s*:\\s*(?:Route(?:Params|Context)|\\{\\s*params:\\s*Promise<\\{[^}]+\\}>\\s*\\})\\s*\\)\\s*(?::\\s*Promise<[^{]+>)?\\s*\\{`),
    // With context parameter
    new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(\\s*(\\w+):\\s*NextRequest\\s*,\\s*(\\w+):\\s*Route(?:Context|Params)\\s*\\)\\s*(?::\\s*Promise<[^{]+>)?\\s*\\{`),
    // Just request parameter
    new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(\\s*(\\w+):\\s*NextRequest\\s*\\)\\s*(?::\\s*Promise<[^{]+>)?\\s*\\{`),
    // No parameters at all
    new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(\\s*\\)\\s*(?::\\s*Promise<[^{]+>)?\\s*\\{`),
  ];

  for (let pi = 0; pi < patterns.length; pi++) {
    const pat = patterns[pi];
    const match = content.match(pat);
    if (!match) continue;

    const fullMatch = match[0];
    const startIdx = match.index;

    // Find the matching closing brace for the function
    const bodyStart = startIdx + fullMatch.length;
    const closingBraceIdx = findMatchingBrace(content, bodyStart - 1);
    if (closingBraceIdx === -1) {
      console.warn(`  Could not find closing brace for ${method} in ${filePath}`);
      continue;
    }

    const funcBody = content.slice(bodyStart, closingBraceIdx);

    // Determine if request is used in the body
    const requestParam = match[1] || 'request';
    const requestUsed = requestParam !== '_request' && isParamUsedInBody(funcBody, requestParam === '_request' ? 'request' : requestParam);
    const requestParamName = (requestParam === '_request' || !requestUsed) ? '_request' : 'request';

    // Process the function body
    let newBody = funcBody;

    // Remove auth block patterns
    newBody = removeAuthBlock(newBody);

    // Replace user.id with userId
    newBody = newBody.replace(/\buser\.id\b/g, 'userId');

    // Remove outer try/catch if it wraps the entire body
    newBody = removeOuterTryCatch(newBody);

    // Determine params type
    let paramsType = '';
    let paramsDestructure = '';

    if (pi === 0) {
      // { params } destructuring pattern - extract param type from the original interface or inline type
      const paramTypeMatch = content.match(/params:\s*Promise<(\{[^}]+\})>/);
      if (paramTypeMatch) {
        paramsType = paramTypeMatch[1];
      }
      paramsDestructure = ', { userId, params }';
    } else if (pi === 1) {
      // context parameter - replace context.params with params from context
      const contextName = match[2];
      // Replace context.params references
      newBody = newBody.replace(new RegExp(`${contextName}\\.params`, 'g'), 'params');
      // Extract params type
      const paramTypeMatch = content.match(/params:\s*Promise<(\{[^}]+\})>/);
      if (paramTypeMatch) {
        paramsType = paramTypeMatch[1];
      }
      paramsDestructure = ', { userId, params }';
    } else if (pi === 2 || pi === 3) {
      paramsDestructure = ', { userId }';
    }

    // Build the new handler
    let typeParam = '';
    if (paramsType) {
      typeParam = `<${paramsType}>`;
    }

    // Check if there's a return type annotation
    let returnType = '';
    const returnTypeMatch = fullMatch.match(/\)\s*:\s*(Promise<[^{]+>)\s*\{/);
    if (returnTypeMatch) {
      returnType = `: ${returnTypeMatch[1]}`;
    }

    const newHandler = `export const ${method} = withAuthMiddleware${typeParam}(async (${requestParamName}${paramsDestructure})${returnType} => {${newBody}});`;

    content = content.slice(0, startIdx) + newHandler + content.slice(closingBraceIdx + 1);
    break; // Only transform once per method
  }

  return content;
}

function isParamUsedInBody(body, paramName) {
  // Check if the parameter name appears in the body (not in comments)
  const regex = new RegExp(`\\b${paramName}\\b`);
  return regex.test(body);
}

function removeAuthBlock(body) {
  // Pattern 1: const supabase = await createClient(); + auth.getUser() + if check
  // We keep createClient() if used elsewhere for DB operations

  // Remove the auth block: supabase.auth.getUser() + if (!user) check
  // This handles various patterns:

  // Remove: const { data: { user }, error: authError } = await supabase.auth.getUser();
  body = body.replace(
    /\s*const\s*\{\s*data:\s*\{\s*user\s*\}\s*(?:,\s*(?:error:\s*\w+))?\s*\}\s*=\s*await\s*supabase\.auth\.getUser\(\);\s*/g,
    '\n'
  );

  // Also handle: const { data: { user } } = await supabase.auth.getUser();
  body = body.replace(
    /\s*const\s*\{\s*data:\s*\{\s*user\s*\}\s*\}\s*=\s*await\s*supabase\.auth\.getUser\(\);\s*/g,
    '\n'
  );

  // Remove auth error check blocks - various patterns
  // Pattern: if (authError || !user) { return ... }
  body = body.replace(
    /\s*if\s*\(\s*(?:authError\s*\|\|\s*)?!user\s*\)\s*\{[\s\S]*?(?:return\s+(?:NextResponse\.json|new\s+Response|unauthorizedError)\s*\([^)]*(?:\{[^}]*\}[^)]*)*\)\s*;?\s*)\s*\}\s*/g,
    '\n'
  );

  // Pattern: if (authError || !user) { return ... } (with nested objects)
  body = body.replace(
    /\s*if\s*\(\s*authError\s*\|\|\s*!user\s*\)\s*\{[^}]*return[^}]*\}\s*/g,
    '\n'
  );

  return body;
}

function removeOuterTryCatch(body) {
  // Check if body starts with try { and ends with catch block
  const trimmed = body.trim();
  if (!trimmed.startsWith('try {')) return body;

  // Find the try block
  const tryStart = trimmed.indexOf('{');
  const tryCatchEnd = findMatchingBrace(trimmed, tryStart);
  if (tryCatchEnd === -1) return body;

  // Check if after the try block there's a catch
  const afterTry = trimmed.slice(tryCatchEnd + 1).trim();
  if (!afterTry.startsWith('catch')) return body;

  // Check if catch block goes to the end
  const catchBraceStart = afterTry.indexOf('{');
  if (catchBraceStart === -1) return body;

  const catchContent = afterTry.slice(catchBraceStart);
  const catchEnd = findMatchingBrace(catchContent, 0);
  if (catchEnd === -1) return body;

  const afterCatch = catchContent.slice(catchEnd + 1).trim();

  // Only remove if this try/catch wraps the entire body
  if (afterCatch.length === 0) {
    // Extract the try block body
    const tryBody = trimmed.slice(tryStart + 1, tryCatchEnd);
    return tryBody;
  }

  return body;
}

function findMatchingBrace(str, openBraceIdx) {
  let depth = 1;
  for (let i = openBraceIdx + 1; i < str.length; i++) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
    // Skip strings
    if (str[i] === '"' || str[i] === "'" || str[i] === '`') {
      const quote = str[i];
      i++;
      while (i < str.length && str[i] !== quote) {
        if (str[i] === '\\') i++;
        i++;
      }
    }
  }
  return -1;
}

// Run migration
let migrated = 0;
let skipped = 0;
let failed = 0;

for (const f of files) {
  const fullPath = resolve(ROOT, f);
  try {
    const result = migrateFile(fullPath);
    if (result) migrated++;
    else skipped++;
  } catch (e) {
    console.error(`FAILED: ${f} - ${e.message}`);
    failed++;
  }
}

console.log(`\nDone: ${migrated} migrated, ${skipped} skipped, ${failed} failed`);
