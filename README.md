# Dashboard de Férias

Painel de gestão de férias para RH: acompanhamento de saldos, solicitações,
aprovações e avisos automáticos.

- **Frontend**: React 19 + Vite 7 (Tailwind CSS 4, shadcn/ui, TanStack Query)
- **API**: Express 5 (TypeScript), empacotada como Serverless Function da Vercel
- **Banco de dados**: MongoDB (Mongoose 8) — Atlas em produção
- **Monorepo**: pnpm workspaces
- **Deploy**: Vercel (frontend estático + `/api` na mesma função, mesmo domínio)

## Estrutura

```text
.
├── api/                          # Serverless Function da Vercel (/api/*)
├── artifacts/
│   ├── api-server/               # API Express (rotas, middleware, libs)
│   ├── mockup-sandbox/           # Playground de mockups
│   └── vacation-dashboard/       # Frontend React + Vite
├── lib/
│   ├── api-spec/                 # OpenAPI 3.1 + geração de código (Orval)
│   ├── api-client-react/         # Hooks TanStack Query gerados
│   ├── api-zod/                  # Schemas Zod gerados
│   ├── auth-web/                 # Hook useAuth() do frontend
│   └── db/                       # Modelos Mongoose + conexão MongoDB
├── scripts/                      # Scripts utilitários (ex.: seed do MongoDB)
├── vercel.json                   # Configuração de build/rotas da Vercel
└── pnpm-workspace.yaml
```

## Variáveis de ambiente

| Variável | Onde é usada | Descrição |
| --- | --- | --- |
| `MONGODB_URI` | API | String de conexão do MongoDB (Atlas) |
| `ADMIN_EMAIL` | API | E-mail do coordenador criado/promovido no primeiro acesso (ex.: `admin@tdztrading.com.br`) |
| `ADMIN_PASSWORD` | API | Senha desse coordenador (mínimo 6 caracteres) |
| `ALLOWED_EMAIL_DOMAIN` | API + Frontend | Domínio corporativo liberado para login, cadastro e recuperação de senha (padrão `tdztrading.com.br`; use `*` para desativar a restrição) |
| `APP_URL` | API | URL pública do app, usada no link de redefinição de senha |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | API | Envio de e-mail (opcional; sem SMTP o link é impresso no log) |
| `PORT` / `BASE_PATH` | Frontend | Porta e base path do Vite (padrões: `3000` e `/`) |
| `API_PROXY_TARGET` | Frontend (dev) | Endereço da API usado pelo proxy do Vite (padrão `http://localhost:8080`) |

## Desenvolvimento local

Requer Node.js 24+ e pnpm 10.

### 1. MongoDB

Qualquer instância 7+/8+ serve (local ou Atlas). No Windows, a versão portable
não exige privilégios de administrador:

```powershell
# baixa (uma vez) e extrai o servidor
$dir = "$env:TEMP\mongodb"
Invoke-WebRequest -Uri "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-8.0.23.zip" -OutFile "$dir\mongodb.zip"
Expand-Archive "$dir\mongodb.zip" "$dir\mongodb" -Force

# sobe em background (independe do terminal)
New-Item -ItemType Directory -Force -Path "$env:TEMP\mongodb-data" | Out-Null
Start-Process -FilePath "$dir\mongodb\mongodb-win32-x86_64-windows-8.0.23\bin\mongod.exe" `
  -ArgumentList @("--dbpath", "$env:TEMP\mongodb-data", "--port", "27017", "--bind_ip", "127.0.0.1") `
  -WindowStyle Hidden
```

Em Linux/macOS: `mongod --dbpath ./tmp/mongo --port 27017`.

### 2. Dependências, seed e servidores

```bash
pnpm install

# popular o banco com os dados de demonstração
MONGODB_URI="mongodb://localhost:27017/holiday_dashboard" pnpm --filter @workspace/scripts run seed:mongo

# API (porta 8080)
MONGODB_URI="mongodb://localhost:27017/holiday_dashboard" \
  PORT=8080 pnpm --filter @workspace/api-server run dev

# Frontend (porta 20421)
PORT=20421 BASE_PATH=/ pnpm --filter @workspace/vacation-dashboard run dev
```

