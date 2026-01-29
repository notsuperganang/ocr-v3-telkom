# Local Development Setup

This guide walks you through setting up the Telkom Contract Extractor for local development.

## Prerequisites

Before starting, ensure you have the following installed:

| Software | Version | Purpose |
|----------|---------|---------|
| **Conda** (Miniconda/Anaconda) | Latest | Python environment management |
| **Node.js** | 18+ | Frontend development |
| **PostgreSQL** | 15+ | Database |
| **Docker** (Optional) | 20+ | Alternative for PostgreSQL |
| **Git** | 2.30+ | Version control |

## Quick Start (TL;DR)

```bash
# 1. Clone the repository
git clone <repository-url>
cd telkom-contract-extractor

# 2. Start PostgreSQL (Docker method)
docker-compose up postgres -d

# 3. Setup and start backend
source ~/.zshrc
conda activate ocr-v3
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 4. Setup and start frontend (new terminal)
cd frontend
npm install
npm run dev

# 5. Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# Login: paycol / paycol123
```

---

## Detailed Setup Instructions

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd telkom-contract-extractor
```

### Step 2: Database Setup

You have two options for PostgreSQL:

#### Option A: Using Docker (Recommended)

```bash
# Start PostgreSQL container
docker-compose up postgres -d

# Verify it's running
docker-compose ps

# Connection details:
# Host: localhost
# Port: 5432
# Database: telkom_contracts
# Username: postgres
# Password: postgres
```

#### Option B: Using Local PostgreSQL

```bash
# Create the database
sudo -u postgres psql

# In PostgreSQL shell:
CREATE DATABASE telkom_contracts;
CREATE USER postgres WITH PASSWORD 'postgres';
GRANT ALL PRIVILEGES ON DATABASE telkom_contracts TO postgres;
\q
```

### Step 3: Backend Setup

#### 3.1 Activate Conda Environment

The project requires a specific Conda environment for PaddleOCR dependencies:

```bash
# Load shell configuration
source ~/.zshrc

# Activate the OCR environment
conda activate ocr-v3
```

> **Important**: The `ocr-v3` environment should already exist on the development machine. If it doesn't, see [Creating the Conda Environment](#creating-the-conda-environment) below.

#### 3.2 Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

#### 3.3 Configure Environment Variables

Create or update the `.env` file in the `backend/` directory:

```bash
# Copy example if available
cp .env.example .env

# Or create manually
cat > .env << 'EOF'
# API Configuration
APP_NAME="Telkom Contract Data Extractor"
VERSION="1.0.0"
HOST="0.0.0.0"
PORT=8000

# File Upload Settings
MAX_FILE_SIZE=52428800
UPLOAD_DIR="uploads"
OUTPUT_DIR="output"

# Logging
LOG_LEVEL="INFO"
LOG_FILE="logs/app.log"

# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/telkom_contracts

# Authentication Configuration
AUTH_USERNAME=paycol
AUTH_PASSWORD=paycol123
JWT_SECRET_KEY=your_jwt_secret_key_change_in_production
EOF
```

#### 3.4 Run Database Migrations

```bash
# Apply all migrations
alembic upgrade head

# Verify tables were created
PGPASSWORD=postgres psql -h localhost -U postgres -d telkom_contracts -c "\dt"
```

#### 3.5 (Optional) Restore Database Snapshot

If you want to start with existing data:

```bash
# Restore the initial database dump
PGPASSWORD=postgres psql -h localhost -U postgres -d telkom_contracts < ../docs/initial_db_dump.sql
```

#### 3.6 Start the Backend Server

```bash
# Start with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# You should see:
# INFO:     Uvicorn running on http://0.0.0.0:8000
# INFO:     Application startup complete.
```

Verify the backend is running:
- Health check: http://localhost:8000/health
- API docs: http://localhost:8000/docs

### Step 4: Frontend Setup

Open a **new terminal** for the frontend:

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will start at http://localhost:5173

### Step 5: Access the Application

1. Open http://localhost:5173 in your browser
2. Login with test credentials:
   - Username: `paycol`
   - Password: `paycol123`

---

## Creating the Conda Environment

If the `ocr-v3` environment doesn't exist, you have three options to create it:

### Option A: Using Exported Environment File (Recommended)

The exact environment used in development has been exported to `docs/ocr-v3-environment.yml`:

```bash
# Navigate to project root
cd telkom-contract-extractor

# Create environment from exported YAML
conda env create -f docs/ocr-v3-environment.yml

# Activate it
source ~/.zshrc
conda activate ocr-v3

# Verify Python version
python --version  # Should show Python 3.10.x
```

### Option B: Using Exported Requirements File

If the YAML method fails, use the pip requirements:

```bash
# Create new environment with Python 3.10
conda create -n ocr-v3 python=3.10 -y

# Activate it
conda activate ocr-v3

