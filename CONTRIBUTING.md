# Guia de Contribuicao

Obrigado por considerar contribuir com o Holiday Dashboard! Este documento fornece diretrizes para contribuir com o projeto.

## Indice

- [Codigo de Conduta](#codigo-de-conduta)
- [Como Contribuir](#como-contribuir)
- [Configuracao do Ambiente](#configuracao-do-ambiente)
- [Padroes de Codigo](#padroes-de-codigo)
- [Commits](#commits)
- [Pull Requests](#pull-requests)
- [Reportando Bugs](#reportando-bugs)
- [Sugerindo Funcionalidades](#sugerindo-funcionalidades)

## Codigo de Conduta

Este projeto adota um codigo de conduta para garantir um ambiente acolhedor e respeitoso. Esperamos que todos os contribuidores:

- Usem linguagem acolhedora e inclusiva
- Respeitem diferentes pontos de vista e experiencias
- Aceitem criticas construtivas graciosamente
- Foquem no que e melhor para a comunidade
- Mostrem empatia com outros membros da comunidade

## Como Contribuir

1. **Fork** o repositorio
2. **Clone** seu fork localmente
3. **Crie uma branch** para sua contribuicao
4. **Faca suas alteracoes**
5. **Teste** suas alteracoes
6. **Commit** suas alteracoes
7. **Push** para seu fork
8. **Abra um Pull Request**

## Configuracao do Ambiente

### Pre-requisitos

- Node.js 24 ou superior
- pnpm 10 ou superior
- Git

### Instalacao

```bash
# Clone seu fork
git clone https://github.com/seu-usuario/Holiday-Dashboard.git
cd Holiday-Dashboard

# Adicione o repositorio original como upstream
git remote add upstream https://github.com/RafaelTDZ/Holiday-Dashboard.git

# Instale as dependencias
pnpm install
```

### Verificando a Instalacao

```bash
# Verificar tipos em todos os projetos
pnpm typecheck

# Build de todos os projetos
pnpm build
```

## Padroes de Codigo

### TypeScript

- Use tipos explicitos sempre que possivel
- Evite `any`, prefira `unknown` quando necessario
- Use interfaces para objetos e types para unioes/intersecoes

```typescript
// Bom
interface Employee {
  id: number;
  name: string;
  department: string;
}

// Evitar
const employee: any = { ... };
```

### React

- Use componentes funcionais com hooks
- Mantenha componentes pequenos e focados
- Use desestruturacao para props

```tsx
// Bom
function EmployeeCard({ name, role, department }: EmployeeCardProps) {
  return (
    <Card>
      <CardTitle>{name}</CardTitle>
      <CardDescription>{role} - {department}</CardDescription>
    </Card>
  );
}

// Evitar
function EmployeeCard(props: EmployeeCardProps) {
  return (
    <Card>
      <CardTitle>{props.name}</CardTitle>
      ...
    </Card>
  );
}
```

### CSS/Tailwind

- Use classes utilitarias do Tailwind
- Agrupe classes logicamente
- Use variaveis CSS para temas

```tsx
// Bom
<div className="flex items-center gap-4 p-4 bg-background rounded-lg">

// Evitar
<div style={{ display: 'flex', alignItems: 'center' }}>
```

### Organizacao de Arquivos

- Um componente por arquivo
- Nomeie arquivos em kebab-case
- Agrupe arquivos relacionados em pastas

```
components/
├── employee-card.tsx
├── employee-list.tsx
└── employee-form/
    ├── index.tsx
    ├── form-fields.tsx
    └── validation.ts
```

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
tipo(escopo): descricao

[corpo opcional]

[rodape opcional]
```

### Tipos

- `feat`: Nova funcionalidade
- `fix`: Correcao de bug
- `docs`: Documentacao
- `style`: Formatacao (sem mudanca de codigo)
- `refactor`: Refatoracao
- `test`: Testes
- `chore`: Manutencao

### Exemplos

```bash
feat(employees): adiciona filtro por departamento

fix(vacations): corrige calculo de dias uteis

docs(readme): atualiza instrucoes de instalacao

refactor(api): extrai logica de validacao para utils
```

## Pull Requests

### Antes de Abrir

1. Sincronize com o upstream:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. Verifique os tipos:
   ```bash
   pnpm typecheck
   ```

3. Execute o build:
   ```bash
   pnpm build
   ```

### Ao Abrir

- Use um titulo descritivo
- Preencha o template de PR
- Vincule issues relacionadas
- Adicione screenshots para mudancas visuais

### Template de PR

```markdown
## Descricao

[Descreva suas alteracoes]

## Tipo de Mudanca

- [ ] Correcao de bug
- [ ] Nova funcionalidade
- [ ] Mudanca que quebra compatibilidade
- [ ] Documentacao

## Checklist

- [ ] Meu codigo segue os padroes do projeto
- [ ] Revisei meu proprio codigo
- [ ] Adicionei comentarios em partes complexas
- [ ] Atualizei a documentacao se necessario
- [ ] Minhas alteracoes nao geram warnings
- [ ] Adicionei testes que provam que minha correcao/feature funciona

## Screenshots (se aplicavel)

[Cole screenshots aqui]

## Issues Relacionadas

Fixes #[numero]
```

## Reportando Bugs

### Antes de Reportar

1. Verifique se o bug ja foi reportado
2. Atualize para a versao mais recente
3. Tente reproduzir em um ambiente limpo

### Ao Reportar

Use o template de issue para bugs:

```markdown
## Descricao do Bug

[Descricao clara e concisa]

## Passos para Reproduzir

1. Va para '...'
2. Clique em '...'
3. Role para baixo ate '...'
4. Veja o erro

## Comportamento Esperado

[O que deveria acontecer]

## Screenshots

[Se aplicavel]

## Ambiente

- OS: [ex. Windows 11, macOS 14]
- Browser: [ex. Chrome 120, Firefox 121]
- Versao do Node: [ex. 20.10.0]
```

## Sugerindo Funcionalidades

### Antes de Sugerir

1. Verifique se ja foi sugerido
2. Considere se faz sentido para o projeto
3. Pense em como implementaria

### Ao Sugerir

Use o template de feature request:

```markdown
## Descricao da Funcionalidade

[Descricao clara da funcionalidade]

## Motivacao

[Por que isso seria util]

## Solucao Proposta

[Como voce imagina isso funcionando]

## Alternativas Consideradas

[Outras abordagens que voce pensou]

## Contexto Adicional

[Qualquer outra informacao relevante]
```

## Duvidas?

Se tiver duvidas sobre como contribuir, abra uma issue com a tag `question` ou entre em contato com os mantenedores.

Agradecemos sua contribuicao!
