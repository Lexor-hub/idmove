# ID Transportes - Sistema de Logística Multi-Empresa

## Visão Geral
Sistema React moderno para gestão de logística e transporte que suporta múltiplas empresas (multi-tenant) com diferentes níveis de acesso e funcionalidades específicas.

## Tecnologias Principais
- **Frontend**: React 18 + TypeScript + Vite
- **UI**: shadcn/ui + Tailwind CSS
- **Autenticação**: JWT Tokens
- **Arquitetura**: Microserviços (7 APIs diferentes)

## Tipos de Usuário
1. **MASTER**: Acesso global a todas as empresas
2. **ADMIN**: Administrador de empresa específica
3. **SUPERVISOR**: Supervisor de operações
4. **OPERATOR**: Operador de sistema
5. **DRIVER**: Motorista
6. **CLIENT**: Cliente final

## Funcionalidades Principais

### 1. Upload e Processamento de Canhotos
- Upload de imagens (JPG, PNG, PDF)
- OCR automático para extração de dados
- Validação e correção de informações
- Armazenamento seguro

### 2. Rastreamento em Tempo Real
- Localização GPS dos motoristas
- Status em tempo real (ativo, inativo, ocupado)
- Histórico de rotas
- Atualizações automáticas

### 3. Gestão de Ocorrências
- Registro de problemas (reentrega, recusa, avaria)
- Captura de fotos como evidência
- Geolocalização do problema
- Relatórios de análise

### 4. Relatórios Avançados
- Métricas de performance de entregas
- Análise individual de motoristas
- Volume por cliente
- Exportação em múltiplos formatos

### 5. Gestão Multi-Empresa (Master)
- Criação e configuração de empresas
- Personalização (cores, logo, domínio)
- Controle de limites (usuários, motoristas)
- Diferentes planos de serviço

## Dashboards Específicos

### Master Dashboard
- Estatísticas globais de todas as empresas
- Gestão de empresas e usuários master
- Relatórios consolidados
- Configurações do sistema

### Admin Dashboard
- KPIs da empresa
- Gestão de usuários
- Relatórios detalhados
- Configurações da empresa

### Supervisor Dashboard
- Monitoramento de entregas
- Gestão de motoristas
- Controle de ocorrências
- Análises operacionais

### Driver Dashboard
- Lista de entregas pendentes
- Atualização de localização
- Registro de ocorrências
- Histórico de entregas

### Client Dashboard
- Acompanhamento de status
- Histórico de entregas
- Notificações em tempo real

## Arquitetura Multi-Service
```
Auth Service: http://localhost:3001
Drivers Service: http://localhost:3002
Deliveries Service: http://localhost:3003
Receipts Service: http://localhost:3004
Tracking Service: http://localhost:3005
Reports Service: http://localhost:3006
Companies Service: http://localhost:3007
```

## Segurança
- JWT Tokens com expiração
- Validação client-side de tokens
- Isolamento completo de dados entre empresas
- Logout automático para tokens expirados

## Problemas Comuns e Soluções

### Erro 500 - JWT_SECRET
**Problema**: `secretOrPrivateKey must have a value`
**Solução**: Configurar variável JWT_SECRET no backend

### Duplicação de Headers
**Problema**: Dois headers aparecem na tela
**Solução**: Remover Header de componentes individuais

### Token Inválido (401)
**Problema**: Token expirado ou inválido
**Solução**: Verificar expiração e renovar token

## Funcionalidades Futuras (Phase 2)
- Sistema de notificações WebSocket
- Importação automática de XML NF
- Funcionalidades offline (PWA)
- Configurações avançadas de personalização

## Configuração de Ambiente
```bash
npm install
npm run dev
```

## Variáveis de Ambiente
```env
VITE_AUTH_API_URL=http://localhost:3001
VITE_DRIVERS_API_URL=http://localhost:3002
VITE_DELIVERIES_API_URL=http://localhost:3003
VITE_RECEIPTS_API_URL=http://localhost:3004
VITE_TRACKING_API_URL=http://localhost:3005
VITE_REPORTS_API_URL=http://localhost:3006
VITE_COMPANIES_API_URL=http://localhost:3007
```

## Estrutura do Projeto
```
src/
├── components/     # Componentes reutilizáveis
├── contexts/      # Contextos React (AuthContext)
├── pages/         # Páginas da aplicação
├── services/      # Serviços de API
├── types/         # Definições TypeScript
└── utils/         # Utilitários
```

## Tratamento de Erros
- Mensagens amigáveis para usuários
- Logs detalhados para debug
- Recuperação automática quando possível
- Feedback visual com toasts

## Performance
- Lazy loading de componentes
- Memoização para otimização
- Debounce em pesquisas
- Cache de dados críticos

---

*Sistema desenvolvido para ID Transportes - Gestão completa de logística multi-empresa com foco em rastreamento, relatórios e gestão de ocorrências.* 