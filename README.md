# MonitorIP — Web + Backend + Apps (Android/iOS)

Aplicació completa de monitoratge d'IPs/URLs amb:
- **Comprovacions automàtiques cada 20 min** (i a petició) via HTTP o TCP.
- **Avisos**: Push mòbil (Expo), **Telegram** i **email** (Gmail SMTP).
- **Gestió d'usuaris**: cada usuari veu només els seus objectius.
- **Import CSV**, resums **diari** i **mensual** d'errors.
- **Web** responsiva (Vite + React + Tailwind, i18n) i **app mòbil** (Expo).
- **Allotjament**: Backend a **Render**, Web a **Netlify**.

## Monorepo
```
backend/  # Fastify + Prisma + PostgreSQL + cron + email + Telegram + Expo push
web/      # Vite React PWA + Tailwind + i18next
mobile/   # Expo React Native + notifications
shared/   # Tipus compartits
```

---

## 1) Backend (Render)

### 1.1. Crear PostgreSQL i servei web
1. A Render, crea una Base de Dades PostgreSQL.
2. Crea un **Web Service** des del directori `backend/` amb:
   - **Build Command**: `npm install && npm run build && npx prisma migrate deploy`
   - **Start Command**: `npm start`
3. Variables d'entorn (env):
   - `PORT=8080`
   - `CORS_ORIGIN=https://<el-teu-site>.netlify.app`
   - `JWT_SECRET=<cadena llarga aleatòria>`
   - `DATABASE_URL=<de la BD de Render>`
   - `PUBLIC_BASE_URL=https://<la-teva-app-backend>.onrender.com`
   - `SMTP_HOST=smtp.gmail.com`
   - `SMTP_PORT=465`
   - `SMTP_SECURE=true`
   - `SMTP_USER=botmailmonitorip@gmail.com`
   - `SMTP_PASS=<App Password del Gmail (2FA)>`
   - `TZ=Europe/Madrid`

> **Gmail**: activa 2FA al compte `botmailmonitorip@gmail.com` i genera un **App Password** per SMTP.

### 1.2. Scheduler perquè corri sempre
Opció A (recomanada): Crea un **Background Worker** a Render amb el mateix repo i directori `backend/`:
- **Build Command**: `npm install && npm run build && npx prisma migrate deploy`
- **Start Command**: `npm run scheduler`

Opció B: Configura **Render Cron Jobs** que toquin una URL de "wake" si el teu pla hiberna, però el **worker** és el que executa les tasques periòdiques fiables (checks + digests).

### 1.3. Telegram Bot
1. A Telegram, parla amb `@BotFather`:
   - `/newbot` → dona-li nom (p.ex. *MonitorIP*) i **username** únic.
   - Guarda el **BOT TOKEN**.
2. A Render (backend), afegeix `TELEGRAM_BOT_TOKEN=<el-token>`.
3. Després d'arrencar el backend, es configura automàticament el **webhook** a:
   ```
   https://<PUBLIC_BASE_URL>/api/telegram/webhook
   ```
4. Vincular un usuari: a la Web, a **Configuració > Telegram** clica *Generar token* i envia a Telegram:
   ```
   /start <TOKEN>
   ```
   Resposta: `✅ Connectat!` i ja rebràs avisos.

---

## 2) Web (Netlify)

1. A Netlify, crea un **New site from Git** apuntant al directori `web/` (o puja el codi).
2. **Build command**: `npm install && npm run build`
3. **Publish directory**: `dist`
4. Variables (si cal):
   - `VITE_API_BASE=https://<la-teva-api>.onrender.com`

La Web inclou:
- Capçalera persistent amb **logo radar** (icona, opengraph, PWA).
- Canvi d’**idioma** (per defecte: **Català**) i desplegable amb banderes (emoji).
- Pàgines: **Login**, **Register**, **Monitoratge**, **Configuració**.
- Formulari d'alta d'objectius, **import CSV**, esborrar i **comprovació manual**.

**CSV** (amb capçalera):
```csv
label,kind,address,port,intervalMinutes
Web corporativa,http,https://example.com,,20
Servidor SSH,tcp,example.com,22,20
```

---

## 3) App mòbil (Android/iOS)

### 3.1. Prerequisits
- `npm i -g expo-cli`
- Android Studio / Xcode segons plataforma.

### 3.2. Variables
A `mobile`, crea `.env` o defineix `EXPO_PUBLIC_API_BASE` (o edita `API baseURL` a `src/App.tsx`) amb la URL de backend.

### 3.3. Execució
```
cd mobile
npm install
npm start
```
A la primera execució:
- Accepta permisos de notificacions.
- **Inicia sessió** amb el mateix usuari que a la web.
- S'enviarà el **Expo Push Token** al backend (`/api/push/register`) automàticament.

---

## 4) Desenvolupament local (Linux Mint 22.1)

### Backend
```
cd backend
cp .env.example .env   # omple valors locals
npm install
npm run migrate:dev
npm run dev
```

### Web
```
cd web
npm install
# crea .env amb VITE_API_BASE=http://localhost:8080
npm run dev
```

### Mobile (emulador Android)
- Assegura que el backend local escolta a `0.0.0.0:8080`.
- L'app usa `http://10.0.2.2:8080` per a l'emulador Android.

---

## 5) Notes de seguretat i persistència
- Contrasenyes **hashades** amb Argon2.
- Sessions JWT (caducitat 30 dies).
- Dades persistents a **PostgreSQL** (les actualitzacions de l'app no perden dades).
- CORS restringit a la teva URL de Netlify.

---

## 6) Idiomes i banderes
- Per defecte: **Català** (senyera 🇦🇩). Llista d'idiomes al desplegable en l'ordre sol·licitat:
  **Gallec**, **Euscar**, **Anglès**, **Francès**, **Alemany**, **Italià**, **Rus**, **Búlgar**, **Romanès**, **Serbi**, **Xinès simplificat**, **Japonès**, **Hindi**, **Indonesi**, **Àrab**, **Swahili**, **Taushiro**, **Maorí**, **Quichua** i **Espanyol**.
- Traduccions base incloses per CA/EN/ES (la resta fan *fallback* a EN; pots ampliar `web/src/i18n.ts`).

---

## 7) Endpoints principals (resum)
- `POST /api/auth/register` · `POST /api/auth/login`
- `GET/POST/DELETE /api/targets` · `POST /api/targets/csv` · `POST /api/targets/:id/check`
- `GET /api/checks/latest`
- `GET/PUT /api/notif/settings` · `POST /api/notif/connect-token`
- `POST /api/push/register`
- `POST /api/telegram/webhook` (webhook)

---

## 8) Consells de Render/Netlify
- Mantén **worker** separat perquè les comprovacions i resums corrin encara que no hi hagi trànsit.
- Si uses HTTPS custom, actualitza `CORS_ORIGIN` i `PUBLIC_BASE_URL`.

Bon monitoratge! 🙌
