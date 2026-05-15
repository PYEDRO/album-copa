# SETUP — Álbum da Copa: Talentos Tech
## Deploy gratuito com Supabase + Netlify

---

## Pré-requisitos

- Node.js 18+
- Conta gratuita em [supabase.com](https://supabase.com)
- Conta gratuita em [netlify.com](https://netlify.com)

---

## PASSO 1 — Criar projeto no Supabase

1. Acesse [supabase.com/dashboard](https://supabase.com/dashboard) → **New Project**
2. Escolha um nome (ex: `album-talentos-tech`) e uma senha forte para o banco
3. Região: **South America (São Paulo)** — menor latência para o Brasil
4. Aguarde ~2 minutos para o projeto inicializar

---

## PASSO 2 — Rodar a migration (schema do banco)

1. No painel do Supabase, vá em **SQL Editor** (ícone de banco no menu lateral)
2. Clique em **New query**
3. Cole o conteúdo completo do arquivo `supabase/migrations/001_initial_schema.sql`
4. Clique em **Run** (ou `Ctrl+Enter`)
5. Você deverá ver: `Success. No rows returned`

---

## PASSO 3 — Popular o banco com os stickers

1. No **SQL Editor**, crie outra **New query**
2. Cole o conteúdo do arquivo `supabase/seed.sql`
3. Clique em **Run**
4. Você deverá ver: `Success. 18 rows inserted` (stickers + quiz questions)

Para verificar:
```sql
SELECT id, name, rarity, team FROM stickers ORDER BY id::integer;
```

---

## PASSO 4 — Obter as credenciais do Supabase

1. Vá em **Project Settings** (engrenagem no menu lateral) → **API**
2. Copie:
   - **Project URL** → será seu `VITE_SUPABASE_URL`
   - **anon public** key → será seu `VITE_SUPABASE_ANON_KEY`

---

## PASSO 5 — Configurar variáveis de ambiente locais

Na pasta raiz do projeto, crie o arquivo `.env.local`:

```bash
VITE_SUPABASE_URL="https://xxxxxxxxxxxxxxxxxxx.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
VITE_APP_URL="http://localhost:3000"
```

> **Nunca commite `.env.local` no Git.** Ele já está no `.gitignore`.

---

## PASSO 6 — Fazer o build local

```bash
npm install
npm run build
```

Isso gera a pasta `dist-build/` com os arquivos prontos para deploy.

> Se preferir testar localmente antes: `npm run dev` e acesse `http://localhost:3000`

---

## PASSO 7 — Deploy das Edge Functions

As Edge Functions ficam no Supabase e executam a lógica crítica de backend.

### Opção A — Via Supabase CLI (recomendado)

```bash
# Instalar a CLI
npm install -g supabase

# Login
supabase login

# Linkar ao seu projeto (substitua pelo seu Project ID, visível na URL do dashboard)
supabase link --project-ref SEU_PROJECT_ID

# Deploy das 3 funções
supabase functions deploy claim-daily-pack
supabase functions deploy accept-trade
supabase functions deploy update-leaderboard
```

### Opção B — Via painel web

1. No Supabase, vá em **Edge Functions** → **Deploy a new function**
2. Cole o conteúdo de cada arquivo:
   - `supabase/functions/claim-daily-pack/index.ts`
   - `supabase/functions/accept-trade/index.ts`
   - `supabase/functions/update-leaderboard/index.ts`

---

## PASSO 8 — Deploy no Netlify

### Opção A — Drag & Drop (mais rápido)

1. Acesse [app.netlify.com](https://app.netlify.com)
2. Vá em **Sites** → arraste a pasta `dist-build/` para a área de drop
3. Aguarde o upload (~10 segundos)

### Opção B — Via Git (CI/CD automático)

1. Suba o projeto para um repositório GitHub
2. No Netlify: **Add new site** → **Import an existing project** → selecione o repo
3. Configure:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Em **Site configuration → Environment variables**, adicione:
   - `VITE_SUPABASE_URL` = sua URL do Supabase
   - `VITE_SUPABASE_ANON_KEY` = sua chave anon
5. Clique em **Deploy site**

> Com a Opção B, todo `git push` na branch `main` re-deploya automaticamente.

---

## PASSO 9 — Configurar Auth no Supabase

1. No Supabase, vá em **Authentication → URL Configuration**
2. Em **Site URL**, coloque a URL do seu site Netlify (ex: `https://album-talentos-tech.netlify.app`)
3. Em **Redirect URLs**, adicione:
   - `https://album-talentos-tech.netlify.app/**`
   - `http://localhost:3000/**` (para desenvolvimento)

---

## PASSO 10 — Habilitar Login com Google (SSO Corporativo)

> **Pré-requisito:** Só funciona com contas `@fortestecnologia.com.br`.
> Contas Google de outros domínios são bloqueadas automaticamente no frontend e o usuário é deslogado.

### 10.1 — Criar credenciais OAuth no Google Cloud Console

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um projeto (ou use um existente) → menu superior esquerdo → **Select a project → New Project**
3. Vá em **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client IDs**
4. Application type: **Web application**
5. Em **Authorized redirect URIs**, adicione:
   ```
   https://<SEU_PROJECT_REF>.supabase.co/auth/v1/callback
   ```
   (substitua `<SEU_PROJECT_REF>` pelo ID do seu projeto Supabase, visível na URL do dashboard)
6. Clique em **Create** → copie o **Client ID** e o **Client Secret**

> Se a sua organização usa Google Workspace, você pode restringir o OAuth para aceitar apenas usuários do domínio `fortestecnologia.com.br` em **OAuth consent screen → Authorized domains**.

### 10.2 — Configurar o provider Google no Supabase

1. No Supabase, vá em **Authentication → Providers**
2. Localize **Google** e clique para expandir
3. Habilite o toggle **Enable sign in with Google**
4. Cole o **Client ID** e **Client Secret** obtidos no passo anterior
5. Clique em **Save**

### 10.3 — Verificar Redirect URLs (Supabase Auth)

Em **Authentication → URL Configuration**, confirme que as URLs de redirect estão listadas:
- `https://album-talentos-tech.netlify.app/**`
- `http://localhost:3000/**`

### 10.4 — Variável de ambiente do domínio corporativo

No `.env.local` (e nas env vars do Netlify), confirme que está definida:
```bash
VITE_CORPORATE_DOMAIN="fortestecnologia.com.br"
```

Qualquer tentativa de login com conta fora desse domínio será bloqueada com mensagem de erro.

---

## PASSO 11 — Configurar Leaderboard automático (opcional)

Para atualizar o ranking de hora em hora automaticamente:

1. No Supabase, vá em **Database → Extensions** → habilite `pg_cron`
2. No **SQL Editor**, execute:

```sql
SELECT cron.schedule(
  'refresh-leaderboard-hourly',
  '0 * * * *',
  $$SELECT public.refresh_leaderboard()$$
);
```

---

## Verificação final

Após o deploy, acesse sua URL do Netlify e verifique:

- [ ] Tela de login aparece
- [ ] É possível criar conta e logar
- [ ] Álbum carrega os stickers do Supabase
- [ ] Botão "Pack Diário" abre pack e salva no banco
- [ ] Leaderboard exibe ranking
- [ ] Sistema de trocas permite propor/aceitar/recusar

---

## Estrutura de arquivos criados

```
álbum-da-copa_-talentos-tech/
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql   # Schema + RLS + RPCs PostgreSQL
│   ├── functions/
│   │   ├── claim-daily-pack/        # Pack diário + pity system (Edge Function)
│   │   ├── accept-trade/            # Troca atômica (Edge Function)
│   │   └── update-leaderboard/      # Refresh top-100 (Edge Function)
│   └── seed.sql                     # 18 stickers + quiz questions
├── src/
│   ├── lib/
│   │   └── supabase.ts              # Cliente + tipos tipados
│   ├── hooks/
│   │   ├── useAuth.ts               # Autenticação
│   │   ├── usePacks.ts              # Inventário + claim diário
│   │   ├── useLeaderboard.ts        # Ranking realtime
│   │   └── useTrades.ts             # Sistema de trocas
│   ├── components/
│   │   ├── AuthModal.tsx            # Login / Registro
│   │   ├── Leaderboard.tsx          # Ranking top-100
│   │   └── TradeSystem.tsx          # Trocas entre usuários
│   └── App.tsx                      # App principal integrado
├── .env.example                     # Template de variáveis
└── SETUP.md                         # Este arquivo
```

---

## Free tier — o que é gratuito

| Serviço | Free tier | Limite para ~500 usuários |
|---|---|---|
| Supabase Database | 500MB PostgreSQL | Suficiente |
| Supabase Auth | 50.000 usuários | Suficiente |
| Supabase Edge Functions | 500K invocações/mês | Suficiente |
| Supabase Realtime | 200 conexões simultâneas | Suficiente |
| Netlify Hosting | 100GB bandwidth/mês | Suficiente |
| Netlify Build | 300 min/mês | Suficiente |

**Custo mensal estimado: $0,00**

---

## Suporte

Documentação Supabase: [supabase.com/docs](https://supabase.com/docs)
Documentação Netlify: [docs.netlify.com](https://docs.netlify.com)
