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

#### POST /api/auth/register-local

Cria uma conta com e-mail e senha e inicia a sessao.

**Corpo:**
```json
{ "email": "user@example.com", "password": "minimo-6-caracteres" }
```

**Resposta 200:** `{ "ok": true }` (e o cookie de sessao `sid`)

**Resposta 400:** e-mail inválido, fora do domínio corporativo permitido (`ALLOWED_EMAIL_DOMAIN`) ou senha com menos de 6 caracteres
**Resposta 409:** o e-mail já está cadastrado

---

#### POST /api/auth/login-local

Autentica com e-mail e senha.

**Corpo:**
```json
{ "email": "user@example.com", "password": "minha-senha" }
```

**Resposta 200:** `{ "ok": true }` (e o cookie de sessao `sid`)

**Resposta 400:** e-mail fora do domínio permitido (`ALLOWED_EMAIL_DOMAIN`) ou credenciais faltantes

**Resposta 401:** e-mail ou senha incorretos

---

#### POST /api/auth/forgot-password

Envia o e-mail de redefinicao de senha. A resposta e sempre `200`, mesmo
quando o e-mail nao esta cadastrado (para nao revelar quem tem conta).

**Corpo:** `{ "email": "user@example.com" }`

**Resposta 200:** `{ "ok": true }`

**Resposta 400:** e-mail fora do domínio permitido (`ALLOWED_EMAIL_DOMAIN`)

---

#### POST /api/auth/reset-password

Define uma nova senha usando o token enviado por e-mail (valido por 1 hora).

**Corpo:**
```json
{ "token": "hex-token", "password": "nova-senha" }
```

**Resposta 200:** `{ "ok": true }`
**Resposta 400:** token invalido ou expirado

---

#### GET /api/logout

Encerra a sessao do usuario (apaga o cookie `sid`).

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
      "vacationBalanceDays": 25,
      "daysUntilNextVacation": 30,
      "isOnVacation": false,
      "nextVacationStart": "2024-07-01"
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

---

#### DELETE /api/vacations/:id

Cancela uma solicitacao de ferias.

**Resposta 204:** No content

---

#### PUT /api/vacations/:id/status

Atualiza o status de uma solicitacao de ferias (somente gestores).

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
