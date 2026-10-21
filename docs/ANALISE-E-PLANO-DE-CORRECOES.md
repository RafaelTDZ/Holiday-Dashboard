# Análise Técnica e Plano de Correções — Dashboard de Férias

| Campo | Valor |
|---|---|
| Data da análise | 21/10/2026 |
| Escopo | Estrutura, arquitetura, segurança, regras de negócio, contrato da API, qualidade e operação |
| Status | Análise concluída; branch `v0/add-preview-script` integrada e removida; worktree limpo |
| Verificação | `pnpm run typecheck` executado com sucesso após o merge |
| Base | Branch `main`, commit `af913f7` |
| Branches | Apenas `main` (local e remota) |
| Worktrees | Apenas o worktree principal |

> Este documento é um registro vivo. Os números de linha refletem o código na data da análise e podem mudar após as correções. Marque os checkboxes conforme as tarefas forem concluídas.

---

## 1. Resumo executivo

O projeto é um **monorepo pnpm** com separação clara entre frontend, API, banco de dados e bibliotecas compartilhadas. A base é sólida: TypeScript em todo o stack, contrato OpenAPI com geração de client e schemas, autenticação com bcrypt e sessão server-side, conexão com MongoDB preparada para serverless e documentação inicial.

A arquitetura atual é adequada para o porte do produto:

- **Frontend:** React 19 + Vite 7 + Tailwind CSS 4 + shadcn/ui + TanStack Query + wouter.
- **API:** Express 5, compilada com esbuild e publicada como uma única Serverless Function da Vercel em `/api`.
- **Banco:** MongoDB com Mongoose 8, IDs numéricos via coleção de contadores e datas de domínio como `YYYY-MM-DD`.
- **Contrato:** OpenAPI 3.1 → Orval → hooks React Query (`lib/api-client-react`) e schemas Zod (`lib/api-zod`).
- **Deploy:** Vercel, com frontend estático e API no mesmo domínio.

Os principais riscos identificados não são estruturais, e sim de **autorização, ciclo de vida de sessão e completude do contrato**:

1. Cadastro aberto permite que qualquer pessoa crie conta e se registre como funcionário, acessando dados de toda a equipe.
2. `DELETE /api/vacations/:id` não verifica proprietário nem papel de gestor.
3. Sessão de usuário removido do banco continua autenticada.
4. Tokens de reset e sessões não têm TTL; tokens são armazenados em texto puro e não há revogação de sessões após troca de senha.
5. O OpenAPI não cobre 9 operações implementadas, incluindo notificações, vendas de férias e edição de férias. O frontend contorna isso com `fetch` manual.
6. A regra de venda de até 1/3 do período, descrita no README, não está implementada.
7. Não há testes automatizados, lint, formatação configurada nem CI.

### 1.1 Top 5 riscos

| # | Risco | Severidade | Impacto |
|---|---|---|---|
| 1 | Cadastro aberto + auto-registro como funcionário | Crítica | Exposição de dados de RH a qualquer pessoa |
| 2 | Exclusão de férias sem autorização | Crítica | Perda/alteração de dados por qualquer usuário logado |
| 3 | Sessão de usuário excluído permanece válida | Alta | Acesso indevido após desligamento |
| 4 | Tokens/sessões sem TTL e sem revogação | Alta | Janela de sequestro de conta e acúmulo de dados |
| 5 | Contrato OpenAPI incompleto | Média/Alta | Clientes divergentes, regressões e manutenção duplicada |

### 1.2 Conclusão

A estrutura **não precisa ser reescrita**. O caminho mais eficiente é:

1. Fechar as brechas de autorização e sessão (Fase 1).
2. Alinhar as regras de negócio e completar o contrato da API (Fase 2).
3. Limpar resíduos, adicionar testes, lint e CI (Fase 3).

### 1.3 Estado do Git

A branch `v0/add-preview-script` foi integrada à `main` por fast-forward (`af913f7`) e a branch remota foi excluída. O worktree residual `cosmic-panda` também foi removido. Hoje existe **apenas a `main`**, sincronizada com `origin/main`. O detalhamento está na seção 3.6 e o achado correspondente é o `GIT-01`, já resolvido.

---

## 2. Escopo e método

Foram inspecionados:

