# Erro 500 - Problema de Configuração do Backend

## Problema Identificado

O erro `500 Internal Server Error` com a mensagem `"secretOrPrivateKey must have a value"` indica que o backend não está configurado corretamente para gerar tokens JWT.

## Causa do Problema

O backend está tentando gerar um token JWT mas não possui a chave secreta configurada. Este é um problema de configuração no lado do servidor.

## Soluções Implementadas no Frontend

### 1. Melhor Tratamento de Erro
- Adicionado tratamento específico para o erro `secretOrPrivateKey`
- Mensagem de erro mais clara para o usuário: "Erro de configuração do servidor. Entre em contato com o administrador."
- Logs detalhados para debug

### 2. Logs de Debug
- Logs de requisição e resposta para facilitar o debug
- Verificação de token e validação de expiração
- Logs específicos para problemas de configuração

### 3. Melhor Experiência do Usuário
- Mensagens de erro mais amigáveis
- Tratamento de diferentes tipos de erro de conexão
- Feedback claro sobre problemas de configuração

## Solução no Backend

O administrador do backend precisa:

1. **Configurar a variável de ambiente JWT_SECRET**:
   ```env
   JWT_SECRET=sua_chave_secreta_muito_segura_aqui
   ```

2. **Verificar se o arquivo .env está sendo carregado corretamente**

3. **Reiniciar o servidor backend** após a configuração

## Como Testar

1. Configure a variável `JWT_SECRET` no backend
2. Reinicie o servidor backend
3. Tente fazer login novamente
4. Verifique os logs do console para confirmar que não há mais erros

## Logs Úteis para Debug

O frontend agora exibe logs detalhados no console:
- URL da requisição
- Status da resposta
- Detalhes do erro
- Validação de token

## Próximos Passos

1. **Imediato**: Configurar `JWT_SECRET` no backend
2. **Verificação**: Testar login após configuração
3. **Monitoramento**: Verificar logs para confirmar funcionamento

## Contato

Se o problema persistir após configurar o `JWT_SECRET`, entre em contato com a equipe de backend com os logs do console. 