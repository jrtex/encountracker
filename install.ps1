# Encountracker Installation Script for Windows
# This script guides you through setting up the Encountracker application

# Requires PowerShell 5.0 or later
#Requires -Version 5.0

# Stop on errors
$ErrorActionPreference = "Stop"

# Helper functions
function Write-Header {
    param([string]$Message)
    Write-Host "`n================================================" -ForegroundColor Blue
    Write-Host $Message -ForegroundColor Blue
    Write-Host "================================================`n" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Cyan
}

# Generate random JWT secret
function New-JwtSecret {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::Create()
    $rng.GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

# Check if command exists
function Test-CommandExists {
    param([string]$Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

# Check PostgreSQL installation
function Test-PostgreSQL {
    if (Test-CommandExists "psql") {
        Write-Success "PostgreSQL is installed"
        return $true
    } else {
        Write-ErrorMsg "PostgreSQL is not installed"
        return $false
    }
}

# Check Docker installation
function Test-Docker {
    if (-not (Test-CommandExists "docker")) {
        Write-ErrorMsg "Docker is not installed"
        return $false
    }

    # Check for docker-compose (V1) or docker compose (V2)
    if (Test-CommandExists "docker-compose") {
        $script:dockerComposeCmd = "docker-compose"
        Write-Success "Docker and Docker Compose (V1) are installed"
        return $true
    }

    # Check for docker compose as a subcommand (V2)
    try {
        $null = docker compose version 2>&1
        if ($LASTEXITCODE -eq 0) {
            $script:dockerComposeCmd = "docker compose"
            Write-Success "Docker and Docker Compose (V2) are installed"
            return $true
        }
    } catch {}

    Write-ErrorMsg "Docker Compose is not installed"
    return $false
}

# Check Node.js installation
function Test-Node {
    if ((Test-CommandExists "node") -and (Test-CommandExists "npm")) {
        $nodeVersion = node --version
        Write-Success "Node.js $nodeVersion is installed"
        return $true
    } else {
        Write-ErrorMsg "Node.js is not installed"
        return $false
    }
}

# Test PostgreSQL connection
function Test-PostgresConnection {
    param(
        [string]$Host,
        [string]$Port,
        [string]$Database,
        [string]$User,
        [string]$Password
    )

    $env:PGPASSWORD = $Password
    try {
        $null = psql -h $Host -p $Port -U $User -d $Database -c "SELECT 1;" 2>&1
        return $?
    } finally {
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    }
}

# Create PostgreSQL database and user
function New-PostgresDatabase {
    param(
        [string]$DatabaseName,
        [string]$User,
        [string]$Password
    )

    Write-Info "Creating PostgreSQL database and user..."

    if (-not (Test-CommandExists "psql")) {
        Write-ErrorMsg "psql command not found"
        return $false
    }

    $sqlCommands = @"
-- Create database
CREATE DATABASE $DatabaseName;

-- Create user
CREATE USER $User WITH PASSWORD '$Password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DatabaseName TO $User;

-- Connect to database and grant schema privileges (PostgreSQL 15+)
\c $DatabaseName
GRANT ALL ON SCHEMA public TO $User;
"@

    try {
        $sqlCommands | psql -U postgres 2>&1 | Out-Null
        Write-Success "Database and user created successfully"
        return $true
    } catch {
        Write-ErrorMsg "Failed to create database and user"
        Write-Info "You may need to run this script as Administrator or create the database manually"
        return $false
    }
}

# Read secure password
function Read-SecurePassword {
    param(
        [string]$Prompt,
        [string]$Default = ""
    )

    if ($Default) {
        $promptText = "${Prompt} [${Default}]: "
    } else {
        $promptText = "${Prompt}: "
    }

    $securePassword = Read-Host $promptText -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

    if ([string]::IsNullOrEmpty($password) -and $Default) {
        return $Default
    }
    return $password
}

# Main installation flow
Write-Header "Encountracker Installation"

Write-Host "This script will help you set up the Encountracker application."
Write-Host "You'll be asked a few questions to configure your installation."
Write-Host ""

# Step 1: Choose installation mode
Write-Header "Step 1: Choose Installation Mode"
Write-Host "How would you like to run Encountracker?"
Write-Host "1) Local Development (requires Node.js and PostgreSQL)"
Write-Host "2) Docker (requires Docker and Docker Compose)"
Write-Host ""
$installMode = Read-Host "Enter your choice (1 or 2)"

switch ($installMode) {
    "1" {
        Write-Info "You selected: Local Development"
        $runMode = "local"

        # Check prerequisites
        Write-Header "Checking Prerequisites"

        if (-not (Test-Node)) {
            Write-ErrorMsg "Node.js is required for local development"
            Write-Host "Please install Node.js from https://nodejs.org/ and run this script again"
            exit 1
        }

        if (-not (Test-PostgreSQL)) {
            Write-ErrorMsg "PostgreSQL is required for local development"
            Write-Host "Please install PostgreSQL from https://www.postgresql.org/download/windows/ and run this script again"
            exit 1
        }
    }
    "2" {
        Write-Info "You selected: Docker"
        $runMode = "docker"

        # Check prerequisites
        Write-Header "Checking Prerequisites"

        if (-not (Test-Docker)) {
            Write-ErrorMsg "Docker and Docker Compose are required"
            Write-Host "Please install Docker Desktop from https://docs.docker.com/desktop/install/windows-install/ and run this script again"
            exit 1
        }
    }
    default {
        Write-ErrorMsg "Invalid choice. Please run the script again and select 1 or 2."
        exit 1
    }
}

# Step 2: Database configuration
Write-Header "Step 2: Database Configuration"

if ($runMode -eq "docker") {
    Write-Host "Do you want to use:"
    Write-Host "1) Docker's built-in PostgreSQL (default, recommended for most users)"
    Write-Host "2) External PostgreSQL database"
    Write-Host ""
    $dbChoice = Read-Host "Enter your choice (1 or 2) [1]"
    if ([string]::IsNullOrEmpty($dbChoice)) { $dbChoice = "1" }

    if ($dbChoice -eq "2") {
        $useExternalDb = $true
        Write-Info "You will configure an external PostgreSQL database"
    } else {
        $useExternalDb = $false
        Write-Info "Using Docker's built-in PostgreSQL"
    }
} else {
    Write-Host "Do you want to:"
    Write-Host "1) Create a new PostgreSQL database"
    Write-Host "2) Use an existing PostgreSQL database"
    Write-Host ""
    $dbChoice = Read-Host "Enter your choice (1 or 2)"
}

# Collect database credentials
if ($runMode -eq "docker" -and -not $useExternalDb) {
    # Docker with built-in DB - use defaults
    $postgresHost = "db"
    $postgresPort = "5432"
    $postgresDb = "encountracker"
    $postgresUser = "encountracker_user"
    $postgresPassword = Read-SecurePassword "Enter PostgreSQL password" "encountracker_password"
} else {
    # Local or external DB - collect details
    if ($dbChoice -eq "1") {
        # Create new database
        Write-Info "Configure new database settings"
        $postgresDb = Read-Host "Database name [encountracker_dev]"
        if ([string]::IsNullOrEmpty($postgresDb)) { $postgresDb = "encountracker_dev" }

        $postgresUser = Read-Host "Database user [encountracker_user]"
        if ([string]::IsNullOrEmpty($postgresUser)) { $postgresUser = "encountracker_user" }

        $postgresPassword = Read-SecurePassword "Database password" "local_dev_password"

        if ($runMode -eq "local") {
            $postgresHost = "localhost"
            $postgresPort = "5432"

            Write-Info "Creating database..."
            if (New-PostgresDatabase $postgresDb $postgresUser $postgresPassword) {
                Write-Success "Database created successfully"
            } else {
                Write-Warning "Database creation failed. You may need to create it manually."
                Write-Info "Run these commands in psql as postgres user:"
                Write-Host ""
                Write-Host "  CREATE DATABASE $postgresDb;"
                Write-Host "  CREATE USER $postgresUser WITH PASSWORD '$postgresPassword';"
                Write-Host "  GRANT ALL PRIVILEGES ON DATABASE $postgresDb TO $postgresUser;"
                Write-Host "  \c $postgresDb"
                Write-Host "  GRANT ALL ON SCHEMA public TO $postgresUser;"
                Write-Host ""
                Read-Host "Press Enter once you've created the database manually, or Ctrl+C to exit"
            }
        }
    } else {
        # Use existing database
        Write-Info "Enter existing database connection details"
        $postgresHost = Read-Host "Database host [localhost]"
        if ([string]::IsNullOrEmpty($postgresHost)) { $postgresHost = "localhost" }

        $postgresPort = Read-Host "Database port [5432]"
        if ([string]::IsNullOrEmpty($postgresPort)) { $postgresPort = "5432" }

        $postgresDb = Read-Host "Database name"
        $postgresUser = Read-Host "Database user"
        $postgresPassword = Read-SecurePassword "Database password"
    }

    # Test connection (for local mode)
    if ($runMode -eq "local") {
        Write-Info "Testing database connection..."
        if (Test-PostgresConnection $postgresHost $postgresPort $postgresDb $postgresUser $postgresPassword) {
            Write-Success "Database connection successful"
        } else {
            Write-ErrorMsg "Failed to connect to database. Please check your credentials."
            exit 1
        }
    }
}

# Step 3: Additional configuration
Write-Header "Step 3: Additional Configuration"

# JWT Secret
$jwtSecret = New-JwtSecret
Write-Success "Generated secure JWT secret"

# Base URL Path
Write-Host ""
Write-Host "If you're running behind a reverse proxy in a subdirectory (e.g., example.com/app),"
Write-Host "enter the base path. Otherwise, leave blank."
$baseUrlPath = Read-Host "Base URL path (e.g., /app) []"

# Port configuration (for local mode)
if ($runMode -eq "local") {
    $port = Read-Host "Server port [3000]"
    if ([string]::IsNullOrEmpty($port)) { $port = "3000" }
}

# Step 4: Create configuration file
Write-Header "Step 4: Creating Configuration Files"

# Create .env file
$envFile = ".env"
Write-Info "Creating $envFile..."

$envContent = @"
# PostgreSQL Configuration
POSTGRES_HOST=$postgresHost
POSTGRES_PORT=$postgresPort
POSTGRES_DB=$postgresDb
POSTGRES_USER=$postgresUser
POSTGRES_PASSWORD=$postgresPassword

# Application Configuration
JWT_SECRET=$jwtSecret
JWT_EXPIRES_IN=24h
BASE_URL_PATH=$baseUrlPath

# Server Configuration
"@

if ($runMode -eq "local") {
    $envContent += "`nPORT=$port"
}

$envContent | Out-File -FilePath $envFile -Encoding UTF8
Write-Success "Configuration file created: $envFile"

# Create docker-compose.override.yml if using external DB
if ($runMode -eq "docker" -and $useExternalDb) {
    Write-Info "Creating docker-compose.override.yml for external database..."

    $overrideContent = @"
version: '3.8'

services:
  app:
    environment:
      - POSTGRES_HOST=$postgresHost
      - POSTGRES_PORT=$postgresPort
      - POSTGRES_DB=$postgresDb
      - POSTGRES_USER=$postgresUser
      - POSTGRES_PASSWORD=$postgresPassword
"@

    $overrideContent | Out-File -FilePath "docker-compose.override.yml" -Encoding UTF8
    Write-Success "Created docker-compose.override.yml"
}

# Step 5: Install and initialize
Write-Header "Step 5: Installation"

if ($runMode -eq "local") {
    # Install dependencies
    Write-Info "Installing Node.js dependencies..."
    npm install
    Write-Success "Dependencies installed"

    # Initialize database
    Write-Info "Initializing database..."
    npm run init-db
    Write-Success "Database initialized"

    # Success message
    Write-Header "Installation Complete!"
    Write-Success "Encountracker is ready to use!"
    Write-Host ""
    Write-Host "To start the development server, run:"
    Write-Host "  npm run dev" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "The application will be available at:"
    Write-Host "  http://localhost:$port$baseUrlPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Default admin credentials:"
    Write-Host "  Username: admin" -ForegroundColor Yellow
    Write-Host "  Password: admin123" -ForegroundColor Yellow
    Write-Host ""
    Write-Warning "Remember to change the admin password after first login!"

} elseif ($runMode -eq "docker") {
    # Build and start Docker containers
    Write-Info "Building and starting Docker containers..."

    # Execute docker compose command (handles both V1 and V2)
    if ($dockerComposeCmd -eq "docker-compose") {
        docker-compose up --build -d
    } else {
        docker compose up --build -d
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Success "Docker containers started"

        # Success message
        Write-Header "Installation Complete!"
        Write-Success "Encountracker is running in Docker!"
        Write-Host ""
        Write-Host "The application is available at:"
        Write-Host "  http://localhost:3000$baseUrlPath" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Default admin credentials:"
        Write-Host "  Username: admin" -ForegroundColor Yellow
        Write-Host "  Password: admin123" -ForegroundColor Yellow
        Write-Host ""
        Write-Warning "Remember to change the admin password after first login!"
        Write-Host ""
        Write-Host "Useful Docker commands:"
        Write-Host "  $dockerComposeCmd logs -f       # View logs"
        Write-Host "  $dockerComposeCmd restart       # Restart containers"
        Write-Host "  $dockerComposeCmd down          # Stop containers"
        Write-Host "  $dockerComposeCmd up --build -d # Rebuild and restart"
    } else {
        Write-ErrorMsg "Failed to start Docker containers"
        Write-Host "Check the logs with: $dockerComposeCmd logs"
        exit 1
    }
}

Write-Host ""
Write-Info "Configuration saved in $envFile"
Write-Host ""
