# Telkom Contract Extractor - Documentation

Welcome to the documentation for the **Telkom Contract Data Extractor & Management System**.

## Quick Links

| Document | Description |
|----------|-------------|
| [Project Overview](./01-PROJECT-OVERVIEW.md) | What this project does and why |
| [Local Development Setup](./02-LOCAL-DEVELOPMENT-SETUP.md) | Get the app running on your machine |
| [Database Setup](./03-DATABASE-SETUP.md) | Database configuration and restoration |
| [Architecture](./04-ARCHITECTURE.md) | How the codebase is structured |
| [Deployment Guide](./05-DEPLOYMENT-GUIDE.md) | Production deployment instructions |

## Getting Started (5-Minute Guide)

### Prerequisites
- Conda with `ocr-v3` environment
- Docker (for PostgreSQL)
- Node.js 18+

### Start the Application

```bash
# 1. Start database
docker-compose up postgres -d

# 2. Start backend (new terminal)
source ~/.zshrc
conda activate ocr-v3
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 3. Start frontend (new terminal)
cd frontend
npm install
npm run dev

# 4. Open browser
# http://localhost:5173
# Login: paycol / paycol123
```

### Restore Database with Sample Data

```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d telkom_contracts < docs/initial_db_dump.sql
```

---

## Handover Information

### Project Status (January 2026)

| Component | Status |
|-----------|--------|
| Core OCR Pipeline | ✅ Complete |
| Upload & Processing | ✅ Complete |
| Review Interface | ✅ Complete |
| Contract Management | ✅ Complete |
| Master Data (Backbone) | ✅ Complete |
| Invoice Management | ✅ Complete |
| **Deployment** | ⏳ **Pending server availability** |

### What's Included

1. **Fully functional application** - All features implemented and tested
2. **Database snapshot** - `initial_db_dump.sql` with sample data
3. **Conda environment export** - `ocr-v3-environment.yml` (Python 3.10 + 168 packages)
4. **Docker configuration** - Production-ready Dockerfiles
5. **Comprehensive documentation** - This docs folder

### What Needs to Be Done

1. **Server Allocation** - Request a production server from IT
2. **SSL Certificate** - Set up HTTPS with Let's Encrypt
3. **Domain Configuration** - Point domain to server
4. **Production Deployment** - Follow [Deployment Guide](./05-DEPLOYMENT-GUIDE.md)
5. **User Training** - Train end users on the system

### Test Credentials

| Username | Password | Role |
|----------|----------|------|
| `paycol` | `paycol123` | MANAGER |
| `petugas` | `petugas123` | STAFF |

---

## Files in This Directory

```
docs/
├── README.md                    # This file (documentation index)
├── 01-PROJECT-OVERVIEW.md       # Project summary and features
├── 02-LOCAL-DEVELOPMENT-SETUP.md # Dev environment setup guide
├── 03-DATABASE-SETUP.md         # Database configuration guide
├── 04-ARCHITECTURE.md           # Codebase structure explanation
├── 05-DEPLOYMENT-GUIDE.md       # Production deployment instructions
├── initial_db_dump.sql          # Database snapshot with sample data (135 KB)
├── ocr-v3-environment.yml       # Conda environment export (Python 3.10 + 168 packages)
└── ocr-v3-requirements.txt      # Pip freeze output for reference
```

---

## Additional Resources

### In the Project Root

- **`CLAUDE.md`** - Comprehensive development guidelines and conventions
- **`DOCKER.md`** - Docker-specific documentation
- **`docker-compose.yml`** - Development Docker configuration

### External Documentation

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [PaddleOCR Documentation](https://paddlepaddle.github.io/PaddleOCR/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Alembic Documentation](https://alembic.sqlalchemy.org/)

---

## Contact

This project was developed during an internship period. For questions about:

- **Codebase & Architecture**: Check `CLAUDE.md` and this documentation
- **Business Requirements**: Contact the project stakeholders at Telkom
- **Infrastructure**: Contact IT department for server access

---

## Changelog

### January 2026
- Initial documentation suite created
- Database snapshot exported
- Handover preparation completed

---

*Documentation last updated: January 2026*
