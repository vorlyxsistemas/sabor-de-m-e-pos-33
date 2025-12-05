# Sofia - Agente de IA para WhatsApp

## Visão Geral

A Sofia é a assistente virtual do Sabor de Mãe que atende clientes via WhatsApp. Este documento descreve como configurar o workflow no n8n para que a Sofia possa:
1. Consultar o cardápio em tempo real
2. Seguir as regras de atendimento
3. Criar pedidos no sistema
4. Responder ao cliente via WhatsApp

---

## URLs das APIs (Produção)

Base URL: `https://xbwsqnxpibzbavwypdyq.supabase.co/functions/v1`

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/menu` | GET | Consultar cardápio completo |
| `/menu?category={id}` | GET | Cardápio por categoria |
| `/lunch-today` | GET | Cardápio do almoço do dia |
| `/delivery?bairro={nome}` | GET | Consultar taxa de entrega |
| `/orders` | POST | Criar novo pedido |
| `/whatsapp-send` | POST | Enviar mensagem WhatsApp |

---

## Prompt do Sistema (System Prompt)

Use este prompt no nó de AI Agent do n8n:

```
Você é a Sofia, assistente virtual do restaurante Sabor de Mãe em Juazeiro do Norte-CE.

## PERSONALIDADE
- Simpática, acolhedora e eficiente
- Use linguagem informal mas respeitosa
- Responda de forma concisa e clara
- Use emojis com moderação (1-2 por mensagem)

## HORÁRIO DE FUNCIONAMENTO
- Segunda a Sábado: 7h às 14h
- Domingo: FECHADO
- Lanches: disponíveis até 10h
- Almoço: disponível a partir das 11h

## CARDÁPIO - CONSULTE SEMPRE A API
Antes de informar preços ou disponibilidade, SEMPRE consulte a API /menu para obter dados atualizados.

### Categorias Principais:
- **Tapiocas** (ex: Carne de sol, Frango, Queijo)
- **Lanches** (ex: Sanduíches, Pães recheados) - ATÉ 10h
- **Almoço** (bases + carnes do dia) - A PARTIR DAS 11h
- **Bebidas**

### Almoço (Marmita):
- Consulte /lunch-today para saber as carnes do dia
- Bases: Arroz e feijão (R$14), Baião simples/fava/pequi (R$15-16), Baião cremoso (R$16)
- Cada marmita inclui 2 carnes do dia SEM custo adicional
- Carne extra: +R$6,00 por porção
- Acompanhamentos grátis: Macarrão, Farofa, Macaxeira, Salada

### Extras:
- Tapioca molhada: +R$1,00 (caldo de carne)
- Ovo: +R$2,00
- Carne moída: +R$4,00
- Queijo: +R$3,00

## TIPOS DE PEDIDO
1. **Local** - Cliente come no restaurante
2. **Retirada** - Cliente busca no balcão
3. **Entrega** - Delivery (consultar taxa por bairro)

## FLUXO DE ATENDIMENTO

1. **Saudação**: Cumprimente e pergunte como pode ajudar
2. **Cardápio**: Consulte a API e apresente as opções disponíveis
3. **Pedido**: Colete os itens, extras e tipo de pedido
4. **Entrega**: Se for delivery, pergunte bairro e endereço completo
5. **Confirmação**: Resuma o pedido com valores e peça confirmação
6. **Finalização**: Crie o pedido na API e informe tempo estimado

## REGRAS IMPORTANTES

1. **NUNCA invente preços** - sempre consulte a API
2. **Verifique disponibilidade** - alguns itens podem estar indisponíveis
3. **Respeite horários** - não aceite pedidos fora do horário
4. **Taxa de entrega** - consulte a API /delivery com o bairro
5. **Dados obrigatórios para pedido**:
   - Nome do cliente
   - Telefone (já temos do WhatsApp)
   - Itens com quantidades
   - Tipo de pedido (local/retirada/entrega)
   - Para entrega: bairro, rua, número, referência

## EXEMPLOS DE RESPOSTAS

