# Deployment na Render.com (zdarma)

## Krok 1: Push na GitHub

```bash
cd /Users/martinsnizek/CascadeProjects/bet_analysis
git init
git add .
git commit -m "Initial commit"
git branch -M main

# Vytvoř repozitář na GitHub a pushni
git remote add origin https://github.com/TVOJEJMENO/bet-tracker.git
git push -u origin main
```

## Krok 2: Vytvoření služeb na Render

### 2.1 Backend API (Web Service)

1. Jdi na https://dashboard.render.com/
2. Klikni **New +** → **Web Service**
3. Připoj GitHub repozitář
4. Nastavení:
   - **Name**: `bet-tracker-api`
   - **Environment**: `Python 3`
   - **Region**: `Frankfurt (EU)`
   - **Branch**: `main`
   - **Build Command**: `cd backend && pip install -r requirements.txt`
   - **Start Command**: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Klikni **Advanced** a přidej Environment Variables:
   - `SECRET_KEY`: (vygeneruj si dlouhý řetězec, např. `openssl rand -hex 32`)
   - `ALGORITHM`: `HS256`
   - `ACCESS_TOKEN_EXPIRE_MINUTES`: `15`
   - `REFRESH_TOKEN_EXPIRE_DAYS`: `7`
   - `DATABASE_URL`: `sqlite:///./bet_analysis.db`
6. Klikni **Create Web Service**

**POZOR**: Free tier má **ephemeral disk** - data se resetují při každém deployi/restartu!

### 2.2 Frontend (Static Site)

1. Na Render dashboard klikni **New +** → **Static Site**
2. Připoj ten samý GitHub repozitář
3. Nastavení:
   - **Name**: `bet-tracker`
   - **Region**: `Frankfurt (EU)`
   - **Branch**: `main`
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Publish Directory**: `frontend/dist`
4. Přidej **Redirects** (SPA routing):
   - Source: `/*`
   - Destination: `/index.html`
   - Action: `Rewrite`
5. Klikni **Create Static Site**

## Krok 3: Aktualizace API URL

Po prvním deployi backendu dostaneš URL jako `https://bet-tracker-api.onrender.com`.

Uprav `frontend/src/services/api.ts`:
```typescript
const API_BASE_URL = isProduction 
  ? 'https://bet-tracker-api.onrender.com/api'  // <- tvoje backend URL
  : '/api';
```

Commit a push:
```bash
git add frontend/src/services/api.ts
git commit -m "Update API URL for production"
git push
```

Render automaticky redeployne frontend.

## Dostupné URL

| Služba | URL | Poznámka |
|--------|-----|----------|
| Frontend | `https://bet-tracker.onrender.com` | Statický site |
| Backend API | `https://bet-tracker-api.onrender.com` | API + SQLite |

## Omezení free tier:

- **Spí po 15 min neaktivity** (první request po probuzení trvá 30-60s)
- **SQLite se resetuje** při každém deployi/restartu
- 512 MB RAM
- 100 GB bandwidth/měsíc

## Trvalá data (volitelné - $0.25/měsíc):

Pokud chceš uchovat data v SQLite:
1. Uprav backend na Render na **Paid plan** ($7/měsíc)
2. Přidej **Disk**: 1 GB za $0.25/měsíc
3. Změň `DATABASE_URL` na cestu na disku, např. `/mnt/data/bet_analysis.db`

## Alternativa pro trvalá data zdarma:

Místo Render použij **Railway** ($5 kreditů/měsíc zdarma) nebo **Fly.io** (3 GB volume zdarma).

## Kontrola:

Po deployi zkontroluj:
```bash
# Backend
curl https://bet-tracker-api.onrender.com/api/health

# Frontend otevři v prohlížeči
# https://bet-tracker.onrender.com
```
