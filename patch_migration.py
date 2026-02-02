import os

file_path = "supabase/migrations/20251225000001_add_ai_interaction_tables.sql"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

policies = [
    ("Users can view own feedback", "public.ai_feedback"),
    ("Users can create own feedback", "public.ai_feedback"),
    ("Users can update own feedback", "public.ai_feedback"),
    ("Users can view own ai snapshots", "public.ai_operation_snapshots"),
    ("Users can create own ai snapshots", "public.ai_operation_snapshots"),
    ("Users can update own ai snapshots", "public.ai_operation_snapshots"),
    ("Users can view own ai notes", "public.ai_notes"),
    ("Users can create own ai notes", "public.ai_notes"),
    ("Users can update own ai notes", "public.ai_notes"),
    ("Users can delete own ai notes", "public.ai_notes")
]

for policy_name, table_name in policies:
    create_stmt = f'CREATE POLICY "{policy_name}"'
    drop_stmt = f'DROP POLICY IF EXISTS "{policy_name}" ON {table_name};\n{create_stmt}'
    
    check_stmt = f'DROP POLICY IF EXISTS "{policy_name}"'
    
    if check_stmt not in content:
        content = content.replace(create_stmt, drop_stmt)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Migration file patched successfully.")
