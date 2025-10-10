# 🔧 Solução para Erro 404 - Porta 3001

## 🚨 **Problema Identificado**

O frontend ainda está fazendo requisições para `http://localhost:3001/api/auth/companies` em vez de `http://localhost:3000/api/auth/companies`.

## 🔍 **Possíveis Causas**

### **1. Cache do Navegador**
- O navegador pode estar usando uma versão em cache do JavaScript
- O Vite pode estar servindo uma versão antiga dos arquivos

### **2. Variáveis de Ambiente**
- Pode haver um arquivo `.env` com configuração antiga
- As variáveis de ambiente podem não estar sendo carregadas corretamente

### **3. Build Antigo**
- O projeto pode estar usando uma build antiga
- Os arquivos podem não ter sido recompilados

## ✅ **Soluções**

### **1. Limpar Cache e Recompilar**
```bash
# Parar o servidor de desenvolvimento
Ctrl + C

# Limpar cache do Vite
rm -rf node_modules/.vite

# Limpar cache do npm
npm cache clean --force

# Reinstalar dependências
npm install

# Iniciar servidor novamente
npm run dev
```

### **2. Limpar Cache do Navegador**
- **Chrome/Edge**: `Ctrl + Shift + R` (hard refresh)
- **Firefox**: `Ctrl + F5`
- **Ou**: Abrir DevTools → Network → Disable cache

### **3. Verificar Arquivos de Ambiente**
```bash
# Verificar se há arquivos .env
ls -la | grep .env

# Se houver, verificar o conteúdo
cat .env.local
cat .env
```

### **4. Forçar Rebuild**
```bash
# Parar servidor
Ctrl + C

# Limpar build
rm -rf dist

# Rebuild
npm run build
npm run dev
```

## 🔧 **Verificação da Configuração**

### **1. Verificar Console do Navegador**
Abra o DevTools (F12) e verifique:
- Se há erros de JavaScript
- Se a configuração está sendo carregada corretamente
- Se as URLs estão corretas

### **2. Verificar Network Tab**
- Abrir DevTools → Network
- Fazer login novamente
- Verificar para qual URL está sendo feita a requisição

### **3. Testar Configuração**
```javascript
// No console do navegador
import { getBaseUrl } from './src/config/api.ts';
console.log(getBaseUrl('/api/auth/companies'));
// Deve retornar: http://localhost:3000
```

## 🎯 **Configuração Correta**

### **Arquivo: src/config/api.ts**
```typescript
export const API_CONFIG = {
  AUTH_SERVICE: 'http://localhost:3000',    // ✅ CORRETO
  AUTH_USERS: 'http://localhost:3001',      // ✅ CORRETO
  // ... outros serviços
};
```

### **Função getBaseUrl**
```typescript
export function getBaseUrl(endpoint: string): string {
  const config = getApiConfig();
  
  // ✅ Autenticação (inclui /api/auth/companies)
  if (endpoint.startsWith('/api/auth')) {
    return config.AUTH_SERVICE; // http://localhost:3000
  }
  
  // ... outros serviços
}
```

## 🚀 **Passos para Resolver**

1. **Parar o servidor**: `Ctrl + C`
2. **Limpar cache**: `rm -rf node_modules/.vite`
3. **Reinstalar**: `npm install`
4. **Reiniciar**: `npm run dev`
5. **Limpar cache do navegador**: `Ctrl + Shift + R`
6. **Testar**: Fazer login novamente

## ✅ **Resultado Esperado**

Após aplicar as soluções:
- ✅ Requisições vão para `http://localhost:3000`
- ✅ Endpoint `/api/auth/companies` funciona
- ✅ Login funciona corretamente
- ✅ Seleção de empresa funciona

**🎯 Sistema funcionando com as portas corretas!** 