# Modelo de Dados - Sabor de Mãe

## Visão Geral

Este documento descreve a estrutura de dados do sistema Sabor de Mãe, incluindo tabelas, relacionamentos e fluxos de dados.

---

## Diagrama de Relacionamentos

```
┌─────────────┐     ┌─────────────┐
│  auth.users │────▶│  profiles   │
└─────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│ user_roles  │
└─────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ categories  │────▶│   items     │────▶│   extras    │
└─────────────┘     └─────────────┘     └─────────────┘
                          │
                          ▼
┌─────────────┐     ┌─────────────┐
│   orders    │────▶│ order_items │
└─────────────┘     └─────────────┘

┌─────────────┐     ┌─────────────┐
│ lunch_menu  │     │delivery_zone│
└─────────────┘     └─────────────┘

┌─────────────┐     ┌─────────────┐
│ ai_sessions │     │messages_log │
└─────────────┘     └─────────────┘
```

---

## Tabelas

### profiles
Perfis de usuários vinculados ao auth.users.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID (PK) | Referência ao auth.users |
| name | TEXT | Nome do usuário |
| phone | TEXT | Telefone |
| created_at | TIMESTAMPTZ | Data de criação |

### user_roles
Papéis dos usuários (segurança: tabela separada).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID (PK) | Identificador único |
| user_id | UUID (FK) | Referência ao auth.users |
| role | app_role | admin, staff, customer |

### categories
Categorias do cardápio.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID (PK) | Identificador único |
| name | TEXT | Nome da categoria |
| created_at | TIMESTAMPTZ | Data de criação |

**Valores pré-populados:**
- Tapiocas
- Cuscuz
- Lanches
- Bebidas
- Caldos e Panelada
- Almoço
- Porções

### items
Itens do cardápio.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID (PK) | Identificador único |
| category_id | UUID (FK) | Categoria do item |
| name | TEXT | Nome do item |
| description | TEXT | Descrição |
| price | NUMERIC(10,2) | Preço |
| allow_extras | BOOLEAN | Permite adicionais |
| allow_quantity | BOOLEAN | Permite quantidade |
| allow_tapioca_molhada | BOOLEAN | Opção tapioca molhada |
| available | BOOLEAN | Disponível para venda |
| created_at | TIMESTAMPTZ | Data de criação |

### extras
Adicionais por item.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID (PK) | Identificador único |
| item_id | UUID (FK) | Item relacionado |
| name | TEXT | Nome do adicional |
| price | NUMERIC(10,2) | Preço extra |

### lunch_menu
Cardápio de almoço por dia da semana.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID (PK) | Identificador único |
| weekday | INT | Dia (0=Dom, 6=Sáb) |
| meat_name | TEXT | Nome da carne |
| meat_price | NUMERIC(10,2) | Preço da carne |

**Valores pré-populados (Segunda a Sexta):**
- Segunda: Frango Grelhado (R$ 18,00)
- Terça: Carne de Sol (R$ 22,00)
- Quarta: Bife Acebolado (R$ 20,00)
- Quinta: Frango à Milanesa (R$ 19,00)
- Sexta: Peixe Frito (R$ 24,00)

### delivery_zones
Zonas de entrega e taxas.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID (PK) | Identificador único |
| bairro | TEXT | Nome do bairro |
| dist_km | NUMERIC(5,2) | Distância em km |
| taxa | NUMERIC(10,2) | Taxa de entrega |

### orders
Pedidos.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID (PK) | Identificador único |
| customer_name | TEXT | Nome do cliente |
| customer_phone | TEXT | Telefone |
| order_type | order_type | local, retirada, entrega |
| address | TEXT | Endereço de entrega |
| cep | TEXT | CEP |
| reference | TEXT | Ponto de referência |
| scheduled_for | TIMESTAMPTZ | Agendamento |
| delivery_tax | NUMERIC(10,2) | Taxa de entrega |
| subtotal | NUMERIC(10,2) | Subtotal |
| total | NUMERIC(10,2) | Total |
| status | order_status | pending, preparing, ready, delivered, cancelled |
| created_at | TIMESTAMPTZ | Data de criação |

### order_items
Itens do pedido.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID (PK) | Identificador único |
| order_id | UUID (FK) | Pedido relacionado |
| item_id | UUID (FK) | Item do cardápio |
| quantity | INT | Quantidade |
| extras | JSONB | Adicionais selecionados |
| tapioca_molhada | BOOLEAN | Tapioca molhada |
| price | NUMERIC(10,2) | Preço calculado |

