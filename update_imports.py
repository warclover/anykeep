import os
import re

base_path = os.path.abspath("src/lib/classification")
target_import = "@/lib/classification/infrastructure/shared-services"

def resolve_path(file_path, import_path):
    if import_path.startswith("@"):
        return import_path

    dir_path = os.path.dirname(file_path)
    if import_path.startswith("./") or import_path.startswith("../"):
        resolved = os.path.normpath(os.path.join(dir_path, import_path))
        # relative to project root (assuming c:\anykeep as root)
        # But here we just want to know if it points to strategies/modern/shared or v5/shared

        # Convert to relative path from src/lib/classification for easier checking
        rel_to_base = os.path.relpath(resolved, base_path)
        return rel_to_base.replace("\\", "/")
    return import_path

def process_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = content
    # Regex to find import statements
    # import ... from "..."
    import_regex = re.compile(r'(import\s+.*?from\s+["\'])(.*?)(["\'])')

    modified = False

    def replace_callback(match):
        prefix = match.group(1)
        import_path = match.group(2)
        suffix = match.group(3)

        resolved = resolve_path(file_path, import_path)

        # Check if it points to strategies/modern/shared
        # strategies/modern/shared is at src/lib/classification/strategies/modern/shared

        # Paths relative to src/lib/classification
        # strategies/modern/shared/...
        # v5/shared/...

        if resolved and (resolved == "strategies/modern/shared" or resolved.startswith("strategies/modern/shared/") or
           resolved == "v5/shared" or resolved.startswith("v5/shared/")):

            nonlocal modified
            modified = True

            # Determine new import path
            # We want to point to "@/lib/classification/infrastructure/shared-services"
            # plus whatever subpath was used, e.g. /logger

            rest = ""
            if "strategies/modern/shared" in resolved:
                 rest = resolved.split("strategies/modern/shared")[1]
            elif "v5/shared" in resolved:
                 rest = resolved.split("v5/shared")[1]

            # Remove leading slash from rest if exists
            if rest.startswith("/"):
                rest = rest[1:]

            new_import = target_import
            if rest:
                new_import = f"{target_import}/{rest}"

            # print(f"Replacing {import_path} with {new_import} in {file_path}")
            return f"{prefix}{new_import}{suffix}"

        return match.group(0)

    new_content = import_regex.sub(replace_callback, content)

    if modified:
        print(f"Updating {file_path}")
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

for root, dirs, files in os.walk(base_path):
    for file in files:
        if file.endswith(".ts") or file.endswith(".tsx"):
            process_file(os.path.join(root, file))
