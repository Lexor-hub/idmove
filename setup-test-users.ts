/**
 * Script para criar usuários de teste
 * Rode com: npx tsx setup-test-users.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Variáveis de ambiente não encontradas!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Dados dos usuários de teste
const testUsers = [
  {
    email: "admin@test.com",
    password: "Admin@123456",
    name: "Admin Test",
    role: "ADMIN",
  },
  {
    email: "motorista@test.com",
    password: "Motorista@123456",
    name: "João da Silva",
    role: "DRIVER",
  },
  {
    email: "cliente@test.com",
    password: "Cliente@123456",
    name: "Cliente Teste",
    role: "CLIENT",
  },
];

async function createTestUsers() {
  console.log("🚀 Criando usuários de teste...\n");

  for (const user of testUsers) {
    try {
      console.log(`📝 Criando ${user.role}: ${user.email}`);

      // 1. Criar usuário no Auth
      const { data, error } = await supabase.auth.signUp({
        email: user.email,
        password: user.password,
        options: {
          data: {
            full_name: user.name,
          },
        },
      });

      if (error) {
        console.error(`   ❌ Erro ao criar usuário: ${error.message}`);
        continue;
      }

      if (!data.user) {
        console.error(`   ❌ Usuário não foi criado`);
        continue;
      }

      const userId = data.user.id;
      console.log(`   ✅ Usuário criado: ${userId}`);

      // 2. Aguardar o trigger handle_new_user() criar o profile
      // (O trigger cria automaticamente quando um novo usuário é criado)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 3. Atualizar o profile com role e dados corretos
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .update({
          role: user.role,
          full_name: user.name,
          username: user.email.split("@")[0],
        })
        .eq("auth_user_id", userId)
        .select()
        .single();

      if (profileError) {
        console.error(`   ❌ Erro ao atualizar profile: ${profileError.message}`);
        continue;
      }

      // 4. Se for motorista, criar registro em drivers
      if (user.role === "DRIVER") {
        // Primeiro, conseguir a empresa padrão (a que tem 1 row no setup)
        const { data: companies, error: companyError } = await supabase
          .from("companies")
          .select("id")
          .limit(1)
          .single();

        if (!companyError && companies) {
          const { error: driverError } = await supabase
            .from("drivers")
            .insert({
              profile_id: profileData.id,
              company_id: companies.id,
              name: user.name,
              cpf: "000.000.000-00",
              status: "ATIVO",
              current_status: "offline",
            });

          if (driverError) {
            console.warn(
              `   ⚠️  Aviso: não foi possível criar driver record: ${driverError.message}`
            );
          } else {
            console.log(`   ✅ Driver record criado`);
          }
        }
      }

      // 5. Se for cliente, criar registro em clients
      if (user.role === "CLIENT") {
        const { data: companies, error: companyError } = await supabase
          .from("companies")
          .select("id")
          .limit(1)
          .single();

        if (!companyError && companies) {
          const { error: clientError } = await supabase
            .from("clients")
            .insert({
              profile_id: profileData.id,
              company_id: companies.id,
              name: user.name,
              email: user.email,
              status: "ACTIVE",
            });

          if (clientError) {
            console.warn(
              `   ⚠️  Aviso: não foi possível criar client record: ${clientError.message}`
            );
          } else {
            console.log(`   ✅ Client record criado`);
          }
        }
      }

      console.log(`   ✅ ${user.role} criado com sucesso!\n`);
    } catch (error) {
      console.error(`   ❌ Erro inesperado:`, error);
    }
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ USUÁRIOS DE TESTE CRIADOS!\n");
  console.log("📋 CREDENCIAIS DE TESTE:\n");

  testUsers.forEach((user) => {
    console.log(`${user.role}:`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Senha: ${user.password}`);
    console.log(`  Nome: ${user.name}\n`);
  });

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("💡 PRÓXIMOS PASSOS:\n");
  console.log("1. Acesse o app: http://localhost:5173");
  console.log("2. Faça login com as credenciais acima");
  console.log("3. Teste cada perfil (Admin, Cliente, Motorista)");
  console.log("4. Verifique as funcionalidades da Fase 2\n");
}

createTestUsers().catch(console.error);
