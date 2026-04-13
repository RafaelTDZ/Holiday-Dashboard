#!/usr/bin/env python3
import subprocess
import os

# Mudar para o diretório raiz
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

print("[v0] Diretório atual:", os.getcwd())

# Verificar status do git
print("\n[v0] Verificando status do git...")
result = subprocess.run(["git", "status", "--short"], capture_output=True, text=True)
print(result.stdout)

# Adicionar todas as mudanças
print("\n[v0] Adicionando mudanças...")
subprocess.run(["git", "add", "-A"], check=True)

# Criar commit
print("\n[v0] Criando commit...")
commit_message = """refactor: improve performance and code quality

- Centralize getApiBase() in utils/api.ts to eliminate duplication
- Create useVacations hook with React Query for shared vacation data fetching
- Extract MiniCalendarCard as reusable memoized component
- Migrate calendar views to use React Query for better caching
- Add useMemo optimization to prevent unnecessary re-renders
- Update all pages to use centralized utilities"""

subprocess.run(["git", "commit", "-m", commit_message], check=True)

# Fazer push
print("\n[v0] Fazendo push para o GitHub...")
subprocess.run(["git", "push", "origin", "main"], check=True)

print("\n[v0] Push concluído com sucesso!")
