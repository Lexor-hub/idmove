// Teste de Integração do Sistema de Autenticação
// Execute este arquivo para testar a integração com o backend

const API_BASE_URL = 'http://localhost:3000'; // ✅ CORRIGIDO: auth-service na porta 3000

// Função para fazer requisições HTTP
async function makeRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: defaultHeaders
    });

    const data = await response.json();
    console.log(`✅ ${endpoint}:`, data);
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error(`❌ ${endpoint}:`, error.message);
    throw error;
  }
}

// Teste 1: Login
async function testLogin() {
  console.log('\n🔐 Testando Login...');
  
  try {
    const loginData = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: 'joao_motorista',
        password: 'password'
      })
    });

    if (loginData.success && loginData.data) {
      console.log('✅ Login realizado com sucesso!');
      console.log('Token:', loginData.data.token.substring(0, 20) + '...');
      console.log('Usuário:', loginData.data.user);
      return loginData.data.token;
    } else {
      throw new Error('Resposta de login inválida');
    }
  } catch (error) {
    console.error('❌ Erro no login:', error.message);
    throw error;
  }
}

// Teste 2: Listar Empresas
async function testGetCompanies(token) {
  console.log('\n🏢 Testando Listagem de Empresas...');
  
  try {
    const companiesData = await makeRequest('/api/auth/companies', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (companiesData.success && companiesData.data) {
      console.log('✅ Empresas carregadas com sucesso!');
      console.log('Empresas:', companiesData.data);
      return companiesData.data;
    } else {
      throw new Error('Resposta de empresas inválida');
    }
  } catch (error) {
    console.error('❌ Erro ao carregar empresas:', error.message);
    throw error;
  }
}

// Teste 3: Selecionar Empresa
async function testSelectCompany(token, companyId) {
  console.log('\n🎯 Testando Seleção de Empresa...');
  
  try {
    const selectCompanyData = await makeRequest('/api/auth/select-company', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        company_id: companyId
      })
    });

    if (selectCompanyData.success && selectCompanyData.data) {
      console.log('✅ Empresa selecionada com sucesso!');
      console.log('Novo Token:', selectCompanyData.data.token.substring(0, 20) + '...');
      console.log('Usuário Atualizado:', selectCompanyData.data.user);
      return selectCompanyData.data.token;
    } else {
      throw new Error('Resposta de seleção de empresa inválida');
    }
  } catch (error) {
    console.error('❌ Erro ao selecionar empresa:', error.message);
    throw error;
  }
}

// Teste 4: Obter Perfil
async function testGetProfile(token) {
  console.log('\n👤 Testando Obtenção de Perfil...');
  
  try {
    const profileData = await makeRequest('/api/auth/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (profileData.success && profileData.data) {
      console.log('✅ Perfil carregado com sucesso!');
      console.log('Perfil:', profileData.data);
      return profileData.data;
    } else {
      throw new Error('Resposta de perfil inválida');
    }
  } catch (error) {
    console.error('❌ Erro ao carregar perfil:', error.message);
    throw error;
  }
}

// Teste Completo
async function runAllTests() {
  console.log('🚀 Iniciando Testes de Integração do Sistema de Autenticação');
  console.log('=' .repeat(60));
  console.log('📍 Auth-service: http://localhost:3000');
  
  try {
    // Teste 1: Login
    const token = await testLogin();
    
    // Teste 2: Listar Empresas
    const companies = await testGetCompanies(token);
    
    if (companies && companies.length > 0) {
      // Teste 3: Selecionar Primeira Empresa
      const finalToken = await testSelectCompany(token, companies[0].id);
      
      // Teste 4: Obter Perfil com Token Final
      await testGetProfile(finalToken);
    } else {
      console.log('⚠️ Nenhuma empresa encontrada para teste');
    }
    
    console.log('\n🎉 Todos os testes foram executados com sucesso!');
    console.log('✅ Sistema de autenticação está funcionando corretamente');
    
  } catch (error) {
    console.error('\n💥 Erro durante os testes:', error.message);
    console.log('\n🔧 Verifique:');
    console.log('1. Se o auth-service está rodando na porta 3000');
    console.log('2. Se as credenciais de teste estão corretas');
    console.log('3. Se a estrutura de resposta está conforme esperado');
  }
}

// Executar testes se o arquivo for executado diretamente
if (typeof window === 'undefined') {
  // Node.js environment
  runAllTests().catch(console.error);
} else {
  // Browser environment
  window.runAuthTests = runAllTests;
  console.log('Para executar os testes, chame: window.runAuthTests()');
}

// Exportar para uso em outros arquivos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testLogin,
    testGetCompanies,
    testSelectCompany,
    testGetProfile,
    runAllTests
  };
} 