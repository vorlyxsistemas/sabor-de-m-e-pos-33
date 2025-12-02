# MVP Plan - Sabor de Mãe

## 🎯 Visão Geral

Sistema completo de gestão para lanchonete, com foco em:
- Gestão de pedidos
- Cardápio digital
- Atendimento via WhatsApp com IA
- Controle de entregas

---

## 📊 Fase 1: Fundação (ATUAL ✅)

### Entregáveis
- [x] Estrutura de pastas organizada
- [x] Design system definido
- [x] Componentes base criados
- [x] Páginas estruturais (layouts)
- [x] Roteamento configurado
- [x] Documentação inicial

---

## 📊 Fase 2: Banco de Dados (PRÓXIMO)

### Integração com Lovable Cloud (Supabase)

```sql
-- Tabelas principais

-- Usuários do sistema (funcionários)
CREATE TABLE usuarios (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  cargo TEXT NOT NULL, -- admin, gerente, cozinha, atendente
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Categorias do cardápio
CREATE TABLE categorias (
  id UUID PRIMARY KEY,
  nome TEXT NOT NULL,
  ordem INT DEFAULT 0,
  ativo BOOLEAN DEFAULT true
);

-- Itens do cardápio
CREATE TABLE itens_cardapio (
  id UUID PRIMARY KEY,
  categoria_id UUID REFERENCES categorias(id),
  nome TEXT NOT NULL,
  descricao TEXT,
  preco DECIMAL(10,2) NOT NULL,
  imagem_url TEXT,
  disponivel BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cardápio de almoço por dia
CREATE TABLE almoco_semanal (
  id UUID PRIMARY KEY,
  dia_semana INT NOT NULL, -- 0=Domingo, 6=Sábado
  carne TEXT NOT NULL,
  acompanhamentos TEXT,
  preco DECIMAL(10,2),
  ativo BOOLEAN DEFAULT true
);

-- Bairros e taxas de entrega
CREATE TABLE bairros (
  id UUID PRIMARY KEY,
  nome TEXT NOT NULL,
  taxa DECIMAL(10,2) NOT NULL,
  tempo_estimado INT, -- minutos
  ativo BOOLEAN DEFAULT true
);

-- Clientes
CREATE TABLE clientes (
  id UUID PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT UNIQUE NOT NULL,
  endereco TEXT,
  bairro_id UUID REFERENCES bairros(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Pedidos
CREATE TABLE pedidos (
  id UUID PRIMARY KEY,
  numero SERIAL,
  cliente_id UUID REFERENCES clientes(id),
  tipo TEXT NOT NULL, -- delivery, retirada, mesa
  status TEXT NOT NULL, -- aguardando, preparando, pronto, entregue, cancelado
  subtotal DECIMAL(10,2) NOT NULL,
  taxa_entrega DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  observacao TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Itens do pedido
CREATE TABLE itens_pedido (
  id UUID PRIMARY KEY,
  pedido_id UUID REFERENCES pedidos(id),
  item_cardapio_id UUID REFERENCES itens_cardapio(id),
  quantidade INT NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  observacao TEXT
);

-- Agendamentos
CREATE TABLE agendamentos (
  id UUID PRIMARY KEY,
  pedido_id UUID REFERENCES pedidos(id),
  data_agendada TIMESTAMP NOT NULL,
  status TEXT DEFAULT 'agendado'
);
```

### Políticas RLS (Row Level Security)
- Autenticação obrigatória para todas as tabelas
- Admin: acesso total
- Staff: apenas leitura em itens, escrita em pedidos
- Clientes: acesso apenas aos próprios dados

---

## 📊 Fase 3: Autenticação

### Implementação
1. Auth com Supabase (email/senha)
2. Roles: `admin`, `gerente`, `cozinha`, `atendente`
3. Proteção de rotas por role
4. Sessão persistente

### Fluxo
```
Login → Verificar credenciais → Buscar role → Redirecionar para dashboard correto
```

---

## 📊 Fase 4: CRUD do Sistema

### Cardápio
- Listar categorias e itens
- Adicionar/editar/remover itens
- Upload de imagens
- Ordenação drag-and-drop

### Almoço Semanal
- Configurar carne por dia
- Preço único ou variável
- Toggle de disponibilidade

### Usuários
- Cadastro de funcionários
- Atribuição de roles
- Ativação/desativação

### Bairros e Taxas
- Cadastro de bairros
- Definição de taxas
- Tempo estimado de entrega

---

## 📊 Fase 5: Sistema de Pedidos

### Fluxo do Pedido
```
1. Receber pedido (WhatsApp ou manual)
2. Validar disponibilidade
3. Calcular taxa de entrega
4. Criar pedido no banco
5. Notificar cozinha
6. Atualizar status (Kanban)
7. Finalizar entrega
```