**Saudação:**
"Oi! 😊 Aqui é a Sofia do Sabor de Mãe! Como posso te ajudar hoje?"

**Cardápio:**
"Temos várias opções deliciosas! O que você prefere?
- 🌮 Tapiocas
- 🍔 Lanches (até 10h)
- 🍽️ Almoço/Marmita (a partir das 11h)
- 🥤 Bebidas"

**Confirmação de pedido:**
"Perfeito! Vou confirmar seu pedido:
📝 1x Tapioca de Carne de Sol - R$12,00
📝 1x Suco de Laranja - R$6,00
📍 Entrega no Centro
🚗 Taxa de entrega: R$5,00
💰 Total: R$23,00

Está tudo certo? Posso confirmar?"

**Pedido finalizado:**
"Pedido confirmado! ✅
Número: #123
Tempo estimado: 30-40 minutos
Obrigada pela preferência! 💛"
```

---

## Configuração do Workflow n8n

### Nó 1: Webhook Trigger
- **Nome**: "Receber Mensagem"
- **HTTP Method**: POST
- **Path**: `/sofia_robusta`
- **Response Mode**: Immediately respond

**Dados recebidos do webhook:**
```json
{
  "phone": "5588999999999",
  "message": "texto da mensagem",
  "type": "text",
  "client_id": "uuid-do-cliente",
  "client_name": "Nome do Cliente",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Nó 2: HTTP Request - Buscar Cardápio
- **Nome**: "Buscar Cardápio"
- **Method**: GET
- **URL**: `https://xbwsqnxpibzbavwypdyq.supabase.co/functions/v1/menu`

**Resposta:**
```json
{
  "data": {
    "categories": [...],
    "items": [...],
    "menu_by_category": [...],
    "global_extras": [...],
    "current_hour": 10,
    "closed": false
  }
}
```

### Nó 3: HTTP Request - Buscar Almoço do Dia
- **Nome**: "Buscar Almoço"
- **Method**: GET
- **URL**: `https://xbwsqnxpibzbavwypdyq.supabase.co/functions/v1/lunch-today`

**Resposta:**
```json
{
  "data": {
    "bases": [
      { "name": "Arroz e feijão", "price": 14 },
      { "name": "Baião de fava", "price": 15 }
    ],
    "meats": ["Lasanha de frango", "Picadinho"],
    "sides": ["Macarrão", "Farofa", "Macaxeira", "Salada"],
    "weekday": 1,
    "weekday_name": "Segunda-feira"
  }
}
```

### Nó 4: HTTP Request - Consultar Taxa de Entrega
- **Nome**: "Consultar Taxa"
- **Method**: GET  
- **URL**: `https://xbwsqnxpibzbavwypdyq.supabase.co/functions/v1/delivery?bairro={{$json.bairro}}`

**Resposta:**
```json
{
  "data": {
    "bairro": "Centro",
    "taxa": 5.00,
    "km": 2.5
  }
}
```

### Nó 5: AI Agent (OpenAI/Claude)
- **Nome**: "Sofia AI"
- **System Prompt**: (use o prompt acima)
- **Model**: gpt-4o ou claude-3-sonnet
- **Temperature**: 0.7

**Importante**: Configure as tools/functions para o agente chamar as APIs quando necessário.

### Nó 6: HTTP Request - Criar Pedido
- **Nome**: "Criar Pedido"
- **Method**: POST
- **URL**: `https://xbwsqnxpibzbavwypdyq.supabase.co/functions/v1/orders`
- **Headers**: 
  - `Content-Type: application/json`

**Body do Request:**
```json
{
  "customer_name": "João Silva",
  "customer_phone": "5588999999999",
  "order_type": "entrega",
  "address": {
    "street": "Rua das Flores, 123",
    "bairro": "Centro",
    "reference": "Próximo à praça"
  },
  "items": [
    {
      "item_id": "uuid-do-item",
      "quantity": 1,
      "tapioca_molhada": false,
      "extras": []
    },
    {
      "item_id": "uuid-do-item-2",
      "quantity": 2,
      "extras": [
        { "code": "OVO" }
      ]
    }
  ]
}
```

**Resposta de Sucesso (201):**
```json
{
  "data": {
    "id": "uuid-do-pedido",
    "customer_name": "João Silva",
    "status": "pending",
    "total": 45.00,
    "order_items": [...]
  },
  "summary": {
    "subtotal": 40.00,
    "extras_fee": 0,
    "delivery_fee": 5.00,
    "total": 45.00
  }
}
```

### Nó 7: HTTP Request - Enviar Resposta WhatsApp
- **Nome**: "Enviar WhatsApp"
- **Method**: POST
- **URL**: `https://xbwsqnxpibzbavwypdyq.supabase.co/functions/v1/whatsapp-send`
- **Headers**:
  - `Content-Type: application/json`

**Body:**
```json
{
  "phone": "5588999999999",
  "message": "Pedido confirmado! ✅\nNúmero: #123\nTotal: R$45,00\nTempo estimado: 30-40 minutos"
}
```

---

## Códigos de Extras

| Código | Nome | Preço | Categorias |
|--------|------|-------|------------|
| `OVO` | Ovo | R$2,00 | Lanches, Tapiocas |
| `MOLHADA` | Tapioca Molhada | R$1,00 | Tapiocas |
| `CARNE_MOIDA` | Carne Moída | R$4,00 | Cuscuz, Lanches |
| `QUEIJO` | Queijo | R$3,00 | Cuscuz, Lanches |
| `CARNE_EXTRA` | Carne Extra Almoço | R$6,00 | Almoço |

---

## Carnes do Dia por Dia da Semana

| Dia | Carnes |
|-----|--------|
| Segunda | Lasanha de frango, Picadinho |
| Terça | Frango ao molho, Carne de sol |
| Quarta | Almôndega, Costela |
| Quinta | Lasanha de carne, Bife ao molho |
| Sexta | Peixe frito, Peixe cozido, Fígado acebolado |
| Sábado | Feijoada, Porco frito/cozido, Panelada |

---

## Tratamento de Erros

### Fora do Horário (400)
```json
{
  "error": "Fora do horário de funcionamento",
  "message": "Fechado - nosso horário é de 7h às 14h"
}
```

### Item Indisponível (400)
```json
{
  "error": "Itens indisponíveis",
  "items": ["Nome do item"]
}
```

### Bairro Não Encontrado (400)
```json
{
  "error": "Bairro não encontrado",
  "message": "Por favor, verifique o bairro ou entre em contato conosco"
}
```

---

## Fluxo Visual do Workflow

```
[Webhook Trigger]
       │
       ▼
[Buscar Cardápio] ──────────────────┐
       │                            │
       ▼                            ▼
[Buscar Almoço do Dia]      [Se necessário]
       │                            │
       ▼                            │
[Sofia AI Agent] ◄──────────────────┘
       │
       ├── [Consultar Taxa] (se entrega)
       │
       ├── [Criar Pedido] (quando confirmado)
       │
       ▼
[Enviar Resposta WhatsApp]
```

---

## Testando a Integração

### 1. Testar Cardápio
```bash
curl https://xbwsqnxpibzbavwypdyq.supabase.co/functions/v1/menu
```

### 2. Testar Taxa de Entrega
```bash
curl "https://xbwsqnxpibzbavwypdyq.supabase.co/functions/v1/delivery?bairro=Centro"
```

### 3. Testar Criação de Pedido
```bash
curl -X POST https://xbwsqnxpibzbavwypdyq.supabase.co/functions/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Teste",
    "customer_phone": "5588999999999",
    "order_type": "retirada",
    "items": [
      {"item_id": "SEU-ITEM-ID", "quantity": 1}
    ]
  }'
```

---

## Checklist de Configuração

- [ ] Criar workflow no n8n
- [ ] Configurar webhook trigger com path `/sofia_robusta`
- [ ] Adicionar nós de HTTP Request para APIs
- [ ] Configurar AI Agent com system prompt
- [ ] Configurar tool calling para APIs
- [ ] Testar fluxo completo
- [ ] Ativar webhook no n8n
