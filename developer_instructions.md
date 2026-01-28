# Developer Instructions

## Installation

### Local Development Installation

This method is recommended for developers who want to contribute to the project or customize the application.

#### Requirements

- [Node.js](https://nodejs.org/) 18 or higher
- [PostgreSQL](https://www.postgresql.org/download/) 15 or higher
- npm (included with Node.js)

#### Setup Steps

1. **Install PostgreSQL**:

   **Windows**:
   - Download installer from https://www.postgresql.org/download/windows/
   - Run installer (PostgreSQL 15 or 16 recommended)
   - Note the password you set for the `postgres` user
   - Add PostgreSQL bin directory to PATH (e.g., `C:\Program Files\PostgreSQL\16\bin`)

   **macOS**:
   ```bash
   brew install postgresql@16
   brew services start postgresql@16
   ```

   **Linux (Ubuntu/Debian)**:
   ```bash
   sudo apt update
   sudo apt install postgresql postgresql-contrib
   sudo systemctl start postgresql
   ```

2. **Create database and user**:
   ```bash
   # Connect to PostgreSQL as superuser
   psql -U postgres

   # In psql shell, run these commands:
   CREATE DATABASE encountracker_dev;
   CREATE USER encountracker_user WITH PASSWORD 'local_dev_password';
   GRANT ALL PRIVILEGES ON DATABASE encountracker_dev TO encountracker_user;

   # PostgreSQL 15+ requires additional grant:
   \c encountracker_dev
   GRANT ALL ON SCHEMA public TO encountracker_user;
   \q
   ```

3. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd encountracker
   npm install
   ```

4. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your PostgreSQL credentials
   ```

   Update these settings in `.env`:
   ```env
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_DB=encountracker_dev
   POSTGRES_USER=encountracker_user
   POSTGRES_PASSWORD=local_dev_password
   JWT_SECRET=your_random_secret_key_here
   ```

5. **Initialize database**:
   ```bash
   npm run init-db
   ```

   This creates the database schema and a default admin user:
   - Username: `admin`
   - Password: `admin123`

6. **Start development server**:
   ```bash
   npm run dev
   ```

7. **Access application**:
   - Open http://localhost:3000
   - Login with admin credentials

#### Local Development Commands

```bash
# Start development server with auto-reload
npm run dev

# Start production server
npm start

# Initialize/reinitialize database
npm run init-db

# Update admin password (recommended after first login)
npm run update-admin-password

# Reset admin password to default (emergency use only)
npm run reset-password

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with CSV output
npm run test:csv

# Run specific test file
npx jest tests/auth.middleware.test.js
```

#### Running Tests

The application includes comprehensive test coverage using Jest.

**First-time test setup**:
```bash
npm run test:setup
```

This creates a separate test database (`encountracker_test`) to ensure tests never modify your development data.

**Running tests**:
```bash
# Run all tests with coverage report
npm test

# Run tests in watch mode (reruns on file changes)
npm run test:watch

# Run specific test file
npm test -- tests/campaigns.routes.test.js

# Run with verbose output
npm test -- --verbose
```

**Test isolation**: Tests use a completely separate database (`encountracker_test`) configured in `.env.test`. Your development database is never touched during testing.

#### Database Migrations

The application uses an automatic migration system that runs on startup. When you start the server (either via `npm run dev` or `npm start`), any pending database schema changes are automatically applied.

**Migration process**:
1. Migrations are stored in `server/migrations/`
2. Each migration is tracked in the `schema_migrations` table
3. Migrations run sequentially in numerical order
4. Successfully applied migrations are never re-run

**Viewing migration status**:
Check the server logs when starting the application:
```
Checking for pending migrations...
Running migration: 001_add_speed
✓ Migration completed in 15ms: 001_add_speed
All migrations completed successfully
```

**If migrations fail**:
- Check the error message in server logs
- Ensure database user has sufficient permissions
- Verify database connection settings in `.env`
- For test database issues, run `npm run test:setup` again

## Project Structure

```
encountracker/
├── server/               # Backend application
│   ├── routes/          # API route handlers
│   ├── middleware/      # Authentication, validation, error handling
│   ├── models/          # Database schema
│   ├── migrations/      # Database migration files
│   ├── utils/           # Utilities (database, JWT, logger)
│   └── index.js         # Main server entry point
├── client/              # Frontend application
│   ├── css/            # Stylesheets
│   ├── js/             # JavaScript modules
│   └── index.html      # Main HTML file
├── tests/               # Test files
├── config/              # Configuration files
├── data/                # Logs (gitignored)
├── .env                 # Environment variables
├── Dockerfile           # Docker configuration
└── docker-compose.yml   # Docker Compose configuration
```

## Troubleshooting

### Docker Issues

**Problem**: Changes to code don't appear in running container
```bash
docker compose down
docker compose up --build -d
```

**Problem**: "Port 3000 already in use"
```bash
# Stop existing containers
docker compose down

# Or change the port in .env
PORT=3001
```

**Problem**: Database connection errors
```bash
# Check logs
docker compose logs -f postgres
docker compose logs -f app

# Verify environment variables match in .env and docker-compose.yml
```

**Problem**: Application won't start
```bash
# View detailed logs
docker compose logs -f

# Check if containers are running
docker compose ps

# Restart with fresh build
docker compose down
docker compose up --build -d
```

### Local Development Issues

**Problem**: `ECONNREFUSED` when connecting to PostgreSQL
- **Windows**: Check Services app for "postgresql-x64-16" service
- **macOS**: Run `brew services list` and `brew services start postgresql@16`
- **Linux**: Run `sudo systemctl status postgresql`

**Problem**: `password authentication failed for user`
- Verify credentials in `.env` match database user password
- Ensure you set the password when creating the database user

**Problem**: `permission denied for schema public`
- Run as PostgreSQL superuser:
  ```sql
  \c encountracker_dev
  GRANT ALL ON SCHEMA public TO encountracker_user;
  ```

**Problem**: Port already in use
```bash
# Change port in .env
PORT=3001
```

**Problem**: Database schema errors after update
```bash
# Reinitialize database (⚠️ destroys all data)
npm run init-db
```

## Reverse Proxy / Subdirectory Hosting

If you want to host Encountracker under a subdirectory (e.g., `https://yourdomain.com/dnd`):

1. Set `BASE_URL_PATH` in `.env`:
   ```env
   BASE_URL_PATH=/dnd
   ```

2. Configure your reverse proxy to forward requests to the application:

   **nginx example**:
   ```nginx
   location /dnd/ {
       proxy_pass http://localhost:3000/dnd/;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
   }
   ```

   **Caddy example**:
   ```
   yourdomain.com {
       handle_path /dnd/* {
           reverse_proxy localhost:3000
       }
   }
   ```

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

When contributing:
- Write tests for new features (see `tests/` directory for examples)
- Follow existing code style and patterns
- Update documentation as needed
- Ensure all tests pass before submitting (`npm test`)
