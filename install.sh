#!/bin/bash

# Encountracker Installation Script for Linux/macOS
# This script guides you through setting up the Encountracker application

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Generate random JWT secret
generate_jwt_secret() {
    openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check PostgreSQL installation
check_postgres() {
    if command_exists psql; then
        print_success "PostgreSQL is installed"
        return 0
    else
        print_error "PostgreSQL is not installed"
        return 1
    fi
}

# Check Docker installation
check_docker() {
    if command_exists docker && command_exists docker-compose; then
        print_success "Docker and Docker Compose are installed"
        return 0
    else
        print_error "Docker or Docker Compose is not installed"
        return 1
    fi
}

# Check Node.js installation
check_node() {
    if command_exists node && command_exists npm; then
        NODE_VERSION=$(node --version)
        print_success "Node.js $NODE_VERSION is installed"
        return 0
    else
        print_error "Node.js is not installed"
        return 1
    fi
}

# Test PostgreSQL connection
test_postgres_connection() {
    local host=$1
    local port=$2
    local db=$3
    local user=$4
    local password=$5

    PGPASSWORD=$password psql -h "$host" -p "$port" -U "$user" -d "$db" -c "SELECT 1;" >/dev/null 2>&1
}

# Create PostgreSQL database and user
create_postgres_database() {
    local db_name=$1
    local db_user=$2
    local db_password=$3

    print_info "Creating PostgreSQL database and user..."

    # Check if we can connect as postgres user
    if ! command_exists psql; then
        print_error "psql command not found"
        return 1
    fi

    # Try to create database and user
    sudo -u postgres psql <<EOF
-- Create database
CREATE DATABASE $db_name;

-- Create user
CREATE USER $db_user WITH PASSWORD '$db_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $db_name TO $db_user;

-- Connect to database and grant schema privileges (PostgreSQL 15+)
\c $db_name
GRANT ALL ON SCHEMA public TO $db_user;
EOF

    if [ $? -eq 0 ]; then
        print_success "Database and user created successfully"
        return 0
    else
        print_error "Failed to create database and user"
        return 1
    fi
}

# Main installation flow
print_header "Encountracker Installation"

echo "This script will help you set up the Encountracker application."
echo "You'll be asked a few questions to configure your installation."
echo ""

# Step 1: Choose installation mode
print_header "Step 1: Choose Installation Mode"
echo "How would you like to run Encountracker?"
echo "1) Local Development (requires Node.js and PostgreSQL)"
echo "2) Docker (requires Docker and Docker Compose)"
echo ""
read -p "Enter your choice (1 or 2): " INSTALL_MODE

case $INSTALL_MODE in
    1)
        print_info "You selected: Local Development"
        RUN_MODE="local"

        # Check prerequisites
        print_header "Checking Prerequisites"

        if ! check_node; then
            print_error "Node.js is required for local development"
            echo "Please install Node.js from https://nodejs.org/ and run this script again"
            exit 1
        fi

        if ! check_postgres; then
            print_error "PostgreSQL is required for local development"
            echo "Please install PostgreSQL and run this script again"
            echo ""
            echo "Ubuntu/Debian: sudo apt install postgresql postgresql-contrib"
            echo "macOS: brew install postgresql@16"
            exit 1
        fi
        ;;
    2)
        print_info "You selected: Docker"
        RUN_MODE="docker"

        # Check prerequisites
        print_header "Checking Prerequisites"

        if ! check_docker; then
            print_error "Docker and Docker Compose are required"
            echo "Please install Docker from https://docs.docker.com/get-docker/ and run this script again"
            exit 1
        fi
        ;;
    *)
        print_error "Invalid choice. Please run the script again and select 1 or 2."
        exit 1
        ;;
esac

# Step 2: Database configuration
print_header "Step 2: Database Configuration"

