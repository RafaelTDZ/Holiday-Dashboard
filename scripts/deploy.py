#!/usr/bin/env python3
import subprocess
import os

# Tentar vários caminhos possíveis
possible_paths = [
    "/vercel/share/v0-project",
    os.getcwd(),
    os.path.expanduser("~"),
]

for path in possible_paths:
    if os.path.isdir(path):
        print(f"[v0] Encontrado diretório: {path}")
        os.chdir(path)
        break

# Verificar se estamos em um repositório git
if not os.path.isdir(".git"):
    print("[v0] Não estamos em um repositório git. Inicializando...")
    subprocess.run(["git", "init"], check=True)

# Configurar git se necessário
try:
    subprocess.run(["git", "config", "user.email"], capture_output=True, check=True)
except:
    subprocess.run(["git", "config", "user.email", "v0[bot]@users.noreply.github.com"], check=True)

try:
    subprocess.run(["git", "config", "user.name"], capture_output=True, check=True)
except:
    subprocess.run(["git", "config", "user.name", "v0[bot]"], check=True)

# Adicionar arquivos modificados
print("[v0] Adicionando arquivos modificados...")
subprocess.run(["git", "add", "-A"], check=True)

# Verificar status
status = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True, check=True)
print("[v0] Status git:")
print(status.stdout)

if status.stdout.strip():
    # Criar commit
    commit_message = "feat: Implementar melhorias de Performance e Code Quality\n\n- Centralizar getApiBase() em utils/api.ts\n- Criar hook useVacations com React Query e caching\n- Extrair MiniCalendarCard como componente memoizado\n- Atualizar todos os arquivos para usar novas abstrações\n- Remover duplicação de código (~400 linhas)\n- Adicionar memoização para otimizar re-renders"
    
    print("[v0] Fazendo commit...")
    subprocess.run(["git", "commit", "-m", commit_message], check=True)
    
    # Fazer push
    print("[v0] Fazendo push para o repositório remoto...")
    result = subprocess.run(["git", "push", "-u", "origin", "main"], capture_output=True, text=True)
    
    print("[v0] Output do push:")
    print(result.stdout)
    if result.stderr:
        print("[v0] Erros:")
        print(result.stderr)
    
    if result.returncode == 0:
        print("[v0] ✓ Push realizado com sucesso!")
    else:
        print(f"[v0] Push falhou com código {result.returncode}")
else:
    print("[v0] Nenhuma mudança para fazer commit")
