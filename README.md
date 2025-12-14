
A cross-platform web application for managing D&D 5e encounters, built with a production-ready scaffold that allows for incremental feature implementation.

## Disclaimer

This application is built primarily using AI coding tools. This project is intended as a learning project while providing useful functionality for personal hobbies. While safety is taken into account as part of the development of this application, safety is not guaranteed. Run this application at your own risk.


## Features (Scaffold)

This scaffold provides the foundation for a full-featured D&D encounter manager:

- **Authentication System**: JWT-based authentication with role support (admin/player)
- **Database**: SQLite3 with schema designed for easy migration to online databases
- **API Routes**: RESTful API structure with stubbed endpoints ready for implementation
- **Security**: Helmet, CORS, rate limiting, input validation
- **Frontend**: Responsive single-page application with vanilla JavaScript
- **Component Library**: Reusable UI components (buttons, cards, modals, tables, forms)
- **Testing**: Jest setup with example tests
- **Docker**: Ready-to-deploy containerized application
- **Logging**: Winston-based logging to file and console

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: SQLite3 (designed for migration to MySQL/PostgreSQL)
- **Frontend**: Vanilla JavaScript/HTML/CSS
- **Authentication**: JWT with bcryptjs
- **Testing**: Jest + Supertest
- **Deployment**: Docker + Docker Compose

## Project Structure

```
owlbear/
├── server/               # Backend application
│   ├── routes/          # API route handlers (stubbed)
│   ├── middleware/      # Authentication, validation, error handling
│   ├── models/          # Database schema
│   ├── utils/           # Utilities (database, JWT, logger)
│   └── index.js         # Main server file
├── client/              # Frontend application
│   ├── css/            # Stylesheets
│   ├── js/             # JavaScript modules
│   └── index.html      # Main HTML file
├── tests/               # Test files
├── config/              # Configuration files
├── data/                # Database and logs (gitignored)
├── .env                 # Environment variables
├── Dockerfile           # Docker configuration
└── docker-compose.yml   # Docker Compose configuration
```

## Quick Start

### Prerequisites

- Node.js 18+ (or Docker)
- npm or yarn

### Local Development

1. **Clone and Install**
   ```bash
   cd owlbear
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Initialize Database**
   ```bash
   npm run init-db
   ```

   This creates a default admin user:
   - Username: `admin`
   - Password: `admin123`
   - **IMPORTANT**: Change this password in production!

4. **Start Development Server**
   ```bash
   npm run dev
   ```

5. **Access Application**
   - Open http://localhost:3000
   - Login with admin credentials

### Docker Deployment

1. **Using Docker Compose (Recommended)**
   ```bash
   docker-compose up -d
   ```

2. **Using Docker Directly**
   ```bash
   docker build -t dnd-encounter-manager .
   docker run -p 3000:3000 -v dnd-data:/app/data dnd-encounter-manager
   ```

3. **Access Application**
   - Open http://localhost:3000

## Configuration

All configuration is done via environment variables in `.env`:

```env
# Server
PORT=3000                # Server port
NODE_ENV=development     # Environment (development/production)
BASE_URL_PATH=/          # Base URL path for reverse proxy support

# Database
DB_TYPE=sqlite           # Database type (sqlite, mysql, postgresql)
DB_PATH=./data/database.sqlite

# Authentication
JWT_SECRET=your-secret-key-change-this
JWT_EXPIRES_IN=24h

# CORS
CORS_ORIGIN=http://localhost:3000

# Logging
LOG_LEVEL=info
LOG_FILE=./data/app.log

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and receive JWT token
- `GET /api/auth/me` - Get current user info (requires auth)
- `POST /api/auth/logout` - Logout (requires auth)

### Campaign Endpoints (Stubbed)

- `GET /api/campaigns` - List all campaigns
- `GET /api/campaigns/:id` - Get campaign details
- `POST /api/campaigns` - Create campaign (admin only)
- `PUT /api/campaigns/:id` - Update campaign (admin only)
- `DELETE /api/campaigns/:id` - Delete campaign (admin only)

### Encounter Endpoints (Stubbed)

- `GET /api/encounters` - List encounters
- `GET /api/encounters/:id` - Get encounter details
- `POST /api/encounters` - Create encounter (admin only)
- `PUT /api/encounters/:id` - Update encounter (admin only)
- `DELETE /api/encounters/:id` - Delete encounter (admin only)

