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
│  │  TailwindCSS         │    │  Login local        │            │
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
│   │   ├── auth.ts       # Autenticacao
│   │   ├── employees.ts  # CRUD de funcionarios
│   │   ├── vacations.ts  # Gestao de ferias
│   │   ├── dashboard.ts  # Dados do dashboard
│   │   └── me.ts         # Perfil do usuario
│   ├── middlewares/      # Middlewares
│   │   └── authMiddleware.ts
│   ├── lib/              # Utilitarios
│   │   ├── auth.ts       # Funcoes de autenticacao
│   │   ├── email.ts      # Envio de emails
│   │   ├── logger.ts     # Logging (Pino)
│   │   └── vacation-utils.ts
│   ├── types/            # Tipos TypeScript
│   ├── app.ts            # Configuracao do Express
│   └── index.ts          # Entry point
└── tsconfig.json
```

#### Pipeline de Requisicoes

```
Request
   │
   ▼
┌─────────────────┐
│   CORS/Cookie   │
│    Parsers      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Auth Middleware │
│ (Session Check) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Router      │
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
Response
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

O sistema usa autenticacao local com e-mail e senha (bcrypt). A sessao fica
no servidor (colecao `sessions` do MongoDB) e o navegador recebe apenas o
cookie `sid` (HttpOnly).

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
cache na sessao.

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
- Login local com e-mail e senha (bcrypt, 12 rounds)
- Sessoes com cookies HttpOnly (armazenadas no MongoDB)
- Suporte a tokens Bearer para integracoes moveis

### Autorizacao
- Verificacao de sessao em rotas protegidas
- Papel de gestor (isManager) para acoes administrativas
- Usuarios so podem ver/editar seus proprios dados

### Boas Praticas
- CORS configurado
- Validacao de entrada com Zod
- Logging estruturado com Pino
- Variaveis de ambiente para configuracoes sensiveis

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
