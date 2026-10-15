# Radar de Inovação

Radar interno da Sogrape com notícias de **No Alcohol** e **IA**.

Todos os dias, uma recolha automática lê as fontes, pede à Gemini um resumo em pt-PT e deixa as notícias à espera de aprovação no backoffice. Só as notícias aprovadas aparecem no radar.

| Página | Acesso |
|---|---|
| `/` | O radar. Não pede login e está escondido dos motores de busca (`noindex`). |
| `/backoffice` | Triagem e gestão. Pede login com a conta Microsoft da Sogrape e só deixa entrar quem estiver em **Utilizadores**. |

## Como funciona

```
GitHub Actions (6h30 Lisboa)
  └─ fontes ativas (RSS ou WordPress API)
      └─ já visto? (hash do URL normalizado, 90 dias) ─ sim → ignora
      └─ pré-filtro por palavras-chave das categorias ─ não → ignora
      └─ texto completo (content:encoded ou página + Readability)  ← nunca é guardado
      └─ Gemini: relevância, área, categoria, título e resumo em pt-PT
      └─ relevância < corte (50) → descarta
      └─ mesma notícia noutro site? (embeddings + confirmação Gemini) → junta a fonte
      └─ signals (pending) → backoffice → aprovada → radar
```

Quando uma notícia já aprovada recebe uma fonte nova, volta à triagem com o aviso **Nova fonte**. O radar continua a mostrar a versão aprovada até à nova aprovação.

## Estrutura

```
src/app/page.tsx              radar público
src/app/backoffice/           backoffice (login Microsoft)
src/components/radar/         radar e popup da notícia
src/components/bo/            triagem, cartões, detalhe e páginas de admin
pipeline/run.ts               recolha diária
pipeline/seed.ts              áreas, categorias, fontes, definições e 1.º admin (sem notícias)
firestore.rules               regras de acesso
.github/workflows/            recolha diária e seed
```

## Configuração (uma vez)

### 1. Firebase (projeto `sogrape-ai-studio`, base `innovationradar-prod`)

1. **Regras.** Em Firestore › `innovationradar-prod` › Regras, cola o conteúdo de `firestore.rules` e publica. Em alternativa, com a CLI: `firebase deploy --only firestore:rules --project sogrape-ai-studio`.
2. **Conta de serviço.** Em IAM, dá à conta de serviço o papel **Cloud Datastore User**.
3. **Login Microsoft.** O fornecedor Microsoft já está ligado. No fim, quando houver domínio da Vercel, junta-o em Authentication › Definições › **Domínios autorizados**.

Não são precisos índices compostos.

### 2. GitHub › Settings › Secrets and variables › Actions

| Nome | Tipo | Valor |
|---|---|---|
| `GEMINI_API_KEY` | Secret | Chave da API Gemini |
| `FIREBASE_SERVICE_ACCOUNT` | Secret | JSON completo da conta de serviço |
| `GEMINI_MODEL` | Variable (opcional) | Por defeito `gemini-2.5-flash` |

Nunca coloques estas chaves no código nem em ficheiros `.env` versionados.

### 3. Primeiro arranque

1. Actions › **Preparar base de dados (seed)** › Run workflow. Cria as áreas, as categorias, as fontes, as definições e o admin `bruno.justa@sogrape.pt`. Não cria notícias e pode correr-se de novo sem estragar nada.
2. Actions › **Recolha diária** › Run workflow. Para experimentar sem gravar nada, marca **Simular sem gravar nada**.
3. Abre `/backoffice`, entra com a conta Microsoft e aprova as primeiras notícias.

### 4. Vercel (no fim)

Importa o repositório na Vercel. A configuração pública do Firebase já está no código; as variáveis `NEXT_PUBLIC_*` de `.env.example` são opcionais.

Para **adicionar notícias por link** no backoffice, define na Vercel (Settings › Environment Variables) a variável `GEMINI_API_KEY`, com a mesma chave do GitHub. É usada só no servidor, na rota `/api/preparar`, e nunca chega ao browser.

Depois junta o domínio aos domínios autorizados do Firebase (passo 1.3).

## Adicionar uma notícia à mão

No backoffice, **Adicionar** › cola o link › **Preparar notícia**. A rota `/api/preparar` confirma o login e o acesso, lê a página e pede à Gemini o mesmo título, resumo e classificação da recolha diária. Não grava nada.

Revês e editas tudo (título, área, categoria, data, relevância, resumo, porque importa, entidades e dados da fonte) e escolhes **Guardar na triagem** ou **Aprovar e publicar**. A notícia fica marcada como adicionada à mão, o link é registado como já visto (a recolha não o volta a trazer) e entra no mecanismo de junção com notícias iguais de outros sites.

Se o site for pago ou bloquear a leitura, usa **Colar o texto do artigo**.

## Desenvolvimento local

```bash
npm install
cp .env.example .env.local
npm run dev          # http://localhost:3000 e /backoffice
npm test             # testes da recolha
npm run typecheck
```

