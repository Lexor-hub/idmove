# 🎯 Responsabilidades dos Serviços - Sistema Multi-Tenant

## ✅ **Configuração Correta das Portas**

```typescript
// ✅ Portas corretas dos serviços
const AUTH_SERVICE_PORT = 3000;    // auth-service (onde está o endpoint /api/auth/companies)
const AUTH_USERS_PORT = 3001;      // auth-users-service (não tem endpoint de companies)
const DRIVERS_PORT = 3002;         // drivers-vehicles-service
const DELIVERIES_PORT = 3003;      // deliveries-routes-service
const RECEIPTS_PORT = 3004;        // receipts-ocr-service
const TRACKING_PORT = 3005;        // tracking-service
const REPORTS_PORT = 3006;         // reports-service
const COMPANIES_PORT = 3007;       // companies-service
```

## 🚀 **Detalhamento dos Serviços**

### **1. AUTH_SERVICE (Porta 3000)**
- **Responsabilidade**: Autenticação e autorização
- **Endpoint de Companies**: ✅ **SIM** - `/api/auth/companies`
- **Endpoints Principais**:
  - `POST /api/auth/login` - Login do usuário
  - `GET /api/auth/companies` - Listar empresas do usuário
  - `POST /api/auth/select-company` - Selecionar empresa
  - `GET /api/auth/profile` - Obter perfil do usuário
  - `POST /api/auth/refresh` - Renovar token
  - `POST /api/auth/logout` - Logout

### **2. AUTH_USERS (Porta 3001)**
- **Responsabilidade**: Gerenciamento de usuários
- **Endpoint de Companies**: ❌ **NÃO** - Não possui endpoint de companies
- **Endpoints Principais**:
  - `GET /api/users` - Listar usuários
  - `POST /api/users` - Criar usuário
  - `PUT /api/users/:id` - Atualizar usuário
  - `DELETE /api/users/:id` - Deletar usuário

### **3. DRIVERS (Porta 3002)**
- **Responsabilidade**: Motoristas e veículos
- **Endpoint de Companies**: ❌ **NÃO**
- **Endpoints Principais**:
  - `GET /api/drivers` - Listar motoristas
  - `POST /api/drivers` - Criar motorista
  - `GET /api/vehicles` - Listar veículos
  - `POST /api/vehicles` - Criar veículo

### **4. DELIVERIES (Porta 3003)**
- **Responsabilidade**: Entregas, rotas e ocorrências
- **Endpoint de Companies**: ❌ **NÃO**
- **Endpoints Principais**:
  - `GET /api/deliveries` - Listar entregas
  - `POST /api/deliveries` - Criar entrega
  - `GET /api/routes` - Listar rotas
  - `GET /api/occurrences` - Listar ocorrências

### **5. RECEIPTS (Porta 3004)**
- **Responsabilidade**: Comprovantes e OCR
- **Endpoint de Companies**: ❌ **NÃO**
- **Endpoints Principais**:
  - `POST /api/receipts/upload` - Upload de comprovante
  - `POST /api/receipts/:id/ocr` - Processar OCR
  - `GET /api/receipts` - Listar comprovantes

### **6. TRACKING (Porta 3005)**
- **Responsabilidade**: Rastreamento em tempo real
- **Endpoint de Companies**: ❌ **NÃO**
- **Endpoints Principais**:
  - `POST /api/tracking/location` - Enviar localização
  - `GET /api/tracking/current` - Localizações atuais
  - `GET /api/tracking/history` - Histórico de rastreamento

### **7. REPORTS (Porta 3006)**
- **Responsabilidade**: Relatórios e analytics
- **Endpoint de Companies**: ❌ **NÃO**
- **Endpoints Principais**:
  - `GET /api/reports/deliveries` - Relatório de entregas
  - `GET /api/reports/drivers` - Relatório de motoristas
  - `GET /api/dashboard/kpis` - KPIs do dashboard

### **8. COMPANIES (Porta 3007)**
- **Responsabilidade**: Gerenciamento de empresas
- **Endpoint de Companies**: ✅ **SIM** - `/api/companies`
- **Endpoints Principais**:
  - `GET /api/companies` - Listar empresas
  - `POST /api/companies` - Criar empresa
  - `PUT /api/companies/:id` - Atualizar empresa

## 🔧 **Roteamento Correto de Endpoints**

### **Para AUTH_SERVICE (Porta 3000)**
```typescript
// ✅ Endpoints que vão para AUTH_SERVICE
'/api/auth/login'           // Login
'/api/auth/companies'       // Listar empresas do usuário
'/api/auth/select-company'  // Selecionar empresa
'/api/auth/profile'         // Perfil do usuário
'/api/auth/refresh'         // Renovar token
'/api/auth/logout'          // Logout
```

### **Para AUTH_USERS (Porta 3001)**
```typescript
// ✅ Endpoints que vão para AUTH_USERS
'/api/users'                // Listar usuários
'/api/users/:id'            // Gerenciar usuário específico
```

### **Para COMPANIES (Porta 3007)**
```typescript
// ✅ Endpoints que vão para COMPANIES
'/api/companies'            // Listar todas as empresas
'/api/companies/:id'        // Gerenciar empresa específica
```

## ⚠️ **Pontos Importantes**

### **1. Diferença entre AUTH_SERVICE e AUTH_USERS**
- **AUTH_SERVICE (3000)**: Autenticação e empresas do usuário logado
- **AUTH_USERS (3001)**: Gerenciamento geral de usuários

### **2. Diferença entre AUTH_SERVICE e COMPANIES**
- **AUTH_SERVICE (3000)**: `/api/auth/companies` - Empresas do usuário logado
- **COMPANIES (3007)**: `/api/companies` - Gerenciamento geral de empresas

### **3. Fluxo de Autenticação**
1. Login via `AUTH_SERVICE` (3000)
2. Listar empresas via `AUTH_SERVICE` (3000)
3. Selecionar empresa via `AUTH_SERVICE` (3000)
4. Acessar dados da empresa selecionada

## 🎯 **Resultado Esperado**

Com essa configuração correta:

1. **✅ Login**: Funciona via AUTH_SERVICE (3000)
2. **✅ Listar Empresas**: Funciona via AUTH_SERVICE (3000)
3. **✅ Selecionar Empresa**: Funciona via AUTH_SERVICE (3000)
4. **✅ Acesso aos Dados**: Funciona com token da empresa selecionada

**🎯 Sistema de autenticação multi-tenant funcionando perfeitamente!** 