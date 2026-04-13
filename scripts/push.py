#!/usr/bin/env python3
import subprocess
import os
import sys

# Mudar para o diretório do projeto
project_dir = "/vercel/share/v0-project"
os.chdir(project_dir)

print(f"[v0] Working directory: {os.getcwd()}")
print(f"[v0] Verificando status git...")

try:
    # Verificar status
    status = subprocess.run(["git", "status"], capture_output=True, text=True, check=True)
    print("[v0] Git status:")
    print(status.stdout)
    
    # Adicionar todas as mudanças
    print("[v0] Adicionando arquivos modificados...")
    subprocess.run(["git", "add", "."], check=True)
    
    # Fazer commit
    commit_msg = "refactor: performance e code quality improvements\n\n- Centralizar getApiBase() e getAppBase() em utils/api.ts\n- Criar hook useVacations com React Query para caching\n- Extrair MiniCalendarCard como componente separado com React.memo\n- Migrar calendar.tsx para usar hook useVacations\n- Atualizar dashboard.tsx para usar MiniCalendarCard\n- Remover duplicação de código em 6 arquivos"
    print("[v0] Fazendo commit...")
    subprocess.run(["git", "commit", "-m", commit_msg], check=True)
    
    # Fazer push
    print("[v0] Fazendo push para GitHub...")
    result = subprocess.run(["git", "push", "origin", "main"], capture_output=True, text=True, check=True)
    print("[v0] Push realizado com sucesso!")
    print(result.stdout)
    
    print("\n✓ Todas as mudanças foram salvas no GitHub com sucesso!")
    
except subprocess.CalledProcessError as e:
    print(f"[v0] Erro ao executar comando git: {e}")
    print(f"[v0] stdout: {e.stdout}")
    print(f"[v0] stderr: {e.stderr}")
    sys.exit(1)
except Exception as e:
    print(f"[v0] Erro: {e}")
    sys.exit(1)
