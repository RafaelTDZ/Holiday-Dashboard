#!/usr/bin/env python3
import subprocess
import os

# Obter diretório atual
cwd = os.getcwd()
print(f"[v0] Diretório atual: {cwd}")

# Listar conteúdo do diretório
try:
    files = os.listdir(cwd)
    print(f"[v0] Arquivos no diretório: {files[:10]}")
except Exception as e:
    print(f"[v0] Erro ao listar: {e}")

# Tentar fazer git status
try:
    result = subprocess.run(['git', 'status'], capture_output=True, text=True, timeout=10)
    print(f"[v0] Git status:\n{result.stdout}")
    print(f"[v0] Git stderr:\n{result.stderr}")
except Exception as e:
    print(f"[v0] Erro ao executar git status: {e}")

# Fazer commit
try:
    result = subprocess.run(['git', 'add', '-A'], capture_output=True, text=True, timeout=10)
    print(f"[v0] Git add result: {result.returncode}")
except Exception as e:
    print(f"[v0] Erro ao fazer git add: {e}")

# Commit com mensagem
try:
    result = subprocess.run(
        ['git', 'commit', '-m', 'feat: Performance and Code Quality improvements\n\n- Centralize getApiBase() utility in src/utils/api.ts\n- Create useVacations hook with React Query integration\n- Extract MiniCalendarCard component with React.memo optimization\n- Update dashboard.tsx, calendar.tsx and auth pages to use new abstractions\n- Add memoization to prevent unnecessary re-renders\n- Eliminate code duplication across 6 files'],
        capture_output=True,
        text=True,
        timeout=10
    )
    print(f"[v0] Git commit result: {result.returncode}")
    print(f"[v0] Git commit stdout: {result.stdout}")
    print(f"[v0] Git commit stderr: {result.stderr}")
except Exception as e:
    print(f"[v0] Erro ao fazer git commit: {e}")

# Push para o GitHub
try:
    result = subprocess.run(['git', 'push', 'origin', 'main'], capture_output=True, text=True, timeout=30)
    print(f"[v0] Git push result: {result.returncode}")
    print(f"[v0] Git push stdout: {result.stdout}")
    print(f"[v0] Git push stderr: {result.stderr}")
    
    if result.returncode == 0:
        print("\n✓ Mudanças foram enviadas com sucesso para o GitHub!")
    else:
        print(f"\n✗ Erro ao fazer push: {result.stderr}")
except Exception as e:
    print(f"[v0] Erro ao fazer git push: {e}")
