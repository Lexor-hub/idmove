import { z } from 'zod';

// 1. Definição da Interface e Schema de Validação (Zod)
// =========================================================================

/**
 * Define a estrutura de configuração da API, com URLs para cada microserviço.
 */
export interface ApiConfig {
  AUTH_SERVICE: string;
  AUTH_USERS: string;
  DRIVERS: string;
  DELIVERIES: string;
  RECEIPTS: string;
  TRACKING: string;
  REPORTS: string;
  COMPANIES: string;
}

const ApiConfigSchema = z.object({
  AUTH_SERVICE: z.string().url(),
  AUTH_USERS: z.string().url(),
  DRIVERS: z.string().url(),
  DELIVERIES: z.string().url(),
  RECEIPTS: z.string().url(),
  TRACKING: z.string().url(),
  REPORTS: z.string().url(),
  COMPANIES: z.string().url(),
});

// 2. Configuração Padrão (Fallback)
// =========================================================================

/**
 * Configuração padrão para ambiente de desenvolvimento local.
 * Usada como fallback se as variáveis de ambiente não estiverem definidas.
 */
export const API_CONFIG_DEFAULT: ApiConfig = {
  AUTH_SERVICE: 'http://localhost:3000',
  AUTH_USERS: 'http://localhost:3001',
  DRIVERS: 'http://localhost:3002',
  DELIVERIES: 'http://localhost:3003',
  RECEIPTS: 'http://localhost:3004',
  TRACKING: 'http://localhost:3005',
  REPORTS: 'http://localhost:3006',
  COMPANIES: 'http://localhost:3007',
};

// 3. Função para Obter a Configuração (com Variáveis de Ambiente)
// =========================================================================

/**
 * Obtém a configuração da API a partir das variáveis de ambiente (VITE_*),
 * com fallback para os valores padrão. Valida a configuração usando Zod.
 *
 * Esta função usa um closure (IIFE) para criar um cache privado e garantir
 * que a configuração seja calculada e validada apenas uma vez.
 *
 * @returns {ApiConfig} A configuração da API validada.
 */
export const getApiConfig = ((): () => ApiConfig => {
  let validatedConfig: ApiConfig | null = null;

  return (): ApiConfig => {
    if (validatedConfig) {
      return validatedConfig;
    }

    const envConfig = {
      AUTH_SERVICE: import.meta.env.VITE_AUTH_API_URL,
      AUTH_USERS: import.meta.env.VITE_AUTH_USERS_API_URL,
      DRIVERS: import.meta.env.VITE_DRIVERS_API_URL,
      DELIVERIES: import.meta.env.VITE_DELIVERIES_API_URL,
      RECEIPTS: import.meta.env.VITE_RECEIPTS_API_URL,
      TRACKING: import.meta.env.VITE_TRACKING_API_URL,
      REPORTS: import.meta.env.VITE_REPORTS_API_URL,
      COMPANIES: import.meta.env.VITE_COMPANIES_API_URL,
    };

    const mergedConfig = {
      ...API_CONFIG_DEFAULT,
      ...Object.fromEntries(Object.entries(envConfig).filter(([, v]) => v)),
    };

    try {
      validatedConfig = ApiConfigSchema.parse(mergedConfig);
      return validatedConfig;
    } catch (error) {
      console.error('Erro de validação nas variáveis de ambiente da API:', error);
      throw new Error('Configuração de API inválida.');
    }
  };
})();

// 4. Função para Determinar a URL Base (Roteamento de Endpoints)
// =========================================================================

/**
 * Determina a URL base correta para um determinado endpoint, roteando
 * a requisição para o microserviço apropriado.
 * @param {string} endpoint - O endpoint da API (ex: '/api/auth/login').
 * @returns {string} A URL base do serviço correspondente.
 */
export function getBaseUrl(endpoint: string): string {
  const config = getApiConfig();

  if (endpoint.startsWith('/api/auth')) return config.AUTH_SERVICE;
  if (endpoint.startsWith('/api/users')) return config.AUTH_USERS;
  if (endpoint.startsWith('/api/drivers') || endpoint.startsWith('/api/vehicles')) return config.DRIVERS;
  if (endpoint.startsWith('/api/deliveries') || endpoint.startsWith('/api/routes') || endpoint.startsWith('/api/occurrences')) return config.DELIVERIES;
  if (endpoint.startsWith('/api/receipts')) return config.RECEIPTS;
  if (endpoint.startsWith('/api/tracking')) return config.TRACKING;
  if (endpoint.startsWith('/api/reports') || endpoint.startsWith('/api/dashboard')) return config.REPORTS;
  if (endpoint.startsWith('/api/companies')) return config.COMPANIES;

  console.warn(`[getBaseUrl] Rota não mapeada para o endpoint: "${endpoint}". Usando AUTH_SERVICE como fallback.`);
  return config.AUTH_SERVICE;
}
