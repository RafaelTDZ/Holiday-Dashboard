#!/usr/bin/env python3
import subprocess
import os

# Navegar para o diretório do projeto
project_dir = "/vercel/share/v0-project"
os.chdir(project_dir)

print(f"[v0] Diretório atual: {os.getcwd()}")
print(f"[v0] Conteúdo do diretório: {os.listdir('.')[:10]}")

# Verificar se estamos em um repositório git
try:
    result = subprocess.run(["git", "status"], capture_output=True, text=True, check=True)
    print("[v0] Repositório git encontrado")
    print(result.stdout)
except subprocess.CalledProcessError as e:
    print(f"[v0] Erro ao verificar git status: {e}")
    print(f"[v0] Stderr: {e.stderr}")

# Configurar git
subprocess.run(["git", "config", "user.email", "v0[bot]@users.noreply.github.com"], cwd=project_dir)
subprocess.run(["git", "config", "user.name", "v0[bot]"], cwd=project_dir)

# Adicionar todas as mudanças
print("[v0] Adicionando mudanças...")
subprocess.run(["git", "add", "-A"], cwd=project_dir)

# Ver o que foi adicionado
result = subprocess.run(["git", "status"], capture_output=True, text=True, cwd=project_dir)
print("[v0] Status do git:")
print(result.stdout)

# Fazer commit
print("[v0] Fazendo commit...")
commit_result = subprocess.run(
    ["git", "commit", "-m", "refactor: Performance and Code Quality improvements\n\n- Centralized API utilities (getApiBase, getAppBase)\n- Created useVacations hook with React Query\n- Extracted MiniCalendarCard component with memoization\n- Updated files to use shared abstractions\n- Eliminated code duplication\n- Improved caching and performance"],
    capture_output=True,
    text=True,
    cwd=project_dir
)
print(f"[v0] Commit output: {commit_result.stdout}")
if commit_result.stderr:
    print(f"[v0] Commit stderr: {commit_result.stderr}")

# Fazer push
print("[v0] Fazendo push para GitHub...")
push_result = subprocess.run(
    ["git", "push", "-u", "origin", "main"],
    capture_output=True,
    text=True,
    cwd=project_dir
)
print(f"[v0] Push output: {push_result.stdout}")
if push_result.stderr:
    print(f"[v0] Push stderr: {push_result.stderr}")

if push_result.returncode == 0:
    print("\n✅ Sucesso! Mudanças enviadas para GitHub!")
else:
    print(f"\n❌ Erro ao fazer push: {push_result.returncode}")