### Monster Endpoints (Stubbed)

- `GET /api/monsters` - List monsters in encounter
- `GET /api/monsters/search` - Search D&D 5e API (not implemented)
- `GET /api/monsters/dnd/:id` - Get monster from D&D 5e API (not implemented)
- `POST /api/monsters` - Add monster to encounter (admin only)
- `PUT /api/monsters/:id` - Update monster (admin only)
- `DELETE /api/monsters/:id` - Remove monster (admin only)

### Combat Endpoints (Stubbed)

- `GET /api/combat/:encounter_id/initiative` - Get initiative order
- `POST /api/combat/:encounter_id/start` - Start combat (admin only)
- `POST /api/combat/:encounter_id/next-turn` - Next turn (admin only)
- `PUT /api/combat/initiative/:id` - Update initiative (admin only)
- `POST /api/combat/:encounter_id/end` - End combat (admin only)

### Import/Export Endpoints (Stubbed)

- `POST /api/import-export/export/:campaign_id` - Export campaign (admin only)
- `POST /api/import-export/import` - Import campaign (admin only)
- `GET /api/import-export/schema` - Get import/export schema

All protected endpoints require `Authorization: Bearer <token>` header.

## Database Schema

### Users
- `id`, `username`, `email`, `password_hash`, `role` (admin/player)

### Campaigns
- `id`, `name`, `description`, `dm_user_id`

### Encounters
- `id`, `campaign_id`, `name`, `description`, `difficulty`, `status`

### Monsters
- `id`, `encounter_id`, `name`, `dnd_api_id`, `max_hp`, `current_hp`, `armor_class`, `initiative_bonus`

### Players
- `id`, `campaign_id`, `user_id`, `character_name`, `character_class`, `level`, `max_hp`, `current_hp`, `armor_class`

### Initiative Tracker
- `id`, `encounter_id`, `participant_type`, `participant_id`, `initiative`, `turn_order`, `is_current_turn`

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

## Frontend Component Library

The client includes a reusable component library in `client/js/components.js`:

- **Toast Notifications**: `Components.showToast(message, type)`
- **Modals**: `Components.showModal(title, content, actions)`
- **Confirm Dialogs**: `Components.confirm(message, onConfirm)`
- **Tables**: `Components.createTable(headers, rows, options)`
- **Cards**: `Components.createCard(title, content, footer)`
- **Badges**: `Components.createBadge(text, type)`
- **Alerts**: `Components.createAlert(message, type)`

## Security Considerations

- **Change Default Credentials**: Update admin password immediately
- **JWT Secret**: Use a strong, random JWT_SECRET in production
- **CORS**: Configure CORS_ORIGIN for your domain
- **HTTPS**: Use HTTPS in production (configure reverse proxy)
- **Rate Limiting**: Adjust rate limits based on your needs
- **Input Validation**: All inputs are validated on the backend

## Migration Path

The database is designed for easy migration:

1. **SQLite to PostgreSQL/MySQL**:
   - Update `DB_TYPE` in `.env`
   - Implement connection logic in `server/utils/database.js`
   - Update schema in `server/models/schema.js` for database-specific syntax

2. **Feature Implementation**:
   - Routes are stubbed and ready for logic implementation
   - Database schema is complete
   - Frontend has component library and API client ready

## Next Steps for Implementation

1. **Campaign Management**: Implement CRUD operations in campaign routes
2. **Encounter Builder**: Add encounter creation and management logic
3. **D&D 5e API Integration**: Connect to https://www.dnd5eapi.co
4. **Initiative Tracker**: Implement turn order and combat state management
5. **Import/Export**: Add JSON import/export functionality
6. **Real-time Updates**: Consider WebSocket for live initiative tracking

## Troubleshooting

### Database Issues
```bash
# Reinitialize database
rm data/database.sqlite
npm run init-db
```

### Port Already in Use
```bash
# Change port in .env
PORT=3001
```

### Docker Issues
```bash
# Rebuild container
docker-compose down
docker-compose up --build
```

## License

MIT

## Contributing

This is a scaffold project. Implement features incrementally without refactoring core infrastructure.