### Kanban
- Colunas: Aguardando → Em Preparo → Pronto → Entregue
- Drag-and-drop para atualizar status
- Tempo em cada etapa
- Alerta para pedidos atrasados

---

## 📊 Fase 6: Integração WhatsApp (Evolution API)

### Configuração
1. Instância Evolution API
2. Webhook para receber mensagens
3. Edge function para processar

### Fluxo
```
Cliente envia mensagem
    ↓
Evolution API recebe
    ↓
Webhook dispara
    ↓
Edge function processa
    ↓
Encaminha para Sofia (IA) ou cria pedido
```

### Tipos de Mensagem
- Texto: processado pela IA
- Localização: calcular taxa de entrega
- Imagem: comprovante de pagamento

---

## 📊 Fase 7: Agente Sofia (IA via N8N)

### Arquitetura
```
WhatsApp → Evolution API → N8N Workflow → Lovable AI → Resposta
```

### Capacidades da Sofia
1. **Atendimento**
   - Saudação personalizada
   - Apresentar cardápio
   - Tirar dúvidas sobre itens

2. **Pedidos**
   - Coletar itens do pedido
   - Confirmar endereço
   - Calcular total
   - Informar tempo de entrega

3. **Consultas**
   - Status do pedido
   - Horário de funcionamento
   - Cardápio do almoço do dia

### Workflow N8N
```
Trigger: Webhook (mensagem WhatsApp)
    ↓
Identificar intenção (IA)
    ↓
Switch por intenção:
  - cardapio → Buscar itens no Supabase
  - pedido → Iniciar fluxo de pedido
  - status → Consultar pedido
  - outro → Resposta genérica
    ↓
Formatar resposta
    ↓
Enviar via Evolution API
```

---

## 📊 Fase 8: Impressão de Comandas

### Opções
1. **Impressora Térmica USB**
   - Integração via browser print
   - Template de comanda em HTML

2. **Impressora em Rede**
   - API de impressão (print server)
   - Edge function para enviar

### Formato da Comanda
```
================================
      SABOR DE MÃE
================================
Pedido: #0042
Data: 02/12/2024 14:30
Tipo: DELIVERY
--------------------------------
1x Tapioca Frango      R$ 15,00
1x Suco Laranja        R$  8,00
--------------------------------
Subtotal:              R$ 23,00
Taxa Entrega:          R$  5,00
TOTAL:                 R$ 28,00
--------------------------------
Cliente: João Silva
Endereço: Rua das Flores, 123
Bairro: Centro
Telefone: (11) 99999-9999
--------------------------------
Observação: Sem cebola
================================
```

---

## 📊 Fase 9: Agendamentos

### Funcionalidades
- Agendar pedido para data/hora futura
- Notificação automática antes do horário
- Integração com Kanban

---

## 🗓️ Ordem de Implementação Recomendada

| Ordem | Fase | Prioridade | Dependências |
|-------|------|------------|--------------|
| 1 | Banco de Dados | CRÍTICA | - |
| 2 | Autenticação | CRÍTICA | Banco |
| 3 | CRUD Cardápio | ALTA | Auth |
| 4 | CRUD Almoço | ALTA | Cardápio |
| 5 | CRUD Pedidos | ALTA | Cardápio |
| 6 | Kanban Funcional | ALTA | Pedidos |
| 7 | WhatsApp | MÉDIA | Pedidos |
| 8 | Agente Sofia | MÉDIA | WhatsApp |
| 9 | Impressão | BAIXA | Pedidos |
| 10 | Agendamentos | BAIXA | Pedidos |

---

## ⚙️ Variáveis de Ambiente (Futuras)

```env
# Lovable Cloud (auto-configurado)
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Evolution API
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=

# N8N
N8N_WEBHOOK_URL=
```

---

## 📝 Notas Técnicas

### Edge Functions Planejadas
- `process-whatsapp-message`: Receber mensagens
- `send-whatsapp-message`: Enviar mensagens
- `calculate-delivery-fee`: Calcular taxa
- `print-order`: Imprimir comanda
- `ai-agent`: Processar com IA

### Real-time
- Usar Supabase Realtime para:
  - Atualização do Kanban
  - Novos pedidos
  - Status de pedidos

---

## 🚀 Conclusão

Este MVP está estruturado para crescer de forma organizada, seguindo as melhores práticas do Lovable. Cada fase pode ser implementada incrementalmente, sem quebrar funcionalidades existentes.

**Próximo passo recomendado:** Conectar Lovable Cloud e implementar a estrutura do banco de dados.
