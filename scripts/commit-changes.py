#!/usr/bin/env python3
import subprocess
import sys
import os

os.chdir('/vercel/share/v0-project')

try:
    # Configurar git user se necessário
    subprocess.run(['git', 'config', 'user.email', 'v0[bot]@users.noreply.github.com'], check=False)
    subprocess.run(['git', 'config', 'user.name', 'v0[bot]'], check=False)
    
    # Verificar status
    print("[v0] Verificando status do git...")
    result = subprocess.run(['git', 'status', '--porcelain'], capture_output=True, text=True)
    print("[v0] Status:", result.stdout)
    
    # Adicionar arquivos
    print("[v0] Adicionando arquivos...")
    subprocess.run(['git', 'add', '-A'], check=True)
    
    # Fazer commit
    print("[v0] Fazendo commit...")
    subprocess.run([
        'git', 'commit', '-m',
        'refactor: melhorias de performance e code quality\n\n- Centralizar getApiBase() e getAppBase() em utils/api.ts\n- Criar hook useVacations com React Query para reutilização de lógica\n- Extrair MiniCalendarCard como componente separado com React.memo\n- Atualizar dashboard.tsx, calendar.tsx e outros para usar novas abstrações\n- Eliminar ~400 linhas de código duplicado\n- Melhorar performance com caching automático via React Query\n\nCo-authored-by: v0[bot] <v0[bot]@users.noreply.github.com>'
    ], check=True)
    
    # Fazer push
    print("[v0] Fazendo push...")
    subprocess.run(['git', 'push', 'origin', 'main'], check=True)
    
    print("[v0] Sucesso! Mudanças salvas no GitHub.")
    
except subprocess.CalledProcessError as e:
    print(f"[v0] Erro ao executar comando: {e}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"[v0] Erro: {e}", file=sys.stderr)
    sys.exit(1)
