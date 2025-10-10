# 🔍 Debug - Problema do Token

## 🚨 **Erro Atual**
```
Status da resposta: 401 Unauthorized
Erro da API: Object
API Error: Error: Token não fornecido
```

## 🔍 **Análise do Problema**

### **1. Fluxo Esperado**
1. ✅ Login → Token temporário salvo em `temp_token`
2. ✅ Selecionar empresa → Token final salvo em `id_transporte_token`
3. ❌ **Problema**: Token não está sendo enviado para `/api/auth/companies`

### **2. Verificações Necessárias**

#### **A. Verificar se o Login Funcionou**
```javascript
// No console do navegador
console.log('temp_token:', localStorage.getItem('temp_token'));
console.log('id_transporte_token:', localStorage.getItem('id_transporte_token'));
```

#### **B. Verificar Headers da Requisição**
```javascript
// No console do navegador
// Abrir DevTools → Network → Fazer login → Verificar headers
```

#### **C. Verificar Função getAuthHeader**
```javascript
// No console do navegador
// Importar e testar a função
import { apiService } from './src/services/api';
console.log('Headers:', apiService.getAuthHeader());
```

## 🔧 **Soluções**

### **1. Verificar se o Token Está Sendo Salvo**
```javascript
// Após fazer login, verificar:
localStorage.getItem('temp_token') // Deve ter valor
localStorage.getItem('id_transporte_token') // Deve estar vazio
```

### **2. Verificar se o Token Está Sendo Enviado**
```javascript
// Na aba Network do DevTools:
// 1. Fazer login
// 2. Verificar requisição para /api/auth/companies
// 3. Verificar se o header Authorization está presente
```

### **3. Debug da Função getAuthHeader**
```javascript
// Adicionar logs na função getAuthHeader
private getAuthHeader(): Record<string, string> {
  console.log('=== DEBUG getAuthHeader ===');
  
  let token = localStorage.getItem('id_transporte_token');
  console.log('Token final:', token ? 'Presente' : 'Ausente');
  
  if (!token) {
    token = localStorage.getItem('temp_token');
    console.log('Token temporário:', token ? 'Presente' : 'Ausente');
  }
  
  if (token) {
    console.log('Token válido:', this.isTokenValid());
    return { Authorization: `Bearer ${token}` };
  }
  
  console.log('Nenhum token encontrado');
  return {};
}
```

## 🎯 **Passos para Debug**

### **1. Verificar Login**
```javascript
// 1. Fazer login
// 2. Verificar console para logs
// 3. Verificar localStorage
```

### **2. Verificar Token**
```javascript
// No console:
localStorage.getItem('temp_token')
localStorage.getItem('id_transporte_token')
```

### **3. Verificar Requisição**
```javascript
// 1. Abrir DevTools → Network
// 2. Fazer login
// 3. Verificar requisição para companies
// 4. Verificar headers
```

## ✅ **Resultado Esperado**

Após debug:
- ✅ Token temporário salvo após login
- ✅ Token enviado no header Authorization
- ✅ Requisição para `/api/auth/companies` com sucesso
- ✅ Lista de empresas carregada

**🎯 Identificar onde o token está sendo perdido!** 