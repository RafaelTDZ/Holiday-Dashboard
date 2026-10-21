# Arquitetura do Sistema

## Visao Geral

O Holiday Dashboard segue uma arquitetura de monorepo com separacao clara entre frontend, backend e bibliotecas compartilhadas.

```
┌─────────────────────────────────────────────────────────────────┐
│                         MONOREPO                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────┐    ┌─────────────────────┐            │
│  │   vacation-dashboard │    │     api-server      │            │
│  │      (Frontend)      │────│      (Backend)      │            │
│  │                      │    │                      │            │
│  │  React + Vite        │    │  Express.js         │            │
│  │  TailwindCSS         │    │  Login local + Google│            │
│  │  React Query         │    │  MongoDB (Mongoose) │            │
│  └──────────┬───────────┘    └──────────┬──────────┘            │
│             │                            │                       │
│             │    ┌─────────────────┐    │                       │
│             └────│  Bibliotecas    │────┘                       │
│                  │  Compartilhadas │                            │
│                  │                 │                            │
│                  │  api-client     │                            │
│                  │  api-zod        │                            │
│                  │  api-spec       │                            │
│                  │  auth-web       │                            │
│                  │  db (Mongoose)  │                            │
│                  └─────────────────┘                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Componentes Principais

### 1. Frontend (vacation-dashboard)

O frontend e uma Single Page Application (SPA) construida com React.

#### Estrutura de Diretorios

```
vacation-dashboard/
├── src/
│   ├── components/        # Componentes reutilizaveis
│   │   ├── ui/           # Componentes base (shadcn/ui)
│   │   ├── layout.tsx    # Layout principal
│   │   └── ...
│   ├── pages/            # Paginas da aplicacao
│   │   ├── dashboard.tsx
│   │   ├── calendar.tsx
│   │   ├── employees/
│   │   └── ...
│   ├── hooks/            # Hooks customizados
│   ├── utils/            # Utilitarios
│   └── App.tsx           # Componente raiz
├── public/               # Assets estaticos
└── vite.config.ts        # Configuracao do Vite
```

#### Fluxo de Dados

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Paginas   │────▶│   Hooks     │────▶│  API Client │
│             │◀────│ (useQuery)  │◀────│  (Orval)    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ React Query │
                    │   Cache     │
                    └─────────────┘
```

### 2. Backend (api-server)

O backend e uma API REST construida com Express.js.

#### Estrutura de Diretorios

```
api-server/
├── src/
│   ├── routes/           # Rotas da API
│   │   ├── auth.ts       # Autenticacao (local + Google)
│   │   ├── employees.ts  # CRUD de funcionarios
│   │   ├── vacations.ts  # Gestao de ferias
│   │   ├── dashboard.ts  # Dados do dashboard
│   │   └── me.ts         # Perfil do usuario
│   ├── middlewares/      # Middlewares
│   │   ├── authMiddleware.ts   # Valida a sessao
│   │   ├── error-handler.ts    # Erros em JSON (404/500)
│   │   └── rate-limit.ts       # Limite de requisicoes (em memoria)
│   ├── lib/              # Utilitarios
│   │   ├── auth.ts       # Funcoes de autenticacao
│   │   ├── email.ts      # Envio de emails
│   │   ├── email-domain.ts      # Dominio de e-mail permitido
│   │   ├── google-auth.ts       # OAuth 2.0 do Google (Workspace)
│   │   ├── logger.ts     # Logging (Pino)
│   │   ├── password-policy.ts   # Politica de senha
│   │   ├── rate-limit.ts         # (reexportado pelos middlewares)
│   │   └── vacation-utils.ts
│   ├── types/            # Tipos TypeScript
│   ├── app.ts            # Configuracao do Express
│   └── index.ts          # Entry point
├── tests/               # Testes unitarios (vitest)
└── tsconfig.json
```

#### Pipeline de Requisicoes

```
Request
   │
   ▼
┌─────────────────┐
│ CORS (allowlist │
│  CORS_ORIGINS)  │
│  Cookie Parsers │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Auth Middleware │  (sessao invalidada se o usuario nao existir mais)
│ (Session Check) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Router      │  (rate limit nas rotas de autenticacao)
│  /api/...       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Handler      │
│  (Controller)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Error Handler  │  (sempre JSON; 404 tambem)
└─────────────────┘
```

### 3. Bibliotecas Compartilhadas

#### api-spec

