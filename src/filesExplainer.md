# Estrutura do Projeto - Sabor de Mãe

## 📁 Visão Geral da Arquitetura

```
src/
├── components/           # Componentes reutilizáveis
│   ├── layout/          # Layouts e estrutura de página
│   ├── shared/          # Componentes compartilhados
│   └── ui/              # Componentes Shadcn UI
├── hooks/               # Custom React hooks
├── lib/                 # Utilitários e helpers
├── pages/               # Páginas da aplicação
│   ├── admin/           # Páginas do painel admin
│   └── staff/           # Páginas do painel da cozinha
└── api/                 # (Futuro) Integração com APIs
```

## 📂 Detalhamento dos Arquivos

### `/components/layout/`
Componentes de estrutura de página.

| Arquivo | Descrição |
|---------|-----------|
| `AdminLayout.tsx` | Layout padrão para páginas admin |
| `StaffLayout.tsx` | Layout padrão para páginas da cozinha |
| `AppSidebar.tsx` | Sidebar de navegação (admin e staff) |
| `AppHeader.tsx` | Header com busca e notificações |

### `/components/shared/`
Componentes reutilizáveis em todo o sistema.

| Arquivo | Descrição |
|---------|-----------|
| `StatsCard.tsx` | Card de estatísticas com ícone e trend |
| `DataTable.tsx` | Tabela de dados genérica |
| `PageHeader.tsx` | Cabeçalho de página com título e ação |
| `EmptyState.tsx` | Estado vazio com ícone e CTA |
| `KanbanColumn.tsx` | Coluna e card para Kanban |

### `/pages/`
Páginas da aplicação.

| Arquivo | Rota | Descrição |
|---------|------|-----------|
| `Index.tsx` | `/` | Página inicial com acesso ao sistema |
| `Login.tsx` | `/login` | Tela de login |

### `/pages/admin/`
Páginas do painel administrativo.

| Arquivo | Rota | Descrição |
|---------|------|-----------|
| `Dashboard.tsx` | `/admin` | Dashboard com estatísticas |
| `Pedidos.tsx` | `/admin/pedidos` | Lista de pedidos |
| `Cardapio.tsx` | `/admin/cardapio` | Gerenciamento do cardápio |
| `Almoco.tsx` | `/admin/almoco` | Cardápio de almoço por dia |
| `Kanban.tsx` | `/admin/kanban` | Kanban de pedidos (admin) |
| `Usuarios.tsx` | `/admin/usuarios` | Gerenciamento de usuários |
| `Configuracoes.tsx` | `/admin/configuracoes` | Configurações do sistema |

### `/pages/staff/`
Páginas do painel da cozinha.

| Arquivo | Rota | Descrição |
|---------|------|-----------|
| `StaffDashboard.tsx` | `/staff` | Dashboard da cozinha |
| `StaffKanban.tsx` | `/staff/kanban` | Kanban de produção |
| `StaffPedidos.tsx` | `/staff/pedidos` | Lista de pedidos |

## 🎨 Design System

### Tokens de Cor (index.css)
- `--primary`: Laranja quente (#F97316 equivalente)
- `--background`: Creme claro
- `--sidebar-*`: Tons marrons para sidebar
- `--success`, `--warning`, `--destructive`: Estados

### Componentes Customizados
Todos os componentes usam tokens do design system, nunca cores diretas.

## 🛣️ Roteamento

O roteamento está configurado em `App.tsx`:
- Rotas públicas: `/`, `/login`
- Rotas admin: `/admin/*`
- Rotas staff: `/staff/*`

## 📦 Dependências Principais

- React + TypeScript
- React Router DOM (roteamento)
- Tailwind CSS (estilos)
- Shadcn UI (componentes base)
- Lucide React (ícones)
- TanStack Query (futuro: data fetching)

## 🔮 Próximos Passos

1. Integração com Lovable Cloud (Supabase)
2. Implementação de autenticação
3. CRUD do cardápio
4. Sistema de pedidos
5. Integração WhatsApp
6. Agente Sofia (IA)
