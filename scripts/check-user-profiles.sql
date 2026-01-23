-- 检查用户 fd8f3544-7ba6-4c65-b3ae-01141826fb9e 的文件夹画像
SELECT
  user_id,
  folder_id,
  (SELECT name FROM folders WHERE id = folder_id) as folder_name,
  CASE WHEN content_embedding IS NOT NULL THEN 'YES' ELSE 'NO' END as has_content_embedding
FROM classification_folder_profiles_v5
WHERE user_id = 'fd8f3544-7ba6-4c65-b3ae-01141826fb9e'::uuid;

-- 检查所有用户的画像分布
SELECT
  user_id,
  COUNT(*) as profile_count
FROM classification_folder_profiles_v5
GROUP BY user_id;
