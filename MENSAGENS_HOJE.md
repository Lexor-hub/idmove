# Mensagens — 02/06/2026 (v3)

> **Atualização v3:** Igor está puto, com razão. "4h úteis" foi calibração ruim
> minha — pra operação dele, isso é uma eternidade. Cliente do litoral já se foi.
> Apareceram dois bugs novos no caminho: admin não consegue adicionar motorista,
> e cadastro de carro travando. **Acumulamos prazos quebrados sem aviso.**
>
> **Mudanças v3:**
> - Tirado "4h úteis" das duas mensagens. Não cabe.
> - Mensagem do Igor: mais curta, sem SLA escrito, com presença operacional
>   concreta no lugar (telefone aberto na hora que precisar).
> - Mensagem do Fabio: foco em "resolvido", sem promessa de janela de resposta.
> - Adicionada seção "bugs novos abertos hoje" pra rastreamento.

---

## 1) Mensagem para o IGOR (envie primeiro — agora)

```
Igor, eu te entendo. Quebramos dois prazos sem te avisar antes, e isso é o que mais corrói. Não vou empilhar promessa em cima disso.

O que tem agora, concreto:

Achei a causa do que o Fabio viu hoje. Ana e João estavam com cadastro vinculado a uma empresa diferente do restante. Tudo que eles registraram (ocorrência, canhoto, GPS, finalização) ESTÁ no banco — só não aparecia no painel porque o filtro é por empresa. Não se perdeu nada. Já corrigi o vínculo e reatribuí o que eles processaram hoje pra empresa certa.

Você falar com a Ana e o João vai cair melhor do que eu falando. Texto pronto pra você mandar pros dois:

— início —
Ana / João, achamos o que aconteceu. Tudo que vocês registraram hoje (ocorrências, canhotos, entregas) ficou salvo, não se perdeu nada. O problema foi do nosso lado: o cadastro de vocês estava em uma configuração diferente do restante, e por isso o que vocês fizeram não aparecia no painel da operação. Já corrigimos aqui. Quando forem usar o app de novo, é só entrar normal — vai funcionar.
— fim —

Os outros dois pontos que você levantou:
- Add motorista pelo painel admin: vou olhar agora. Me manda o print do erro que aparece.
- Cadastro de carro travando: idem, me manda o que apareceu na tela.

Modo de trabalho daqui pra frente: linha direta no WhatsApp. Quando precisar de mim, me chama na hora. Não te coloco em janela de 4h, isso foi promessa minha mal calibrada. Vou estar disponível durante a operação. Se eu não puder responder no momento, te aviso o porquê e quando volto.

E não vou mais empurrar prazo sem confirmar. Se um item da semana atrasar, você sabe antes do prazo vencer, não depois.
```

---

## 2) Mensagem para o FABIO (envie em seguida)

```
Fabio, complementando o material de ontem com o que apurei agora:

O que você acompanhou hoje (Ana e João sem aparecer no painel) tem causa fechada: os dois estavam cadastrados em uma configuração de empresa diferente do restante da operação. Tudo que eles processaram hoje — ocorrências, canhotos, entregas — ficou registrado no banco normalmente. O painel é que estava filtrando por empresa e por isso eles ficavam invisíveis pra você.

Diferente do PDF de ontem, aqui já tem ação tomada, não plano:

- Cadastros corrigidos.
- Tudo que eles registraram hoje foi reatribuído pra empresa correta — entra retroativo no seu painel.
- Te mando o print do painel já refletindo isso em seguida.

Pra não voltar a acontecer: o próprio sistema passa a bloquear a criação de motorista em empresa errada — deixa de depender de quem está cadastrando lembrar disso.

Estou à disposição direto pra qualquer ponto que apareça.
```

---

## 3) Mensagem para Ana e João (envie SÓ se eles cobrarem direto — o Igor pode falar com eles primeiro)

> **Use só se o Igor pedir reforço**, ou se Ana/João falarem direto com você.
> Tom: reconhecer trabalho, assumir do nosso lado, pedido único e simples
> embalado como "última confirmação", não como "favor pra resolver".

