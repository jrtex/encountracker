# Encountracker

A web application for managing D&D 5e encounters, featuring initiative tracking, combat management, and campaign organization.

## Disclaimer

This application is built primarily using AI coding tools. This project is intended as a learning project while providing useful functionality for personal hobbies. While safety is taken into account as part of the development of this application, safety is not guaranteed. Run this application at your own risk.

## Features

- **Authentication System**: Secure user authentication with role-based access (admin/player)
- **Campaign Management**: Organize your D&D campaigns and encounters
- **Initiative Tracker**: Track turn order and combat state
- **Player Management**: Manage player characters and their stats
- **Monster Database**: Store and manage monster stats for encounters
- **Responsive Design**: Works on desktop and mobile devices

## Installation

### Recommended: Docker Installation

Docker is the easiest way to get Encountracker up and running. This method handles all dependencies automatically, including the PostgreSQL database.

#### Requirements

- [Docker](https://docs.docker.com/get-docker/) (version 20.10 or higher)
- [Docker Compose](https://docs.docker.com/compose/install/) (usually included with Docker Desktop)

#### Setup Steps

1. **Clone the repository** (or download and extract the ZIP file):
   ```bash
   git clone <repository-url>
   cd encountracker
   ```

2. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

3. **Configure your environment** by editing `.env`:

   **Required settings** (MUST be changed for security):
   ```env
   # Database password (CHANGE THIS!)
   POSTGRES_PASSWORD=your_secure_password_here

   # JWT secret for authentication (CHANGE THIS!)
   JWT_SECRET=your_random_secret_key_here
   ```

   **Optional settings** (can leave as defaults):
   ```env
   # Server port (default: 3000)
   PORT=3000

   # Database configuration (usually don't need to change these)
   POSTGRES_DB=encountracker
   POSTGRES_USER=encountracker_user

   # JWT token expiration (default: 24 hours)
   JWT_EXPIRES_IN=24h

   # CORS origin (set to your domain in production, or * for all)
   CORS_ORIGIN=*

   # Base URL path (for reverse proxy/subdirectory hosting)
   BASE_URL_PATH=/

   # Logging level (info, debug, warn, error)
   LOG_LEVEL=info

   # Rate limiting
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=10000
   ```

4. **Start the application**:
   ```bash
   docker compose up -d
   ```

   This command will:
   - Download the required Docker images (PostgreSQL and Node.js)
   - Build the application container
   - Start both the database and application
   - Initialize the database with default schema
   - Create a default admin user

5. **Access the application**:
   - Open your browser to http://localhost:3000 (or your configured PORT)
   - Login with default credentials:
     - Username: `admin`
     - Password: `admin123`
   - **IMPORTANT**: Change the admin password immediately after first login!

#### Docker Management Commands

```bash
# View logs
docker compose logs -f

# Stop the application
docker compose down

# Update to latest code (after pulling changes)
docker compose down
docker compose up --build -d

# Restart the application (without rebuilding)
docker compose restart

# Remove everything including data (⚠️ WARNING: Destroys all data!)
docker compose down -v
```

#### Updating the Application

When you pull new code or update the application:

```bash
# Stop current containers
docker compose down

# Rebuild and start with latest code
docker compose up --build -d
```

**Why rebuild is needed**: Docker caches images for performance. Without `--build`, it will reuse the old cached image and your code changes won't appear.

### Alternative: Local Development Installation

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

## Security Considerations

**Before using in production**:

1. **Change default admin password**: Login and change from `admin123` immediately
2. **Set strong JWT secret**: Use a random, long string for `JWT_SECRET` in `.env`
3. **Use secure database password**: Set a strong `POSTGRES_PASSWORD` in `.env`
4. **Configure CORS**: Set `CORS_ORIGIN` to your domain (not `*`)
5. **Use HTTPS**: Deploy behind a reverse proxy with SSL/TLS (nginx, Caddy, Traefik)
6. **Review rate limits**: Adjust based on your expected traffic
7. **Keep Docker images updated**: Regularly rebuild to get security patches

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

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

When contributing:
- Write tests for new features (see `tests/` directory for examples)
- Follow existing code style and patterns
- Update documentation as needed
- Ensure all tests pass before submitting (`npm test`)
