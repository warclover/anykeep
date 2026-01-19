import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少 Supabase 配置');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testClassification() {
  console.log('🧪 开始测试 v5.0 分类...\n');
  
  // 1. 获取或创建测试用户
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
  
  if (usersError || !users || users.length === 0) {
    console.error('❌ 无法获取用户列表:', usersError);
    return;
  }
  
  const testUser = users[0];
  console.log('✅ 使用测试用户:', testUser.id);
  
  // 2. 创建测试书签
  const testBookmark = {
    user_id: testUser.id,
    title: 'Next.js 14 App Router 完整指南 - 测试 v5.0',
    url: 'https://example.com/nextjs-guide-v5-test',
    summary: '这是一篇关于 Next.js 14 新特性的技术文章，详细介绍了 App Router、Server Components 和数据获取的最佳实践。',
    tags: ['Next.js', 'React', '前端开发'],
    platform: 'web',
  };
  
  console.log('📝 创建测试书签...');
  const { data: bookmark, error: bookmarkError } = await supabase
    .from('bookmarks')
    .insert(testBookmark)
    .select()
    .single();
  
  if (bookmarkError) {
    console.error('❌ 创建书签失败:', bookmarkError);
    return;
  }
  
  console.log('✅ 书签已创建，ID:', bookmark.id);
  console.log('\n⏳ 等待分类处理（查看服务器日志）...\n');
  
  // 等待几秒让分类完成
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // 3. 查询分类结果
  const { data: updatedBookmark } = await supabase
    .from('bookmarks')
    .select('id, title, folder_id, folders(name)')
    .eq('id', bookmark.id)
    .single();
  
  console.log('📊 分类结果:');
  console.log('  - 书签 ID:', updatedBookmark.id);
  console.log('  - 标题:', updatedBookmark.title);
  console.log('  - 文件夹 ID:', updatedBookmark.folder_id);
  console.log('  - 文件夹名称:', updatedBookmark.folders?.name || '未分类');
  
  // 4. 清理测试数据
  console.log('\n🧹 清理测试数据...');
  await supabase.from('bookmarks').delete().eq('id', bookmark.id);
  console.log('✅ 测试完成！');
}

testClassification().catch(console.error);
