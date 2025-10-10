# 🧪 Teste de Login com Debug

## 🎯 **Instruções para Testar o Login**

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

### **3. Limpar localStorage**
```javascript
// No console do navegador:
localStorage.clear();
console.log('localStorage limpo');
```

### **4. Fazer Login**
1. **Preencher credenciais**:
   - Username: `joao_motorista`
   - Password: `123456`

2. **Clicar em "Entrar"**

3. **Verificar logs no console**:
   ```
   === DEBUG API LOGIN ===
   Credenciais enviadas: {username: "joao_motorista", password: "123456"}
   
   === DEBUG LOGIN ===
   Fazendo login com credenciais: {username: "joao_motorista", password: "123456"}
   
   Resposta do login: {success: true, data: {token: "...", user: {...}}}
   Token recebido: Presente
   Token temporário salvo no localStorage: eyJhbGciOiJIUzI1NiIs...
   Token verificado no localStorage: Presente
   ```

### **5. Verificar localStorage Após Login**
```javascript
// No console do navegador:
console.log('temp_token:', localStorage.getItem('temp_token'));
console.log('id_transporte_token:', localStorage.getItem('id_transporte_token'));
console.log('temp_user:', localStorage.getItem('temp_user'));
```

### **6. Verificar Requisição para Companies**
1. **Ir para aba Network**
2. **Verificar requisição para**: `/api/auth/companies`
3. **Verificar logs**:
   ```
   === DEBUG getAuthHeader ===
   Token final: Ausente
   Token temporário: Presente
   Token encontrado: eyJhbGciOiJIUzI1NiIs...
   Token válido: true
   Token válido - enviando no header Authorization
   ```

## 🔍 **Possíveis Resultados**

### **✅ Cenário 1: Login Funciona**
```
=== DEBUG API LOGIN ===
Credenciais enviadas: {username: "joao_motorista", password: "123456"}
Resposta do login da API: {success: true, data: {token: "...", user: {...}}}

=== DEBUG LOGIN ===
Token recebido: Presente
Token temporário salvo no localStorage: eyJhbGciOiJIUzI1NiIs...
Token verificado no localStorage: Presente
```
**Resultado**: Login funcionando, token salvo

### **❌ Cenário 2: Login Falha**
```
=== DEBUG API LOGIN ===
Credenciais enviadas: {username: "joao_motorista", password: "123456"}
Resposta do login da API: {success: false, error: "..."}
```
**Problema**: Credenciais inválidas ou backend não responde

### **❌ Cenário 3: Token Não Salvo**
```
=== DEBUG LOGIN ===
Token recebido: Presente
Token temporário salvo no localStorage: eyJhbGciOiJIUzI1NiIs...
Token verificado no localStorage: Ausente
```
**Problema**: localStorage não está funcionando

## 🚀 **Próximos Passos**

### **Se Login Funciona mas Token Não Salva**:
1. Verificar se localStorage está habilitado
2. Verificar se há erros de JavaScript
3. Verificar se o navegador suporta localStorage

### **Se Login Falha**:
1. Verificar se o backend está rodando na porta 3000
2. Verificar se as credenciais estão corretas
3. Verificar se há erros de CORS

### **Se Token Salva mas Requisição Falha**:
1. Verificar se o token está sendo enviado no header
2. Verificar se o backend está aceitando o token
3. Verificar se o endpoint está correto

## ✅ **Resultado Esperado**

Após o teste:
- ✅ Login retorna token válido
- ✅ Token é salvo no localStorage
- ✅ Token é enviado no header Authorization
- ✅ Requisição para `/api/auth/companies` retorna 200
- ✅ Lista de empresas é carregada

**🎯 Identificar exatamente onde está o problema no fluxo de login!** 