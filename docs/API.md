# Guia de API

## Introducao

A API do Holiday Dashboard segue a especificacao OpenAPI 3.1 e utiliza JSON para todas as requisicoes e respostas.

## URL Base

```
/api
```

## Autenticacao

A API suporta dois metodos de autenticacao:

### 1. Cookie de Sessao (Web)

Para aplicacoes web, a autenticacao e feita via cookie HttpOnly `sid`.

```http
GET /api/auth/user
Cookie: sid=<session_id>
```

### 2. Token Bearer (Mobile)

Para aplicacoes mobile, use o header Authorization:

```http
GET /api/auth/user
Authorization: Bearer <session_token>
```

### 3. Google (Workspace) (opcional)

Quando `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` estao configurados, o login
com Google fica disponivel. O botao so aparece quando a API responde
`{"google": true}` em `GET /api/auth/providers`.

```http
GET /api/auth/google          # 302 para o consentimento do Google
GET /api/auth/google/callback # volta do Google e abre a sessao
```

O dominio do Workspace e enviado como `hd` e **validado no servidor** antes de
criar a sessao. Quem entra por esse caminho nasce como empregado, igual aos
outros.

### Restricoes

- **Dominio corporativo:** login, cadastro e recuperacao de senha so aceitam
  e-mails de `ALLOWED_EMAIL_DOMAIN` (padrao `tdztrading.com.br`).
- **Perfil base:** quem se cadastra e sempre **empregado** (`isManager =
  false`). O papel de coordenador e concedido pelo administrador.
- **Rate limit:** 30 requisicoes a cada 5 minutos no login/cadastro e 10 a cada
  15 minutos na recuperacao de senha (por IP).
- **Politica de senha:** minimo de 10 caracteres, 3 de 4 grupos (minuscula,
  maiuscula, numero, simbolo) e a senha nao pode conter o e-mail da conta.

## Erros

Todas as respostas de erro saem em JSON, no formato `{ "error": "mensagem" }`.
O `GET /api/logout` esta depreciado: use `POST /api/logout`.

## Endpoints

### Saude

#### GET /api/healthz

Verifica o status de saude do servidor.

**Resposta 200:**
```json
{
  "status": "ok"
}
```

---

### Autenticacao

#### GET /api/auth/providers

Informa quais provedores externos de login estao configurados.

**Resposta 200:**
```json
{ "google": true }
```

---

#### GET /api/auth/google

Redireciona para a tela de consentimento do Google (OAuth 2.0). Salva um
`state` aleatorio em cookie para proteger o round-trip contra CSRF.

**Resposta 302:** para `https://accounts.google.com/o/oauth2/v2/auth`
**Resposta 404:** `{ "error": "Login com Google não configurado." }`

---

#### GET /api/auth/google/callback

Callback do Google. Valida o `state`, troca o `code` por tokens, confere a
assinatura do id_token, `email_verified` e o dominio permitido, cria (ou
atualiza) o usuario e inicia a sessao com o cookie `sid`.

**Query:** `code`, `state`, `error`

**Resposta 302:** para a raiz do app em caso de sucesso, ou para
`/login?error=<codigo>` (`google_invalido`, `google_falha`,
`dominio_nao_permitido`, `access_denied`).

---

#### POST /api/auth/register-local

Cria uma conta com e-mail e senha e inicia a sessao.

**Corpo:**
```json
{ "email": "user@tdztrading.com.br", "password": "minimo-10-caracteres" }
```

**Resposta 200:** `{ "ok": true }` (e o cookie de sessao `sid`)

**Resposta 400:** e-mail inválido, fora do domínio corporativo permitido (`ALLOWED_EMAIL_DOMAIN`) ou senha que não atende à política (mínimo de 10 caracteres, 3 de 4 grupos de caracteres)
**Resposta 409:** o e-mail já está cadastrado
**Resposta 429:** limite de requisições excedido

---

#### POST /api/auth/login-local

Autentica com e-mail e senha.

**Corpo:**
```json
{ "email": "user@tdztrading.com.br", "password": "minha-senha" }
```

**Resposta 200:** `{ "ok": true }` (e o cookie de sessao `sid`)

