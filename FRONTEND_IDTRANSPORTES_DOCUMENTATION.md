# Frontend ID Transportes - Documentação Completa

## Visão Geral do Sistema

O frontend da ID Transportes é uma aplicação React moderna desenvolvida para gerenciar operações de logística e transporte multi-empresa. O sistema suporta múltiplas empresas (multi-tenant) com diferentes níveis de acesso e funcionalidades específicas para cada tipo de usuário.

## Arquitetura Técnica

### Stack Tecnológico
- **Framework**: React 18 com TypeScript
- **Build Tool**: Vite
- **UI Framework**: shadcn/ui + Tailwind CSS
- **Roteamento**: React Router v6
- **Gerenciamento de Estado**: React Context API
- **Autenticação**: JWT (JSON Web Tokens)
- **HTTP Client**: Fetch API nativo

### Estrutura de Pastas
```
src/
├── components/          # Componentes reutilizáveis
│   ├── auth/           # Componentes de autenticação
│   ├── layout/         # Layouts e navegação
│   ├── receipts/       # Upload e processamento de canhotos
│   ├── tracking/       # Rastreamento em tempo real
│   ├── occurrences/    # Gestão de ocorrências
│   └── ui/            # Componentes base (shadcn/ui)
├── contexts/           # Contextos React (AuthContext)
├── pages/             # Páginas da aplicação
│   ├── auth/          # Páginas de autenticação
│   └── dashboard/     # Dashboards por tipo de usuário
├── services/          # Serviços de API
├── types/             # Definições TypeScript
└── utils/             # Utilitários
```

## Sistema Multi-Tenant

### Conceito
O sistema suporta múltiplas empresas operando simultaneamente, com isolamento completo de dados entre empresas. Cada empresa possui:
- Dados isolados
- Configurações personalizadas
- Usuários específicos
- Relatórios independentes

### Configuração de URLs
```typescript
const API_BASE_URLS = {
  auth: 'http://localhost:3001',
  drivers: 'http://localhost:3002',
  deliveries: 'http://localhost:3003',
  receipts: 'http://localhost:3004',
  tracking: 'http://localhost:3005',
  reports: 'http://localhost:3006',
  companies: 'http://localhost:3007',
};
```

## Sistema de Autenticação

### Tipos de Usuário
1. **MASTER**: Acesso global a todas as empresas
2. **ADMIN**: Administrador de empresa específica
3. **SUPERVISOR**: Supervisor de operações
4. **OPERATOR**: Operador de sistema
5. **DRIVER**: Motorista
6. **CLIENT**: Cliente final

### Compatibilidade com Roles Antigas
```typescript
const roleMap = {
  MASTER: 'MASTER',
  ADMIN: 'ADMIN',
  SUPERVISOR: 'SUPERVISOR',
  OPERATOR: 'OPERATOR',
  DRIVER: 'DRIVER',
  CLIENT: 'CLIENT',
  // Compatibilidade
  ADMINISTRADOR: 'ADMIN',
  MOTORISTA: 'DRIVER',
  OPERADOR: 'OPERATOR',
};
```

### Processo de Login
1. Validação de credenciais
2. Verificação de empresa (opcional)
3. Geração de token JWT
4. Armazenamento seguro no localStorage
5. Redirecionamento para dashboard específico

## Dashboards por Tipo de Usuário

### Master Dashboard
- **Visão Global**: Estatísticas de todas as empresas
- **Gestão de Empresas**: Criar, editar, configurar empresas
- **Usuários Master**: Gerenciar usuários com acesso global
- **Relatórios Globais**: Análises consolidadas
- **Configurações Sistema**: Configurações globais

### Admin Dashboard
- **KPIs da Empresa**: Métricas de performance
- **Gestão de Usuários**: Criar e gerenciar usuários
- **Relatórios**: Relatórios detalhados
- **Configurações**: Personalização da empresa

### Supervisor Dashboard
- **Monitoramento**: Acompanhamento de entregas
- **Gestão de Motoristas**: Status e performance
- **Ocorrências**: Gestão de problemas
- **Relatórios**: Análises operacionais

### Driver Dashboard
- **Entregas Atuais**: Lista de entregas pendentes
- **Rastreamento**: Atualização de localização
- **Ocorrências**: Registro de problemas
- **Histórico**: Entregas realizadas

### Client Dashboard
- **Acompanhamento**: Status das entregas
- **Histórico**: Entregas anteriores
- **Notificações**: Atualizações em tempo real

## Funcionalidades Principais

### 1. Upload e Processamento de Canhotos
- **Upload de Imagens**: JPG, PNG, PDF (máx 5MB)
- **OCR Automático**: Extração de dados de notas fiscais
- **Validação**: Verificação e correção de dados
- **Armazenamento**: Sistema de arquivos seguro

### 2. Rastreamento em Tempo Real
- **Localização GPS**: Captura de coordenadas
- **Status do Motorista**: Ativo, inativo, ocupado, disponível
- **Histórico de Rotas**: Trajetórias completas
- **Atualizações Automáticas**: Refresh a cada 30s

