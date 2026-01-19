import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('URL:', supabaseUrl ? 'SET' : 'MISSING');
console.log('KEY:', supabaseKey ? 'SET' : 'MISSING');

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const userId = 'fd8f3544-7ba6-4c65-b3ae-01141826fb9e';

  // 1. 查找 PPT 科研绘图教程书签
  console.log('=== 查找 PPT 科研绘图教程书签 ===');
  const { data: pptBookmarks, error: pptError } = await supabase
    .from('bookmarks')
    .select('id, title, folder_id, classification_status, classification_result, created_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .or('title.ilike.%PPT科研绘图%,title.ilike.%260篇%,title.ilike.%教程汇总%')
    .order('created_at', { ascending: false })
    .limit(5);

  if (pptError) {
    console.error('PPT bookmarks error:', pptError);
  } else if (pptBookmarks && pptBookmarks.length > 0) {
    console.log(`找到 ${pptBookmarks.length} 个相关书签:`);
    for (const b of pptBookmarks) {
      console.log(`\nID: ${b.id}`);
      console.log(`标题: ${b.title}`);
      console.log(`文件夹ID: ${b.folder_id}`);
      console.log(`分类状态: ${b.classification_status}`);
      console.log(`分类结果: ${JSON.stringify(b.classification_result, null, 2)}`);
      console.log(`创建时间: ${b.created_at}`);
    }
  } else {
    console.log('未找到 PPT 科研绘图相关书签');
  }

  // 2. 查询关键文件夹的详情
  console.log('\n=== 关键文件夹详情 ===');
  const folderIds = [2, 30]; // claude 学习, 教程笔记
  for (const folderId of folderIds) {
    const { data: folder } = await supabase
      .from('folders')
      .select('id, name')
      .eq('id', folderId)
      .single();

    const { data: profile } = await supabase
      .from('classification_folder_profiles_v5')
      .select('bookmark_count, alpha_coefficient, last_updated_at')
      .eq('folder_id', folderId)
      .eq('user_id', userId)
      .single();

    console.log(`\n文件夹 ${folderId}: ${folder?.name || 'NOT FOUND'}`);
    if (profile) {
      console.log(`  书签数量: ${profile.bookmark_count}`);
      console.log(`  Alpha系数: ${profile.alpha_coefficient}`);
      console.log(`  最后更新: ${profile.last_updated_at}`);
    } else {
      console.log('  无 V5 Profile');
    }
  }

  // 3. 查询最近分类到 claude 学习 (folder 2) 的书签
  console.log('\n=== 最近分类到 claude 学习 的书签 ===');
  const { data: claudeBookmarks } = await supabase
    .from('bookmarks')
    .select('id, title, classification_confidence, created_at')
    .eq('user_id', userId)
    .eq('folder_id', 2)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5);

  if (claudeBookmarks) {
    claudeBookmarks.forEach(b => {
      console.log(`[${b.id}] ${b.title?.substring(0, 50)}... | 置信度: ${b.classification_confidence}`);
    });
  }

  // 4. 查询教程笔记文件夹的书签
  console.log('\n=== 教程笔记 文件夹的书签 ===');
  const { data: tutorialBookmarks } = await supabase
    .from('bookmarks')
    .select('id, title, classification_result, created_at')
    .eq('user_id', userId)
    .eq('folder_id', 30)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (tutorialBookmarks && tutorialBookmarks.length > 0) {
    console.log(`共 ${tutorialBookmarks.length} 个书签:`);
    tutorialBookmarks.forEach(b => {
      console.log(`[${b.id}] ${b.title?.substring(0, 60)}`);
    });
  } else {
    console.log('无书签');
  }

  // 5. 搜索含"教程"的书签在哪些文件夹
  console.log('\n=== 含"教程"关键词的书签分布 ===');
  const { data: tutorialRelated } = await supabase
    .from('bookmarks')
    .select('id, title, folder_id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .ilike('title', '%教程%')
    .limit(20);

  if (tutorialRelated && tutorialRelated.length > 0) {
    console.log(`找到 ${tutorialRelated.length} 个含"教程"的书签:`);
    const folderCounts = {};
    tutorialRelated.forEach(b => {
      folderCounts[b.folder_id] = (folderCounts[b.folder_id] || 0) + 1;
    });
    console.log('按文件夹分布:', folderCounts);
    tutorialRelated.forEach(b => {
      console.log(`[folder ${b.folder_id}] ${b.title?.substring(0, 50)}`);
    });
  }

  // 6. 查看 T1 纠正日志
  console.log('\n=== T1 纠正日志 (书签 1463) ===');
  const { data: classifyLogs, error: logError } = await supabase
    .from('classification_logs_v5')
    .select('*')
    .eq('bookmark_id', 1463)
    .order('created_at', { ascending: false })
    .limit(5);

  if (logError) {
    console.error('Log query error:', logError);
  } else if (classifyLogs && classifyLogs.length > 0) {
    classifyLogs.forEach(log => {
      console.log(`\n阶段: ${log.stage}`);
      console.log(`文件夹ID: ${log.folder_id}`);
      console.log(`置信度: ${log.confidence}`);
      console.log(`推理: ${log.reasoning?.substring(0, 200)}`);
    });
  } else {
    console.log('无 T1 日志');
  }
}

main().then(() => console.log('\nDone')).catch(e => console.error('Error:', e));
