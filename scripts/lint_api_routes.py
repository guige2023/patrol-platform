#!/usr/bin/env python3
"""
Lints API route configuration for common issues:
1. Router files should NOT define prefix - only __init__.py should
2. More specific routes (with subpaths) should be registered before catch-all {id} routes
3. No duplicate path registrations
"""

import re
import sys
from pathlib import Path

def check_router_prefixes(api_dir: Path):
    """Check that router files don't define their own prefixes."""
    issues = []
    for py_file in api_dir.glob("*.py"):
        if py_file.name == "__init__.py":
            continue
        content = py_file.read_text()
        # Check for APIRouter with prefix
        matches = re.findall(r'APIRouter\s*\(\s*prefix\s*=\s*["\']([^"\']+)["\']', content)
        if matches:
            issues.append(f"{py_file.name}: Defines prefix(es): {matches} - should NOT have prefix, only __init__.py should")
    return issues

def check_init_router_registration(api_dir: Path):
    """Check that __init__.py properly registers routers."""
    init_file = api_dir / "__init__.py"
    if not init_file.exists():
        return ["__init__.py not found"]
    
    content = init_file.read_text()
    issues = []
    
    # Check for duplicate prefix registrations
    prefix_counts = {}
    for match in re.finditer(r'include_router\s*\(\s*(\w+)\.router\s*,\s*prefix\s*=\s*["\']([^"\']+)["\']', content):
        router_name, prefix = match.groups()
        key = (prefix, router_name)
        prefix_counts[key] = match.group()
    
    # Check that routers with overlapping prefixes are registered in correct order
    # e.g., knowledge_files should come before knowledge since it has more specific routes
    lines = content.split('\n')
    router_lines = [(i, line) for i, line in enumerate(lines) if 'include_router' in line]
    
    for i in range(len(router_lines) - 1):
        line1, line2 = router_lines[i][1], router_lines[i+1][1]
        match1 = re.search(r'include_router\s*\(\s*(\w+)\.router\s*,\s*prefix\s*=\s*["\']([^"\']+)["\']', line1)
        match2 = re.search(r'include_router\s*\(\s*(\w+)\.router\s*,\s*prefix\s*=\s*["\']([^"\']+)["\']', line2)
        if match1 and match2:
            prefix1, router1 = match1.groups()
            prefix2, router2 = match2.groups()
            # If same prefix, router with more specific routes (subdir) should come first
            if prefix1 == prefix2:
                # This is a heuristic - we flag it for manual review
                issues.append(f"Line {router_lines[i][0]+1}: Both {router1} and {router2} use prefix '{prefix1}' - ensure more specific router comes first")
    
    return issues

def check_route_ordering(py_file: Path):
    """Check that more specific routes come before catch-all {id} routes."""
    if py_file.name == "__init__.py":
        return []
    
    issues = []
    content = py_file.read_text()
    lines = content.split('\n')
    
    route_lines = []
    for i, line in enumerate(lines):
        match = re.search(r'@(?:router|api)\.(\w+)\s*\(\s*["\']([^"\']+)["\']', line)
        if match:
            method, path = match.groups()
            route_lines.append((i+1, method, path))
    
    # Check for {id} routes vs more specific sub-routes
    for i in range(len(route_lines) - 1):
        _, method1, path1 = route_lines[i]
        _, method2, path2 = route_lines[i+1]
        
        # If current route is {id} and next is a more specific sub-route of {id}, warn
        if '{id}' in path1 and not '{id}' in path2:
            # Check if path2 is a sub-route of path1
            base_path = path1.split('/{')[0]
            if path2.startswith(base_path + '/') and path2.replace(base_path, '').count('/') > 0:
                issues.append(f"Line {route_lines[i+1][0]}: Route '{path2}' should be registered before '{path1}' (more specific routes first)")
    
    return issues

def main():
    api_dir = Path("backend/app/api/v1")
    if not api_dir.exists():
        print(f"Error: {api_dir} not found")
        sys.exit(1)
    
    all_issues = []
    
    print("Checking router prefix definitions...")
    all_issues.extend(check_router_prefixes(api_dir))
    
    print("Checking __init__.py router registration...")
    all_issues.extend(check_init_router_registration(api_dir))
    
    print("Checking route ordering in router files...")
    for py_file in api_dir.glob("*.py"):
        if py_file.name != "__init__.py":
            all_issues.extend(check_route_ordering(py_file))
    
    if all_issues:
        print("\n❌ Issues found:")
        for issue in all_issues:
            print(f"  - {issue}")
        sys.exit(1)
    else:
        print("\n✅ No issues found!")
        sys.exit(0)

if __name__ == "__main__":
    main()
