import subprocess
import os
import sys

# Mudar para o diretório do projeto
os.chdir('/vercel/share/v0-project')

try:
    # Verificar status
    print("[v0] Verificando status do repositório...")
    result = subprocess.run(['git', 'status', '--porcelain'], capture_output=True, text=True)
    print(f"[v0] Status: {result.stdout}")
    
    # Adicionar todas as mudanças
    print("[v0] Adicionando mudanças...")
    subprocess.run(['git', 'add', '.'], check=True)
    
    # Fazer commit
    print("[v0] Fazendo commit...")
    subprocess.run(['git', 'commit', '-m', 'feat: Melhorias de Performance e Code Quality\n\n- Centralizar getApiBase() em utils/api.ts\n- Criar hook useVacations com React Query\n- Extrair MiniCalendarCard como componente separado\n- Usar React.memo para otimizar re-renders\n- Atualizar todos os arquivos para usar novas abstrações'], check=True)
    
    # Fazer push
    print("[v0] Fazendo push para o GitHub...")
    result = subprocess.run(['git', 'push', 'origin', 'main'], capture_output=True, text=True)
    print(f"[v0] Push output: {result.stdout}")
    if result.stderr:
        print(f"[v0] Push stderr: {result.stderr}")
    
    print("[v0] Sucesso! Mudanças enviadas para o GitHub.")
    
except subprocess.CalledProcessError as e:
    print(f"[v0] Erro: {e}")
    sys.exit(1)
except Exception as e:
    print(f"[v0] Erro inesperado: {e}")
    sys.exit(1)