O Vite faz proxy de `/api` para `http://localhost:8080` durante o
desenvolvimento, então o app funciona em `http://localhost:20421`.

> O `mongod` em background não sobrevive a reinícios do Windows. Se a API
> responder `{"status":"ok"}` mas os dados não carregarem, verifique se o
> MongoDB está no ar (`Test-NetConnection localhost -Port 27017`) — a conexão
> do Mongoose se reconecta sozinha assim que ele voltar.

### Rodar em segundo plano (Windows)

Processos iniciados dentro de um terminal integrado podem ser encerrados
quando a sessão fecha. Para manter a API e o frontend de pé, inicie-os
desacoplados:

```powershell
$logs = "$env:TEMP\holiday-dashboard-logs"; New-Item -ItemType Directory -Force -Path $logs | Out-Null

# API
$env:PORT="8080"; $env:MONGODB_URI="mongodb://127.0.0.1:27017/holiday_dashboard"
Start-Process node.exe -ArgumentList @("--enable-source-maps", "artifacts\api-server\dist\index.mjs") `
  -WindowStyle Hidden -RedirectStandardOutput "$logs\api.log" -RedirectStandardError "$logs\api.err.log"

# Frontend
$env:PORT="20421"; $env:BASE_PATH="/"; $env:API_PROXY_TARGET="http://localhost:8080"
Start-Process cmd.exe -ArgumentList @("/c", "pnpm --filter @workspace/vacation-dashboard run dev > `"$logs\web.log`" 2>&1") -WindowStyle Hidden
```

Para encerrar: `Stop-Process -Id (Get-NetTCPConnection -LocalPort 8080,20421 -State Listen).OwningProcess`.

No Linux/macOS, o equivalente é `nohup ... &` (ou `tmux`/`screen`).



## Build e verificação

```bash
pnpm run typecheck   # tsc --build em todos os pacotes
pnpm run build       # typecheck + build de cada pacote
```

## Deploy na Vercel

O projeto usa o preset "Other" com:

- `buildCommand`: build do bundle da API + build do frontend
- `outputDirectory`: `artifacts/vacation-dashboard/dist/public`
- `api/index.js`: a API Express como Serverless Function, montada em `/api`
- rewrite de `/api/*` para a função e das demais rotas para `/index.html` (SPA)

Produção: **https://holiday-dashboard-rafael-1902s-projects.vercel.app**

Configure no painel da Vercel (Production e Preview):

| Variável | Valor |
| --- | --- |
| `MONGODB_URI` | String de conexão do MongoDB Atlas (já configurada) |
| `ADMIN_EMAIL` | E-mail do coordenador (ex.: `admin@tdztrading.com.br`) |
| `ALLOWED_EMAIL_DOMAIN` | `tdztrading.com.br` (ou `*` para desativar a restrição) |
| `ADMIN_PASSWORD` | Senha desse coordenador |
| `APP_URL` | URL pública do app |
| `SEED_DEMO_DATA` | `true` para popular o conjunto de demonstração |

`ADMIN_EMAIL`/`ADMIN_PASSWORD` criam (ou promovem) o coordinator no primeiro
acesso. Com `SEED_DEMO_DATA=true` o conjunto de demonstração também é criado
de forma idempotente — os demais usuários usam a senha `senha123`.

> Restrição de acesso: com `ALLOWED_EMAIL_DOMAIN=tdztrading.com.br`, apenas e-mails desse domínio podem fazer login, cadastro ou solicitar redefinição de senha. Se precisar abrir para testes, defina `ALLOWED_EMAIL_DOMAIN=*`.


## Contrato da API

A especificação OpenAPI fica em `lib/api-spec/openapi.yaml`. Depois de
alterá-la, regenere os clientes:

```bash
pnpm --filter @workspace/api-spec run codegen
```

## Regras de negócio

- Saldo de férias: `(dias trabalhados / 365,25) × 30 − dias aprovados − dias vendidos`
- Só férias **aprovadas** entram no saldo e na indicatoração "em férias hoje"
- O primeiro pedido exige saldo ≥ 30 dias
- Venda de dias: no máximo o saldo disponível; 1/3 do período
- Coordenadores (`isManager`) aprovam/reprovam pedidos e gestionam a equipe
- O flag `isManager` é lido do banco a cada requisição (sem cache em sessão)