Contem a especificacao OpenAPI 3.1 que define:
- Endpoints da API
- Schemas de request/response
- Parametros e validacoes

#### api-client-react

Cliente React Query gerado automaticamente pelo Orval:
- Hooks para cada endpoint
- Tipos TypeScript
- Integracao com React Query

#### api-zod

Schemas Zod gerados a partir da especificacao OpenAPI:
- Validacao em runtime
- Tipos TypeScript inferidos

## Fluxo de Autenticacao

O sistema aceita dois caminhos de autenticacao, e ambos terminam na **mesma**
sessao server-side (colecao `sessions` do MongoDB) com o cookie `sid` (HttpOnly):

1. **Login local** com e-mail e senha (bcrypt);
2. **Login com Google** (OAuth 2.0, restrito ao Workspace pelo parametro `hd`
   e validado no servidor).

```
┌─────────┐     ┌──────────────────┐     ┌──────────────┐     ┌──────────────┐
│ Browser │────▶│  Frontend        │────▶│ /api/auth/   │────▶│  MongoDB     │
│         │     │  (login-local)   │     │ login-local  │     │  users +     │
│         │     │                  │     │              │     │  sessions    │
└─────────┘     └──────────────────┘     └──────┬───────┘     └──────────────┘
                                              │
                                              │ Set-Cookie: sid=...
                                              ▼
                                      ┌──────────────┐
                                      │ Cookie SID   │
                                      │ (HttpOnly)   │
                                      └──────────────┘
```

O papel de coordenador (`isManager`) e lido do banco a cada requisicao, sem
cache na sessao. Quem se cadastra entra sempre como **empregado**
(`isManager = false`) — o papel de coordenador e concedido pelo administrador.

Regras complementares:

- O acesso e restrito ao dominio corporativo (`ALLOWED_EMAIL_DOMAIN`, padrao
  `tdztrading.com.br`) no login, no cadastro e na recuperacao de senha.
- A sessao e invalidada quando o usuario deixa de existir no banco, e o
  `expire` da sessao e limpo pelo TTL do MongoDB.
- Trocar ou redefinir a senha revoga as outras sessoes do usuario.
- O logout e feito por `POST /api/logout` (o `GET` esta depreciado).

## Modelo de Dados

### Entidades Principais

```
┌─────────────────┐       ┌─────────────────┐
│    Employee     │       │    Vacation     │
├─────────────────┤       ├─────────────────┤
│ id              │◀──────│ id              │
│ name            │   1:N │ employeeId      │
│ role            │       │ startDate       │
│ department      │       │ endDate         │
│ hireDate        │       │ durationDays    │
│ createdAt       │       │ notes           │
│ userId (user)   │       │ status          │
└─────────────────┘       │ createdAt       │
                          └─────────────────┘
```

### Status de Ferias

```
pending ──▶ approved
   │
   └──────▶ rejected
```

## Seguranca

### Autenticacao
- Login local com e-mail e senha (bcrypt, 12 rounds) e login com Google (OAuth 2.0)
- Dominio corporativo obrigatorio (`ALLOWED_EMAIL_DOMAIN`)
- Politica de senha: minimo de 10 caracteres, 3 de 4 grupos de caracteres
- Sessoes com cookies HttpOnly (armazenadas no MongoDB, com TTL)
- Tokens de redefinição de senha guardados como hash SHA-256 (TTL de 1h)
- Rate limit nas rotas de autenticacao (30/5 min no login, 10/15 min na recuperacao)
- Suporte a tokens Bearer para integracoes moveis

### Autorizacao
- Verificacao de sessao em rotas protegidas
- Sessao invalidada quando o usuario e removido do banco
- Papel de gestor (isManager) para acoes administrativas, lido do banco a cada requisicao
- Usuarios so podem ver/editar seus proprios dados
- Restricoes por dono: excluir/cancelar férias, aprovar e vender dias sao do gestor

### Boas Praticas
- CORS com allowlist (`CORS_ORIGINS`)
- Error handler JSON (sem HTML nem stack trace em producao)
- Validacao de entrada com Zod
- Logging estruturado com Pino
- Variaveis de ambiente para configuracoes sensiveis
- Testes unitarios (vitest) e CI com typecheck, lint e testes

## Escalabilidade

### Atual
- Monorepo com pnpm workspaces
- Builds independentes por projeto
- Cache de queries no frontend

### Futuro
- Microservicos (se necessario)
- Cache Redis para sessoes
- CDN para assets estaticos
- Load balancer para multiplas instancias
