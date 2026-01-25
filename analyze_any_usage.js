const fs = require('fs');
const path = require('path');

const grepOutputFile = String.raw`C:\Users\xiafe\.claude\projects\c--anykeep\bd1206b9-0384-4b75-be8d-a8dd630dcaea\tool-results\Grep-Alk69hSQ.txt`;

try {
  const content = fs.readFileSync(grepOutputFile, 'utf8');
  const lines = content.split('\n');

  let prodCount = 0;
  let testCount = 0;
  const prodFiles = [];

  const testPatterns = [
    '__tests__',
    '.test.ts',
    '.spec.ts',
    '.test.tsx',
    '.spec.tsx'
  ];

  for (const line of lines) {
    if (!line.trim()) continue;

    // The grep output format depends on the tool, but looking at the Read output:
    // It seems to be "filepath:count" based on the previous Read output which showed "src\repositories\base.repository.ts:5"
    // However, the Grep tool output says "Output too large... Preview...".
    // And the Read tool showed lines like "1->src\repositories\base.repository.ts:5".
    // Wait, the Read tool adds line numbers "1->". The file itself probably just has "filepath:count".

    // Let's handle the potential format.
    const parts = line.split(':');
    if (parts.length < 2) continue;

    const countStr = parts[parts.length - 1];
    const filePath = parts.slice(0, parts.length - 1).join(':');

    const count = parseInt(countStr, 10);
    if (isNaN(count)) continue;

    const isTest = testPatterns.some(pattern => filePath.includes(pattern));

    if (isTest) {
      testCount += count;
    } else {
      prodCount += count;
      prodFiles.push({ path: filePath, count: count });
    }
  }

  // Sort prod files by count descending
  prodFiles.sort((a, b) => b.count - a.count);

  console.log('--- Report ---');
  console.log(`Total 'as any'/'as unknown' in Production: ${prodCount}`);
  console.log(`Total 'as any'/'as unknown' in Tests: ${testCount}`);
  console.log('\nTop 10 Files with most assertions in Production:');

  prodFiles.slice(0, 10).forEach((file, index) => {
    console.log(`${index + 1}. ${file.path}: ${file.count}`);
  });

} catch (err) {
  console.error('Error reading file:', err);
}
