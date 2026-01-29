# Deployment Guide

This guide covers deploying the Telkom Contract Extractor to a production server.

## Deployment Status

| Component | Status | Notes |
|-----------|--------|-------|
| Application Code | ✅ Ready | Fully functional |
| Docker Configuration | ✅ Ready | Production Dockerfiles included |
| Database Migrations | ✅ Ready | Alembic migrations tested |
| Server | ⏳ Pending | Waiting for server allocation |

---

## Prerequisites

### Server Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 4 cores | 8 cores |
| RAM | 8 GB | 16 GB |
| Storage | 50 GB SSD | 100 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### Software Requirements

- Docker 20.10+
- Docker Compose 2.0+
- Nginx (reverse proxy)
- SSL Certificate (Let's Encrypt)

---

## Deployment Options

### Option 1: Docker Compose (Recommended)

The project includes production-ready Docker configuration.

### Option 2: Manual Deployment

Deploy backend and frontend separately with systemd services.

### Option 3: Cloud Platform

Deploy to AWS, GCP, or Azure using managed services.

---

## Docker Compose Deployment

### Step 1: Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### Step 2: Clone Repository

```bash
# Clone to server
git clone <repository-url> /opt/telkom-contract-extractor
cd /opt/telkom-contract-extractor
```

### Step 3: Configure Environment

```bash
# Create production environment file
cp .env.example .env
nano .env
```

**Production .env Configuration:**

```env
# Database (use strong passwords!)
POSTGRES_DB=telkom_contracts
POSTGRES_USER=telkom_prod
POSTGRES_PASSWORD=<generate-strong-password-here>
POSTGRES_PORT=5432

# Backend
BACKEND_PORT=8000
DEBUG=false

# CRITICAL: Generate a secure JWT secret
# Use: openssl rand -hex 32
JWT_SECRET_KEY=<your-256-bit-secret-key>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_HOURS=24

# File Settings
MAX_FILE_SIZE=52428800

# OCR
USE_GPU=false  # Set true if GPU available
OCR_LANG=id

# Frontend
FRONTEND_PORT=3000
VITE_API_BASE_URL=https://your-domain.com

# CORS (production domains only)
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

### Step 4: Create Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: telkom_postgres
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - telkom_network
    restart: always
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: production
    container_name: telkom_backend
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      JWT_ALGORITHM: ${JWT_ALGORITHM}
      MAX_FILE_SIZE: ${MAX_FILE_SIZE}
      USE_GPU: ${USE_GPU}
      CORS_ORIGINS: ${CORS_ORIGINS}
    volumes:
      - backend_storage:/app/storage
      - backend_logs:/app/logs
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - telkom_network
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      target: production
      args:
        VITE_API_BASE_URL: ${VITE_API_BASE_URL}
    container_name: telkom_frontend
    networks:
      - telkom_network
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:1.25-alpine
    container_name: telkom_nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - certbot_webroot:/var/www/certbot:ro
    depends_on:
      - frontend
      - backend
    networks:
      - telkom_network
    restart: always

  # Certbot for SSL (optional, run periodically)
  certbot:
    image: certbot/certbot
    container_name: telkom_certbot
    volumes:
      - ./nginx/ssl:/etc/letsencrypt
      - certbot_webroot:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
    profiles:
      - ssl

volumes:
  postgres_data:
  backend_storage:
  backend_logs:
  certbot_webroot:

networks:
  telkom_network:
    driver: bridge
```

### Step 5: Create Nginx Configuration

Create `nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    # Upstream servers
    upstream backend {
        server backend:8000;
    }

    upstream frontend {
        server frontend:80;
    }

    # HTTP server (redirect to HTTPS)
    server {
        listen 80;
        server_name your-domain.com www.your-domain.com;

        # Certbot challenge
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        # Redirect all HTTP to HTTPS
        location / {
            return 301 https://$host$request_uri;
        }
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name your-domain.com www.your-domain.com;

        # SSL certificates
        ssl_certificate /etc/nginx/ssl/live/your-domain.com/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/live/your-domain.com/privkey.pem;

        # SSL configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_prefer_server_ciphers on;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # API routes
        location /api {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # File upload size
            client_max_body_size 50M;
        }

        # Auth routes
        location /auth {
            limit_req zone=api burst=5 nodelay;
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # Health check
        location /health {
            proxy_pass http://backend;
        }

        # API docs (consider restricting in production)
        location /docs {
            proxy_pass http://backend;
        }

        location /openapi.json {
            proxy_pass http://backend;
        }

        # Frontend (catch-all)
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
```

### Step 6: SSL Certificate Setup

```bash
# Create nginx directories
mkdir -p nginx/ssl

# Initial certificate (before HTTPS is configured)
# First, comment out the HTTPS server block in nginx.conf

# Start services
docker-compose -f docker-compose.prod.yml up -d postgres nginx

# Get certificate
docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    -d your-domain.com \
    -d www.your-domain.com \
    --email your-email@example.com \
    --agree-tos \
    --no-eff-email

# Now uncomment the HTTPS server block and restart
docker-compose -f docker-compose.prod.yml restart nginx
```

### Step 7: Build and Deploy

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head

# (Optional) Restore initial data
docker-compose -f docker-compose.prod.yml exec -T postgres \
    psql -U telkom_prod -d telkom_contracts < docs/initial_db_dump.sql

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Step 8: Verify Deployment

```bash
# Health check
curl https://your-domain.com/health

# Test login
curl -X POST https://your-domain.com/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username": "paycol", "password": "paycol123"}'
```

---

## Manual Deployment (Alternative)

If Docker is not available, deploy components manually.

### Backend Deployment

```bash
# 1. Install system dependencies
sudo apt install -y python3.10 python3.10-venv python3-pip \
    libgl1-mesa-glx libglib2.0-0 libsm6 libxext6 libxrender-dev \
    libpoppler-cpp-dev poppler-utils postgresql-client

# 2. Create application directory
sudo mkdir -p /opt/telkom-backend
sudo chown $USER:$USER /opt/telkom-backend

# 3. Copy backend code
cp -r backend/* /opt/telkom-backend/

# 4. Create virtual environment
cd /opt/telkom-backend
python3.10 -m venv venv
source venv/bin/activate

# 5. Install dependencies
pip install -r requirements.txt

# 6. Configure environment
cp .env.example .env
nano .env  # Edit with production values

# 7. Create systemd service
sudo nano /etc/systemd/system/telkom-backend.service
```

**Systemd Service File:**

```ini
[Unit]
Description=Telkom Contract Extractor Backend
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/telkom-backend
Environment="PATH=/opt/telkom-backend/venv/bin"
ExecStart=/opt/telkom-backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable telkom-backend
sudo systemctl start telkom-backend
sudo systemctl status telkom-backend
```

### Frontend Deployment

```bash
# 1. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 2. Build frontend
cd frontend
npm ci
VITE_API_BASE_URL=https://your-domain.com npm run build

# 3. Copy build to web server
sudo mkdir -p /var/www/telkom-frontend
sudo cp -r dist/* /var/www/telkom-frontend/
sudo chown -R www-data:www-data /var/www/telkom-frontend
```

---

## Post-Deployment Checklist

### Security Checklist

- [ ] Strong database password configured
- [ ] JWT secret key is cryptographically secure (256-bit)
- [ ] SSL/TLS certificate installed and valid
- [ ] CORS origins restricted to production domains
- [ ] API docs restricted or disabled in production
- [ ] Firewall configured (only 80, 443 exposed)
- [ ] SSH key authentication only (disable password auth)
- [ ] Automatic security updates enabled

### Operations Checklist

- [ ] Health checks configured
- [ ] Log rotation configured
- [ ] Backup schedule configured
- [ ] Monitoring/alerting set up
- [ ] SSL certificate auto-renewal configured
- [ ] Disaster recovery plan documented

### Application Checklist

- [ ] Database migrations applied
- [ ] Initial data loaded (if needed)
- [ ] Test users changed or removed
- [ ] File upload limits appropriate
- [ ] Email notifications configured (future)

---

## Backup Strategy

### Database Backup

```bash
# Create backup script
cat > /opt/backup/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backup/db"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER="telkom_postgres"

mkdir -p $BACKUP_DIR
docker exec $CONTAINER pg_dump -U telkom_prod telkom_contracts > $BACKUP_DIR/backup_$DATE.sql
gzip $BACKUP_DIR/backup_$DATE.sql

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
EOF

chmod +x /opt/backup/backup-db.sh

# Add to crontab (daily at 2 AM)
echo "0 2 * * * /opt/backup/backup-db.sh" | crontab -
```

### File Storage Backup

```bash
# Backup uploaded files and exports
rsync -avz /var/lib/docker/volumes/telkom_backend_storage/_data/ /opt/backup/storage/
```

---

## Monitoring

### Basic Monitoring with Docker

```bash
# Container status
docker-compose -f docker-compose.prod.yml ps

# Resource usage
docker stats

# Logs
docker-compose -f docker-compose.prod.yml logs -f --tail=100
```

### Application Health Endpoint

The `/health` endpoint provides:
- Application status
- Database connectivity
- OCR service status

```bash
# Check health
curl -s https://your-domain.com/health | jq
```

### Recommended Monitoring Tools

- **Uptime Monitoring**: UptimeRobot, Pingdom
- **Log Aggregation**: Loki + Grafana, ELK Stack
- **Metrics**: Prometheus + Grafana
- **Error Tracking**: Sentry

---

## Troubleshooting Production Issues

### Container Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs backend

# Check health
docker inspect telkom_backend | jq '.[0].State'

# Restart service
docker-compose -f docker-compose.prod.yml restart backend
```

### Database Connection Issues

```bash
# Check postgres is running
docker-compose -f docker-compose.prod.yml ps postgres

# Check connection from backend
docker-compose -f docker-compose.prod.yml exec backend python -c "
from app.database import engine
with engine.connect() as conn:
    print('Connection successful')
"
```

### SSL Certificate Issues

```bash
# Check certificate
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# Renew certificate
docker-compose -f docker-compose.prod.yml run --rm certbot renew

# Restart nginx after renewal
docker-compose -f docker-compose.prod.yml restart nginx
```

### High Memory Usage

```bash
# Check memory per container
docker stats --no-stream

# Restart high-memory container
docker-compose -f docker-compose.prod.yml restart backend
```

---

## Scaling Considerations

### Horizontal Scaling

For high traffic, consider:

1. **Load Balancer**: Add nginx or cloud load balancer
2. **Multiple Backend Instances**: Run multiple uvicorn workers
3. **Database Replication**: PostgreSQL read replicas
4. **File Storage**: Move to S3/MinIO for distributed storage
5. **Redis Cache**: Add caching layer for frequently accessed data

### GPU for OCR

If OCR performance is critical:

```yaml
# docker-compose.prod.yml
backend:
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
  environment:
    USE_GPU: "true"
```

---

## Maintenance Procedures

### Rolling Updates

```bash
# Pull latest code
git pull

# Build new images
docker-compose -f docker-compose.prod.yml build

# Rolling restart (one container at a time)
docker-compose -f docker-compose.prod.yml up -d --no-deps backend
docker-compose -f docker-compose.prod.yml up -d --no-deps frontend
```

### Database Migrations

```bash
# Backup first!
/opt/backup/backup-db.sh

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head

# Verify
docker-compose -f docker-compose.prod.yml exec backend alembic current
```

### SSL Certificate Renewal

Certbot auto-renews, but verify:

```bash
# Check certificate expiry
echo | openssl s_client -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates

# Manual renewal if needed
docker-compose -f docker-compose.prod.yml run --rm certbot renew
docker-compose -f docker-compose.prod.yml restart nginx
```

---

## Contact & Support

For deployment issues:

1. Check this documentation first
2. Review logs: `docker-compose logs -f`
3. Check `CLAUDE.md` for application-specific details
4. Contact the previous development team

---

## Appendix: Quick Reference

### Useful Commands

```bash
# Start production
docker-compose -f docker-compose.prod.yml up -d

# Stop production
docker-compose -f docker-compose.prod.yml down

# View logs
docker-compose -f docker-compose.prod.yml logs -f backend

# Restart service
docker-compose -f docker-compose.prod.yml restart backend

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head

# Database shell
docker-compose -f docker-compose.prod.yml exec postgres psql -U telkom_prod -d telkom_contracts

# Backup database
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U telkom_prod telkom_contracts > backup.sql
```

### Important Paths

| Path | Description |
|------|-------------|
| `/opt/telkom-contract-extractor` | Application root |
| `./docker-compose.prod.yml` | Production compose file |
| `./nginx/nginx.conf` | Nginx configuration |
| `./nginx/ssl/` | SSL certificates |
| `/var/lib/docker/volumes/` | Docker volumes |

### Important URLs

| URL | Description |
|-----|-------------|
| `https://your-domain.com` | Application frontend |
| `https://your-domain.com/health` | Health check endpoint |
| `https://your-domain.com/docs` | API documentation |
| `https://your-domain.com/api/...` | API endpoints |
