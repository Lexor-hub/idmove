/**
 * Script para criar usuários de teste (v2 - melhorado)
 * Rode com: npx tsx create-test-users-v2.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://jmxckbbunoyrsxkaubmi.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpteGNrYmJ1bm95cnN4a2F1Ym1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MDcyMDksImV4cCI6MjA5MzE4MzIwOX0.52m2GgS1dqV_7896DgvPCI6Yr-yBjroobs7RLSEb-Jw";

const supabase = createClient(supabaseUrl, supabaseKey);

const testUsers = [
  {
    email: "admin@test.com",
    password: "Admin@123456",
    full_name: "Admin Teste",
    role: "ADMIN",
  },
  {
    email: "motorista@test.com",
    password: "Motorista@123456",
    full_name: "Motorista Teste",
    role: "DRIVER",
  },
  {
    email: "cliente@test.com",
    password: "Cliente@123456",
    full_name: "Cliente Teste",
    role: "CLIENT",
  },
];

// Delay helper
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function createTestUsers() {
  console.log("🚀 Criando usuários de teste...\n");

  for (const [index, user] of testUsers.entries()) {
    try {
      console.log(`📝 [${index + 1}/3] Criando ${user.role}: ${user.email}`);

      // 1. Criar usuário no Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: user.email,
        password: user.password,
        options: {
          data: {
            full_name: user.full_name,
          },
        },
      });

      if (signUpError) {
        // Se o usuário já existe, tenta atualizar o profile
        if (signUpError.message?.includes("already registered")) {
          console.log(`   ⚠️  Usuário já existe, tentando atualizar profile...`);

          // Busca o profile existente
          const { data: existingProfile, error: getError } = await supabase
            .from("profiles")
            .select("*")
            .eq("email", user.email)
            .single();

          if (!getError && existingProfile) {
            // Atualiza o profile
            const { error: updateError } = await supabase
              .from("profiles")
              .update({
                full_name: user.full_name,
                role: user.role,
              })
              .eq("id", existingProfile.id);

            if (updateError) {
              console.error(`   ❌ Erro ao atualizar: ${updateError.message}`);
              continue;
            }

            console.log(`   ✅ Profile atualizado com sucesso!`);
          } else {
            console.error(`   ❌ Erro ao buscar profile existente`);
            continue;
          }
        } else {
          console.error(`   ❌ Erro ao criar usuário: ${signUpError.message}`);
          continue;
        }
      } else if (signUpData.user) {
        console.log(`   ✅ Usuário criado (trigger criará profile)`);

        // 2. Aguardar o trigger criar o profile (500ms)
        await delay(500);

        // 3. Atualizar o profile com dados corretos
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            full_name: user.full_name,
            role: user.role,
          })
          .eq("auth_user_id", signUpData.user.id);

        if (updateError) {
          console.error(`   ❌ Erro ao atualizar profile: ${updateError.message}`);
        } else {
          console.log(`   ✅ Profile atualizado com role ${user.role}`);
        }
      }

      console.log();

      // Delay entre requisições para evitar rate limit
      if (index < testUsers.length - 1) {
        await delay(2000); // 2 segundos entre cada criação
      }
    } catch (error: any) {
      console.error(`   ❌ Erro inesperado:`, error.message);
      console.log();
    }
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ CONCLUSÃO!\n");
  console.log("📋 CREDENCIAIS DE TESTE:\n");

  testUsers.forEach((user) => {
    console.log(`${user.role}:`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Senha: ${user.password}`);
    console.log(`  Nome: ${user.full_name}\n`);
  });

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎯 PRÓXIMO PASSO:\n");
  console.log("1. Acesse: http://localhost:5173");
  console.log("2. Teste login com cada uma das credenciais acima");
  console.log("3. Verifique os fluxos de cada perfil\n");
}

createTestUsers().catch(console.error);
