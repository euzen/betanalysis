# Bet Analysis Application

A comprehensive web application for analyzing betting data with duplicate detection and management capabilities.

## Features

- **HTML Data Import**: Import betting data from HTML files with automatic parsing
- **Duplicate Detection**: Smart detection of duplicate matches with similarity scoring
- **Data Visualization**: Interactive dashboard with charts and statistics
- **Duplicate Resolution**: Manual resolution of detected duplicates
- **REST API**: Full backend API for data management

## Architecture

### Backend (FastAPI + SQLAlchemy)
- FastAPI web framework
- SQLite database (easily upgradeable to PostgreSQL)
- BeautifulSoup for HTML parsing
- Duplicate detection with similarity algorithms

### Frontend (React + TypeScript)
- React 18 with TypeScript
- Tailwind CSS for styling
- Recharts for data visualization
- Axios for API communication

## Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Start the backend server:
```bash
python -m app.main
```

The backend will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Usage

### 1. Import Data
1. Go to the **Data Management** page
2. Select your HTML file containing betting data
3. Choose duplicate detection strategy:
   - **Smart**: Detects duplicates based on similarity (recommended)
   - **Strict**: Only exact matches are considered duplicates
4. Click "Import" to process the file

### 2. View Dashboard
- **Overview**: Total predictions, success rate, unresolved duplicates
- **Charts**: Prediction results pie chart, success rate overview
- **Recent Activity**: Latest imports and predictions

### 3. Manage Duplicates
1. Go to the **Duplicates** page
2. Review detected duplicates with similarity scores
3. Choose which record to keep:
   - **Keep Original**: Removes the duplicate record
   - **Keep Duplicate**: Removes the original record
4. View detailed comparison before making decisions

## API Endpoints

### Matches
- `GET /api/matches/` - List all matches
- `GET /api/matches/{id}` - Get specific match

### Predictions
- `GET /api/predictions/` - List all predictions
- `GET /api/predictions/stats/summary` - Get prediction statistics

### Imports
- `POST /api/imports/html` - Import HTML file
- `GET /api/imports/logs` - Get import history

### Duplicates
- `GET /api/duplicates/` - List duplicates
- `POST /api/duplicates/{id}/resolve` - Resolve duplicate

## Data Structure

### Match Data
```json
{
  "home_team": "Manchester United",
  "away_team": "Brentford",
  "league": "Premier League",
  "country": "England",
  "home_score": 2,
  "away_score": 1,
  "status": "FT",
  "predictions": [
    {
      "type": "Number of goals",
      "value": "+1.5",
      "percentage": 80,
      "odds": 1.16,
      "result": "SUCCESS"
    }
  ]
}
```

## Duplicate Detection

The application uses multiple criteria for duplicate detection:

1. **Team Names** (60% weight): Exact match of home/away teams
2. **League** (included in team match): Same league
3. **Score** (30% weight): Identical final scores
4. **Time** (10% weight): Matches within 2-hour window

Similarity score > 80% is considered a duplicate in smart mode.

## Development

### Backend Development
```bash
cd backend
python -m app.main  # Start with auto-reload
```

### Frontend Development
```bash
cd frontend
npm run dev  # Start development server
npm run build  # Build for production
```

### Database
The application uses SQLite by default. The database file (`bet_analysis.db`) is created automatically on first run.

To reset the database:
```bash
rm backend/bet_analysis.db
```

## Project Structure

```
bet_analysis/
├── backend/
│   ├── app/
│   │   ├── api/          # API endpoints
│   │   ├── models/       # Database models
│   │   ├── parsers/      # HTML parsing logic
│   │   ├── database.py   # Database configuration
│   │   └── main.py       # FastAPI application
│   ├── requirements.txt
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API services
│   │   └── types/        # TypeScript types
│   ├── package.json
│   └── vite.config.ts
├── data/
│   └── data_vcera.html   # Sample data file
└── README.md
```

## Troubleshooting

### Common Issues

1. **CORS Errors**: Make sure backend is running on port 8000
2. **Database Errors**: Delete the database file and restart the backend
3. **Import Failures**: Check that HTML file contains the expected structure
4. **Frontend Build Issues**: Clear node_modules and reinstall dependencies

### Logs
- Backend logs are displayed in the terminal
- Frontend logs are available in browser dev tools
- Import history is available in the Data Management section

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Deployment

### Render.com (Free Tier)

Deploy your own instance with one click:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

**Note:** The free tier uses ephemeral storage - SQLite data resets on deploy/restart. For persistent data, upgrade to a paid plan with Disk.

See [DEPLOY_RENDER.md](DEPLOY_RENDER.md) for detailed instructions.

## License

This project is licensed under the MIT License.
