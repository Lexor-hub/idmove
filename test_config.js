// Teste de Configuração da API
console.log('=== TESTE DE CONFIGURAÇÃO DA API ===');

// Verificar variáveis de ambiente
console.log('VITE_AUTH_API_URL:', import.meta.env.VITE_AUTH_API_URL);
console.log('VITE_AUTH_USERS_API_URL:', import.meta.env.VITE_AUTH_USERS_API_URL);

// Importar configuração
import { API_CONFIG, getApiConfig, getBaseUrl } from './src/config/api.ts';

console.log('API_CONFIG:', API_CONFIG);
console.log('getApiConfig():', getApiConfig());

// Testar roteamento
console.log('getBaseUrl("/api/auth/companies"):', getBaseUrl('/api/auth/companies'));
console.log('getBaseUrl("/api/auth/login"):', getBaseUrl('/api/auth/login'));
console.log('getBaseUrl("/api/users"):', getBaseUrl('/api/users'));

console.log('=== FIM DO TESTE ==='); 