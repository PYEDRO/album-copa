# Deploy no Vercel — Álbum da Copa

## Pré-requisitos
- Node.js instalado (versão 18+)
- npm disponível no terminal

---

## Passo 1 — Instalar a Vercel CLI

Abra o terminal (PowerShell ou CMD) e rode:

```bash
npm install -g vercel
```

Confirme que instalou:

```bash
vercel --version
```

---

## Passo 2 — Fazer login na Vercel

```bash
vercel login
```

Vai abrir uma janela no navegador pedindo para entrar com GitHub, Google ou e-mail.
Escolha o método que preferir e autorize.

---

## Passo 3 — Fazer o deploy

Dentro da pasta do projeto (álbum-da-copa_-talentos-tech), rode:

```bash
vercel
```

A CLI vai fazer algumas perguntas — responda assim:

| Pergunta | Resposta |
|---|---|
| Set up and deploy? | `Y` |
| Which scope? | Seu usuário pessoal |
| Link to existing project? | `N` (primeiro deploy) |
| What's your project's name? | `album-da-copa` (ou o nome que quiser) |
| In which directory is your code located? | `.` (Enter — pasta atual) |
| Want to modify the settings? | `N` |

A Vercel vai detectar automaticamente que é um projeto Vite.

---

## Passo 4 — Configurar as variáveis de ambiente

Após o primeiro deploy, acesse o painel da Vercel:
👉 https://vercel.com/dashboard

1. Clique no projeto **album-da-copa**
2. Vá em **Settings → Environment Variables**
3. Adicione cada variável abaixo com o valor do seu `.env.local`:

| Nome | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `https://ddkfmumawxgcnpadklkm.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | *(sua anon key do Supabase)* |
| `VITE_APP_URL` | `https://album-da-copa.vercel.app` *(URL gerada pelo Vercel)* |
| `VITE_CORPORATE_DOMAIN` | `fortestecnologia.com.br` |

> ⚠️ **VITE_APP_URL**: Atualize com a URL real que o Vercel gerou após o primeiro deploy.

---

## Passo 5 — Redemake após configurar as env vars

Após adicionar as variáveis no painel, faça um novo deploy para que entrem em efeito:

```bash
vercel --prod
```

Ou diretamente pelo painel: **Deployments → Redeploy**.

---

## Deploys futuros

Para subir novas versões, basta rodar na raiz do projeto:

```bash
vercel --prod
```

---

## Configuração gerada (vercel.json)

O arquivo `vercel.json` já foi criado na raiz do projeto com:
- **Build command**: `npm run build`
- **Output directory**: `dist`
- **Framework**: `vite`
- **Rewrites**: todas as rotas apontam para `index.html` (necessário para SPA)

---

## Domínio customizado (opcional)

Em **Settings → Domains** no painel da Vercel, você pode adicionar um domínio próprio gratuitamente.
