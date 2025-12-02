# Sabor de Mãe - Regras de Negócio e Documentação de API

## Índice
1. [Endpoints da API](#endpoints-da-api)
2. [Regras de Negócio](#regras-de-negócio)
3. [Exemplos de Uso](#exemplos-de-uso)
4. [Guia do Administrador](#guia-do-administrador)

---

## Endpoints da API

### Menu

#### GET /functions/v1/menu
Retorna o cardápio completo com categorias e itens disponíveis.

**Parâmetros:**
- `category` (opcional): UUID da categoria para filtrar
- `include_unavailable` (opcional): `true` para incluir itens indisponíveis

**Resposta:**
```json
{
  "data": {
    "categories": [...],
    "items": [...],
    "menu_by_category": [...],
    "global_extras": [...]
  }
}
```

---

### Almoço do Dia

#### GET /functions/v1/lunch-today
Retorna os itens fixos do almoço e as carnes do dia.

**Resposta:**
```json
{
  "data": {
    "weekday": 1,
    "weekday_name": "Segunda",
    "fixed_items": [...],
    "meats": [{"meat_name": "Lasanha de frango", "meat_price": 0}, ...],
    "available": true
  }
}
```

---

### Taxa de Entrega

#### GET /functions/v1/delivery?bairro=Centro
Retorna a taxa de entrega para um bairro.

**Parâmetros:**
- `bairro`: Nome do bairro (case-insensitive)

**Resposta:**
```json
{
  "data": {
    "id": "...",
    "bairro": "Centro",
    "taxa": 5.00,
    "dist_km": 2.5
  }
}
```

---

### Pedidos

#### POST /functions/v1/orders
Cria um novo pedido com validação de regras de negócio.

**Corpo da requisição:**
```json
{
  "customer_name": "João Silva",
  "customer_phone": "558899912345",
  "order_type": "entrega",
  "address": {
    "bairro": "Centro",
    "street": "Rua X, 123",
    "cep": "63000-000",
    "reference": "Em frente a padaria"
  },
  "items": [
    {
      "item_id": "<uuid_tapioca>",
      "quantity": 2,
      "tapioca_molhada": true,
      "extras": [{"code": "OVO"}]
    }
  ],
  "payment_method": "dinheiro"
}
```

**Parâmetros de query:**
- `skip_hours_check=true`: Ignora verificação de horário (apenas para testes)

**Resposta (201):**
```json
{
  "data": {...pedido completo...},
  "summary": {
    "subtotal": 20.00,
    "extras_fee": 4.00,
    "delivery_fee": 5.00,
    "total": 29.00
  }
}
```

**Erros possíveis:**
- `400`: Fora do horário, item indisponível, bairro não encontrado
- `500`: Erro interno

---

#### DELETE /functions/v1/orders?id=<order_id>
Cancela um pedido (apenas dentro de 10 minutos).

**Resposta (200):**
```json
{
  "data": {...},
  "message": "Pedido cancelado com sucesso"
}
```

**Erro (403):**
```json
{
  "error": "Cancelamento não permitido",
  "message": "Janela de cancelamento de 10 minutos expirada."
}
```

---

#### GET /functions/v1/orders
Lista todos os pedidos (admin/staff).

#### GET /functions/v1/orders?id=<order_id>
Retorna um pedido específico.

#### PATCH /functions/v1/orders?id=<order_id>
Atualiza status do pedido.

```json
{
  "status": "preparing"
}
```

---

## Regras de Negócio

### 1. Horário de Funcionamento
- **Segunda a Sábado:** 07:00 às 14:00
- **Domingo:** Fechado
- Pedidos fora do horário retornam erro 400

### 2. Taxa de Tapioca Molhada
- **+R$ 1,00** por unidade
- Apenas se o item permite (`allow_tapioca_molhada = true`)
- NÃO cobra se já é molhado por padrão (`is_molhado_by_default = true`)
- Exemplo: "Tapioca dupla molhada" já vem molhada, não cobra extra

### 3. Extras
- **Ovo:** R$ 2,00 (aplica-se a Lanches)
- **Carne extra almoço:** R$ 6,00 (aplica-se a Almoço)
- Extras só são adicionados se o item permite (`allow_extras = true`)

### 4. Disponibilidade de Itens
- Campo `available` controla se o item aparece no cardápio
- Admin pode desativar itens esgotados
- Endpoint `/menu` retorna apenas itens disponíveis por padrão

### 5. Carnes do Almoço
- Configuradas por dia da semana (0-6)
- Segunda a Sexta: 2 opções de carne
- Sábado: Feijoada + Porco
- Endpoint `lunch-today` retorna automaticamente as carnes do dia

### 6. Taxa de Entrega
- Calculada por bairro via tabela `delivery_zones`
- Busca case-insensitive
- Se bairro não encontrado, retorna erro 400

### 7. Política de Cancelamento
- **Janela de 10 minutos** após criação
- Após 10 minutos, pedido é automaticamente marcado como "em preparo"
- Cancelamento após esse período retorna erro 403

### 8. Cálculo de Totais (Server-side)
O servidor SEMPRE calcula os totais, nunca confia no cliente:
```
subtotal = Σ(preço_item × quantidade + extras + molhar)
total = subtotal + taxa_entrega
```

---

## Exemplos de Uso

### Exemplo 1: Pedido de Tapioca com Extra
```bash
curl -X POST https://napgcbrouifczxblteuw.supabase.co/functions/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Maria",
    "customer_phone": "558899912345",
    "order_type": "local",
    "items": [
      {
        "item_id": "<uuid_tapioca_manteiga>",
        "quantity": 2,
        "tapioca_molhada": true,
        "extras": []
      }
    ]
  }'
```
**Cálculo:** (R$3.00 + R$1.00 molhar) × 2 = **R$8.00**

### Exemplo 2: Pedido de Entrega
```bash
curl -X POST https://napgcbrouifczxblteuw.supabase.co/functions/v1/orders?skip_hours_check=true \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "João",
    "customer_phone": "558899912345",
    "order_type": "entrega",
    "address": {
      "bairro": "Centro",
      "street": "Rua X",
      "cep": "63000-000"
    },
    "items": [
      {
        "item_id": "<uuid_pao_ovo>",
        "quantity": 1,
        "extras": [{"code": "OVO"}]
      }
    ]
  }'
```
**Cálculo:** R$4.00 + R$2.00 (ovo) + R$5.00 (taxa Centro) = **R$11.00**

### Exemplo 3: Cancelar Pedido
```bash
curl -X DELETE "https://napgcbrouifczxblteuw.supabase.co/functions/v1/orders?id=<order_id>"
```

---

## Guia do Administrador

### Marcar Item como Indisponível
1. Acesse `/admin/items`
2. Localize o item na lista
3. Clique no toggle "Disponível" para desativar
4. O item deixará de aparecer no cardápio automaticamente

### Importar CSV de Bairros
1. Acesse `/admin/delivery-zones`
2. Clique em "Importar CSV"
3. Formato do CSV:
```csv
bairro,dist_km,taxa
Centro,2.5,5.00
Aldeota,4.0,7.00
```

### Editar Carnes do Almoço
1. Acesse `/admin/lunch`
2. Para cada dia da semana, adicione/remova/edite as carnes
3. Clique em "Salvar Alterações"

### Testar Cancelamento
1. Crie um pedido de teste
2. Dentro de 10 minutos, tente cancelar (deve funcionar)
3. Após 10 minutos, tente cancelar (deve bloquear)

---

## Funções do Banco de Dados

### get_taxa_by_bairro(bairro_in text)
Retorna taxa e distância para um bairro.

### get_lunch_menu_for_today()
Retorna as carnes do dia atual.

### can_cancel_order(order_id uuid)
Verifica se pedido pode ser cancelado (dentro de 10 min).

### mark_pending_orders_in_preparation()
Move pedidos pendentes > 10min para "preparing".
(Deve ser executada via cron job a cada minuto)

---

## Configuração do Cron Job

Para mover automaticamente pedidos pendentes para "em preparo":

```sql
-- Via pg_cron (se disponível)
SELECT cron.schedule(
  'mark-pending-orders',
  '* * * * *', -- A cada minuto
  'SELECT mark_pending_orders_in_preparation()'
);
```

Ou configure um workflow no n8n que chame:
```sql
SELECT mark_pending_orders_in_preparation();
```
