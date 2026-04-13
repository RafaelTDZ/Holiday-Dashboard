import { execSync } from 'child_process';
import { chdir } from 'process';

try {
  chdir('/vercel/share/v0-project');

  // Configurar git
  execSync('git config user.email "v0[bot]@users.noreply.github.com"');
  execSync('git config user.name "v0[bot]"');

  // Adicionar todas as mudanças
  execSync('git add -A');

  // Fazer commit
  const commitMessage = `refactor: Melhorias de Performance e Code Quality

- Centralizar getApiBase() e getAppBase() em utils/api.ts
- Criar hook useVacations com React Query para caching
- Extrair MiniCalendarCard como componente separado com memoização
- Atualizar dashboard.tsx, calendar.tsx e componentes
- Eliminar ~400 linhas de código duplicado
- Melhorar performance com caching automático

Co-authored-by: v0[bot] <v0[bot]@users.noreply.github.com>`;

  execSync(`git commit -m "${commitMessage}"`);

  // Fazer push
  execSync('git push');

  console.log('✓ Mudanças salvas com sucesso no GitHub!');
} catch (error) {
  console.error('[v0] Erro ao fazer commit:', error.message);
  process.exit(1);
}
