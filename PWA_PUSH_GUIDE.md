# ☽✦☾ Guia de Testes — PWA + Push Notifications

## Pré-requisitos

- Sistema rodando via `docker-compose up --build`
- Acesso pelo celular Android na mesma rede Wi-Fi
- Chrome para Android (versão 50+) ou Firefox Android

---

## 1. Descobrir o IP da sua máquina

No Windows (PowerShell):
```powershell
ipconfig
# Anote o IPv4 da sua rede (ex: 192.168.1.100)
```

No Linux/Mac:
```bash
hostname -I | awk '{print $1}'
```

---

## 2. Instalar o PWA no Android

### Passo a passo:

1. No celular Android, abra o **Chrome**
2. Acesse: `http://SEU_IP:3000`  
   Exemplo: `http://192.168.1.100:3000`

3. Faça login normalmente

4. O Chrome vai exibir automaticamente um banner:  
   **"Adicionar AxeFlow à tela inicial"** → toque em **Adicionar**

5. Se o banner não aparecer:
   - Toque nos 3 pontinhos (menu) no canto superior direito
   - Toque em **"Adicionar à tela inicial"** ou **"Instalar app"**

6. O ícone ☽✦☾ vai aparecer na tela inicial do seu Android

7. Abra pelo ícone — o app vai abrir em **modo standalone** (sem barra do browser)

### Requisitos para o PWA instalar:
- ✅ `manifest.json` com `display: standalone`
- ✅ Service Worker registrado
- ✅ Ícones 192x192 e 512x512
- ✅ HTTPS **ou** localhost (para testes locais em HTTP, só funciona via IP local na mesma rede)

> **Nota:** Para testar via IP local (não localhost), o Chrome pode bloquear o SW.  
> Solução: use `chrome://flags/#unsafely-treat-insecure-origin-as-secure` no Chrome  
> e adicione `http://SEU_IP:3000` na lista.

---

## 3. Ativar Push Notifications

1. Abra o app (pelo ícone na tela inicial ou pelo browser)
2. Vá para o **Dashboard**
3. Clique no botão **"🔔 Ativar notificações"** na barra superior
4. O browser vai pedir permissão → toque em **Permitir**
5. A subscription é automaticamente enviada ao backend
6. O botão muda para **"🔔 Notificações ativas"** (verde)

---

## 4. Disparar notificação de teste

### Opção A — Via curl (terminal da sua máquina):

```bash
curl -X POST http://localhost:8000/push/test \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Nova gira disponível",
    "body": "A lista para a gira foi aberta.",
    "url": "/dashboard"
  }'
```

### Opção B — Via PowerShell (Windows):

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/push/test" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"title":"Nova gira disponível","body":"A lista para a gira foi aberta.","url":"/dashboard"}'
```

### Opção C — Via Swagger UI (interface visual):

1. Acesse: `http://localhost:8000/docs`
2. Encontre o endpoint `POST /push/test`
3. Clique em **"Try it out"**
4. Clique em **"Execute"**

### Opção D — Script de teste completo:

```bash
# Verificar quantas subscriptions estão ativas
curl http://localhost:8000/push/status

# Enviar push com mensagem customizada
curl -X POST http://localhost:8000/push/test \
  -H "Content-Type: application/json" \
  -d '{
    "title": "⭐ Teste do Terreiro",
    "body": "Esta é uma notificação de teste personalizada!",
    "url": "/giras"
  }'
```

---

## 5. Verificar se funcionou

Depois de disparar o push:

- ✅ A notificação deve aparecer no celular **mesmo com o app fechado**
- ✅ Ao clicar na notificação, o app deve abrir na URL configurada
- ✅ No terminal do backend deve aparecer: `[Push] Broadcast: 1 enviados, 0 falhas`

---

## 6. Troubleshooting

### "Service Worker não registra"
- Verifique se `sw.js` está em `/frontend/public/sw.js`
- No browser: F12 → Application → Service Workers → verifique se está "activated"

### "Permissão bloqueada no Android"
- Chrome → Configurações do site → Notificações → Habilitar para o domínio

### "Push não chega no celular"
- Verifique se o celular tem conexão com internet (o push passa pelos servidores do Google FCM)
- Verifique os logs do backend: `docker-compose logs backend`
- Confira se a VAPID_PUBLIC_KEY no frontend bate com a VAPID_PRIVATE_KEY no backend

### "Cannot install PWA"
- O Chrome requer HTTPS para instalar PWA em domínios não-localhost
- Para testes locais via IP, habilite: `chrome://flags/#unsafely-treat-insecure-origin-as-secure`

### Resetar subscriptions (backend reiniciado = subscriptions perdidas)
- As subscriptions ficam em memória RAM
- Se o backend reiniciar, precisa ativar notificações novamente no app
- Para persistência permanente, salve no banco (tabela `push_subscriptions`)

---

## 7. Estrutura dos arquivos PWA adicionados

```
frontend/
├── public/
│   ├── manifest.json       ← configuração PWA (nome, ícones, cores)
│   ├── sw.js               ← service worker (cache + push handler)
│   ├── offline.html        ← página fallback sem internet
│   └── icons/
│       ├── icon-192.png    ← ícone para Android
│       ├── icon-512.png    ← ícone para splash screen
│       └── icon.svg        ← ícone vetorial
├── services/
│   └── pushService.js      ← lógica de registro SW e push subscription
└── components/
    └── NotificationButton.js ← botão "Ativar notificações"

backend/
├── app/
│   ├── services/
│   │   └── push_service.py ← salva subscriptions e envia push via pywebpush
│   └── routers/
│       └── push_router.py  ← POST /push/subscribe, POST /push/test, GET /push/status
```

---

## 8. Chaves VAPID geradas para este projeto

```
VAPID_PUBLIC_KEY=BPVB0GWklvxVIo3GAtj2p1IDjZv1yTKSwVcwIWLCe3wygLbRDSJfOxSCvQd-ZUiTn-LvH0-jsPKflzlt4Tg8ufA
VAPID_PRIVATE_KEY=MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgsxwmmzwI9U13ELFPbXSRKq9Kaz4hxIQ9y9scGnAbwgGhRANCAAT1QdBlpJb8VSKNxgLY9qdSA42b9ckyksFXMCFiwnt8MoC20Q0iXzsUgr0HfmVIk5_i7x9Po7Dyn5c5beE4PLnw
```

> ⚠️ Para produção, gere novas chaves VAPID e configure via variáveis de ambiente no `.env`.
