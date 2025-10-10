Objetivo: Gerar um frontend React completo para o sistema "ID Transporte", pronto para consumir os endpoints da API Node.js fornecida. O sistema deve atender às necessidades de diferentes perfis de usuário (Motorista, Administrador, Supervisor/Operador, Cliente) e suas respectivas funcionalidades.
Informações Essenciais do Sistema:
• Nome do Sistema: ID Transporte
• Domínio: .com.br
• Contexto: Gerenciamento de entregas com foco em digitalização de canhotos, rastreamento e relatórios, para uma transportadora com média de 150 a 200 entregas/dia, 25 a 30 motoristas e veículos, atuando em São Paulo Capital e Interior.
Estrutura Técnica:
• Framework Frontend: React (conforme solicitado no prompt)
• API Backend: Consumir os microserviços Node.js conforme a "Documentação da API ID Transportes".
• Autenticação: O sistema deve usar autenticação baseada em JWT, consumindo os endpoints /api/auth/login e /api/auth/forgot-password. Endpoints protegidos exigem o header Authorization: Bearer <token>.
Funcionalidades por Perfil de Usuário:
1. Geral (Login e Acesso):
    ◦ Página de Login: Permitir que todos os usuários (Motorista, Administrador, Supervisor/Operador, Cliente) façam login com CPF (para motoristas, ou 3 primeiros dígitos) ou credenciais de usuário (username/email e senha).
    ◦ Função "Esqueceu a Senha": Implementar a funcionalidade de recuperação de senha, utilizando o endpoint /api/auth/forgot-password.
    ◦ Notificações: O sistema deve ter capacidade de exibir notificações aos motoristas e ao escritório (administrador, supervisor/operador) sobre o início e fim de rotas, preferencialmente via sistema, com potencial para integração futura com WhatsApp/Email/SMS.
    ◦ Responsividade: O frontend deve ser responsivo, otimizado para celulares (smartphones Android e iPhone) para os motoristas e desktops (Windows/Mac) para administradores, supervisores/operadores e clientes.
2. Motorista (App Mobile PWA):
    ◦ Fluxo de Trabalho Principal:
        ▪ Após o login, o motorista deve clicar em "Iniciar Dia".
        ▪ Interface para fotografar canhotos (com POST /api/receipts/upload) ou ler XML da NF (com POST /api/sefaz/import-xml) para cada nota fiscal que irá entregar (média de 5 a 15 por carro).
        ▪ Botão "Iniciar Rota" que carrega as notas fiscais já no aplicativo (com número da NF, cliente, endereço, volume, produtos, valor).
        ▪ Durante a entrega, o motorista deve clicar no número da NF para tirar foto do comprovante de entrega (utilizando POST /api/receipts/upload e PUT /api/deliveries/:id/status para "Entrega Realizada").
        ▪ Campo específico para reentrega, recusa de nota ou avarias, permitindo tirar foto da recusa e adicionar um campo de observação sucinta, registrando ocorrências (PUT /api/deliveries/:id/occurrence).
        ▪ Botão "Finalizar Rota" ao término da rota.
    ◦ Visão Geral:
        ▪ Ver suas entregas do dia: Exibir uma lista das entregas atribuídas ao motorista para o dia, utilizando GET /api/drivers/:driverId/today-deliveries.
        ▪ Marcar status da entrega: Atualizar o status de uma entrega (ex: "Em Andamento", "Realizada", "Problema"), usando PUT /api/deliveries/:id/status.
        ▪ Ver localização/rota: Exibir a rota atual e a localização do motorista em um mapa, registrando pontos de rastreamento (POST /api/tracking/location).
        ▪ Histórico de Viagens: Acessar um relatório com o histórico de suas viagens (GET /api/tracking/drivers/:driverId/history).
        ▪ Outras Funções: Acesso rápido a informações de Clientes, Endereços e Números de Notas Fiscais associados às suas entregas.
    ◦ Offline: O aplicativo deve ser capaz de operar offline para as funcionalidades essenciais, sincronizando os dados quando a conexão for restabelecida.
