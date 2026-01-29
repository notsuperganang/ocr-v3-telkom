# Docker Deployment Guide

This document provides comprehensive instructions for running the Telkom Contract Extractor application using Docker.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Services](#services)
- [Development Workflow](#development-workflow)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)

## Prerequisites

- **Docker**: Version 20.10 or higher
- **Docker Compose**: Version 2.0 or higher
- **System Requirements**:
  - Minimum 4GB RAM
  - 10GB free disk space
  - Linux, macOS, or Windows with WSL2

### Installation

**Linux (Ubuntu/Debian)**:
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Add user to docker group (optional)
sudo usermod -aG docker $USER
```

**macOS**:
```bash
# Install Docker Desktop from https://www.docker.com/products/docker-desktop
# Docker Compose is included
```

**Windows**:
- Install Docker Desktop from https://www.docker.com/products/docker-desktop
- Enable WSL2 backend

## Quick Start

### 1. Clone and Configure

```bash
# Navigate to project directory
cd telkom-contract-extractor

# Create environment file
cp .env.example .env

# Edit .env with your configuration
nano .env  # or use your preferred editor
```

### 2. Start All Services

```bash
# Start all services (postgres, backend, frontend)
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

### 3. Initialize Database

```bash
# Run database migrations
docker-compose exec backend alembic upgrade head

# Verify database connection
docker-compose exec postgres psql -U postgres -d telkom_contracts -c "\dt"
```

### 4. Access Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

### 5. Login with Test Users

- **Manager**: `paycol` / `paycol123`
- **Staff**: `petugas` / `petugas123`

## Configuration

### Environment Variables

The `.env` file contains all configuration. Key variables:

```env
# Database
POSTGRES_DB=telkom_contracts
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_PORT=5432

# Backend
BACKEND_PORT=8000
JWT_SECRET_KEY=change-this-in-production

# Frontend
FRONTEND_PORT=5173
VITE_API_BASE_URL=http://localhost:8000

# OCR
USE_GPU=false  # Set to true if GPU available
OCR_LANG=id    # Indonesian language
```

### Security Configuration

**IMPORTANT**: Before deploying to production:

1. **Change JWT Secret**: Generate a strong random key
   ```bash
   openssl rand -hex 32
   ```

2. **Update Database Credentials**: Use strong passwords

3. **Configure CORS**: Set specific allowed origins
   ```env
   CORS_ORIGINS=https://your-domain.com
   ```

## Services

### PostgreSQL Database

- **Image**: `postgres:15-alpine`
- **Port**: 5432
- **Data**: Persisted in `postgres_data` volume
- **Health Check**: Automatic with 10s interval

```bash
# Access PostgreSQL shell
docker-compose exec postgres psql -U postgres -d telkom_contracts

# Backup database
docker-compose exec postgres pg_dump -U postgres telkom_contracts > backup.sql

# Restore database
docker-compose exec -T postgres psql -U postgres telkom_contracts < backup.sql
```

### Backend (FastAPI)

- **Base Image**: `python:3.10-slim`
- **Port**: 8000
- **Build Context**: `./backend`
- **Features**:
  - PaddleOCR integration
  - JWT authentication
  - Database migrations
  - File upload handling

```bash
# View backend logs
docker-compose logs -f backend

# Execute commands in backend
docker-compose exec backend python -c "print('Hello from backend')"

# Run database migrations
docker-compose exec backend alembic upgrade head

# Create new migration
docker-compose exec backend alembic revision --autogenerate -m "description"

# Run backend tests
docker-compose exec backend pytest

# Access backend shell
docker-compose exec backend bash
```

### Frontend (React + Vite)

- **Base Image**: `node:20-alpine`
- **Port**: 5173 (dev) / 80 (production)
- **Build Context**: `./frontend`
- **Features**:
  - Hot module replacement
  - Optimized production builds with Nginx
  - Responsive design

```bash
# View frontend logs
docker-compose logs -f frontend

# Rebuild frontend
docker-compose up -d --build frontend

# Access frontend shell
docker-compose exec frontend sh

# Install new npm package
docker-compose exec frontend npm install <package-name>
```

### PgAdmin (Optional)

PgAdmin is available as an optional tool for database management.

```bash
# Start with PgAdmin
docker-compose --profile tools up -d

# Access PgAdmin
# URL: http://localhost:5050
# Email: admin@telkom.local (from .env)
# Password: admin (from .env)
```

**Connect to Database in PgAdmin**:
1. Right-click "Servers" → "Register" → "Server"
2. General tab: Name = "Telkom Contracts"
3. Connection tab:
   - Host: `postgres`
   - Port: `5432`
   - Database: `telkom_contracts`
   - Username: `postgres`
   - Password: `postgres`

## Development Workflow

### Starting Development Environment

```bash
# Start all services in detached mode
docker-compose up -d

# Watch logs for all services
docker-compose logs -f

# Watch logs for specific service
docker-compose logs -f backend
```

### Hot Reload

Both backend and frontend support hot reload:

- **Backend**: Code changes in `backend/app/` trigger automatic reload
- **Frontend**: Code changes in `frontend/src/` trigger HMR

### Rebuilding Services

```bash
# Rebuild all services
docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build backend

# Force rebuild without cache
docker-compose build --no-cache backend
```

### Running Commands

```bash
# Backend: Run Python script
docker-compose exec backend python scripts/test_default.py

# Backend: Install new package
docker-compose exec backend pip install <package-name>
# Then add to requirements.txt and rebuild

# Frontend: Install new package
docker-compose exec frontend npm install <package-name>

# Frontend: Run linter
docker-compose exec frontend npm run lint
```

### Database Operations

```bash
# Create migration
docker-compose exec backend alembic revision --autogenerate -m "add new table"

# Apply migrations
docker-compose exec backend alembic upgrade head

# Rollback migration
docker-compose exec backend alembic downgrade -1

# View migration history
docker-compose exec backend alembic history

# Reset database (WARNING: destroys all data)
docker-compose down -v
docker-compose up -d
docker-compose exec backend alembic upgrade head
```

## Production Deployment

### Build Production Images

```bash
# Build production backend
docker-compose -f docker-compose.prod.yml build backend

# Build production frontend
docker-compose -f docker-compose.prod.yml build frontend
```

### Production Configuration

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    # ... same as development

  backend:
    build:
      context: ./backend
      target: production
    environment:
      DEBUG: false
      # ... other production settings
    restart: always

  frontend:
    build:
      context: ./frontend
      target: production
    restart: always

  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend
```

### Security Best Practices

1. **Use secrets management**: Store sensitive data in Docker secrets or external vault
2. **Enable HTTPS**: Use Let's Encrypt with Certbot
3. **Configure firewall**: Only expose necessary ports
4. **Update regularly**: Keep Docker images up to date
5. **Monitor logs**: Set up centralized logging
6. **Backup database**: Automated daily backups

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

```bash
# Find process using port 8000
sudo lsof -i :8000

# Kill the process
sudo kill -9 <PID>

# Or change port in .env
BACKEND_PORT=8001
```

#### 2. Backend Won't Start

```bash
# Check logs
docker-compose logs backend

# Common causes:
# - Database not ready: Wait for postgres health check
# - Missing dependencies: Rebuild image
# - Migration errors: Check alembic version
```

#### 3. Database Connection Error

```bash
# Verify postgres is running
docker-compose ps postgres

# Test connection
docker-compose exec backend python -c "from app.database import engine; print(engine)"

# Check DATABASE_URL environment variable
docker-compose exec backend env | grep DATABASE_URL
```

#### 4. Frontend Can't Connect to Backend

```bash
# Check VITE_API_BASE_URL
docker-compose exec frontend env | grep VITE_API_BASE_URL

# Verify backend is accessible
curl http://localhost:8000/health

# Check CORS configuration in backend
```

#### 5. Out of Disk Space

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything (BE CAREFUL!)
docker system prune -a --volumes
```

### Debugging Techniques

```bash
# 1. Check service health
docker-compose ps

# 2. View real-time logs
docker-compose logs -f --tail=100

# 3. Execute shell in container
docker-compose exec backend bash
docker-compose exec frontend sh

# 4. Inspect container
docker inspect telkom_backend

# 5. View resource usage
docker stats

# 6. Check network connectivity
docker-compose exec backend ping postgres
docker-compose exec frontend ping backend
```

## Maintenance

### Regular Maintenance Tasks

```bash
# 1. Update Docker images (weekly)
docker-compose pull
docker-compose up -d

# 2. Backup database (daily)
docker-compose exec postgres pg_dump -U postgres telkom_contracts > backup_$(date +%Y%m%d).sql

# 3. Clean up unused resources (weekly)
docker system prune -f

# 4. Check disk usage
docker system df

# 5. Update application code
git pull
docker-compose up -d --build

# 6. View logs for errors
docker-compose logs --since 24h | grep -i error
```

### Monitoring

```bash
# View resource usage
docker stats telkom_backend telkom_frontend telkom_postgres

# Check container health
docker inspect telkom_backend | jq '.[0].State.Health'

# View log file sizes
docker-compose exec backend du -sh /app/logs/*
```

### Backup and Restore

```bash
# Backup database
docker-compose exec postgres pg_dump -U postgres telkom_contracts > backup.sql

# Backup volumes
docker run --rm \
  -v telkom_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres_data.tar.gz -C /data .

# Restore database
docker-compose exec -T postgres psql -U postgres telkom_contracts < backup.sql

# Restore volume
docker run --rm \
  -v telkom_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/postgres_data.tar.gz -C /data
```

### Performance Tuning

**Backend Optimization**:
```yaml
# Increase worker processes
command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

**PostgreSQL Optimization**:
```yaml
environment:
  POSTGRES_SHARED_BUFFERS: 256MB
  POSTGRES_EFFECTIVE_CACHE_SIZE: 1GB
  POSTGRES_WORK_MEM: 16MB
```

**Resource Limits**:
```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      memory: 1G
```

## Useful Commands Reference

```bash
# Start services
docker-compose up -d                    # Start all services
docker-compose up -d postgres           # Start only postgres
docker-compose --profile tools up -d    # Start with optional tools (pgadmin)

# Stop services
docker-compose stop                     # Stop all services
docker-compose stop backend             # Stop specific service
docker-compose down                     # Stop and remove containers
docker-compose down -v                  # Stop and remove volumes (WARNING!)

# View status
docker-compose ps                       # List running services
docker-compose logs -f                  # Follow logs
docker-compose logs -f --tail=100       # Follow last 100 lines
docker-compose logs backend             # Logs for specific service

# Execute commands
docker-compose exec backend bash        # Access backend shell
docker-compose exec postgres psql       # Access postgres shell
docker-compose exec backend pytest      # Run tests

# Build and rebuild
docker-compose build                    # Build all images
docker-compose build --no-cache         # Build without cache
docker-compose up -d --build            # Rebuild and restart

# Cleanup
docker-compose down --rmi all           # Remove containers and images
docker system prune -a --volumes        # Remove everything (BE CAREFUL!)
```

## Support

For issues and questions:

- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Check CLAUDE.md for detailed project information
- **Logs**: Always check logs first with `docker-compose logs -f`

## License

This Docker configuration is part of the Telkom Contract Extractor project.