- Estrutura de diretórios e workspaces.
- `package.json` de todos os pacotes, `pnpm-workspace.yaml`, `tsconfig*`, `vercel.json` e `.env.example`.
- Rotas, middlewares, modelos e lógica de negócio da API.
- Páginas, componentes, hooks e chamadas HTTP do frontend.
- Especificação OpenAPI, configuração do Orval e artefatos gerados.
- Documentação (`README.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, `CONTRIBUTING.md`).
- Histórico Git, branches locais/remotas, worktrees, tags e pull requests.
- Execução de `pnpm run typecheck`.

Não foram executados testes manuais de UI, testes de carga, auditoria de dependências nem acesso ao banco de produção.

---

## 3. Estrutura atual

### 3.1 Visão em árvore

```text
.
├── api/
│   └── index.js                    # Serverless Function da Vercel (/api/*)
├── artifacts/
│   ├── api-server/                 # API Express
│   │   └── src/
│   │       ├── routes/             # auth, employees, vacations, dashboard, me, notifications
│   │       ├── middlewares/        # authMiddleware
│   │       ├── lib/                # auth, bootstrap, email, logger, vacation-utils
│   │       ├── types/
│   │       ├── app.ts
│   │       ├── handler.ts
│   │       └── index.ts
│   ├── mockup-sandbox/             # Playground de componentes (não usado no deploy)
│   └── vacation-dashboard/         # SPA React
│       └── src/
│           ├── pages/              # dashboard, calendar, employees, auth
│           ├── components/         # layout, gates, notificações, shadcn/ui
│           ├── hooks/
│           ├── utils/
│           └── App.tsx
├── lib/
│   ├── api-spec/                   # OpenAPI 3.1 + Orval
│   ├── api-client-react/           # Hooks TanStack Query gerados
│   ├── api-zod/                    # Schemas Zod gerados
│   ├── auth-web/                   # Hook useAuth()
│   └── db/                         # Conexão, modelos Mongoose e seed
├── scripts/
│   ├── src/seed-mongo.ts
│   ├── src/hello.ts
│   ├── preinstall.mjs
│   └── *.py                        # Scripts antigos de commit/push/deploy
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── ANALISE-E-PLANO-DE-CORRECOES.md
├── attached_assets/                # Imagem não referenciada pelo código
├── vercel.json
├── pnpm-workspace.yaml
└── package.json
```

### 3.2 Pacotes do workspace

| Pacote | Responsabilidade | Arquivos TS/TSX | Linhas TS/TSX | Observação |
|---|---|---:|---:|---|
| `artifacts/vacation-dashboard` | SPA React | 75 | ~8.800 | 4 páginas principais + shadcn/ui |
| `artifacts/mockup-sandbox` | Playground de componentes | 63 | ~5.700 | Não entra no build da Vercel |
| `artifacts/api-server` | API Express | 18 | ~1.570 | Bundle ESM + CJS via esbuild |
| `lib/api-client-react` | Hooks gerados | 4 | ~1.920 | Inclui `custom-fetch.ts` |
| `lib/api-zod` | Schemas Zod gerados | 29 | ~770 | 31 arquivos no total |
| `lib/db` | Modelos e conexão | 12 | ~450 | Mongoose |
| `lib/api-spec` | OpenAPI + Orval | 1 | ~68 | `openapi.yaml` com ~24 KB |
| `lib/auth-web` | Hook `useAuth` | 2 | ~51 | Depende do client gerado |
| `scripts` | Seed e utilitários | 2 | ~27 | 10 scripts `.py` legados |
| `api/index.js` | Entrada da Vercel | 1 | ~30 | Requer bundle CJS |

**Total rastreado:** 266 arquivos; ~19.356 linhas de TypeScript/TSX.

### 3.3 Fluxo de execução em produção

```text
Browser
  │
  ├── GET /                → SPA estática (Vercel)
  └── /api/*               → api/index.js
                              │
                              └── require(artifacts/api-server/dist/cjs/handler.cjs)
                                    │
                                    └── Express app
                                          ├── pino-http
                                          ├── CORS + cookie-parser + JSON
                                          ├── connectDb() (promise cacheada)
                                          ├── ensureBootstrapAdmin() (idempotente)
                                          ├── authMiddleware (sessão + isManager)
                                          └── routers /api
```

- O cookie `sid` é HttpOnly e SameSite=Lax.
- A sessão fica no MongoDB, não no token do navegador.
- `isManager` é reconsultado no banco a cada requisição.
- O `api/index.js` normaliza o prefixo `/api` caso a Vercel entregue a URL sem ele.

### 3.4 Modelo de dados

Coleções principais:

| Coleção | Modelo | Campos relevantes |
|---|---|---|
| `users` | `User` | `email`, `passwordHash`, `isManager`, dados de perfil |
| `sessions` | `Session` | `sid`, `sess`, `expire` |
| `employees` | `Employee` | `id`, `name`, `role`, `department`, `hireDate`, `userId` |
| `vacations` | `Vacation` | `id`, `employeeId`, `startDate`, `endDate`, `status`, `notes` |
| `vacation_sales` | `VacationSale` | `id`, `employeeId`, `daysSold`, `saleDate`, `notes` |
| `notifications` | `Notification` | `id`, `userId`, `message`, `read`, `vacationId`, `employeeId` |
| `password_reset_tokens` | `PasswordResetToken` | `token`, `userId`, `expiresAt` |
| `counters` | `Counter` | `_id`, `seq` |

Decisões relevantes:

- IDs numéricos públicos são gerados pela coleção `counters`, evitando expor `_id` do Mongo.
- Campos de data de domínio são strings `YYYY-MM-DD`, evitando deslocamento de timezone.
- A ordenação lexicográfica de datas ISO coincide com a cronológica.

### 3.5 Inventário de endpoints

Legenda: **Auth** = exige sessão; **Gestor** = exige `isManager`; **Spec** = presente no OpenAPI.

| Método | Rota | Auth | Gestor | Spec | Observação |
|---|---|---|---|---|---|
| GET | `/healthz` | Não | Não | Sim | Status estático |
| GET | `/auth/user` | Opcional | Não | Sim | Retorna `user: null` sem sessão |
| GET | `/logout` | Opcional | Não | Sim | Altera estado via GET |
| POST | `/auth/register-local` | Não | Não | Sim | Cadastro aberto |
| POST | `/auth/login-local` | Não | Não | Sim | Sem rate limit |
| POST | `/auth/forgot-password` | Não | Não | Sim | Sempre retorna 200 |
| POST | `/auth/reset-password` | Não | Não | Sim | Token em texto puro |
| GET | `/employees` | Sim | Não | Sim | Retorna todos os funcionários e saldos |
| POST | `/employees` | Sim | Sim | Sim | Cria/vincula usuário |
| GET | `/employees/:id` | Sim | Não | Sim | Detalhe com férias e vendas |
| PUT | `/employees/:id` | Sim | Sim | Sim | Atualiza dados |
| DELETE | `/employees/:id` | Sim | Sim | Sim | Cascade parcial |
| PUT | `/employees/:id/password` | Sim | Depende | **Não** | Próprio usuário ou gestor |
| GET | `/employees/:id/vacation-sales` | Sim | Não | **Não** | Vendas de férias |
| POST | `/employees/:id/vacation-sales` | Sim | Sim | **Não** | Regra de 1/3 ausente |
| DELETE | `/employees/:id/vacation-sales/:saleId` | Sim | Sim | **Não** | Exclusão de venda |
| GET | `/vacations` | Sim | Não | **Não** | Lista todas as férias |
| GET | `/employees/:id/vacations` | Sim | Não | Sim | Férias do funcionário |
| POST | `/employees/:id/vacations` | Sim | Não | Sim | Apenas para si mesmo |
| PUT | `/vacations/:id/status` | Sim | Sim | Sim | Aprova/reprova |
| PUT | `/vacations/:id` | Sim | Não | **Não** | Edita férias pendentes do próprio usuário |
| DELETE | `/vacations/:id` | Sim | Não | Sim | **Sem verificação de dono** |
| GET | `/dashboard/summary` | Sim | Não | Sim | Agrega todos os dados em memória |
| GET | `/me/employee` | Sim | Não | Sim | Vínculo usuário → funcionário |
| POST | `/me/employee` | Sim | Não | Sim | Auto-registro como funcionário |
| GET | `/notifications` | Sim | Não | **Não** | Últimas 30 |
| PUT | `/notifications/read-all` | Sim | Não | **Não** | Marca todas |
| PUT | `/notifications/:id/read` | Sim | Não | **Não** | Marca uma |

**Resumo:** 28 operações implementadas, 19 no OpenAPI; **9 operações fora do contrato**.

### 3.6 Estado do Git, branches e worktrees

Verificação realizada em 21/10/2026, após `git fetch origin --prune`.

| Tipo | Ref | Commit | Situação |
|---|---|---|---|
| Local | `main` | `af913f7` | Sincronizada com `origin/main` |
| Remota | `origin/main` | `af913f7` | Única branch remota |
| Remota | `origin/v0/add-preview-script` | — | Integrada e excluída em 21/10/2026 |
| Tag | — | — | Nenhuma tag |
| Worktree | `cosmic-panda` | — | Removido em 21/10/2026 |

**Histórico da branch `v0/add-preview-script`:**

- Foi integrada à `main` por fast-forward, resultando no commit `af913f7`.
- A branch remota foi excluída; `git ls-remote --heads origin` lista apenas `main`.
- Os arquivos da branch foram mantidos:
  - `package.json` com os scripts `dev` e `preview`;
  - `artifacts/vacation-dashboard/src/components/layout.tsx` com o favicon do projeto.
- Commits integrados:
  1. `e8cc295` — **Add root preview scripts**.
  2. `af913f7` — **Replace red icon with project icon**.
- O worktree `cosmic-panda` foi removido; `git worktree list` mostra apenas o principal.
- O `pnpm run typecheck` passou após o merge.

**Follow-ups da branch (mantidos no plano):**

- O script `dev` sobe **apenas o frontend**; a API continua precisando de outro comando (ver `DX-04`).
- O script `preview` também cobre apenas o frontend e depende da API/proxy já configurados.
- O `src="/favicon.svg"` é absoluto e quebra quando `BASE_PATH` é diferente de `/` (ver `API-02`).

---

## 4. Pontos fortes

- **Separação de responsabilidades:** frontend, API, banco e bibliotecas compartilhadas têm limites claros.
- **Stack consistente:** TypeScript em todo o projeto, com typecheck único no root.
- **Contrato-first:** OpenAPI gera hooks e schemas Zod, reduzindo duplicação de tipos.
- **Autenticação sólida na base:** bcrypt com 12 rounds, cookie HttpOnly, sessão server-side e expiração.
- **Papel de gestor sempre atualizado:** `isManager` é lido do banco a cada requisição, sem cache na sessão.
- **Serverless bem tratado:** conexão do Mongoose é cacheada globalmente; bootstrap e seed são idempotentes.
- **Decisão consciente sobre datas:** strings `YYYY-MM-DD` documentadas para evitar bugs de timezone.
- **IDs públicos numéricos:** não expõem `_id` do MongoDB e mantêm o contrato estável.
- **Segurança de supply chain:** `minimumReleaseAge: 1440` no `pnpm-workspace.yaml`.
- **Documentação inicial:** README, arquitetura, API e contribuição presentes.
- **Typecheck passando:** `pnpm run typecheck` executou com sucesso em todos os pacotes.

---

## 5. Achados detalhados

### 5.1 Segurança e autorização

#### SEC-01 — Cadastro aberto e auto-registro como funcionário

- **Severidade:** Crítica
- **Evidência:**
  - `artifacts/api-server/src/routes/auth.ts:74-112` — `POST /auth/register-local` cria conta para qualquer e-mail.
  - `artifacts/api-server/src/routes/me.ts:45-88` — `POST /me/employee` vincula a conta a um funcionário.
  - `artifacts/vacation-dashboard/src/components/registration-gate.tsx:49-90` — o gate conduz o usuário ao auto-registro.
  - `artifacts/api-server/src/routes/employees.ts:66-102` — qualquer autenticado lista todos os funcionários, saldos e férias.
- **Impacto:** qualquer pessoa com acesso à URL pública pode criar uma conta, registrar-se como funcionário e visualizar dados de RH de toda a equipe.
- **Correção recomendada:**
  - Tornar o cadastro **por convite** ou restringir por domínio de e-mail (`ALLOWED_EMAIL_DOMAINS`).
  - Ou desabilitar `register-local` em produção e criar usuários apenas pelo gestor.
  - Se o auto-registro for mantido, exigir um código de convite de uso único.
  - Revisar a visibilidade de `GET /employees` e `GET /vacations` para não-gestores.
- **Critérios de aceite:**
  - Sem convite/allowlist, `POST /auth/register-local` retorna 403.
  - Um não-gestor não consegue criar funcionário nem se auto-registrar sem autorização.
  - Teste automatizado cobre o fluxo bloqueado.

#### SEC-02 — Exclusão de férias sem verificação de dono ou gestor

- **Severidade:** Crítica
- **Evidência:** `artifacts/api-server/src/routes/vacations.ts:344-367`.
- **Impacto:** qualquer usuário autenticado pode apagar férias de qualquer funcionário informando o ID.
- **Correção recomendada:**
  - Carregar a férias e o funcionário antes de excluir.
  - Permitir apenas:
    - o próprio funcionário, se a solicitação estiver `pending`; ou
    - um gestor, conforme política definida.
  - Retornar 403 quando não autorizado e 404 quando não existir.
- **Critérios de aceite:**
  - Usuário A recebe 403 ao tentar excluir férias de B.
  - Dono exclui a própria solicitação pendente.
  - Gestor exclui conforme política.
  - Teste de integração cobre os três casos.

#### SEC-03 — Sessão de usuário removido continua válida

- **Severidade:** Alta
- **Evidência:** `artifacts/api-server/src/middlewares/authMiddleware.ts:38-53`.
- **Impacto:** ao excluir um usuário do banco, a sessão existente continua autenticada até expirar. O código usa `session.user` como fallback quando `dbUser` não é encontrado.
- **Correção recomendada:**
  - Se `dbUser` for `null`, chamar `clearSession(res, sid)` e seguir sem `req.user`.
  - Não reutilizar dados da sessão quando o usuário não existe mais.
- **Critérios de aceite:**
  - Usuário removido recebe 401 na próxima requisição.
  - Cookie é limpo.
  - Teste cobre sessão válida + usuário inexistente.

#### SEC-04 — Ciclo de vida de sessões e tokens de reset

- **Severidade:** Alta
- **Evidência:**
  - `lib/db/src/models/session.ts:8-15` — `expire` tem índice comum, não TTL.
  - `lib/db/src/models/password-reset-token.ts:8-15` — `expiresAt` também sem TTL.
  - `artifacts/api-server/src/routes/auth.ts:204-221` — token de reset é salvo em texto puro e as sessões não são revogadas.
  - `artifacts/api-server/src/routes/employees.ts:364-365` — troca de senha não invalida sessões.
- **Impacto:**
  - Sessões e tokens expirados acumulam no banco.
  - Tokens vazados em backup/log podem ser reutilizados dentro da validade.
  - Após troca de senha, um invasor com sessão ativa continua logado.
- **Correção recomendada:**
  - Criar índices TTL:
    - `sessions.expire` com `expireAfterSeconds: 0`;
    - `password_reset_tokens.expiresAt` com `expireAfterSeconds: 0`.
  - Armazenar apenas o hash SHA-256 do token de reset.
  - Ao trocar/redefinir senha, apagar todas as sessões do usuário.
  - Definir `createdAt` nos tokens e limitar a um token ativo por usuário.
  - Verificar índices existentes com `syncIndexes()` ou migration.
- **Critérios de aceite:**
  - Sessões expiradas desaparecem sem acesso.
  - Tokens expirados não são encontrados.
  - Reset de senha derruba todas as sessões antigas.
  - Token não é recuperável em texto puro no banco.

#### SEC-05 — Ausência de rate limiting e política de senha fraca

- **Severidade:** Alta
- **Evidência:**
  - `artifacts/api-server/src/app.ts` — nenhum middleware de rate limit.
  - `artifacts/api-server/src/routes/auth.ts:83-85,199-201` — senha mínima de 6 caracteres.
- **Impacto:** ataques de força bruta, credential stuffing e abuso do envio de e-mails de reset.
- **Correção recomendada:**
  - Aplicar `express-rate-limit` (ou equivalente) em:
    - `POST /auth/login-local` (ex.: 5 tentativas/min por IP + e-mail);
    - `POST /auth/forgot-password`;
    - `POST /auth/reset-password`;
    - `POST /auth/register-local`.
  - Elevar a senha mínima para 8–10 caracteres e bloquear senhas comuns.
  - Considerar bloqueio temporário após tentativas repetidas.
- **Critérios de aceite:**
  - Após N tentativas, a API retorna 429.
  - Senhas curtas são rejeitadas com mensagem clara.
  - Testes cobrem o limite.

#### SEC-06 — CORS permissivo

- **Severidade:** Média
- **Evidência:** `artifacts/api-server/src/app.ts:32` — `cors({ credentials: true, origin: true })`.
- **Impacto:** qualquer origem é refletida. O `SameSite=Lax` reduz o risco, mas a configuração é frágil e permite erros futuros.
- **Correção recomendada:**
  - Allowlist via `APP_URL` e/ou `CORS_ORIGINS`.
  - Em produção, rejeitar origens desconhecidas.
  - Manter `credentials: true` apenas para as origens permitidas.
- **Critérios de aceite:**
  - Origem permitida recebe cabeçalhos CORS.
  - Origem não permitida não recebe `Access-Control-Allow-Origin`.
  - Preflight responde corretamente.

#### SEC-07 — Ausência de handler global de erros JSON

- **Severidade:** Média
- **Evidência:** `artifacts/api-server/src/app.ts` termina após montar o router; não há middleware 404 nem error handler.
- **Impacto:** erros não tratados podem retornar HTML/stack trace do Express, quebrando o contrato `{ error }` e expondo detalhes internos.
- **Correção recomendada:**
  - Middleware 404 para `/api/*` retornando `{ error: "Not found" }`.
  - Error handler final com log Pino e resposta JSON.
  - Não expor `stack` em produção.
- **Critérios de aceite:**
  - Rota inexistente retorna JSON 404.
  - Erro forçado retorna JSON 500 sem stack em produção.
  - Log contém `requestId`, rota e erro.

#### SEC-08 — Logout via GET

- **Severidade:** Baixa/Média
- **Evidência:**
  - `artifacts/api-server/src/routes/auth.ts:68-72` — `GET /logout`.
  - `lib/auth-web/src/use-auth.ts:47-49` — redireciona para `/api/logout`.
- **Impacto:** logout acionável por link/imagem e redirecionamento ignora `BASE_PATH`. O risco é limitado (não permite ações destrutivas), mas foge do padrão REST.
- **Correção recomendada:**
  - Criar `POST /auth/logout` e ajustar o frontend.
  - Redirecionar para `${BASE_PATH}/` ou retornar 204 e deixar o cliente navegar.
  - Manter `GET` temporariamente apenas por compatibilidade, se necessário.
- **Critérios de aceite:**
  - Frontend usa `POST`.
  - Sessão é removida e cookie limpo.
  - OpenAPI atualizado.

#### SEC-09 — Seed de demonstração em produção

- **Severidade:** Média
- **Evidência:**
  - `artifacts/api-server/src/lib/bootstrap.ts:49-52`.
  - `README.md:143-147` sugere `SEED_DEMO_DATA=true`.
- **Impacto:** se habilitado em produção, cria usuários de demonstração com senha conhecida (`senha123`).
- **Correção recomendada:**
  - Bloquear seed quando `NODE_ENV === "production"`, salvo flag explícita `ALLOW_DEMO_SEED=true`.
  - Documentar que o seed é apenas para ambientes de teste.
- **Critérios de aceite:**
  - Produção sem flag explícita não executa seed.
  - Log indica claramente quando o seed foi ignorado.

---

### 5.2 Regras de negócio

#### BIZ-01 — Regra de venda de 1/3 não implementada

- **Severidade:** Alta
- **Evidência:**
  - `README.md:163` — “Venda de dias: no máximo o saldo disponível; 1/3 do período”.
  - `artifacts/api-server/src/routes/employees.ts:423-434` — valida apenas o saldo.
  - `artifacts/vacation-dashboard/src/pages/employees/detail.tsx:1155` — `max` é o saldo, não 1/3.
- **Impacto:** funcionários/gestores podem vender mais dias do que a regra permite, gerando passivo trabalhista.
- **Correção recomendada:**
  - Definir a regra exata com o RH:
    - 1/3 do período aquisitivo (10 dias de 30), ou
    - 1/3 do saldo disponível.
  - Centralizar em uma constante/domínio (`MAX_SALE_RATIO = 1/3`).
  - Validar no servidor e refletir no `max` do formulário e nas mensagens.
  - Criar testes de limite (9, 10 e 11 dias).
- **Critérios de aceite:**
  - API rejeita venda acima do limite com 400 e mensagem clara.
  - UI impede selecionar acima do limite.
  - Testes cobrem exatamente o limite e o excedente.

#### BIZ-02 — Comentário e implementação divergem no acúmulo de férias

- **Severidade:** Alta (regra central)
- **Evidência:**
  - `artifacts/api-server/src/lib/vacation-utils.ts:16-21` — comentário: só após 1 ano completo, `floor(anos) * 30`.
  - `artifacts/api-server/src/lib/vacation-utils.ts:44-54` — código: acúmulo proporcional desde o primeiro dia (`diasTrabalhados / 365,25 * 30`).
  - `README.md:161` — descreve o cálculo proporcional.
- **Impacto:** manutenção e auditoria podem alterar a regra errada; o RH pode interpretar o saldo de forma diferente da implementação.
- **Correção recomendada:**
  - Decidir formalmente a política (recomendação: manter proporcional, que é o comportamento atual e documentado no README).
  - Remover o comentário obsoleto.
  - Extrair constantes (`DAYS_PER_YEAR`, `DAYS_PER_ACCRUAL_YEAR`).
  - Cobrir com testes de tabela: admissão hoje, 6 meses, 1 ano, 2 anos, datas-limite.
- **Critérios de aceite:**
  - Código, comentário, README e testes contam a mesma história.
  - Testes passam em datas de virada de ano e ano bissexto.

#### BIZ-03 — `daysUntilNextVacation` com semântica confusa

- **Severidade:** Média
- **Evidência:**
  - `artifacts/api-server/src/lib/vacation-utils.ts:80-112` — calcula o próximo aniversário a partir do fim da última férias.
  - `artifacts/vacation-dashboard/src/pages/employees/detail.tsx:611` — exibe “o próximo período fecha em X dias”.
- **Impacto:** o nome sugere “dias até as próximas férias”, mas o valor representa o próximo marco de acúmulo. A UI pode induzir a decisões erradas.
- **Correção recomendada:**
  - Renomear para `daysUntilNextAccrual` (ou equivalente) e ajustar o contrato.
  - Ou calcular de fato os dias até a próxima férias aprovada e separar os dois conceitos.
  - Alinhar o texto da UI.
- **Critérios de aceite:**
  - Nome do campo reflete o significado.
  - UI e API usam o mesmo conceito.
  - Teste cobre funcionário sem férias, com férias passadas e com férias futuras.

#### BIZ-04 — Falta de validação de sobreposição e duração

- **Severidade:** Alta
- **Evidência:**
  - `artifacts/api-server/src/routes/vacations.ts:122-220` — criação não verifica períodos existentes.
  - `artifacts/api-server/src/routes/vacations.ts:289-342` — edição também não verifica.
- **Impacto:** é possível criar férias sobrepostas para o mesmo funcionário, contando os mesmos dias duas vezes no saldo.
- **Correção recomendada:**
  - Antes de criar/editar, buscar períodos `pending`/`approved` que intersectem o novo intervalo.
  - Rejeitar com 409 e mensagem explicando o conflito.
  - Definir limite máximo de duração (ex.: 30 dias) e validar.
  - Validar `startDate <= endDate` (já existe) e, se a política exigir, data futura.
- **Critérios de aceite:**
  - Sobreposição total e parcial retornam 409.
  - Períodos adjacentes (fim + 1 dia) são aceitos.
  - Testes cobrem criação e edição.

#### BIZ-05 — Aprovação não revalida saldo

- **Severidade:** Alta
- **Evidência:** `artifacts/api-server/src/routes/vacations.ts:246-250` — atualiza o status diretamente.
- **Impacto:** uma solicitação criada quando havia saldo pode ser aprovada depois de outra férias/venda consumir o saldo, deixando o funcionário com saldo negativo mascarado por `Math.max(0, ...)`.
- **Correção recomendada:**
  - Recalcular o saldo no momento da aprovação.
  - Rejeitar a aprovação se o saldo for insuficiente, com mensagem clara.
  - Considerar transação/condição atômica para evitar corrida entre duas aprovações simultâneas.
- **Critérios de aceite:**
  - Aprovação sem saldo retorna 409/400.
  - Aprovação válida continua funcionando.
  - Teste cobre duas solicitações concorrentes.

#### BIZ-06 — Cascade de exclusão de funcionário incompleto

- **Severidade:** Média
- **Evidência:** `artifacts/api-server/src/routes/employees.ts:300-306`.
- **Impacto:** notificações de férias/vendas excluídas permanecem no banco, com links quebrados. A variável `vacationIds` é calculada e não usada.
- **Correção recomendada:**
  - Excluir notificações por `employeeId` e por `vacationId`.
  - Remover a variável morta.
  - Avaliar soft delete para preservar histórico.
- **Critérios de aceite:**
  - Após excluir funcionário, não restam notificações órfãs.
  - Teste cobre exclusão em cascata.

#### BIZ-07 — Relação usuário ↔ funcionário não é 1:1

- **Severidade:** Média
- **Evidência:**
  - `lib/db/src/models/employee.ts:22` — `userId` tem índice, mas não é único.
  - `artifacts/api-server/src/routes/employees.ts:120-141` — reutiliza usuário existente sem verificar vínculo anterior.
  - `artifacts/api-server/src/routes/me.ts:22` — usa `findOne({ userId })`.
- **Impacto:** o mesmo usuário pode ser vinculado a vários funcionários; `/me/employee` escolhe um arbitrariamente.
- **Correção recomendada:**
  - Criar índice único `sparse` em `employees.userId`.
  - Ao criar funcionário com usuário existente, retornar 409 se já houver vínculo.
  - Migrar dados duplicados antes de criar o índice.
- **Critérios de aceite:**
  - Banco rejeita duplicidade.
  - API retorna erro claro.
  - Migração documentada.

#### BIZ-08 — Gestor não pode agendar férias para o time

- **Severidade:** Média (decisão de produto)
- **Evidência:** `artifacts/api-server/src/routes/vacations.ts:142-145` — exige `emp.userId === req.user.id`.
- **Impacto:** se o RH precisa lançar férias em nome de funcionários, o fluxo atual não permite. Se a regra é autoatendimento, está correto.
- **Correção recomendada:**
  - Definir a política.
  - Se gestor puder agendar, permitir `req.user.isManager` como alternativa e registrar quem criou.
  - Se não puder, documentar explicitamente.
- **Critérios de aceite:**
  - Comportamento documentado e testado.

---

### 5.3 Contrato da API e frontend

#### API-01 — OpenAPI incompleto

- **Severidade:** Alta
- **Evidência:** `lib/api-spec/openapi.yaml` cobre 19 operações; a API implementa 28. Faltam:
  - `GET /vacations`
  - `PUT /vacations/{id}`
  - `GET /employees/{id}/vacation-sales`
  - `POST /employees/{id}/vacation-sales`
  - `DELETE /employees/{id}/vacation-sales/{saleId}`
  - `PUT /employees/{id}/password`
  - `GET /notifications`
  - `PUT /notifications/read-all`
  - `PUT /notifications/{id}/read`
- **Impacto:**
  - O cliente gerado não representa a API real.
  - O frontend usa `fetch` manual e duplica tipos.
  - Mudanças nesses endpoints não são detectadas por codegen/typecheck.
- **Correção recomendada:**
  - Adicionar as 9 operações ao OpenAPI, com schemas de request/response e erros.
  - Rodar `pnpm --filter @workspace/api-spec run codegen`.
  - Substituir os `fetch` manuais por hooks gerados.
  - Adicionar verificação de codegen limpo no CI.
- **Critérios de aceite:**
  - `openapi.yaml` cobre 100% das rotas montadas.
  - Nenhum `fetch` manual para endpoints da API no frontend.
  - CI falha se o código gerado estiver desatualizado.

#### API-02 — `BASE_PATH` não funciona de ponta a ponta

- **Severidade:** Média
- **Evidência:**
  - `lib/auth-web/src/use-auth.ts:24` — `fetch("/api/auth/user")`.
  - `lib/auth-web/src/use-auth.ts:48` — `window.location.href = "/api/logout"`.
  - `lib/api-client-react/src/generated/api.ts:54` — URLs geradas começam em `/api`.
  - `artifacts/vacation-dashboard/src/pages/employees/detail.tsx:323` — `fetch("/api/vacations/...")`.
  - `lib/api-client-react/src/custom-fetch.ts:28` — `setBaseUrl()` existe, mas não é chamado.
  - `artifacts/vacation-dashboard/vite.config.ts:16` — `BASE_PATH` é suportado no build.
- **Impacto:** o app só funciona corretamente com `BASE_PATH=/`. Se alguém publicar em subpath, login, logout, edição de férias e cliente gerado quebram.
- **Correção recomendada:**
  - Escolher uma das opções:
    1. **Suportar de verdade:** chamar `setBaseUrl(import.meta.env.BASE_URL.replace(/\/$/, ""))` uma vez no boot; fazer `useAuth` e logout usarem a mesma base; remover hardcodes.
    2. **Remover o suporte:** fixar `BASE_PATH=/` na documentação e no build, eliminando a configuração.
  - Recomendação: opção 1 se houver intenção de subpath; caso contrário, opção 2 para reduzir complexidade.
- **Critérios de aceite:**
  - Build com `BASE_PATH=/app` faz todas as chamadas para `/app/api/...`.
  - Login, logout, navegação e edição funcionam no subpath.
  - Ou `BASE_PATH` é removido/documentado como não suportado.

#### API-03 — Padrões mistos de acesso à API e tipos duplicados

- **Severidade:** Média
- **Evidência:**
  - `artifacts/vacation-dashboard/src/hooks/use-vacations.ts:54-63` — `fetch` manual.
  - `artifacts/vacation-dashboard/src/components/notification-bell.tsx:29,52,60` — `fetch` manual.
  - `artifacts/vacation-dashboard/src/pages/employees/detail.tsx:207,232,255,323,400` — múltiplos `fetch` manuais.
  - `artifacts/vacation-dashboard/src/pages/employees/detail.tsx` — uso de `(employee as any)`.
- **Impacto:** erros, loading e invalidação de cache ficam inconsistentes; tipos podem divergir do contrato.
- **Correção recomendada:**
  - Mover todas as chamadas para hooks gerados ou para um serviço único (`lib/api`).
  - Remover tipos locais duplicados (`VacationEntry`, etc.) quando o schema gerado já cobrir.
  - Eliminar `as any`, corrigindo os tipos na origem.
- **Critérios de aceite:**
  - Nenhum `fetch(` no diretório `pages/`/`components/` para endpoints da API.
  - Sem `as any` em modelos de domínio.
  - Tipos vêm de `@workspace/api-client-react` ou `@workspace/api-zod`.

#### API-04 — `detail.tsx` monolítico

- **Severidade:** Média
- **Evidência:** `artifacts/vacation-dashboard/src/pages/employees/detail.tsx` — 1.161 linhas.
- **Impacto:** difícil de testar, revisar e evoluir; concentra formulários, mutations, permissões e markup.
- **Correção recomendada:**
  - Extrair:
    - `EmployeeHeader` / dados cadastrais;
    - `VacationSection` + formulário;
    - `VacationSalesSection` + formulário;
    - `PasswordDialog`;
    - hooks de mutation por domínio.
  - Meta: página com menos de ~250 linhas.
- **Critérios de aceite:**
  - Componentes com responsabilidade única.
  - Sem regressão visual/funcional.
  - Testes ou pelo menos storybook/manual checklist.

---

### 5.4 Estrutura, limpeza e documentação

#### MNT-01 — `mockup-sandbox` é peso morto

- **Severidade:** Baixa
- **Evidência:** `artifacts/mockup-sandbox` — 63 arquivos TS/TSX, ~5.700 linhas; não é referenciado pelo app e não entra no build da Vercel (`vercel.json` filtra apenas `api-server` e `vacation-dashboard`), mas é typechecked/buildado no root.
- **Correção recomendada:** remover o pacote ou movê-lo para um repositório/branch de experimentos.
- **Critérios de aceite:** root build/typecheck mais rápido; nenhuma referência quebrada.

#### MNT-02 — Scripts `.py` duplicados

- **Severidade:** Baixa
- **Evidência:** `scripts/` contém `commit-changes.mjs`, `commit-changes.py`, `commit-changes.sh`, `commit-push.py`, `deploy.py`, `final-push.py`, `git-commit.py`, `git-sync.py`, `github-push.py`, `push-changes.py`, `push-to-github.py`, `push.py`.
- **Impacto:** confusão para novos contribuidores, risco de executar automação obsoleta.
- **Correção recomendada:** manter apenas `preinstall.mjs`, `src/seed-mongo.ts` e `src/hello.ts`; remover o restante ou mover para `scripts/legacy/`.
- **Critérios de aceite:** nenhum script duplicado; README atualizado.

#### MNT-03 — Asset não utilizado

- **Severidade:** Baixa
- **Evidência:** `attached_assets/image_1774962049680.png`; alias `@assets` em `vite.config.ts:45` não é usado por nenhum import.
- **Correção recomendada:** remover o asset e o alias, se não houver uso planejado.
- **Critérios de aceite:** build sem referências órfãs.

#### MNT-04 — Documentação desatualizada

- **Severidade:** Média
- **Evidência:**
  - `docs/ARCHITECTURE.md` não cita `vacation_sales` nem `notifications` no modelo de dados.
  - `docs/API.md` termina antes de notificações, vendas, troca de senha e `GET /vacations`.
  - `README.md` cita regra de 1/3 que não existe no código.
  - `docs/ARCHITECTURE.md` usa texto sem acentos, enquanto README usa acentos.
- **Correção recomendada:** atualizar após as correções; usar este documento como fonte de acompanhamento.
- **Critérios de aceite:** docs refletem o comportamento real; exemplos `curl` válidos.

#### MNT-05 — Resíduos do Replit e portabilidade

- **Severidade:** Média
- **Evidência:**
  - `pnpm-workspace.yaml:75-143` remove binários nativos de macOS/Linux ARM (esbuild, rollup, lightningcss) com comentário “replit uses linux-x64 only”.
  - `pnpm-workspace.yaml:43-65` mantém catálogo com plugins Replit e até dependências de Expo não usadas.
  - `artifacts/vacation-dashboard/vite.config.ts:5,27` importa e usa o plugin de overlay de erro do Replit.
- **Impacto:** pode inviabilizar `pnpm install/build` em macOS, apesar de o README dizer que suporta Linux/macOS; adiciona complexidade desnecessária.
- **Correção recomendada:** remover overrides específicos de plataforma e plugins Replit; manter apenas o necessário para Vercel/Windows/Linux/macOS.
- **Critérios de aceite:** `pnpm install` e `pnpm build` em macOS/Linux/Windows sem overrides de plataforma.

#### MNT-06 — Falta de `engines` e `packageManager`

- **Severidade:** Média
- **Evidência:** `package.json` raiz não define `engines` nem `packageManager`; README e CONTRIBUTING exigem Node 24+ e pnpm 10.
- **Impacto:** Vercel/CI podem usar versões diferentes e quebrar o build.
- **Correção recomendada:**
  - Adicionar `"packageManager": "pnpm@10.x"`.
  - Adicionar `"engines": { "node": ">=24" }`.
  - Conferir a versão de Node configurada na Vercel.
- **Critérios de aceite:** build reproduzível; versões documentadas e aplicadas.

#### GIT-01 — Branch `v0/add-preview-script` integrada e removida (resolvido)

- **Severidade:** Baixa
- **Status:** Resolvido em 21/10/2026.
- **Evidência histórica:**
  - `origin/v0/add-preview-script` (`af913f7`) estava 2 commits à frente da `main`, sem PR aberto.
  - `e8cc295` adicionou `dev`/`preview` ao `package.json` raiz, mas ambos cobrem apenas o frontend.
  - `af913f7` trocou o ícone da sidebar por `<img src="/favicon.svg">` em `artifacts/vacation-dashboard/src/components/layout.tsx`.
- **Resultado:**
  - Merge fast-forward realizado; `main` está em `af913f7`.
  - Branch remota `v0/add-preview-script` excluída.
  - Worktree residual `cosmic-panda` removido.
  - `pnpm run typecheck` passou após o merge.
- **Follow-ups relacionados:**
  - `API-02`: tornar o caminho do favicon compatível com `BASE_PATH` (ou remover o suporte a subpath).
  - `DX-04`: fazer `pnpm dev` subir API + frontend, ou documentar que ele sobe apenas o frontend.
- **Critérios de aceite:** integração e limpeza concluídas; restam apenas os follow-ups acima.

---

### 5.5 Operação e performance

#### OPS-01 — Consultas sem paginação e agregação em memória

- **Severidade:** Média (baixa no porte atual)
- **Evidência:**
  - `artifacts/api-server/src/routes/employees.ts:72-99` — carrega todos os funcionários, férias e vendas.
  - `artifacts/api-server/src/routes/dashboard.ts:20-22` — idem.
  - `artifacts/api-server/src/routes/vacations.ts:63-76` — carrega todas as férias e funcionários.
- **Impacto:** o custo cresce linearmente com o número de funcionários/férias; a function tem `maxDuration: 30` na Vercel.
- **Correção recomendada:**
  - Para o porte atual, monitorar tempo de resposta.
  - Se crescer: paginação/filtros, índices compostos e agregações no MongoDB.
  - Evitar recalcular estatísticas de todos os funcionários em toda requisição.
- **Critérios de aceite:** p95 do dashboard dentro do limite acordado; consultas com `explain` usando índices.

#### OPS-02 — Health check não verifica o banco

- **Severidade:** Baixa
- **Evidência:** `artifacts/api-server/src/routes/health.ts:6-8` retorna `{ status: "ok" }` sempre.
- **Impacto:** monitoramento pode considerar a API saudável mesmo com MongoDB indisponível (as rotas de dados retornam 503, mas o health não).
- **Correção recomendada:**
  - Verificar `mongoose.connection.readyState` ou ping leve.
  - Retornar 503 quando o banco estiver indisponível.
  - Manter um endpoint de liveness separado, se necessário.
- **Critérios de aceite:** health reflete a dependência; monitoramento configurado.

#### OPS-03 — Observabilidade limitada

- **Severidade:** Baixa
- **Evidência:** Pino configurado, mas sem alertas, tracing ou captura de erros no frontend.
- **Correção recomendada:** integrar Sentry (ou equivalente) para API e frontend; definir alertas de 5xx e latência.
- **Critérios de aceite:** erros críticos geram alerta; dashboard de latência disponível.

---

### 5.6 Qualidade e DX

#### DX-01 — Sem testes automatizados

- **Severidade:** Alta
- **Evidência:** não há arquivos `*.test.*`, `*.spec.*` nem script `test`.
- **Impacto:** regras centrais (saldo, 1/3, autorização) não têm proteção contra regressão.
- **Correção recomendada:**
  - Adicionar Vitest.
  - Priorizar testes de:
    - `calculateVacationStats` (tabela de datas e status);
    - autorização de férias (dono/gestor);
    - regra de venda 1/3;
    - validação de sobreposição;
    - sessão de usuário removido.
  - Para rotas, usar `supertest` com MongoDB em memória (`mongodb-memory-server`) ou banco de teste.
- **Critérios de aceite:** `pnpm test` passa; cobertura mínima acordada para o domínio.

#### DX-02 — Sem lint/formatação configurada

- **Severidade:** Média
- **Evidência:** `prettier` está em `devDependencies`, mas não há `.prettierrc`, script `format` nem ESLint.
- **Correção recomendada:**
  - Adicionar ESLint (flat config) + Prettier.
  - Scripts `lint`, `format`, `format:check`.
  - Rodar no CI.
- **Critérios de aceite:** `pnpm lint` e `pnpm format:check` passam.

#### DX-03 — Sem CI

- **Severidade:** Alta
- **Evidência:** `.github` não existe.
- **Correção recomendada:**
  - GitHub Actions com:
    - `pnpm install --frozen-lockfile`;
    - `pnpm typecheck`;
    - `pnpm lint`;
    - `pnpm test`;
    - `pnpm build`;
    - verificação de codegen limpo.
- **Critérios de aceite:** PR bloqueado se qualquer etapa falhar.

#### DX-04 — Sem script único de desenvolvimento

- **Severidade:** Baixa
- **Evidência:** README exige abrir API e frontend em terminais separados; não há `dev` no root. A branch `v0/add-preview-script` adiciona `dev`/`preview`, mas apenas para o frontend.
- **Correção recomendada:** adicionar `dev` com `concurrently` ou `pnpm -r --parallel`, mantendo a possibilidade de rodar separado.
- **Critérios de aceite:** `pnpm dev` sobe API + frontend com um comando.

---

## 6. Matriz consolidada

| ID | Área | Severidade | Esforço | Prioridade |
|---|---|---|---|---|
| SEC-01 | Cadastro aberto | Crítica | M | P0 |
| SEC-02 | Exclusão de férias sem authz | Crítica | S | P0 |
| SEC-03 | Sessão de usuário removido | Alta | S | P0 |
| SEC-04 | TTL/revogação de sessão e reset | Alta | M | P0 |
| SEC-05 | Rate limit/senha fraca | Alta | M | P0 |
| SEC-06 | CORS permissivo | Média | S | P1 |
| SEC-07 | Sem error handler JSON | Média | S | P1 |
| SEC-08 | Logout via GET | Baixa | S | P2 |
| SEC-09 | Seed em produção | Média | S | P0 |
| BIZ-01 | Regra de 1/3 ausente | Alta | M | P1 |
| BIZ-02 | Divergência no acúmulo | Alta | S | P0 (decisão) |
| BIZ-03 | `daysUntilNextVacation` confuso | Média | S | P1 |
| BIZ-04 | Sem validação de sobreposição | Alta | M | P1 |
| BIZ-05 | Aprovação sem revalidar saldo | Alta | M | P1 |
| BIZ-06 | Cascade de notificações | Média | S | P1 |
| BIZ-07 | Usuário ↔ funcionário não único | Média | M | P1 |
| BIZ-08 | Gestor não agenda para o time | Média | S | P2 (decisão) |
| API-01 | OpenAPI incompleto | Alta | L | P1 |
| API-02 | `BASE_PATH` inconsistente | Média | M | P1 |
| API-03 | Fetch manual/tipos duplicados | Média | M | P1 |
| API-04 | `detail.tsx` monolítico | Média | L | P2 |
| MNT-01 | `mockup-sandbox` | Baixa | S | P2 |
| MNT-02 | Scripts `.py` duplicados | Baixa | S | P2 |
| MNT-03 | Asset não usado | Baixa | S | P2 |
| MNT-04 | Docs desatualizadas | Média | M | P1 |
| MNT-05 | Resíduos Replit | Média | M | P1 |
| MNT-06 | Sem engines/packageManager | Média | S | P1 |
| GIT-01 | Branch `v0/add-preview-script` | — | — | Resolvido |
| OPS-01 | Sem paginação | Média | L | P2 |
| OPS-02 | Health sem banco | Baixa | S | P2 |
| OPS-03 | Observabilidade | Baixa | M | P2 |
| DX-01 | Sem testes | Alta | L | P0/P1 |
| DX-02 | Sem lint/format | Média | S | P1 |
| DX-03 | Sem CI | Alta | S | P1 |
| DX-04 | Sem `dev` root | Baixa | S | P2 |

Legenda de esforço: **S** = até 2h; **M** = 2–8h; **L** = 1–3 dias.

---

## 7. Plano de correção

### Fase 0 — Decisões e alinhamento (0,5 dia)

- [ ] Confirmar a política de cadastro (convite, allowlist ou aberto).
- [ ] Confirmar a regra de acúmulo de férias (proporcional vs. anual).
- [ ] Confirmar a regra de venda (1/3 do período ou 1/3 do saldo).
- [ ] Confirmar se gestor pode agendar/editar férias para o time.
- [ ] Confirmar se `BASE_PATH` é requisito real.
- [ ] Confirmar política de exclusão de funcionário (hard delete vs. soft delete).
- [x] Decidir o destino da branch `v0/add-preview-script`: merge fast-forward realizado e branch remota excluída.
- [ ] Registrar as decisões neste documento, na seção 9.

**Saída:** decisões registradas e escopo das fases 1–3 fechado.

---

### Fase 1 — Segurança e autorização (P0)

**Objetivo:** eliminar acessos indevidos e reduzir superfície de ataque sem alterar a experiência principal.

- [ ] **SEC-02:** corrigir autorização de `DELETE /vacations/:id` e adicionar testes.
- [ ] **SEC-03:** invalidar sessão quando o usuário não existir mais.
- [ ] **SEC-01:** bloquear cadastro aberto/auto-registro conforme decisão da Fase 0.
- [ ] **SEC-04:** adicionar TTL em `sessions.expire` e `password_reset_tokens.expiresAt`; hashear tokens; revogar sessões ao trocar/resetar senha.
- [ ] **SEC-05:** adicionar rate limit nas rotas de autenticação e elevar a política de senha.
- [ ] **SEC-09:** impedir seed de demonstração em produção.
- [ ] **DX-01 (parcial):** criar testes de autorização e de ciclo de sessão.

**Arquivos prováveis:**
`artifacts/api-server/src/routes/vacations.ts`, `auth.ts`, `employees.ts`, `app.ts`, `middlewares/authMiddleware.ts`, `lib/db/src/models/session.ts`, `lib/db/src/models/password-reset-token.ts`, `lib/db/src/seed.ts`, `lib/api-spec/openapi.yaml`.

**Critérios de aceite da fase:**
- Testes de autorização passam.
- Usuário removido recebe 401.
- Rate limit responde 429.
- Seed não roda em produção.
- `pnpm typecheck` e `pnpm test` passam.

---

### Fase 2 — Regras de negócio e contrato (P1)

**Objetivo:** garantir que a API e o frontend contem a mesma história e que as regras de RH estejam corretas.

- [ ] **BIZ-02:** alinhar acúmulo de férias e remover comentário obsoleto; criar testes de tabela.
- [ ] **BIZ-01:** implementar limite de venda de 1/3 no servidor e na UI.
- [ ] **BIZ-04:** validar sobreposição e duração de férias.
- [ ] **BIZ-05:** revalidar saldo na aprovação.
- [ ] **BIZ-03:** renomear/ajustar `daysUntilNextVacation` e textos da UI.
- [ ] **BIZ-06:** limpar notificações no cascade de exclusão.
- [ ] **BIZ-07:** criar índice único para `employee.userId` e tratar conflitos.
- [ ] **API-01:** completar OpenAPI com as 9 operações e regenerar clientes.
- [ ] **API-02:** corrigir `BASE_PATH` ou removê-lo oficialmente.
- [ ] **API-03:** substituir `fetch` manuais por hooks/serviço único.
- [ ] **SEC-06 / SEC-07 / SEC-08:** CORS allowlist, error handler JSON e logout via POST.
- [ ] **MNT-04:** atualizar `ARCHITECTURE.md`, `API.md` e `README.md`.
- [ ] **MNT-05 / MNT-06:** remover resíduos Replit, adicionar `engines`/`packageManager`.
- [x] **GIT-01:** branch `v0/add-preview-script` integrada via fast-forward e branch remota excluída; follow-ups de favicon e scripts em `API-02` e `DX-04`.
- [ ] **DX-02 / DX-03:** configurar lint, Prettier e CI.

**Critérios de aceite da fase:**
- OpenAPI cobre todas as rotas; codegen limpo.
- Regras de 1/3, sobreposição e saldo cobertas por testes.
- Nenhum `fetch` manual para endpoints da API.
- Docs atualizadas.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` e `pnpm build` passam no CI.

---

### Fase 3 — Limpeza e evolução (P2)

**Objetivo:** reduzir dívida técnica e melhorar experiência de desenvolvimento.

- [ ] **MNT-01:** remover `mockup-sandbox` (ou mover para branch de experimentos).
- [ ] **MNT-02:** remover scripts `.py` duplicados.
- [ ] **MNT-03:** remover asset/alias não usados.
- [ ] **API-04:** refatorar `detail.tsx` em componentes/hooks.
- [ ] **DX-04:** adicionar script `dev` no root.
- [ ] **OPS-01:** avaliar paginação/agregações conforme crescimento.
- [ ] **OPS-02:** health check com ping no banco.
- [ ] **OPS-03:** observabilidade (Sentry/alertas).
- [ ] **BIZ-08:** documentar/decidir agendamento por gestor.
- [ ] **SEC-08:** migrar logout para POST, se ainda não feito.
- [x] **GIT-01:** worktree residual `cosmic-panda` removido em 21/10/2026.

**Critérios de aceite da fase:**
- Build mais rápido e sem pacotes mortos.
- Página de detalhe com componentes coesos.
- Monitoramento básico ativo.

---

## 8. Checklist de validação manual

Após as correções, validar em ambiente local e em preview da Vercel:

### Autenticação
- [ ] Login com credenciais válidas.
- [ ] Login inválido retorna 401 sem vazar se o e-mail existe.
- [ ] `POST /auth/register-local` bloqueado sem convite/allowlist.
- [ ] `POST /me/employee` bloqueado para usuário não autorizado.
- [ ] Reset de senha envia e-mail/log e invalida sessões antigas.
- [ ] Logout limpa cookie e sessão.
- [ ] Após remover usuário do banco, a sessão deixa de funcionar.

### Funcionários
- [ ] Gestor cria funcionário.
- [ ] Não-gestor recebe 403 ao criar/editar/excluir.
- [ ] Não é possível vincular o mesmo usuário a dois funcionários.
- [ ] Exclusão remove férias, vendas e notificações relacionadas.
- [ ] Listagem e detalhe respeitam as permissões definidas.

### Férias
- [ ] Funcionário solicita férias para si.
- [ ] Solicitação com saldo insuficiente é rejeitada.
- [ ] Sobreposição total/parcial é rejeitada.
- [ ] Gestor aprova/reprova.
- [ ] Aprovação sem saldo é rejeitada.
- [ ] Funcionário A não exclui férias de B.
- [ ] Edição só funciona em status `pending` e para o dono.

### Vendas de férias
- [ ] Gestor registra venda dentro do limite.
- [ ] Venda acima de 1/3 é rejeitada.
- [ ] Venda acima do saldo é rejeitada.
- [ ] Exclusão devolve os dias ao saldo.
- [ ] Não-gestor não registra/exclui venda.

### Notificações
- [ ] Solicitação notifica gestores.
- [ ] Aprovação/reprovação notifica funcionário.
- [ ] Marcar como lida funciona e é escopado ao usuário.
- [ ] Exclusão de funcionário/férias não deixa notificações órfãs.

### Infra e frontend
- [ ] `pnpm dev` sobe API + frontend.
- [ ] Build de produção funciona.
- [ ] `BASE_PATH` (se suportado) funciona em subpath.
- [ ] `/healthz` reflete o estado do banco.
- [ ] Erros retornam JSON consistente.
- [ ] CORS rejeita origem não permitida.

---

## 9. Decisões pendentes

| Tema | Opções | Recomendação | Decisão |
|---|---|---|---|
| Cadastro | Aberto / allowlist de domínio / convite / somente gestor | **Convite ou allowlist** | _a definir_ |
| Acúmulo de férias | Proporcional desde o dia 1 / somente após 1 ano | **Manter proporcional** (comportamento atual e documentado no README) | _a definir_ |
| Venda de dias | 1/3 do período aquisitivo / 1/3 do saldo | **1/3 do período (10 dias)** com constante configurável | _a definir_ |
| Gestor agenda para o time | Sim / não | **Sim, se houver necessidade operacional**; registrar autor | _a definir_ |
| `BASE_PATH` | Suportar / remover | **Remover** se não houver caso de uso; reduz complexidade | _a definir_ |
| Exclusão de funcionário | Hard delete / soft delete | **Soft delete** se histórico importar | _a definir_ |
| Retenção de notificações | 30/90 dias / indefinido | Definir TTL após validar uso | _a definir_ |
| Branch `v0/add-preview-script` | Merge / cherry-pick do ícone / descarte | **Merge fast-forward + branch removida** | **Concluído em 21/10/2026** |

---

## 10. Comandos e verificação

### Pré-requisitos

- Node.js 24+
- pnpm 10+
- MongoDB 7/8 (local ou Atlas)

### Instalação e desenvolvimento

```bash
pnpm install

# seed local
MONGODB_URI="mongodb://localhost:27017/holiday_dashboard" \
  pnpm --filter @workspace/scripts run seed:mongo

# API (porta 8080)
MONGODB_URI="mongodb://localhost:27017/holiday_dashboard" \
  PORT=8080 pnpm --filter @workspace/api-server run dev

# frontend (porta 20421)
PORT=20421 BASE_PATH=/ pnpm --filter @workspace/vacation-dashboard run dev
```

No Windows, usar a versão em PowerShell documentada no `README.md`.

### Verificações

```bash
pnpm run typecheck
pnpm run build

# após alterar o OpenAPI
pnpm --filter @workspace/api-spec run codegen

# quando os scripts de teste/lint forem adicionados
pnpm test
pnpm lint
pnpm format:check
```

### Checklist de PR

- [ ] `pnpm typecheck` passa.
- [ ] `pnpm build` passa.
- [ ] `pnpm lint` passa.
- [ ] `pnpm test` passa.
- [ ] OpenAPI atualizado e codegen limpo.
- [ ] Migrações/índices documentados.
- [ ] Nenhum segredo ou `.env` versionado.
- [ ] Documentação atualizada.

---

## 11. Anexos

### 11.1 Estatísticas por módulo

| Módulo | Arquivos TS/TSX | Linhas |
|---|---:|---:|
| `artifacts/vacation-dashboard` | 75 | ~8.800 |
| `artifacts/mockup-sandbox` | 63 | ~5.704 |
| `lib/api-client-react` | 4 | ~1.919 |
| `artifacts/api-server` | 18 | ~1.570 |
| `lib/api-zod` | 29 | ~767 |
| `lib/db` | 12 | ~450 |
| `lib/api-spec` | 1 | ~68 |
| `lib/auth-web` | 2 | ~51 |
| `scripts` | 2 | ~27 |

### 11.2 Arquivos com maior concentração de lógica

| Arquivo | Linhas | Risco |
|---|---:|---|
| `artifacts/vacation-dashboard/src/pages/employees/detail.tsx` | 1.161 | Monólito de UI |
| `artifacts/api-server/src/routes/employees.ts` | 472 | Muitas responsabilidades |
| `artifacts/vacation-dashboard/src/pages/employees/index.tsx` | 413 | Listagem + regras de alerta |
| `artifacts/api-server/src/routes/vacations.ts` | 369 | Regras centrais de férias |
| `artifacts/vacation-dashboard/src/pages/calendar.tsx` | 251 | Calendário |
| `artifacts/vacation-dashboard/src/components/registration-gate.tsx` | 238 | Onboarding |

### 11.3 Referências rápidas

- Deploy e variáveis: `README.md`.
- Arquitetura: `docs/ARCHITECTURE.md`.
- API: `docs/API.md` e `lib/api-spec/openapi.yaml`.
- Regras de férias: `artifacts/api-server/src/lib/vacation-utils.ts`.
- Sessão: `artifacts/api-server/src/lib/auth.ts` e `middlewares/authMiddleware.ts`.
- Modelos: `lib/db/src/models/`.
- Configuração de build: `vercel.json` e `artifacts/api-server/build.mjs`.

---

## 12. Histórico do documento

| Data | Alteração | Autor |
|---|---|---|
| 21/10/2026 | Criação do documento com análise e plano inicial | Análise técnica |
| 21/10/2026 | Inclusão da verificação de branches, worktrees e do achado `GIT-01` | Análise técnica |
| 21/10/2026 | Merge fast-forward da branch v0 (`af913f7`), exclusão da branch remota e remoção do worktree `cosmic-panda`; documento atualizado | Análise técnica |
