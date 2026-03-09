# 🚀 Guia de Deploy — Render (Backend) + Vercel (Frontend)

## Visão geral

```
Celular / Browser
      │
      ▼
┌─────────────────┐
│  Vercel         │  Frontend Next.js  (HTTPS grátis)
│  axeflow.vercel.app │
└────────┬────────┘
         │ /api/* → proxy
         ▼
┌─────────────────┐
│  Render         │  Backend FastAPI   (HTTPS grátis)
│  terreiro.onrender.com │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Render         │  PostgreSQL        (grátis)
│  banco de dados │
└─────────────────┘
```

---

## PARTE 1 — Subir o código no GitHub

O Render e o Vercel fazem deploy direto do GitHub. Primeiro precisa estar no repositório.

### 1.1 Criar repositório no GitHub

1. Acesse https://github.com e faça login
2. Clique em **New repository**
3. Nome: `axeflow`
4. Deixe **privado** (recomendado)
5. Clique em **Create repository**

### 1.2 Subir o projeto

No PowerShell dentro da pasta do projeto:

```powershell
cd C:\Users\denis\Documents\01.Projetos\axeflow

git init
git add .
git commit -m "feat: projeto inicial terreiro saas"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/axeflow.git
git push -u origin main
```

---

## PARTE 2 — Deploy do Backend no Render

### 2.1 Criar conta no Render
Acesse https://render.com → **Get Started for Free** → entre com GitHub

### 2.2 Criar o banco PostgreSQL

1. No dashboard do Render, clique em **New +** → **PostgreSQL**
2. Preencha:
   - **Name:** `axeflow-db`
   - **Database:** `axeflow`
   - **User:** `terreiro`
   - **Plan:** Free
3. Clique em **Create Database**
4. Aguarde ficar `Available` (1-2 min)
5. **Copie a "Internal Database URL"** — vai usar no próximo passo

### 2.3 Criar o Web Service (Backend)

1. Clique em **New +** → **Web Service**
2. Conecte seu repositório GitHub `axeflow`
3. Preencha:
   - **Name:** `axeflow-backend`
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Free

4. Em **Environment Variables**, adicione:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Cole a Internal Database URL do passo 2.2 |
| `SECRET_KEY` | Gere uma string aleatória (ex: `openssl rand -hex 32`) |
| `VAPID_PRIVATE_KEY` | `MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgsxwmmzwI9U13ELFPbXSRKq9Kaz4hxIQ9y9scGnAbwgGhRANCAAT1QdBlpJb8VSKNxgLY9qdSA42b9ckyksFXMCFiwnt8MoC20Q0iXzsUgr0HfmVIk5_i7x9Po7Dyn5c5beE4PLnw` |
| `VAPID_PUBLIC_KEY` | `BPVB0GWklvxVIo3GAtj2p1IDjZv1yTKSwVcwIWLCe3wygLbRDSJfOxSCvQd-ZUiTn-LvH0-jsPKflzlt4Tg8ufA` |
| `VAPID_EMAIL` | `mailto:seuemail@gmail.com` |

5. Clique em **Create Web Service**
6. Aguarde o deploy (3-5 min)
7. **Anote a URL** — será algo como `https://axeflow-backend.onrender.com`

### 2.4 Testar o backend

Abra no browser:
```
https://axeflow-backend.onrender.com/docs
```
Se aparecer o Swagger, está funcionando! ✅

> ⚠️ No plano free do Render, o serviço "dorme" após 15 min sem uso e leva ~30s para acordar na primeira requisição.

---

## PARTE 3 — Deploy do Frontend no Vercel

### 3.1 Atualizar o vercel.json com a URL real do backend

Edite o arquivo `frontend/vercel.json` e substitua a URL:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://axeflow-backend.onrender.com/:path*"
    }
  ]
}
```

Faça commit e push:
```powershell
git add frontend/vercel.json
git commit -m "fix: atualizar URL do backend no vercel.json"
git push
```

### 3.2 Criar conta no Vercel
Acesse https://vercel.com → **Start Deploying** → entre com GitHub

### 3.3 Importar o projeto

1. No dashboard do Vercel, clique em **Add New** → **Project**
2. Importe o repositório `axeflow`
3. Configure:
   - **Framework Preset:** Next.js (detecta automático)
   - **Root Directory:** `frontend`  ← **IMPORTANTE**
4. Em **Environment Variables**, adicione:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `BPVB0GWklvxVIo3GAtj2p1IDjZv1yTKSwVcwIWLCe3wygLbRDSJfOxSCvQd-ZUiTn-LvH0-jsPKflzlt4Tg8ufA` |

5. Clique em **Deploy**
6. Aguarde 2-3 minutos
7. A URL será algo como `https://axeflow.vercel.app`

### 3.4 Testar o frontend

Acesse a URL do Vercel, faça login e teste normalmente. ✅

---

## PARTE 4 — Configurar CORS no backend para produção

Agora que o frontend tem uma URL real, atualizar o backend para aceitar requisições dela.

Edite `backend/app/main.py` e ajuste o CORS:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://axeflow.vercel.app",  # sua URL do Vercel
        "https://axeflow-*.vercel.app", # previews do Vercel
        "http://localhost:3000",               # desenvolvimento local
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Faça commit, push, e o Render faz redeploy automático.

---

## PARTE 5 — Push Notifications em produção

Com HTTPS funcionando tanto no Vercel quanto no Render, o push vai funcionar!

1. Acesse o app pelo celular via URL do Vercel
2. Clique em **"Ativar notificações"** no dashboard
3. Conceda permissão
4. Para disparar um push de teste:

```bash
curl -X POST https://axeflow-backend.onrender.com/push/test \
  -H "Content-Type: application/json" \
  -d '{"title":"Nova gira disponível","body":"A lista foi aberta."}'
```

---

## Resumo das URLs finais

| Serviço | URL |
|---------|-----|
| Frontend | `https://axeflow.vercel.app` |
| Backend API | `https://axeflow-backend.onrender.com` |
| Swagger Docs | `https://axeflow-backend.onrender.com/docs` |

---

## Deploys automáticos

A partir de agora, sempre que fizer `git push` para a branch `main`:
- **Vercel** faz redeploy do frontend automaticamente
- **Render** faz redeploy do backend automaticamente

```powershell
# Fluxo de atualização
git add .
git commit -m "feat: minha alteração"
git push
# Aguardar 2-3 min → atualizado em produção
```

---

## Plano Free — Limitações importantes

| | Render | Vercel |
|--|--------|--------|
| **Sleep** | Dorme após 15min | Não dorme |
| **Banco** | 1GB, expira em 90 dias | — |
| **Banda** | 100GB/mês | 100GB/mês |
| **Builds** | 500 min/mês | Ilimitado |
| **HTTPS** | ✅ Automático | ✅ Automático |
| **Domínio custom** | ✅ | ✅ |