Para correr a recolha localmente, exporta `GEMINI_API_KEY` e `FIREBASE_SERVICE_ACCOUNT` no terminal e corre `DRY_RUN=1 npm run pipeline`.

## Afinações

| Onde | O quê |
|---|---|
| Backoffice › Definições | Corte de relevância (50) e janela do radar (90 dias) |
| Backoffice › Áreas e categorias | Nomes, cores, ícones, descrições para a Gemini e palavras-chave |
| Backoffice › Fontes | Ligar e desligar fontes e adicionar novas (RSS ou WordPress API) |
| Variáveis de ambiente | `MERGE_SIM` (0,86, semelhança para juntar notícias) e `MAX_PER_SOURCE` (40 artigos por fonte e execução) |

## Startups (só no backoffice)

Secção **Startups** com duas páginas:

- **Triagem:** cartões por decidir, aprovadas e rejeitadas, com filtros por setor e fase, detalhe com edição total, **Procurar online** (a Gemini pesquisa na web e escolhes quais entram) e **Adicionar por site** (a ficha é preparada a partir do site).
- **Radar:** só as startups aprovadas. Os anéis são os setores (pela ordem definida em Definições) e a fase é um filtro.

**Recolha semanal** (`.github/workflows/startups.yml`, segunda às 7h30 em Lisboa, ou manualmente com "Simular sem gravar nada"):

1. corre as pesquisas online de cada setor (Gemini com Pesquisa Google) e estrutura as startups encontradas;
2. lê os feeds de startups (Definições › Startups › Fontes) e as notícias dos últimos 8 dias, encontra as startups citadas e prepara a ficha delas;
3. só aceita startups com site próprio a responder; a chave é o domínio do site, por isso a mesma startup nunca aparece duas vezes (só ganha mais origens);
4. abaixo do corte de relevância das startups (Definições › Startups › Regras da recolha) é descartada e não volta a ser proposta;
5. faz a análise de investimento a todas as startups (menos as rejeitadas) com relevância igual ou acima do corte da análise (Definições › Startups › Critérios de investimento) que ainda não a tenham, 3 em paralelo e sem limite de quantidade.

**Análise de investimento:** no painel de cada startup, "Fazer análise" avalia-a com os critérios da Sogrape Ventures: perfil (empresa, produto, tração, equipa, financiamento), os 11 critérios em 3 grupos com veredicto e fontes, a matriz por ticket (como nas guidelines), decisão, ticket, follow-on e próximos passos. São três pedidos curtos à Gemini (dois com pesquisa web em paralelo e a avaliação) e cada análise fica guardada em `startups/{id}/analises`, com histórico. "Copiar relatório" copia tudo em Markdown. As guidelines ficam em Definições › Startups › Critérios de investimento (documento `config/investimento`, que só o backoffice lê); depois de mudar as regras, publica de novo o `firestore.rules`.

**Configurar:** setores e pesquisas em Definições › Startups › Setores e pesquisas. O seed cria os 4 setores iniciais (Vinha e adega, Embalagem e rótulos, Consumidor e vendas, Dados e operações) com 4 pesquisas cada e substitui os setores da primeira versão, passando as startups que os usavam para o setor mais próximo. As execuções aparecem em Definições › Execuções, com a coluna Recolha a dizer "Startups".

**Custos:** cada pesquisa online usa uma pesquisa Google da Gemini. Com 16 pesquisas por semana mais as fichas das startups citadas nas notícias, fica dentro da parte gratuita da Gemini 2.5 Flash.

## Pipeline (Sogrape Ventures, só administradores)

Página **Startups › Pipeline**: o seguimento das startups do primeiro contacto ao investimento, em substituição do Excel do dealflow.

- **Fases:** Radar → Primeiro contacto → Validação de fit → Análise Beta Capital → Análise aprofundada → Negociação → Investida. Arquivar é possível em qualquer fase, com um motivo de uma lista fechada e uma nota.
- **Próximo passo:** de quem é a vez (Sogrape, startup, Beta Capital, reunião por marcar), o que falta fazer, prazo e responsável. O quadro marca o que passou do prazo e mostra há quantos dias cada uma está na fase.
- **Cronologia:** reuniões, emails, documentos, feedback da Beta Capital e notas, com data e autor; as mudanças de fase ficam registadas sozinhas.
- **Vistas:** quadro (arrastar muda a fase), lista ordenável e arquivadas; filtros por vez, "as minhas" e atrasadas; exportação para Excel (CSV).
- **Entrada:** "Pôr no pipeline" na ficha de uma startup (Triagem ou Aprovadas); as startups do radar mostram a etiqueta da fase em que estão no pipeline. A análise de investimento também se faz a partir do pipeline.
- **Dados:** coleção `deals` com `interacoes` e `analises` por baixo. Só administradores leem e escrevem (ver `firestore.rules`).