**Resposta 400:** e-mail fora do domínio permitido (`ALLOWED_EMAIL_DOMAIN`) ou credenciais faltantes
**Resposta 429:** limite de requisições excedido (30 a cada 5 minutos por IP)

**Resposta 401:** e-mail ou senha incorretos

---

#### POST /api/auth/forgot-password

Envia o e-mail de redefinicao de senha. A resposta e sempre `200`, mesmo
quando o e-mail nao esta cadastrado (para nao revelar quem tem conta).
O token e gravado no banco apenas como hash SHA-256 e expira em 1 hora (TTL).

**Corpo:** `{ "email": "user@tdztrading.com.br" }`

**Resposta 200:** `{ "ok": true }`

**Resposta 400:** e-mail fora do domínio permitido (`ALLOWED_EMAIL_DOMAIN`)
**Resposta 429:** limite de requisicoes excedido (10 a cada 15 minutos por IP)

---

#### POST /api/auth/reset-password

Define uma nova senha usando o token enviado por e-mail (valido por 1 hora).
Ao redefinir, **todas as sessoes** do usuario sao revogadas.

**Corpo:**
```json
{ "token": "hex-token", "password": "nova-senha" }
```

**Resposta 200:** `{ "ok": true }`
**Resposta 400:** token invalido ou expirado, ou senha que nao atende a politica

---

#### POST /api/logout

Encerra a sessao do usuario (apaga a sessao no banco e o cookie `sid`).

**Resposta 200:** `{ "ok": true }`

---

#### GET /api/logout (depreciado)

Mantido por compatibilidade. Use `POST /api/logout`.

**Resposta:** Redirect 302 para `/`

---

#### GET /api/auth/user

Retorna o usuario autenticado atual.

**Resposta 200:**
```json
{
  "user": {
    "id": "string",
    "email": "user@example.com",
    "firstName": "Nome",
    "lastName": "Sobrenome",
    "profileImageUrl": "https://...",
    "isManager": false
  }
}
```

**Resposta 200 (nao autenticado):**
```json
{
  "user": null
}
```

---

### Funcionarios

> As rotas de criacao, edicao, exclusao, aprovacao e venda de dias exigem
> **coordenador** (`isManager`). Qualquer usuario autenticado pode apenas
> consultar a lista e os proprios dados.

#### GET /api/employees

Lista todos os funcionarios com saldo de ferias.

**Resposta 200:**
```json
{
  "employees": [
    {
      "id": 1,
      "name": "Maria Silva",
      "role": "Desenvolvedora",
      "department": "Tecnologia",
      "hireDate": "2023-01-15",
      "createdAt": "2023-01-15T10:00:00Z",
      "vacationBalanceDays": 25.5,
      "daysUntilNextVacation": 30,
      "isOnVacation": false,
      "nextVacationStart": "2024-07-01",
      "eligibleForVacation": true,
      "firstEligibilityDate": "2024-01-15",
      "daysSold": 0
    }
  ]
}
```

---

#### POST /api/employees

Cria um novo funcionario.

**Request Body:**
```json
{
  "name": "Nome Completo",
  "role": "Cargo",
  "department": "Departamento",
  "hireDate": "2024-01-01"
}
```

**Resposta 201:**
```json
{
  "id": 1,
  "name": "Nome Completo",
  "role": "Cargo",
  "department": "Departamento",
  "hireDate": "2024-01-01",
  "createdAt": "2024-01-15T10:00:00Z",
  "vacationBalanceDays": 0,
  "daysUntilNextVacation": 365,
  "isOnVacation": false,
  "nextVacationStart": null,
  "vacations": []
}
```

**Resposta 400:**
```json
{
  "error": "Mensagem de erro de validacao"
}
```

---

#### GET /api/employees/:id

Retorna detalhes de um funcionario especifico.

**Parametros Path:**
| Nome | Tipo | Descricao |
|------|------|-----------|
| id | integer | ID do funcionario |

