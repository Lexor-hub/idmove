# 🧪 Teste de Debug - Token

## 🎯 **Instruções para Testar**

### **1. Preparar o Ambiente**
```bash
# 1. Parar o servidor (se estiver rodando)
Ctrl + C

# 2. Reiniciar o servidor
npm run dev

# 3. Abrir o navegador
http://localhost:5173
```

### **2. Abrir DevTools**
- **Chrome/Edge**: `F12` ou `Ctrl + Shift + I`
- **Firefox**: `F12` ou `Ctrl + Shift + I`
- **Ir para aba**: `Console`

### **3. Fazer Login**
1. **Preencher credenciais**:
   - Username: `joao_motorista`
   - Password: `123456`

2. **Clicar em "Entrar"**

3. **Verificar logs no console**:
   ```
   === DEBUG getAuthHeader ===
   Token final: Ausente
   Token temporário: Presente
   Token encontrado: eyJhbGciOiJIUzI1NiIs...
   Token válido: true
   Token válido - enviando no header Authorization
   ```

### **4. Verificar localStorage**
```javascript
// No console do navegador:
console.log('temp_token:', localStorage.getItem('temp_token'));
console.log('id_transporte_token:', localStorage.getItem('id_transporte_token'));
```

### **5. Verificar Requisição**
1. **Ir para aba Network**
2. **Fazer login novamente**
3. **Procurar requisição para**: `/api/auth/companies`
4. **Verificar headers**:
   - Deve ter: `Authorization: Bearer eyJhbGciOiJIUzI1NiIs...`

## 🔍 **Possíveis Resultados**

### **✅ Cenário 1: Token Presente**
```
=== DEBUG getAuthHeader ===
Token final: Ausente
Token temporário: Presente
Token encontrado: eyJhbGciOiJIUzI1NiIs...
Token válido: true
Token válido - enviando no header Authorization
```
**Resultado**: Requisição deve funcionar

### **❌ Cenário 2: Token Ausente**
```
=== DEBUG getAuthHeader ===
Token final: Ausente
Token temporário: Ausente
Nenhum token encontrado no localStorage
```
**Problema**: Login não salvou o token

### **❌ Cenário 3: Token Inválido**
```
=== DEBUG getAuthHeader ===
Token final: Ausente
Token temporário: Presente
Token encontrado: eyJhbGciOiJIUzI1NiIs...
Token válido: false
Token expirado ou inválido - removendo do localStorage
```
**Problema**: Token expirado ou malformado

## 🚀 **Próximos Passos**

### **Se Token Presente mas Requisição Falha**:
1. Verificar se o backend está aceitando o token
2. Verificar se o endpoint está correto
3. Verificar se há CORS issues

### **Se Token Ausente**:
1. Verificar se o login está funcionando
2. Verificar se o token está sendo salvo
3. Verificar se há erros no console

### **Se Token Inválido**:
1. Verificar se o token está sendo gerado corretamente
2. Verificar se a validação está correta
3. Verificar se o backend está gerando tokens válidos

## ✅ **Resultado Esperado**

Após o teste:
- ✅ Login funciona
- ✅ Token é salvo no localStorage
- ✅ Token é enviado no header Authorization
- ✅ Requisição para `/api/auth/companies` retorna 200
- ✅ Lista de empresas é carregada

**🎯 Identificar exatamente onde está o problema!** 