if [ "$RUN_MODE" == "docker" ]; then
    echo "Do you want to use:"
    echo "1) Docker's built-in PostgreSQL (default, recommended for most users)"
    echo "2) External PostgreSQL database"
    echo ""
    read -p "Enter your choice (1 or 2) [1]: " DB_CHOICE
    DB_CHOICE=${DB_CHOICE:-1}

    if [ "$DB_CHOICE" == "2" ]; then
        USE_EXTERNAL_DB=true
        print_info "You will configure an external PostgreSQL database"
    else
        USE_EXTERNAL_DB=false
        print_info "Using Docker's built-in PostgreSQL"
    fi
else
    echo "Do you want to:"
    echo "1) Create a new PostgreSQL database"
    echo "2) Use an existing PostgreSQL database"
    echo ""
    read -p "Enter your choice (1 or 2): " DB_CHOICE
fi

# Collect database credentials
if [ "$RUN_MODE" == "docker" ] && [ "$USE_EXTERNAL_DB" != true ]; then
    # Docker with built-in DB - use defaults
    POSTGRES_HOST="db"
    POSTGRES_PORT="5432"
    POSTGRES_DB="encountracker"
    POSTGRES_USER="encountracker_user"
    read -sp "Enter PostgreSQL password [encountracker_password]: " POSTGRES_PASSWORD
    echo ""
    POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-encountracker_password}
else
    # Local or external DB - collect details
    if [ "$DB_CHOICE" == "1" ]; then
        # Create new database
        print_info "Configure new database settings"
        read -p "Database name [encountracker_dev]: " POSTGRES_DB
        POSTGRES_DB=${POSTGRES_DB:-encountracker_dev}

        read -p "Database user [encountracker_user]: " POSTGRES_USER
        POSTGRES_USER=${POSTGRES_USER:-encountracker_user}

        read -sp "Database password [local_dev_password]: " POSTGRES_PASSWORD
        echo ""
        POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-local_dev_password}

        if [ "$RUN_MODE" == "local" ]; then
            POSTGRES_HOST="localhost"
            POSTGRES_PORT="5432"

            print_info "Creating database..."
            if create_postgres_database "$POSTGRES_DB" "$POSTGRES_USER" "$POSTGRES_PASSWORD"; then
                print_success "Database created successfully"
            else
                print_warning "Database creation failed. You may need to create it manually."
                print_info "Run these commands as postgres user:"
                echo ""
                echo "  CREATE DATABASE $POSTGRES_DB;"
                echo "  CREATE USER $POSTGRES_USER WITH PASSWORD '$POSTGRES_PASSWORD';"
                echo "  GRANT ALL PRIVILEGES ON DATABASE $POSTGRES_DB TO $POSTGRES_USER;"
                echo "  \\c $POSTGRES_DB"
                echo "  GRANT ALL ON SCHEMA public TO $POSTGRES_USER;"
                echo ""
                read -p "Press Enter once you've created the database manually, or Ctrl+C to exit..."
            fi
        fi
    else
        # Use existing database
        print_info "Enter existing database connection details"
        read -p "Database host [localhost]: " POSTGRES_HOST
        POSTGRES_HOST=${POSTGRES_HOST:-localhost}

        read -p "Database port [5432]: " POSTGRES_PORT
        POSTGRES_PORT=${POSTGRES_PORT:-5432}

        read -p "Database name: " POSTGRES_DB
        read -p "Database user: " POSTGRES_USER
        read -sp "Database password: " POSTGRES_PASSWORD
        echo ""
    fi

    # Test connection (for local mode)
    if [ "$RUN_MODE" == "local" ]; then
        print_info "Testing database connection..."
        if test_postgres_connection "$POSTGRES_HOST" "$POSTGRES_PORT" "$POSTGRES_DB" "$POSTGRES_USER" "$POSTGRES_PASSWORD"; then
            print_success "Database connection successful"
        else
            print_error "Failed to connect to database. Please check your credentials."
            exit 1
        fi
    fi
fi

# Step 3: Additional configuration
print_header "Step 3: Additional Configuration"