**Resposta 200:**
```json
{
  "id": 1,
  "name": "Maria Silva",
  "role": "Desenvolvedora",
  "department": "Tecnologia",
  "hireDate": "2023-01-15",
  "createdAt": "2023-01-15T10:00:00Z",
  "vacationBalanceDays": 25,
  "daysUntilNextVacation": 30,
  "isOnVacation": false,
  "nextVacationStart": "2024-07-01",
  "vacations": [
    {
      "id": 1,
      "employeeId": 1,
      "startDate": "2024-07-01",
      "endDate": "2024-07-15",
      "durationDays": 15,
      "notes": "Ferias de verao",
      "status": "approved",
      "createdAt": "2024-06-01T10:00:00Z"
    }
  ]
}
```

**Resposta 404:**
```json
{
  "error": "Funcionario nao encontrado"
}
```

---

#### PUT /api/employees/:id

Atualiza um funcionario.

**Request Body:**
```json
{
  "name": "Nome Atualizado",
  "role": "Novo Cargo",
  "department": "Novo Departamento",
  "hireDate": "2024-01-01"
}
```

Todos os campos sao opcionais.

**Resposta 200:** Mesma estrutura de GET /api/employees/:id

---

#### DELETE /api/employees/:id

Remove um funcionario.

**Resposta 204:** No content

**Resposta 404:**
```json
{
  "error": "Funcionario nao encontrado"
}
```

---

### Ferias

#### GET /api/employees/:id/vacations

Lista todas as ferias de um funcionario.

**Resposta 200:**
```json
{
  "vacations": [
    {
      "id": 1,
      "employeeId": 1,
      "startDate": "2024-07-01",
      "endDate": "2024-07-15",
      "durationDays": 15,
      "notes": "Ferias de verao",
      "status": "approved",
      "createdAt": "2024-06-01T10:00:00Z"
    }
  ]
}
```

---

#### POST /api/employees/:id/vacations

Cria uma nova solicitacao de ferias.

**Request Body:**
```json
{
  "startDate": "2024-07-01",
  "endDate": "2024-07-15",
  "notes": "Ferias de verao"
}
```

**Resposta 201:**
```json
{
  "id": 1,
  "employeeId": 1,
  "startDate": "2024-07-01",
  "endDate": "2024-07-15",
  "durationDays": 15,
  "notes": "Ferias de verao",
  "status": "pending",
  "createdAt": "2024-06-01T10:00:00Z"
}
```

**Resposta 400:** o periodo conflita com outro pedido pendente/aprovado do
mesmo funcionario, ou a duracao excede o saldo disponivel.

---

#### PUT /api/vacations/:id

Edita um pedido de ferias **pendente** do proprio usuario.

**Request Body:**
```json
{ "startDate": "2024-07-01", "endDate": "2024-07-15", "notes": "..." }
```

**Resposta 200:** o pedido atualizado
**Resposta 400:** periodo invalido ou conflitante com outro pedido

---

#### DELETE /api/vacations/:id

Cancela uma solicitacao de ferias. So o proprio dono ou um coordenador pode
excluir.

**Resposta 204:** No content
**Resposta 403:** `{ "error": "Sem permissao para excluir estas ferias." }`

---

#### PUT /api/vacations/:id/status

Atualiza o status de uma solicitacao de ferias (somente gestores). Ao
aprovar, o saldo do funcionario e **revalidado**: a aprovacao e recusada se o
periodo nao couber no saldo disponivel.

**Request Body:**
```json
{
  "status": "approved"
}
```

Status possiveis: `approved`, `rejected`

**Resposta 200:**
```json
{
  "id": 1,
  "employeeId": 1,
  "startDate": "2024-07-01",
  "endDate": "2024-07-15",
  "durationDays": 15,
  "notes": "Ferias de verao",
  "status": "approved",
  "createdAt": "2024-06-01T10:00:00Z"
}
```

**Resposta 400:** saldo insuficiente para aprovar
**Resposta 403:**
```json
{
  "error": "Permissao negada - somente gestores"
}
```

---

### Dashboard

#### GET /api/dashboard/summary

Retorna estatisticas resumidas do dashboard.

**Resposta 200:**
```json
{
  "totalEmployees": 50,
  "employeesOnVacation": 5,
  "pendingRequests": 3,
  "upcomingVacations": 8,
  "departmentBreakdown": [
    {
      "department": "Tecnologia",
      "totalEmployees": 20,
      "onVacation": 2
    }
  ]
}
```

---

### Perfil (Me)

#### GET /api/me/employee

Retorna o registro de funcionario do usuario autenticado.