3. Administrador (Painel Web):
    ◦ Visão Geral: Um dashboard principal (/) que ofereça uma visão macro do sistema, com KPIs mínimos.
    ◦ Gerenciamento de Canhotos:
        ▪ Ver todos os canhotos: Lista completa de todos os comprovantes (GET /api/receipts).
        ▪ Buscar canhotos: Funcionalidade de busca por data, cliente e número da nota fiscal (GET /api/receipts com filtros, ou GET /api/deliveries/:deliveryId/receipt).
        ▪ Processamento OCR: Possibilidade de iniciar o processamento OCR de um canhoto (POST /api/receipts/:id/process-ocr).
    ◦ Gerenciamento de Cadastros:
        ▪ Cadastrar Usuários (Admin, Supervisor, Operador, Driver, Client): Formulário completo para criar novos usuários (POST /api/users), com validação para username único e senha forte.
        ▪ Gerenciar Usuários: Editar dados de usuários (PUT /api/users/:id), alterar senhas (PUT /api/users/:id/password) e desativar usuários (DELETE /api/users/:id).
        ▪ Cadastrar Motoristas: Formulário para registrar novos motoristas (POST /api/drivers).
        ▪ Cadastrar Veículos: Formulário para registrar novos veículos (POST /api/vehicles).
        ▪ Cadastrar Rotas/Entregas: Formulário para criar novas entregas (POST /api/deliveries) e atribuí-las a rotas (POST /api/routes).
    ◦ Monitoramento e Rastreamento:
        ▪ Ver localização de todos os motoristas: Um painel de monitoramento (mapa) que exiba a localização atual de todos os motoristas (GET /api/tracking/drivers/current-locations). Ao clicar na placa ou nome do motorista, deve-se visualizar seu desempenho e rota.
        ▪ Histórico de Rota: Acesso ao histórico de rastreamento de todos os veículos (GET /api/reports/tracking-history).
    ◦ Geração de Relatórios:
        ▪ Relatório das entregas realizadas: Filtrável por data, cliente, motorista e status do comprovante (GET /api/reports/deliveries).
        ▪ Relatório de Ocorrências: Detalhes de entregas com problemas, devoluções, reentregas, avarias (GET /api/reports/occurrences).
        ▪ Relatório de Comprovantes: Entregas com e sem comprovante, data/hora da foto, link de acesso (GET /api/reports/receipts-status).
        ▪ Relatório de Desempenho por Motorista: Quantidade de entregas, eficiência, ocorrências (GET /api/reports/driver-performance).
        ▪ Relatório por Cliente: Volume/valor transportado, por mês e ano (GET /api/reports/client-volume).
        ▪ Status Diário: Status das entregas do dia (GET /api/reports/daily-status).
    ◦ Configuração do Sistema: Páginas para gerenciar configurações gerais do sistema.
4. Supervisor/Operador (Painel Web):
    ◦ Funcionalidades: Similar ao Administrador, mas com escopo ligeiramente reduzido:
        ▪ Ver canhotos: Acesso à lista de comprovantes (GET /api/receipts).
        ▪ Buscar entregas: Capacidade de buscar entregas (GET /api/deliveries com filtros).
        ▪ Acompanhar motoristas: Visualização do painel de monitoramento (GET /api/tracking/drivers/current-locations).
        ▪ Gerar relatório básico: Acesso a relatórios essenciais (ex: /api/reports/daily-status, /api/reports/deliveries com filtros básicos).
        ▪ Cadastrar motoristas e veículos: Formulários para registro (POST /api/drivers, POST /api/vehicles).
5. Cliente (Painel Web):
    ◦ Funcionalidades: Acesso limitado às informações relevantes para suas próprias entregas:
        ▪ Ver todos os canhotos: Visualização dos comprovantes das suas entregas (GET /api/receipts com filtro por cliente, ou GET /api/deliveries/:deliveryId/receipt).
        ▪ Buscar canhotos: Funcionalidade de busca por data e número da nota fiscal (GET /api/receipts com filtros).
        ▪ Acompanhar motoristas: Monitoramento das entregas associadas ao cliente em tempo real (GET /api/tracking/drivers/current-locations ou GET /api/tracking/drivers/:driverId/history com filtros).
        ▪ Gerar relatório básico: Acesso a relatórios de suas próprias entregas (ex: /api/reports/client-volume ou /api/reports/deliveries com filtro por cliente).
Considerações de UI/UX e Desenvolvimento:
• Menus de Navegação: Implementar menus claros para Motorista, Administrador e Supervisor/Operador, com opções relevantes a cada perfil.
• Feedback Visual: Fornecer feedback claro ao usuário para todas as ações (sucesso, erro, carregamento).
• Tratamento de Erros: Implementar tratamento de erros adequado para as respostas da API ({"error": "mensagem"}).
• Dashboard Básico: Para o escritório, um painel básico com KPIs mínimos deve ser um dos primeiros itens a serem implementados.
• Prioridade: Os módulos mais urgentes são upload de canhotos, rastreamento e relatórios.