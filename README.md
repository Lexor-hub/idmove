# ID MOVE - Sistema Multi-Tenant

Sistema de gestão de entregas com suporte a múltiplas empresas (multi-tenant).

## 🚀 Funcionalidades

### Sistema Multi-Tenant
- **Múltiplas Empresas**: Cada empresa tem sua própria instância isolada
- **Domínios Personalizados**: Cada empresa pode ter seu subdomínio
- **Isolamento de Dados**: Dados completamente separados por empresa
- **Configurações Personalizadas**: Logo, cores e configurações por empresa

### Tipos de Usuário
- **MASTER**: Administrador do sistema que gerencia todas as empresas
- **ADMIN**: Administrador de uma empresa específica
- **SUPERVISOR**: Supervisor de uma empresa
- **OPERATOR**: Operador de uma empresa
- **DRIVER**: Motorista de uma empresa
- **CLIENT**: Cliente de uma empresa

### Funcionalidades por Perfil
- **Dashboard Personalizado**: Interface específica para cada tipo de usuário
- **Gestão de Entregas**: Acompanhamento de canhotos e status
- **Rastreamento**: Localização em tempo real dos motoristas
- **Relatórios**: Relatórios detalhados por empresa
- **Gestão de Usuários**: Administração de usuários (ADMIN/MASTER)
- **Gestão de Veículos**: Controle da frota (ADMIN)

## 🛠️ Tecnologias

- **Frontend**: React + TypeScript + Vite
- **UI**: shadcn/ui + Tailwind CSS
- **Estado**: React Context API
- **Roteamento**: React Router
- **HTTP Client**: Fetch API

## 📦 Instalação

```bash
# Clone o repositório
git clone <repository-url>
cd frontend-id-transportes

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp ENV_EXEMPLO.md .env
# Edite o arquivo .env com suas configurações

# Inicie o servidor de desenvolvimento
npm run dev
```

## ⚙️ Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# URLs dos serviços
VITE_AUTH_API_URL=http://localhost:3001
VITE_DRIVERS_API_URL=http://localhost:3002
VITE_DELIVERIES_API_URL=http://localhost:3003
VITE_RECEIPTS_API_URL=http://localhost:3004
VITE_TRACKING_API_URL=http://localhost:3005
VITE_REPORTS_API_URL=http://localhost:3006
VITE_COMPANIES_API_URL=http://localhost:3007

# Configurações do sistema
VITE_APP_NAME=ID MOVE
VITE_APP_VERSION=2.0.0
```

### Estrutura de URLs

- **Master Dashboard**: `https://admin.idmove.com`
- **Empresa 1**: `https://empresa1.idmove.com`
- **Empresa 2**: `https://empresa2.idmove.com`

## 👥 Usuários de Teste

### Master (Sistema)
- **Usuário**: `master`
- **Senha**: `admin123`
- **Acesso**: Dashboard Master, Gestão de Empresas

### Admin (Empresa)
- **Usuário**: `admin`
- **Senha**: `admin123`
- **Empresa**: `idmove`
- **Acesso**: Dashboard Admin, Gestão de Usuários, Veículos, etc.

### Motorista
- **CPF**: `12345678901`
- **Senha**: `driver123`
- **Acesso**: Minhas Entregas, Rastreamento

### Cliente
- **Usuário**: `cliente`
- **Senha**: `client123`
- **Acesso**: Minhas Entregas, Relatórios

## 🏗️ Estrutura do Projeto

```
src/
├── components/
│   ├── auth/           # Componentes de autenticação
│   ├── dashboard/      # Componentes do dashboard
│   ├── layout/         # Layout e header
│   └── ui/            # Componentes UI reutilizáveis
├── contexts/
│   └── AuthContext.tsx # Contexto de autenticação multi-tenant
├── pages/
│   ├── dashboard/      # Páginas do dashboard
│   └── Login.tsx      # Página de login
├── services/
│   └── api.ts         # Serviços de API
└── types/
    └── auth.ts        # Tipos TypeScript
```

## 🔐 Segurança Multi-Tenant

### Isolamento de Dados
- Todos os dados são filtrados por `company_id`
- Usuários não podem acessar dados de outras empresas
- Middleware de autorização por empresa

### Auditoria
- Log de todas as ações dos usuários
- Rastreamento de IP e user agent
- Histórico de logins por empresa

## 🚀 Deploy

### Desenvolvimento
```bash
npm run dev
```

### Produção
```bash
npm run build
npm run preview
```

### Variáveis de Produção
```env
VITE_AUTH_API_URL=https://api.idmove.com/auth
VITE_DRIVERS_API_URL=https://api.idmove.com/drivers
VITE_DELIVERIES_API_URL=https://api.idmove.com/deliveries
VITE_RECEIPTS_API_URL=https://api.idmove.com/receipts
VITE_TRACKING_API_URL=https://api.idmove.com/tracking
VITE_REPORTS_API_URL=https://api.idmove.com/reports
VITE_COMPANIES_API_URL=https://api.idmove.com/companies
```

## 📚 Documentação

- [Manual de Migração Multi-Tenant](MIGRATE_MULTITENANT.MD)
- [Configuração de Ambiente](ENV_EXEMPLO.md)

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.
