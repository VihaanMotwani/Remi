import os

# Define the folders to scan
folders_to_scan = ["agents", "db", "utils"]

# Placeholder docstring template
docstring_template = '''"""
{file_path}

Description:
- [Add a description of what this file/module does.]

Usage:
- [Add usage instructions here.]

Setup Instructions:
- [Add setup instructions here, if any.]

TODO:
- [List any TODOs or improvements here.]
"""
'''

def add_docstring_to_file(file_path):
    """Add a placeholder docstring to the top of a Python file if it doesn't already have one."""
    with open(file_path, "r+") as file:
        content = file.read()
        # Check if the file already has a docstring
        if content.strip().startswith('"""'):
            print(f"Skipping {file_path}: Docstring already exists.")
            return
        
        # Prepend the placeholder docstring
        file.seek(0, 0)
        file.write(docstring_template.format(file_path=file_path) + "\n" + content)
        print(f"Added docstring to {file_path}")

def scan_and_add_docstrings(base_folder):
    """Recursively scan a folder and add docstrings to Python files."""
    for root, _, files in os.walk(base_folder):
        for file in files:
            if file.endswith(".py"):  # Only process Python files
                file_path = os.path.join(root, file)
                add_docstring_to_file(file_path)

def main():
    """Main function to scan folders and add docstrings."""
    for folder in folders_to_scan:
        if os.path.exists(folder):
            print(f"Scanning folder: {folder}")
            scan_and_add_docstrings(folder)
        else:
            print(f"Folder not found: {folder}")

if __name__ == "__main__":
    main()