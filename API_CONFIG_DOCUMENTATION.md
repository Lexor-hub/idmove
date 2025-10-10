# 📋 Configuração da API - Sistema Multi-Tenant

## 🎯 **Estrutura Centralizada de Configuração**

### **Arquivo Principal**: `src/config/api.ts`

```typescript
// Configuração centralizada da API - Multi-Tenant System
export const API_CONFIG = {
  // ✅ Serviços de Autenticação e Usuários
  AUTH_SERVICE: 'http://localhost:3000',  // ✅ Para autenticação
  AUTH_USERS: 'http://localhost:3001',    // ✅ Para gerenciamento de usuários
  
  // ✅ Serviços de Negócio
  DRIVERS: 'http://localhost:3002',       // ✅ Motoristas e Veículos
  DELIVERIES: 'http://localhost:3003',    // ✅ Entregas e Rotas
  RECEIPTS: 'http://localhost:3004',      // ✅ Comprovantes e OCR
  TRACKING: 'http://localhost:3005',      // ✅ Rastreamento em tempo real
  REPORTS: 'http://localhost:3006',       // ✅ Relatórios e Analytics
  COMPANIES: 'http://localhost:3007'      // ✅ Gerenciamento de Empresas
};
```

## 🚀 **Serviços e Suas Responsabilidades**

### **1. AUTH_SERVICE (Porta 3000)**
- **Responsabilidade**: Autenticação e autorização
- **Endpoints**:
  - `POST /api/auth/login` - Login do usuário
  - `GET /api/auth/companies` - Listar empresas do usuário
  - `POST /api/auth/select-company` - Selecionar empresa
  - `GET /api/auth/profile` - Obter perfil do usuário
  - `POST /api/auth/refresh` - Renovar token
  - `POST /api/auth/logout` - Logout

### **2. AUTH_USERS (Porta 3001)**
- **Responsabilidade**: Gerenciamento de usuários
- **Endpoints**:
  - `GET /api/users` - Listar usuários
  - `POST /api/users` - Criar usuário
  - `PUT /api/users/:id` - Atualizar usuário
  - `DELETE /api/users/:id` - Deletar usuário
  - **Nota**: Não possui endpoint de companies

### **3. DRIVERS (Porta 3002)**
- **Responsabilidade**: Motoristas e veículos
- **Endpoints**:
  - `GET /api/drivers` - Listar motoristas
  - `POST /api/drivers` - Criar motorista
  - `GET /api/vehicles` - Listar veículos
  - `POST /api/vehicles` - Criar veículo

### **4. DELIVERIES (Porta 3003)**
- **Responsabilidade**: Entregas, rotas e ocorrências
- **Endpoints**:
  - `GET /api/deliveries` - Listar entregas
  - `POST /api/deliveries` - Criar entrega
  - `GET /api/routes` - Listar rotas
  - `GET /api/occurrences` - Listar ocorrências

### **5. RECEIPTS (Porta 3004)**
- **Responsabilidade**: Comprovantes e OCR
- **Endpoints**:
  - `POST /api/receipts/upload` - Upload de comprovante
  - `POST /api/receipts/:id/ocr` - Processar OCR
  - `GET /api/receipts` - Listar comprovantes

### **6. TRACKING (Porta 3005)**
- **Responsabilidade**: Rastreamento em tempo real
- **Endpoints**:
  - `POST /api/tracking/location` - Enviar localização
  - `GET /api/tracking/current` - Localizações atuais
  - `GET /api/tracking/history` - Histórico de rastreamento

### **7. REPORTS (Porta 3006)**
- **Responsabilidade**: Relatórios e analytics
- **Endpoints**:
  - `GET /api/reports/deliveries` - Relatório de entregas
  - `GET /api/reports/drivers` - Relatório de motoristas
  - `GET /api/dashboard/kpis` - KPIs do dashboard

### **8. COMPANIES (Porta 3007)**
- **Responsabilidade**: Gerenciamento de empresas
- **Endpoints**:
  - `GET /api/companies` - Listar empresas
  - `POST /api/companies` - Criar empresa
  - `PUT /api/companies/:id` - Atualizar empresa

## 🔧 **Configuração de Variáveis de Ambiente**

### **Desenvolvimento (.env.local)**
```env
# URLs dos serviços
VITE_AUTH_API_URL=http://localhost:3000
VITE_AUTH_USERS_API_URL=http://localhost:3001
VITE_DRIVERS_API_URL=http://localhost:3002
VITE_DELIVERIES_API_URL=http://localhost:3003
VITE_RECEIPTS_API_URL=http://localhost:3004
VITE_TRACKING_API_URL=http://localhost:3005
VITE_REPORTS_API_URL=http://localhost:3006
VITE_COMPANIES_API_URL=http://localhost:3007
```

### **Produção (.env.production)**
```env
# URLs dos serviços em produção
VITE_AUTH_API_URL=https://api.idtransportes.com/auth
VITE_AUTH_USERS_API_URL=https://api.idtransportes.com/users
VITE_DRIVERS_API_URL=https://api.idtransportes.com/drivers
VITE_DELIVERIES_API_URL=https://api.idtransportes.com/deliveries
VITE_RECEIPTS_API_URL=https://api.idtransportes.com/receipts
VITE_TRACKING_API_URL=https://api.idtransportes.com/tracking
VITE_REPORTS_API_URL=https://api.idtransportes.com/reports
VITE_COMPANIES_API_URL=https://api.idtransportes.com/companies
```

## 📝 **Uso no Código**

### **Importação da Configuração**
```typescript
import { API_CONFIG, getApiConfig, getBaseUrl } from '@/config/api';
```

### **Uso Direto da Configuração**
```typescript
// Acesso direto às URLs
const authUrl = API_CONFIG.AUTH_SERVICE;
const driversUrl = API_CONFIG.DRIVERS;
```

### **Uso com Variáveis de Ambiente**
```typescript
// Configuração dinâmica baseada em variáveis de ambiente
const config = getApiConfig();
const authUrl = config.AUTH_SERVICE;
```

### **Determinação Automática da URL Base**
```typescript
// Função que determina automaticamente a URL base pelo endpoint
const baseUrl = getBaseUrl('/api/auth/login'); // Retorna: http://localhost:3000
const driversUrl = getBaseUrl('/api/drivers'); // Retorna: http://localhost:3002
```

## ✅ **Benefícios da Nova Estrutura**

### **1. Centralização**
- ✅ Todas as configurações em um único arquivo
- ✅ Fácil manutenção e atualização
- ✅ Consistência em todo o projeto

### **2. Flexibilidade**
- ✅ Suporte a variáveis de ambiente
- ✅ Configuração diferente para desenvolvimento e produção
- ✅ Fallback para valores padrão

### **3. Organização**
- ✅ Separação clara por responsabilidade
- ✅ Comentários explicativos
- ✅ Tipagem TypeScript

### **4. Escalabilidade**
- ✅ Fácil adição de novos serviços
- ✅ Configuração multi-tenant
- ✅ Suporte a diferentes ambientes

## 🎯 **Resultado Final**

A nova estrutura de configuração oferece:

1. **Organização**: Configuração centralizada e bem documentada
2. **Flexibilidade**: Suporte a diferentes ambientes
3. **Manutenibilidade**: Fácil atualização e manutenção
4. **Escalabilidade**: Preparado para crescimento do sistema
5. **Consistência**: Padrão único em todo o projeto

**🎯 Sistema pronto para produção com configuração multi-tenant completa!** 