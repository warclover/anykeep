import { executeDailyDigest } from '@/lib/workflow-lite/tasks/daily-digest';
import { runLiteTask } from '@/lib/workflow-lite/core/runner';

async function main() {
  const userId = process.argv[2];

  if (!userId) {
    console.error('Please provide a user ID as an argument');
    console.error('Usage: tsx scripts/test-lite-digest.ts <user_id>');
    process.exit(1);
  }

  console.log(`Testing Daily Digest for user: ${userId}`);

  const result = await runLiteTask(
    'daily-digest-test',
    `daily-digest-${userId}-${Date.now()}`, // Unique key for testing
    executeDailyDigest,
    { userId }
  );

  console.log('\n-----------------------------------');
  console.log('Final Result:', JSON.stringify(result, null, 2));
  console.log('-----------------------------------');
}

main().catch(console.error);
