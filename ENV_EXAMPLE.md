# 📋 Exemplo de Variáveis de Ambiente (.env.local)

## 🔧 **Configuração Completa**

Copie o conteúdo abaixo para um arquivo `.env.local` na raiz do projeto:

```env
# ========================================
# CONFIGURAÇÃO DA API - SISTEMA MULTI-TENANT
# ========================================

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

# Configurações de desenvolvimento
VITE_DEBUG_MODE=true
VITE_LOG_LEVEL=debug
```

## 🚀 **Como Usar**

1. **Crie o arquivo**: `cp ENV_EXAMPLE.md .env.local`
2. **Edite as URLs**: Ajuste as URLs conforme seu ambiente
3. **Reinicie o servidor**: `npm run dev`

## 📝 **Notas Importantes**

- ✅ **Desenvolvimento**: Use as URLs locais (localhost)
- ✅ **Produção**: Use as URLs de produção
- ✅ **Segurança**: Nunca commite o arquivo `.env.local`
- ✅ **Backup**: Mantenha um backup das configurações

## 🔍 **Verificação**

Para verificar se a configuração está correta:

```bash
# Verificar se as variáveis estão sendo carregadas
npm run dev
```

**🎯 Sistema configurado e pronto para uso!** 