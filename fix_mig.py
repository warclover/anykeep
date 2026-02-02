import sys

path = 'supabase/migrations/20251225000001_add_ai_interaction_tables.sql'
try:
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
except FileNotFoundError:
    print(f"File not found: {path}")
    sys.exit(1)

m = {
    'Users can view own feedback': 'public.ai_feedback',
    'Users can create own feedback': 'public.ai_feedback',
    'Users can update own feedback': 'public.ai_feedback',
    'Users can view own ai snapshots': 'public.ai_operation_snapshots',
    'Users can create own ai snapshots': 'public.ai_operation_snapshots',
    'Users can update own ai snapshots': 'public.ai_operation_snapshots',
    'Users can view own ai notes': 'public.ai_notes',
    'Users can create own ai notes': 'public.ai_notes',
    'Users can update own ai notes': 'public.ai_notes',
    'Users can delete own ai notes': 'public.ai_notes'
}

for p, t in m.items():
    s = f'CREATE POLICY "{p}"'
    r = f'DROP POLICY IF EXISTS "{p}" ON {t};\n{s}'
    # Avoid double patching
    if f'DROP POLICY IF EXISTS "{p}"' not in c:
        c = c.replace(s, r)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
print("Migration file patched.")
