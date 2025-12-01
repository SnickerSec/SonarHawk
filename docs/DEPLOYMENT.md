# CodeGuard Deployment Guide

## Railway Deployment

CodeGuard is configured for easy deployment on Railway.

### Quick Deploy

1. **Create a new Railway project** from this repository
2. **Railway will automatically detect** the configuration from `railway.json` and `nixpacks.toml`
3. **No additional configuration needed** - the app will build and deploy automatically

### Environment Variables

No environment variables are required for basic operation. The application will:
- Listen on the PORT provided by Railway (defaults to 3000)
- Serve both the frontend and API from a single service

### Build Process

Railway will:
1. Install root dependencies: `npm install`
2. Install web dependencies: `cd web && npm install`
3. Build the frontend: `cd web && npm run build`
4. Start the production server: `cd web && NODE_ENV=production node server.js`

### Accessing the Application

Once deployed, visit your Railway app URL to access:
- **Frontend UI**: `https://your-app.railway.app/`
- **Health Check**: `https://your-app.railway.app/api/health`
- **API Endpoint**: `https://your-app.railway.app/api/generate`

## Local Development

### Prerequisites

- Node.js 14-20 (Node 22 works but shows engine warnings)
- npm

### Setup

```bash
# Install dependencies
npm install
cd web && npm install && cd ..

# Start development servers (API + Frontend)
cd web && npm run start:dev
```

This will start:
- API server on http://localhost:3000
- Vite dev server on http://localhost:5173

### Production Build & Test

```bash
# Build the frontend
cd web && npm run build

# Start production server
cd web && npm start
```

Then visit http://localhost:3000

## Features

The web interface supports all CLI options:

### Required Configuration
- SonarQube URL
- Project Key / Component

### Authentication
- Auth Token (recommended)
- Username/Password
- Organization (for SonarCloud)

### Project Metadata
- Project Name
- Application Name
- Release Version

### Scope & Filtering
- Branch
- Pull Request ID
- New Code Period Only
- Include All Bugs
- Include Security Hotspots

### Report Content
- Quality Gate Status
- Code Coverage
- Link Issues to SonarQube
- Security Rules Section
- Only Show Detected Rules
- Fix Missing Rules

### Appearance
- Dark/Light Theme
- Custom Vulnerability Labels

### Advanced Options
- HTTP Proxy
- Debug Mode

## Architecture

```
CodeGuard/
├── index.js              # Core SonarQube client & report generation
├── cli.js                # CLI entry point
├── web/
│   ├── server.js         # Express API server (serves both API & static files)
│   ├── src/
│   │   ├── App.jsx       # React root component
│   │   ├── components/
│   │   │   ├── ReportForm.jsx   # Main form with all options
│   │   │   └── Header.jsx       # App header
│   │   └── theme.js      # Chakra UI theme
│   ├── dist/             # Production build output (generated)
│   └── package.json
├── railway.json          # Railway deployment config
└── nixpacks.toml        # Nixpacks build config
```

## API Endpoints

### GET /api/health
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "environment": "production",
  "version": "1.0.0"
}
```

### POST /api/generate
Generate SonarQube report

**Request Body:**
```json
{
  "sonarurl": "https://sonar.example.com",
  "sonarcomponent": "project:key",
  "sonartoken": "squ_...",
  "branch": "main",
  "darkTheme": true,
  "qualityGateStatus": true
}
```

**Response:**
- Content-Type: `text/html`
- Returns the generated HTML report as a downloadable file

## Troubleshooting

### Build Fails

If the build fails on Railway:
1. Check that Node.js version is compatible (14-20)
2. Verify all dependencies are listed in package.json
3. Check Railway build logs for specific errors

### API Errors

If report generation fails:
1. Verify SonarQube URL is accessible from Railway
2. Check authentication credentials are correct
3. Enable debug mode in the form and check browser console
4. Verify the SonarQube project key exists

### CORS Issues

The server is configured to handle CORS appropriately:
- Development: Allows localhost:5173
- Production: Allows same-origin requests

## Contributing

When adding new features:
1. Update the CLI options in `index.js` (buildCommand function)
2. Update the server mapping in `web/server.js` (options transformation)
3. Update the form in `web/src/components/ReportForm.jsx`
4. Test both CLI and web interface