# Install all packages from exported requirements
pip install -r docs/ocr-v3-requirements.txt
```

### Option C: Manual Installation (Fresh Setup)

If the exported files don't work on your system:

```bash
# Create new environment with Python 3.10
conda create -n ocr-v3 python=3.10 -y

# Activate it
conda activate ocr-v3

# Install PaddlePaddle (CPU version)
pip install paddlepaddle

# Install PaddleOCR and PaddleX
pip install paddleocr paddlex

# Install project dependencies
cd backend
pip install -r requirements.txt
```

### Exported Environment Files

| File | Description |
|------|-------------|
| `docs/ocr-v3-environment.yml` | Full conda environment export (168 packages) |
| `docs/ocr-v3-requirements.txt` | Pip freeze output for reference |

### System Dependencies for OCR

On Ubuntu/Debian, you may need these system packages regardless of which option you chose:

```bash
sudo apt-get update
sudo apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libpoppler-cpp-dev \
    poppler-utils
```

### Verify Installation

After creating the environment, verify the key packages are installed:

```bash
conda activate ocr-v3
python -c "import paddle; print(f'PaddlePaddle: {paddle.__version__}')"
python -c "import paddleocr; print('PaddleOCR: OK')"
python -c "import fastapi; print(f'FastAPI: {fastapi.__version__}')"
```

---

## Development Commands Reference

### Backend Commands

```bash
# Always activate conda first
source ~/.zshrc
conda activate ocr-v3

# Navigate to backend
cd backend

# Start server (with auto-reload)
uvicorn app.main:app --reload --port 8000

# Run tests
pytest

# Run specific test file
pytest tests/test_invoice_service.py -v

# Code formatting
black app/
isort app/

# Create new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# View migration history
alembic history
```

### Frontend Commands

```bash
cd frontend

# Start development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

### Docker Commands

```bash
# Start PostgreSQL only
docker-compose up postgres -d

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop all services
docker-compose down

# Reset database (WARNING: deletes all data)
docker-compose down -v
docker-compose up postgres -d
```

---

## Environment Variables Reference

### Backend (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_NAME` | Application name | Telkom Contract Data Extractor |
| `VERSION` | App version | 1.0.0 |
| `HOST` | Server host | 0.0.0.0 |
| `PORT` | Server port | 8000 |
| `DATABASE_URL` | PostgreSQL connection string | postgresql://postgres:postgres@localhost:5432/telkom_contracts |
| `JWT_SECRET_KEY` | JWT signing key | (change in production) |
| `MAX_FILE_SIZE` | Max upload size in bytes | 52428800 (50MB) |
| `LOG_LEVEL` | Logging level | INFO |

### Frontend (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API URL | http://localhost:8000 |

---

## Troubleshooting

### "conda: command not found"

```bash
# Ensure conda is initialized
source ~/.zshrc
# or
source ~/.bashrc

# If still not found, reinitialize conda
conda init zsh  # or bash
source ~/.zshrc
```

### "Environment 'ocr-v3' not found"

Create the environment (see [Creating the Conda Environment](#creating-the-conda-environment)).

### Backend won't start - Database connection error

1. Check PostgreSQL is running:
   ```bash
   docker-compose ps postgres
   # or
   pg_isready -h localhost -p 5432
   ```

2. Verify credentials in `.env` match your PostgreSQL setup

3. Ensure database exists:
   ```bash
   PGPASSWORD=postgres psql -h localhost -U postgres -l | grep telkom_contracts
   ```

### OCR service initialization warning

If you see "OCR service initialization warning", this is expected if:
- System dependencies are missing (install them)
- PaddleOCR models need to download (first run takes time)

The app will still work—OCR just won't be available until fixed.

### Frontend can't connect to backend

1. Verify backend is running: http://localhost:8000/health
2. Check `VITE_API_BASE_URL` in frontend `.env`
3. Ensure CORS is configured in backend `app/main.py`

### Port already in use

```bash
# Find process using port 8000
lsof -i :8000

# Kill it
kill -9 <PID>

# Or use a different port
uvicorn app.main:app --reload --port 8001
```

---

## IDE Setup (VS Code Recommended)

### Recommended Extensions

- **Python** (ms-python.python)
- **Pylance** (ms-python.vscode-pylance)
- **ESLint** (dbaeumer.vscode-eslint)
- **Prettier** (esbenp.prettier-vscode)
- **Tailwind CSS IntelliSense** (bradlc.vscode-tailwindcss)

### Workspace Settings

Create `.vscode/settings.json`:

```json
{
  "python.defaultInterpreterPath": "~/miniconda3/envs/ocr-v3/bin/python",
  "python.formatting.provider": "black",
  "editor.formatOnSave": true,
  "[python]": {
    "editor.defaultFormatter": "ms-python.black-formatter"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

---

## Next Steps

1. Read the [Architecture Guide](./04-ARCHITECTURE.md) to understand the codebase structure
2. Review the [Database Setup](./03-DATABASE-SETUP.md) for database details
3. Check `CLAUDE.md` in the project root for comprehensive development guidelines