**Resposta 200:**
```json
{
  "employee": {
    "id": 1,
    "name": "Maria Silva",
    "role": "Desenvolvedora",
    "department": "Tecnologia",
    "hireDate": "2023-01-15",
    "createdAt": "2023-01-15T10:00:00Z",
    "vacationBalanceDays": 25,
    "daysUntilNextVacation": 30,
    "isOnVacation": false,
    "nextVacationStart": "2024-07-01"
  }
}
```

**Resposta 200 (nao registrado):**
```json
{
  "employee": null
}
```

---

#### POST /api/me/employee

Auto-registro do usuario como funcionario.

**Request Body:**
```json
{
  "name": "Nome Completo",
  "role": "Cargo",
  "department": "Departamento",
  "hireDate": "2024-01-01"
}
```

**Resposta 201:**
```json
{
  "employee": {
    "id": 1,
    "name": "Nome Completo",
    "role": "Cargo",
    "department": "Departamento",
    "hireDate": "2024-01-01",
    "createdAt": "2024-01-15T10:00:00Z",
    "vacationBalanceDays": 0,
    "daysUntilNextVacation": 365,
    "isOnVacation": false,
    "nextVacationStart": null
  }
}
```

**Resposta 400:**
```json
{
  "error": "Usuario ja registrado como funcionario"
}
```

**Resposta 409:** `{ "error": "Usuario ja vinculado a um funcionario." }`

---

### Vendas de dias

#### GET /api/employees/:id/vacation-sales

Lista as vendas de dias de um funcionario.

**Resposta 200:** `{ "vacationSales": [ ... ] }`

---

#### POST /api/employees/:id/vacation-sales

Registra uma venda de dias (somente coordenadores). O maximo e de **10 dias por
operacao** (1/3 do periodo de 30 dias) e o total nao pode ultrapassar o saldo
disponivel.

**Request Body:**
```json
{ "daysSold": 5, "saleDate": "2024-02-01", "notes": "..." }
```

**Resposta 201:** a venda registrada
**Resposta 400:** dias invalidos, acima do limite de 1/3 ou saldo insuficiente

---

#### DELETE /api/employees/:id/vacation-sales/:saleId

Exclui uma venda de dias (somente coordenadores). A venda precisa pertencer ao
funcionario do path.

**Resposta 204:** No content
**Resposta 404:** `{ "error": "Venda nao encontrada" }`

---

### Troca de senha

#### PUT /api/employees/:id/password

Troca a senha de um funcionario (o proprio ou um coordenador). As **outras**
sessoes do usuario sao revogadas.

**Request Body:**
```json
{ "currentPassword": "senha-atual", "newPassword": "nova-senha-forte" }
```

`currentPassword` e obrigatorio quando o proprio usuario troca a senha.

**Resposta 200:** `{ "message": "Senha alterada com sucesso." }`
**Resposta 400:** senha atual incorreta ou senha nova fora da politica

---

## Codigos de Status HTTP

| Codigo | Descricao |
|--------|-----------|
| 200 | Sucesso |
| 201 | Recurso criado |
| 204 | Sucesso sem conteudo |
| 302 | Redirecionamento |
| 400 | Requisicao invalida |
| 401 | Nao autenticado |
| 403 | Acesso negado |
| 404 | Recurso nao encontrado |
| 409 | Conflito (e-mail ou vinculo ja existente) |
| 429 | Limite de requisicoes excedido |
| 500 | Erro interno do servidor |

## Exemplos com cURL

### Listar funcionarios
```bash
curl -X GET http://localhost:3000/api/employees \
  -H "Cookie: sid=<session_id>"
```

### Criar solicitacao de ferias
```bash
curl -X POST http://localhost:3000/api/employees/1/vacations \
  -H "Content-Type: application/json" \
  -H "Cookie: sid=<session_id>" \
  -d '{
    "startDate": "2024-07-01",
    "endDate": "2024-07-15",
    "notes": "Ferias de verao"
  }'
```

### Aprovar ferias (gestor)
```bash
curl -X PUT http://localhost:3000/api/vacations/1/status \
  -H "Content-Type: application/json" \
  -H "Cookie: sid=<session_id>" \
  -d '{"status": "approved"}'
```
