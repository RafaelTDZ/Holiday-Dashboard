#!/usr/bin/env python3
import subprocess
import os
import sys

# Mudar para o diretório do projeto
project_dir = "/vercel/share/v0-project"
os.chdir(project_dir)

print(f"[v0] Diretório de trabalho: {os.getcwd()}")

try:
    # Configurar git
    subprocess.run(
        ["git", "config", "user.email", "v0[bot]@users.noreply.github.com"],
        check=True,
        capture_output=True
    )
    print("[v0] Email configurado")
    
    subprocess.run(
        ["git", "config", "user.name", "v0[bot]"],
        check=True,
        capture_output=True
    )
    print("[v0] Usuário configurado")
    
    # Adicionar arquivos
    subprocess.run(
        ["git", "add", "artifacts/vacation-dashboard/src/"],
        check=True,
        capture_output=True
    )
    print("[v0] Arquivos adicionados")
    
    # Verificar status
    status = subprocess.run(
        ["git", "status", "--short"],
        capture_output=True,
        text=True,
        check=True
    )
    print("[v0] Status:")
    print(status.stdout)
    
    # Fazer commit
    commit_msg = """refactor: melhorias de performance e qualidade de código

- Centralizar getApiBase() e getAppBase() em utils/api.ts
- Criar hook useVacations com React Query para fetch centralizado
- Extrair MiniCalendarCard como componente separado com React.memo()
- Migrar calendar.tsx para usar useVacations hook
- Adicionar memoização com useMemo para otimizar re-renders
- Remover ~400 linhas de duplicação de código

Co-authored-by: v0[bot] <v0[bot]@users.noreply.github.com>"""
    
    subprocess.run(
        ["git", "commit", "-m", commit_msg],
        check=True,
        capture_output=True
    )
    print("[v0] Commit realizado com sucesso")
    
    # Push para main
    result = subprocess.run(
        ["git", "push", "origin", "main"],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print("[v0] Push realizado com sucesso!")
        print("[v0] As mudanças foram enviadas para o GitHub")
    else:
        print(f"[v0] Erro no push: {result.stderr}")
        sys.exit(1)
        
except subprocess.CalledProcessError as e:
    print(f"[v0] Erro: {e}")
    print(f"[v0] stderr: {e.stderr}")
    sys.exit(1)