```
Ana / João,

Achamos o que aconteceu hoje. Tudo que vocês registraram — ocorrências, canhotos, entregas — ficou salvo no sistema, não se perdeu nada. O problema foi do nosso lado: a configuração da conta de vocês estava em um lugar que não conversava com o painel da operação, por isso parecia que o trabalho tinha sumido.

Já corrigi aqui. Da próxima vez que vocês forem abrir o app, é só entrar normal — vai funcionar e aparecer pra todo mundo.

Obrigado pela paciência hoje, e desculpa por terem passado por isso.
```

---

## 4) Mensagem de confirmação com print (depois que refletir)

> Mande pros dois (Igor e Fabio) logo após confirmar que Ana e João apareceram no painel:

```
Confirmado às [HH:MM]. Registros de Ana e João visíveis no mapa, na lista de entregas e nos KPIs. Anexo o print pra registro.

Sigo com a blindagem do cadastro esta semana e mando status na sexta.
```

---

## Argumentos prontos (se alguém pressionar "as ocorrências sumiram")

Use esses bullets se Igor, Fabio ou os motoristas voltarem na carga:

- **"As ocorrências/entregas se perderam?"** — Não. Todo registro feito hoje pelo Ana e pelo João está no banco. O que faltava era o painel mostrar — por causa do vínculo de empresa que já foi ajustado.
- **"Por que isso aconteceu?"** — Os dois cadastros foram feitos vinculados a uma empresa diferente do restante (vestígio de uma configuração anterior do ambiente). O sistema permitiu na época; a partir desta semana bloqueia.
- **"Como sei que não vai acontecer de novo?"** — Duas camadas: (1) o próprio sistema passa a bloquear cadastro em empresa errada, e (2) o painel do admin passa a ter um alerta visual quando algum motorista em rota some do mapa, pra detectar na hora em vez de descobrir só quando o cliente reclama.
- **"E hoje, o que ficou registrado?"** — Tudo: ocorrências, canhotos, GPS, finalizações. Reatribuído pra empresa correta. Print do painel anexado.

---

## Bugs novos abertos hoje (02/06) — investigar em paralelo

| # | Bug | O que sei | O que preciso pra atacar |
|---|---|---|---|
| 1 | Admin não consegue adicionar motorista pelo painel | Reportado pelo Igor | **Print do erro que aparece** (toast, mensagem na tela, ou ficar travado em "Criando...") |
| 2 | Cadastro de carro travando | Reportado pelo Igor | Em qual ponto trava — botão "Salvar" dá erro? Some da lista? Não abre a tela? Print ajuda. |

Hipóteses iniciais pro #1:
- RPC `create_managed_user` retornando erro de permissão (role do admin)
- Email duplicado (mensagem amigável existe mas pode estar sumindo)
- Fallback `createUserViaSignup` falhando no `auth.signUp` (cota Supabase, email malformado)

Hipóteses iniciais pro #2:
- RLS de `vehicles` bloqueando se `company_id` estiver NULL no contexto
- Validação de placa/modelo no cliente

Vou pegar assim que tiver o print/erro. Sem o detalhe é palpite.

---

## Checklist de envio (ordem)

- [ ] Rodei a Query 1 do plano (validação company_id) no Supabase
- [ ] Confirmei via SQL que Ana e João estão em company_id diferente
- [ ] Rodei os UPDATEs da Sprint 0 (cadastros + entregas)
- [ ] Enviei mensagem do Igor (item 1) — INCLUI o texto pronto pra ele mandar pra Ana/João
- [ ] Enviei mensagem do Fabio (item 2)
- [ ] Aguardei o Igor falar com Ana/João primeiro
- [ ] (Opcional) Enviei mensagem direta pra Ana/João (item 3) se eles cobrarem
- [ ] Confirmei no painel que Ana e João apareceram
- [ ] Enviei mensagem de confirmação com print (item 4) pros dois