### ai_sessions
Sessões do agente IA (WhatsApp).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| session_id | TEXT (PK) | ID da sessão |
| phone | TEXT | Telefone do cliente |
| context | JSONB | Contexto da conversa |
| cart | JSONB | Carrinho atual |
| last_intent | TEXT | Última intenção detectada |
| updated_at | TIMESTAMPTZ | Última atualização |

### messages_log
Log de mensagens do WhatsApp.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID (PK) | Identificador único |
| session_id | TEXT | Sessão relacionada |
| phone | TEXT | Telefone |
| inbound_text | TEXT | Mensagem recebida |
| outbound_text | TEXT | Mensagem enviada |
| metadata | JSONB | Metadados extras |
| created_at | TIMESTAMPTZ | Data/hora |

---

## Enums

### app_role
```sql
'admin' | 'staff' | 'customer'
```

### order_status
```sql
'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
```

### order_type
```sql
'local' | 'retirada' | 'entrega'
```

---

## Edge Functions (API Endpoints)

### GET /functions/v1/categories
Retorna categorias com contagem de itens.

**Response:**
```json
{
  "data": [
    { "id": "...", "name": "Tapiocas", "item_count": 5 }
  ]
}
```

### GET /functions/v1/items
Lista itens do cardápio.

**Query params:**
- `category_id` - Filtrar por categoria
- `available` - Filtrar por disponibilidade

**Response:**
```json
{
  "data": [
    {
      "id": "...",
      "name": "Tapioca de Frango",
      "price": 12.00,
      "category": { "id": "...", "name": "Tapiocas" },
      "extras": [{ "name": "Queijo", "price": 2.00 }]
    }
  ]
}
```

### GET /functions/v1/lunch-today
Retorna cardápio de almoço do dia.

**Response:**
```json
{
  "data": {
    "weekday": 1,
    "weekday_name": "Segunda",
    "fixed_items": [],
    "meats": [{ "meat_name": "Frango Grelhado", "meat_price": 18.00 }],
    "available": true
  }
}
```

### GET /functions/v1/delivery?bairro=Centro
Consulta taxa de entrega por bairro.

**Response:**
```json
{
  "data": {
    "bairro": "Centro",
    "dist_km": 2.5,
    "taxa": 5.00
  }
}
```

### POST /functions/v1/orders
Cria novo pedido.

**Body:**
```json
{
  "customer_name": "João Silva",
  "customer_phone": "11999999999",
  "order_type": "entrega",
  "address": "Rua das Flores, 123",
  "delivery_tax": 5.00,
  "subtotal": 50.00,
  "total": 55.00,
  "items": [
    {
      "item_id": "uuid",
      "quantity": 2,
      "extras": [{ "name": "Queijo", "price": 2.00 }],
      "price": 28.00
    }
  ]
}
```

### GET /functions/v1/orders?id=uuid
Busca pedido por ID.

### PATCH /functions/v1/orders?id=uuid
Atualiza status do pedido.

**Body:**
```json
{ "status": "preparing" }
```

### POST /functions/v1/ai-session
Cria/atualiza sessão IA.

### GET /functions/v1/ai-session?session_id=xxx
Busca sessão por ID.

### POST /functions/v1/log-message
Registra mensagem no log.

---

## Fluxos de Dados

### Fluxo de Criação de Pedido

```
1. Cliente seleciona itens → GET /items
2. Cliente confirma carrinho
3. Cliente informa dados → POST /orders
4. Sistema valida dados
5. Sistema cria order + order_items
6. Sistema retorna pedido completo
7. Pedido aparece no Kanban (status: pending)
```

### Fluxo do Kanban

```
pending → preparing → ready → delivered
                  ↘ cancelled
```

### Fluxo da Sessão IA (WhatsApp)

```
1. Mensagem chega via Evolution API
2. N8N identifica/cria session_id
3. GET /ai-session → contexto atual
4. Agente processa mensagem
5. POST /ai-session → atualiza contexto/carrinho
6. POST /log-message → registra conversa
7. Resposta enviada ao cliente
```

---

## Políticas de Segurança (RLS)

### Dados Públicos (SELECT para todos)
- categories
- items
- extras
- lunch_menu
- delivery_zones

### Dados Restritos
- orders: Admins e Staff podem visualizar/editar
- order_items: Admins e Staff podem visualizar
- profiles: Usuário vê próprio perfil
- user_roles: Usuário vê próprios roles

### Função has_role()
```sql
public.has_role(auth.uid(), 'admin')
```
Verifica se usuário tem determinado papel (security definer).

---

## Próximos Passos

1. **Fase 3**: Implementar autenticação
2. **Fase 4**: CRUD do cardápio
3. **Fase 5**: Sistema de pedidos completo
4. **Fase 6**: Integração WhatsApp
5. **Fase 7**: Agente IA Sofia
