# Deployment na Fly.io (zdarma)

## Co potřebuješ:
1. GitHub účet
2. Fly.io účet (registrace na https://fly.io)
3. Nainstalovaný `flyctl` (příkaz pro instalaci níže)

## Instalace flyctl:

### macOS:
```bash
brew install flyctl
```

### Linux:
```bash
curl -L https://fly.io/install.sh | sh
```

### Windows:
```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

## Deployment krok za krokem:

### 1. Přihlášení do Fly.io
```bash
fly auth login
```

### 2. Vytvoření aplikace
```bash
cd /Users/martinsnizek/CascadeProjects/bet_analysis
fly apps create bet-tracker --org personal
```

### 3. Vytvoření volume (pro SQLite databázi)
```bash
fly volumes create data --region fra --size 1
```

### 4. Deploy
```bash
fly deploy
```

### 5. Otevření aplikace
```bash
fly open
```

## Co se stane:
- Frontend se buildne a spojí s backendem
- SQLite databáze se uloží na persistent volume (`/data/`)
- Aplikace poběží na `https://bet-tracker.fly.dev` (nebo tvé vlastní doméně)
- Data v databázi přežijí restarty

## Monitoring:
```bash
fly logs          # Sledování logů
fly status        # Stav aplikace
fly ssh console   # Přístup do kontejneru
```

## Zdarma limity:
- 256 MB RAM
- 3 GB disk (persistent volume)
- 160 GB traffic/měsíc
- Spí po neaktivitě, ale volume zůstává

## Databáze:
Databáze je na `/data/bet_analysis.db` díky volume mountu v `fly.toml`.
Pro zálohu/export:
```bash
fly ssh console
cat /data/bet_analysis.db > /tmp/backup.db
exit
fly sftp get /tmp/backup.db ./backup.db
```