### 3. Gestão de Ocorrências
- **Tipos**: Reentrega, recusa, avaria
- **Fotos**: Captura de evidências
- **Geolocalização**: Localização do problema
- **Relatórios**: Análise de ocorrências

### 4. Relatórios Avançados
- **Relatórios de Entregas**: Métricas de performance
- **Performance de Motoristas**: Análise individual
- **Volume por Cliente**: Análise de clientes
- **Exportação**: PDF, Excel, JSON

### 5. Gestão de Empresas (Master)
- **Criação**: Cadastro de novas empresas
- **Configuração**: Cores, logo, domínio
- **Limites**: Usuários e motoristas máximos
- **Planos**: Diferentes níveis de serviço

## Componentes Principais

### AuthContext
```typescript
interface AuthContextType {
  user: User | null;
  company: Company | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  loading: boolean;
}
```

### ApiService
- **Métodos HTTP**: GET, POST, PUT, DELETE
- **Autenticação**: Headers automáticos
- **Validação de Token**: Verificação de expiração
- **Tratamento de Erros**: Mensagens amigáveis
- **Multi-Service**: Comunicação com múltiplos backends

### DashboardLayout
- **Navegação**: Menu lateral responsivo
- **Header**: Informações do usuário e empresa
- **Breadcrumbs**: Navegação hierárquica
- **Responsividade**: Adaptação mobile

## Configuração de Ambiente

### Variáveis de Ambiente
```env
VITE_AUTH_API_URL=http://localhost:3001
VITE_DRIVERS_API_URL=http://localhost:3002
VITE_DELIVERIES_API_URL=http://localhost:3003
VITE_RECEIPTS_API_URL=http://localhost:3004
VITE_TRACKING_API_URL=http://localhost:3005
VITE_REPORTS_API_URL=http://localhost:3006
VITE_COMPANIES_API_URL=http://localhost:3007
```

### Instalação e Execução
```bash
npm install
npm run dev
```

## Segurança

### Autenticação
- **JWT Tokens**: Tokens seguros com expiração
- **Refresh Tokens**: Renovação automática
- **Validação Client-side**: Verificação de expiração
- **Logout Automático**: Limpeza de dados expirados

### Armazenamento
- **localStorage**: Tokens e dados de sessão
- **Limpeza Automática**: Remoção de dados expirados
- **Isolamento**: Dados separados por empresa

## Tratamento de Erros

### Tipos de Erro
1. **Erro de Configuração**: JWT_SECRET não configurado
2. **Erro de Conexão**: Servidor indisponível
3. **Erro de Autenticação**: Token inválido/expirado
4. **Erro de Validação**: Dados inválidos

### Feedback ao Usuário
- **Toasts**: Notificações temporárias
- **Mensagens Claras**: Explicação do problema
- **Logs Detalhados**: Debug no console
- **Recuperação**: Sugestões de solução

## Performance

### Otimizações
- **Lazy Loading**: Carregamento sob demanda
- **Memoização**: React.memo e useMemo
- **Debounce**: Pesquisas otimizadas
- **Cache**: Dados em localStorage

### Monitoramento
- **Console Logs**: Debug detalhado
- **Network Tab**: Análise de requisições
- **Performance Tab**: Métricas de renderização

## Funcionalidades Futuras (Phase 2)

### Sistema de Notificações
- **WebSocket**: Notificações em tempo real
- **Push Notifications**: Notificações do navegador
- **Alertas**: Sistema de alertas configurável

### Importação XML NF
- **Upload XML**: Arquivos da SEFAZ
- **Processamento Automático**: Extração de dados
- **Integração SEFAZ**: Validação oficial

### Funcionalidades Offline
- **Cache**: Dados críticos offline
- **Sincronização**: Sincronização automática
- **PWA**: Progressive Web App

### Configurações Avançadas
- **Personalização**: Cores e logos
- **Notificações**: Configurações de alertas
- **Integrações**: APIs externas

## Troubleshooting

### Problemas Comuns

#### Erro 500 - JWT_SECRET
**Sintoma**: `secretOrPrivateKey must have a value`
**Solução**: Configurar JWT_SECRET no backend

#### Duplicação de Headers
**Sintoma**: Dois headers aparecem na tela
**Solução**: Remover Header de componentes individuais

#### Token Inválido
**Sintoma**: 401 Unauthorized
**Solução**: Verificar expiração e renovar token

#### Erro de Importação
**Sintoma**: Module does not provide default export
**Solução**: Adicionar `export default` nos componentes

## Contato e Suporte

### Equipe de Desenvolvimento
- **Frontend**: React/TypeScript
- **Backend**: Node.js/Express
- **DevOps**: Docker/CI-CD

### Documentação
- **API**: Swagger/OpenAPI
- **Componentes**: Storybook
- **Testes**: Jest/React Testing Library

### Repositórios
- **Frontend**: GitHub - ID Transportes Frontend
- **Backend**: GitHub - ID Transportes Backend
- **Documentação**: Wiki do projeto

---

*Esta documentação é mantida atualizada pela equipe de desenvolvimento da ID Transportes. Para dúvidas ou sugestões, entre em contato com a equipe técnica.* 