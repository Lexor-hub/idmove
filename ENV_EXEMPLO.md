# Variáveis de Ambiente - Exemplo

## Configurações de API Multi-Tenant

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

# Configurações do sistema
VITE_APP_NAME=ID Transporte
VITE_APP_VERSION=2.0.0

# Configurações de domínio (para produção)
VITE_MASTER_DOMAIN=admin.idtransportes.com
VITE_APP_DOMAIN=idtransportes.com
```

## Configurações de Produção

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

# Configurações de domínio
VITE_MASTER_DOMAIN=admin.idtransportes.com
VITE_APP_DOMAIN=idtransportes.com
```

## Configurações de Desenvolvimento

```env
# URLs dos serviços em desenvolvimento
VITE_AUTH_API_URL=http://localhost:3000
VITE_AUTH_USERS_API_URL=http://localhost:3001
VITE_DRIVERS_API_URL=http://localhost:3002
VITE_DELIVERIES_API_URL=http://localhost:3003
VITE_RECEIPTS_API_URL=http://localhost:3004
VITE_TRACKING_API_URL=http://localhost:3005
VITE_REPORTS_API_URL=http://localhost:3006
VITE_COMPANIES_API_URL=http://localhost:3007

# Configurações de domínio
VITE_MASTER_DOMAIN=localhost:5173
VITE_APP_DOMAIN=localhost:5173
```

## Notas Importantes

1. **Multi-Tenant**: O sistema agora suporta múltiplas empresas
2. **Domínios**: Cada empresa terá seu próprio subdomínio
3. **Master**: Apenas usuários MASTER podem gerenciar empresas
4. **Compatibilidade**: Mantida compatibilidade com roles antigas
5. **Segurança**: Todos os dados são isolados por empresa

## Estrutura de URLs

- **Master Dashboard**: `https://admin.idtransportes.com`
- **Empresa 1**: `https://empresa1.idtransportes.com`
- **Empresa 2**: `https://empresa2.idtransportes.com`

## Usuários de Teste

- **Master**: `master` / `admin123`
- **Admin Empresa**: `admin` / `admin123` (empresa: idtransportes)
- **Motorista**: `12345678901` / `driver123`
- **Cliente**: `cliente` / `client123` 