# JWT Secret
JWT_SECRET=$(generate_jwt_secret)
print_success "Generated secure JWT secret"

# Base URL Path
echo ""
echo "If you're running behind a reverse proxy in a subdirectory (e.g., example.com/app),"
echo "enter the base path. Otherwise, leave blank."
read -p "Base URL path (e.g., /app) []: " BASE_URL_PATH

# Port configuration (for local mode)
if [ "$RUN_MODE" == "local" ]; then
    read -p "Server port [3000]: " PORT
    PORT=${PORT:-3000}
fi

# Step 4: Create configuration file
print_header "Step 4: Creating Configuration Files"

# Create .env file
ENV_FILE=".env"
print_info "Creating $ENV_FILE..."

cat > "$ENV_FILE" <<EOF
# PostgreSQL Configuration
POSTGRES_HOST=$POSTGRES_HOST
POSTGRES_PORT=$POSTGRES_PORT
POSTGRES_DB=$POSTGRES_DB
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

# Application Configuration
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=24h
BASE_URL_PATH=$BASE_URL_PATH

# Server Configuration
EOF

if [ "$RUN_MODE" == "local" ]; then
    echo "PORT=$PORT" >> "$ENV_FILE"
fi

print_success "Configuration file created: $ENV_FILE"

# Create docker-compose.override.yml if using external DB
if [ "$RUN_MODE" == "docker" ] && [ "$USE_EXTERNAL_DB" == true ]; then
    print_info "Creating docker-compose.override.yml for external database..."

    cat > "docker-compose.override.yml" <<EOF
version: '3.8'

services:
  app:
    environment:
      - POSTGRES_HOST=$POSTGRES_HOST
      - POSTGRES_PORT=$POSTGRES_PORT
      - POSTGRES_DB=$POSTGRES_DB
      - POSTGRES_USER=$POSTGRES_USER
      - POSTGRES_PASSWORD=$POSTGRES_PASSWORD
EOF

    print_success "Created docker-compose.override.yml"
fi

# Step 5: Install and initialize
print_header "Step 5: Installation"

if [ "$RUN_MODE" == "local" ]; then
    # Install dependencies
    print_info "Installing Node.js dependencies..."
    npm install
    print_success "Dependencies installed"

    # Initialize database
    print_info "Initializing database..."
    npm run init-db
    print_success "Database initialized"

    # Success message
    print_header "Installation Complete!"
    print_success "Encountracker is ready to use!"
    echo ""
    echo "To start the development server, run:"
    echo "  npm run dev"
    echo ""
    echo "The application will be available at:"
    echo "  http://localhost:$PORT$BASE_URL_PATH"
    echo ""
    echo "Default admin credentials:"
    echo "  Username: admin"
    echo "  Password: admin123"
    echo ""
    print_warning "Remember to change the admin password after first login!"

elif [ "$RUN_MODE" == "docker" ]; then
    # Build and start Docker containers
    print_info "Building and starting Docker containers..."
    docker-compose up --build -d

    if [ $? -eq 0 ]; then
        print_success "Docker containers started"

        # Success message
        print_header "Installation Complete!"
        print_success "Encountracker is running in Docker!"
        echo ""
        echo "The application is available at:"
        echo "  http://localhost:3000$BASE_URL_PATH"
        echo ""
        echo "Default admin credentials:"
        echo "  Username: admin"
        echo "  Password: admin123"
        echo ""
        print_warning "Remember to change the admin password after first login!"
        echo ""
        echo "Useful Docker commands:"
        echo "  docker-compose logs -f       # View logs"
        echo "  docker-compose restart       # Restart containers"
        echo "  docker-compose down          # Stop containers"
        echo "  docker-compose up --build -d # Rebuild and restart"
    else
        print_error "Failed to start Docker containers"
        echo "Check the logs with: docker-compose logs"
        exit 1
    fi
fi

echo ""
print_info "Configuration saved in $ENV_FILE"
echo ""
