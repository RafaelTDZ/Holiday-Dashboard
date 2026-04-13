#!/bin/bash

cd /vercel/share/v0-project

# Configurar git
git config user.email "v0[bot]@users.noreply.github.com"
git config user.name "v0[bot]"

# Adicionar todas as mudanças
git add -A

# Fazer commit com mensagem descritiva
git commit -m "refactor: Melhorias de Performance e Code Quality

- Centralizar getApiBase() e getAppBase() em utils/api.ts
- Criar hook useVacations com React Query para caching e compartilhamento
- Extrair MiniCalendarCard como componente separado com memoização
- Atualizar dashboard.tsx, calendar.tsx e componentes para usar novas abstrações
- Eliminar ~400 linhas de código duplicado
- Melhorar performance com caching automático de React Query

Co-authored-by: v0[bot] <v0[bot]@users.noreply.github.com>"

# Fazer push para a branch atual
git push

echo "✓ Mudanças salvas com sucesso no GitHub!"
