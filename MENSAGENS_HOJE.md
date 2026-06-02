# Mensagens — 02/06/2026 (v2)

> **Atualização:** Ana e João estão reclamando que ocorrências/entregas que eles
> registraram "não foram registradas". Não é verdade — os registros ESTÃO no banco,
> só não estavam visíveis pro painel admin (causa: empresa errada). Mas pra eles é
> isso que parece, e estão putos com razão.
>
> **Mudanças na v2 vs v1:**
> - Mensagem do Ana/João agora reconhece o trabalho deles ANTES de pedir qualquer
>   coisa. Sai o "favor, faça logout/login" — entra "confirmação pra fechar".
> - Mensagem do Fabio NÃO menciona dependência dos motoristas (queimaria mais).
> - Igor recebe a frase exata pra falar com Ana/João pessoalmente, já que o
>   vínculo dele com eles é mais próximo.

---

## 1) Mensagem para o IGOR (envie primeiro — agora)

```
Igor, sem rodeio:

Achei a causa do que o Fabio viu, e também por que a Ana e o João estão dizendo que as ocorrências/entregas deles "não foram registradas". O que aconteceu foi o seguinte:

Os dois ficaram com o cadastro vinculado a uma empresa diferente do restante. Tudo que eles fizeram FOI registrado no sistema (ocorrência, canhoto, GPS, finalização), só não aparecia no painel da operação porque o painel filtra por empresa. Por isso parecia que o trabalho deles tinha sumido.

Já corrigi o vínculo dos dois e reatribuí tudo que eles processaram hoje pra empresa certa. A partir de agora os registros deles aparecem em mapa, lista, KPIs e relatórios — pra você e pro Fabio. Mando print quando refletir.

Sobre a Ana e o João: eles estão certos em estarem chateados, e é importante que você fale com eles antes que isso vire desconfiança em mim e em você. Sugestão de texto que você manda pros dois:

— início —
Ana / João, achamos o que aconteceu. Tudo que vocês registraram hoje (ocorrências, canhotos, entregas) ficou salvo, não se perdeu nada. O problema foi do nosso lado: o cadastro de vocês estava em uma configuração diferente do restante, e por isso o que vocês fizeram não aparecia no painel da operação. Já corrigimos aqui. Quando vocês forem usar o app de novo, é só entrar normal — vai funcionar.
— fim —

Sobre o que vou fazer pra isso não voltar:

1. Mandei mensagem direta pro Fabio explicando a causa e a correção. Não fica no seu colo.
2. Esta semana o próprio sistema passa a bloquear cadastro de motorista em empresa errada — não depende mais de quem cadastra lembrar disso.
3. Você passa a ter status semanal por escrito: o que entrou em produção, o que está em correção, prazo de cada item. Mesma informação que mando pro Fabio.

Qualquer motorista reportando problema, me chama direto. Retorno em até 4h úteis com diagnóstico inicial.
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

Pra não voltar a acontecer: esta semana o próprio sistema bloqueia a criação de motorista em empresa errada — deixa de depender de quem está cadastrando lembrar disso.

A partir de agora, qualquer ponto que você reportar tem retorno meu em até 4h úteis com diagnóstico inicial no mesmo dia. Sem repassar.
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
