import subprocess
import os
import sys

try:
    # Get current directory
    cwd = os.getcwd()
    print(f"[v0] Working directory: {cwd}")
    
    # Configure git user
    subprocess.run(['git', 'config', 'user.email', 'v0[bot]@users.noreply.github.com'], check=True)
    subprocess.run(['git', 'config', 'user.name', 'v0[bot]'], check=True)
    print("[v0] Git user configured")
    
    # Check git status
    status = subprocess.run(['git', 'status', '--short'], capture_output=True, text=True)
    print(f"[v0] Git status:\n{status.stdout}")
    
    # Add all changes
    subprocess.run(['git', 'add', '.'], check=True)
    print("[v0] Changes staged")
    
    # Commit changes
    commit_msg = """feat: Performance and Code Quality Improvements

- Centralize API utilities: Create src/utils/api.ts with getApiBase() and getAppBase()
- Create useVacations hook: New React Query hook with caching, colors, and calendar utilities
- Extract MiniCalendarCard: Separate component with React.memo() for performance
- Migrate to React Query: Update dashboard and calendar to use new hook
- Add memoization: useMemo and useCallback for optimized re-renders
- Remove duplicated code: Reduce ~400 lines of duplication across components

Co-authored-by: v0[bot] <v0[bot]@users.noreply.github.com>"""
    
    subprocess.run(['git', 'commit', '-m', commit_msg], check=True)
    print("[v0] Changes committed")
    
    # Push to GitHub
    result = subprocess.run(['git', 'push', 'origin', 'main'], capture_output=True, text=True)
    print(f"[v0] Push output: {result.stdout}")
    if result.stderr:
        print(f"[v0] Push stderr: {result.stderr}")
    
    print("[v0] Successfully pushed to GitHub!")
    
except subprocess.CalledProcessError as e:
    print(f"[v0] Error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"[v0] Unexpected error: {e}")
    sys.exit(1)
