# Correção dos fluxos do motorista — 22/10/2026

Alvo: https://idmove.vercel.app/ (projeto Vercel `idmove`, Supabase `jmxckbbunoyrsxkaubmi`).

## Diagnóstico confirmado

- O site, `/login`, `/dashboard` e o banco estavam disponíveis. A auditoria operacional não encontrou vínculos quebrados nos motoristas existentes.
- O primeiro controle do service worker recarregava a página. Reproduzido em navegador novo: e-mail e senha preenchidos desapareceram antes de qualquer requisição de login.
- A restauração confiava no cache `id_move_*`, sem validar a sessão Supabase. Um cache antigo podia abrir um painel sem autenticação operacional; uma sessão válida sem esse cache podia pedir login novamente.
- O estado global de carregamento desmontava o formulário durante o login e perdia seu estado de erro.
- O cadastro usava a data UTC. Entre 21h e 23h59 em Brasília, a nota recebia a data de amanhã e era ocultada pelo filtro de hoje.
- Na ausência de `driver_id`, o formulário usava o ID do perfil como se fosse um motorista. São registros diferentes; isso podia causar falha de chave estrangeira ou vínculo incorreto.
- O painel ocultava entregas pendentes de dias anteriores e confundia carga atribuída com rota em trânsito. Ao concluir a última entrega, podia voltar para uma tela que não mostrava os comprovantes.
- O retorno do upload fornecia `receipt_image_url`, mas a atualização local lia propriedades diferentes. O canhoto recém-enviado podia não abrir até recarregar.

## Alterações

- Validação da sessão no servidor ao restaurar; atualização dos tokens renovados e limpeza do estado ao sair. Erros de empresa, vínculo operacional e usuário inativo deixam de ser ignorados.
- Separação da inicialização do app do carregamento do login. Senha incorreta exibe mensagem em português e preserva o formulário.
- Instalação do PWA sem recarregar a página. Atualizações exibem uma ação para recarregar depois de salvar o trabalho.
- Cadastro com data de Brasília e ID operacional confirmado. Para DRIVER, a API usa o vínculo autenticado em vez do ID enviado pelo formulário.
- Lista com entregas de hoje, pendências anteriores e entregas finalizadas no dia. Agendamentos futuros continuam preservados.
- Distinção entre ASSIGNED e IN_TRANSIT; início da rota com consentimento também atualiza as entregas. Reimportar uma NF em trânsito preserva seu status e documento original.
- Comprovante disponível imediatamente depois do envio. Entregas concluídas permanecem visíveis; adicionar novas NFs continua disponível durante a rota.
- Remoção dos logs de senha, token e dados de autenticação. Bloqueio do fechamento dos formulários durante envio.

Não houve migração nem alteração em entregas reais. A verificação usou uma empresa e um motorista temporários, com dados fictícios.

## Validação

Fluxo real de navegador em 390×844 com Auth, REST, Storage e RPCs do Supabase:

1. Senha incorreta, mensagem visível e formulário preservado.
2. Login DRIVER com entrada direta na empresa vinculada.
3. Restauração de sessão válida sem o cache legado.
4. Data do cadastro em Brasília após 21h.
5. Cadastro da NF vinculada ao motorista e exibição na carga.
6. Consentimento de localização e início da rota.
7. Upload do canhoto, entrega DELIVERED e visualização imediata da imagem.
8. Entrega e comprovante continuam disponíveis após recarregar.
9. Cache legado sem sessão válida retorna ao login.
10. Pendência anterior visível, agendamento futuro oculto e nenhum overflow horizontal.
11. Reimportação de NF em trânsito preserva IN_TRANSIT e o motorista autenticado.
12. Leitura de DANFE fictícia pela Edge Function: HTTP 200; número, destinatário e CNPJ extraídos. Endereço não identificado nesse documento de teste; campos permanecem editáveis.

Build de produção aprovado. ESLint: 129 erros e 22 avisos, mesmos totais da revisão-base; não é uma execução limpa. TypeScript também possui erros anteriores fora dos arquivos corrigidos (ocorrências, rastreamento, configuração legada e exportação CSV).

A consulta de XML por uma chave fiscal real e o funcionamento de câmeras físicas específicas não foram comprovados por esse teste. A leitura de imagem e o envio do arquivo foram verificados em navegador.
