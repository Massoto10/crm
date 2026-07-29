# ScaleToNext CRM — Front-end

Front-end completo e responsivo do CRM multi-tenant de atendimento por WhatsApp, criado com Next.js App Router, TypeScript e CSS próprio.

## Telas incluídas

- Login restrito, sem cadastro público
- Dashboard da instituição
- Caixa de entrada de atendimentos
- Contatos
- Funil de vendas em Kanban com arrastar e soltar
- Agendamentos em calendário e lista
- Gestão de operadores e permissões
- Configurações da instituição
- Painel exclusivo do administrador do sistema
- Instituições, administradores, planos, limites e configurações globais

## Hierarquia implementada

### Administrador do sistema

- Cria instituições
- Cria o administrador inicial de cada instituição
- Visualiza todos os administradores
- Define planos e limites de operadores
- Bloqueia ou ativa instituições
- Acessa somente as rotas administrativas do sistema

### Administrador da instituição

- Acessa somente o próprio tenant
- Cria e gerencia operadores
- Não cria outros administradores
- Não altera o limite de operadores
- Define escopo e telas permitidas para os operadores

### Operador

- Acessa somente os módulos operacionais liberados
- Não acessa equipe, configurações institucionais ou painel do sistema

## Executar

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Contas de demonstração

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador do sistema | `superadmin@stncrm.com` | `admin123` |
| Administrador da instituição | `admin@acme.com` | `admin123` |
| Operador | `operador@acme.com` | `operador123` |

Essas contas são apenas mocks do front-end. Ao integrar com a API, substitua o método `login` em `src/context/crm-context.tsx` pelo endpoint real.

## Integração com NestJS

Configure:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

O arquivo `src/lib/api.ts` já contém um cliente REST com suporte ao header `Authorization: Bearer <token>`.

## Observação

Os dados são mantidos em memória para demonstrar todas as interações do front-end. Atualizações como criação de contato, operador, agendamento e instituição funcionam durante a sessão atual do navegador.
