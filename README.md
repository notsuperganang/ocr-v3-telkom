<p align="center">
  <img src="https://raw.githubusercontent.com/notsuperganang/ocr-v3-telkom/refs/heads/main/frontend/src/assets/logo-telkom-horizontal.png" alt="Telkom Indonesia" width="400"/>
</p>

<h1 align="center">📄 Telkom Contract Data Extractor</h1>

<p align="center">
  <strong>AI-Powered Contract Document Processing with Human-in-the-Loop Validation</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#demo">Demo</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#installation">Installation</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#api-documentation">API</a> •
  <a href="#acknowledgments">Acknowledgments</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10-blue?style=for-the-badge&logo=python&logoColor=white" alt="Python"/>
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/PaddleOCR-PP--StructureV3-blue?style=for-the-badge" alt="PaddleOCR"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Completed-success?style=flat-square" alt="Status"/>
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License"/>
  <img src="https://img.shields.io/github/last-commit/notsuperganang/ocr-v3-telkom?style=flat-square" alt="Last Commit"/>
</p>

---

## 🎯 About The Project

**Telkom Contract Data Extractor** is a full-stack web application designed to automate the extraction of structured data from Indonesian Telkom contract PDF documents. Built during my internship at **PT Telkom Indonesia**, this system leverages cutting-edge OCR technology (PaddleOCR PP-StructureV3) combined with a human-in-the-loop validation workflow to ensure data accuracy and reliability.

### The Problem

Telkom Indonesia handles thousands of contract documents annually. Previously, data from these contracts was manually extracted and entered into spreadsheets—a time-consuming, error-prone process that consumed valuable human resources.

### The Solution

This application provides:

- **🤖 Automated OCR Extraction** - Intelligent document processing using PP-StructureV3
- **👁️ Human Validation Interface** - Split-view review system for accuracy verification
- **📊 Contract Management** - Complete lifecycle management from upload to export
- **💰 Invoice Tracking** - Payment management with Indonesian tax calculation (PPh 23 & PPN)
- **📈 Analytics Dashboard** - Real-time KPIs and contract statistics

---

## ✨ Features

### Document Processing Pipeline
```
📤 Upload → 🔍 OCR Process → 📝 Data Extraction → 👀 Human Review → ✅ Confirmation → 📁 Contract
```

| Feature | Description |
|---------|-------------|
| **Batch Upload** | Upload multiple PDF contracts simultaneously with drag-and-drop |
| **Smart OCR** | PP-StructureV3 extracts text and tables with high accuracy |
| **Regex Extraction** | Sophisticated pattern matching for Indonesian contract formats |
| **Split-View Review** | PDF viewer (left) + editable form (right) for easy validation |
| **Excel Export** | Export confirmed contracts to structured Excel files |

### Contract Management
- 📋 **Contract Registry** - Searchable, filterable list with pagination
- 🔗 **Account Linking** - Link contracts to master client data
- 📅 **Payment Tracking** - Termin payment schedules with auto-status (PENDING/DUE/OVERDUE/PAID)
- 🧾 **Invoice Management** - Full lifecycle with tax calculation

### Master Data (Backbone)
- 👥 **Accounts** - Client master data management
- 🏢 **Segments** - Regional 1-7, Enterprise, Government, SME
- 📍 **Witels** - Regional office codes
- 👔 **Account Managers** - Telkom AM contact information

### Invoice System (Phase 2)
- 💳 **Payment Recording** - Support partial payments
- 📄 **Document Upload** - BUPOT, Faktur Pajak, payment receipts
- 🧮 **Auto Tax Calculation** - PPh 23 (2%) & PPN (11%) computed automatically
- 📊 **Status Tracking** - DRAFT → SENT → PARTIALLY_PAID → PAID workflow

---

### Application Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    DOCUMENT PROCESSING PIPELINE                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. UPLOAD          2. OCR PROCESS       3. EXTRACTION          │
│  ┌─────────┐       ┌─────────────┐      ┌─────────────┐         │
│  │  PDF    │ ───►  │ PP-Structure│ ───► │   Regex +   │         │
│  │ Upload  │       │     V3      │      │   Fuzzy     │         │
│  └─────────┘       └─────────────┘      └─────────────┘         │
│                                                │                │
│                                                ▼                │
│  4. REVIEW          5. CONFIRM           6. CONTRACT            │
│  ┌─────────────┐   ┌─────────────┐      ┌─────────────┐         │
│  │ Split-View  │ ► │   Human     │ ───► │   Final     │         │
│  │  PDF+Form   │   │  Approval   │      │   Record    │         │
│  └─────────────┘   └─────────────┘      └─────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **Python 3.10** | Core programming language |
| **FastAPI** | High-performance API framework |
| **PaddleOCR PP-StructureV3** | Document structure analysis & OCR |
| **SQLAlchemy** | ORM for database operations |
| **Alembic** | Database migration management |
| **PostgreSQL 15** | Primary database |
| **JWT** | Authentication & authorization |
| **Pydantic** | Data validation & serialization |

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18** | UI library |
| **TypeScript** | Type-safe JavaScript |
| **Vite** | Build tool & dev server |
| **Tailwind CSS** | Utility-first styling |
| **React Query** | Server state management |
| **React Hook Form + Zod** | Form handling & validation |
| **Radix UI** | Accessible component primitives |
| **React PDF** | PDF viewing in browser |

### DevOps
| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization |
| **Docker Compose** | Multi-container orchestration |
| **Nginx** | Reverse proxy & static serving |

---

## 🚀 Installation

### Prerequisites

- **Conda** (Miniconda/Anaconda)
- **Node.js** 18+
- **Docker** & Docker Compose
- **Git**

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/notsuperganang/ocr-v3-telkom.git
cd ocr-v3-telkom

# 2. Start PostgreSQL
docker-compose up postgres -d

# 3. Setup Backend
source ~/.zshrc
conda env create -f docs/ocr-v3-environment.yml  # Or: conda activate ocr-v3
conda activate ocr-v3
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 4. Setup Frontend (new terminal)
cd frontend
npm install
npm run dev

# 5. Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Test Credentials

| Username | Password | Role |
|----------|----------|------|
| `paycol` | `paycol123` | MANAGER |
| `petugas` | `petugas123` | STAFF |

### Restore Sample Data (Optional)

```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d telkom_contracts < docs/initial_db_dump.sql
```

---

## 📁 Project Structure

```
telkom-contract-extractor/
├── backend/                    # FastAPI Backend
│   ├── app/
│   │   ├── api/               # API route modules
│   │   ├── auth/              # JWT authentication
│   │   ├── models/            # SQLAlchemy & Pydantic models
│   │   ├── services/          # Business logic (OCR, extraction)
│   │   ├── main.py            # FastAPI entry point
│   │   └── config.py          # Configuration
│   ├── alembic/               # Database migrations
│   └── requirements.txt       # Python dependencies
│
├── frontend/                   # React Frontend
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/             # Route pages
│   │   ├── services/          # API client
│   │   ├── hooks/             # Custom hooks
│   │   └── types/             # TypeScript definitions
│   └── package.json           # Node dependencies
│
├── docs/                       # Documentation & Handover
│   ├── 01-PROJECT-OVERVIEW.md
│   ├── 02-LOCAL-DEVELOPMENT-SETUP.md
│   ├── 03-DATABASE-SETUP.md
│   ├── 04-ARCHITECTURE.md
│   ├── 05-DEPLOYMENT-GUIDE.md
│   ├── initial_db_dump.sql    # Database snapshot
│   └── ocr-v3-environment.yml # Conda environment
│
├── docker-compose.yml         # Docker orchestration
├── CLAUDE.md                  # Development guidelines
└── README.md                  # This file
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser)                              │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    React Frontend (Vite)                         │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     │   │
│  │  │Dashboard│ │ Upload  │ │ Review  │ │Contracts│ │ Invoices│     │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                 │ HTTP/REST                             │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  │
┌─────────────────────────────────┼───────────────────────────────────────┐
│                           SERVER                                        │
│  ┌──────────────────────────────┼───────────────────────────────────┐   │
│  │                    FastAPI Backend                               │   │
│  │  ┌─────────────────────────────────────────────────────────────┐ │   │
│  │  │  API Routes → Service Layer → SQLAlchemy ORM → PostgreSQL   │ │   │
│  │  └─────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    PaddleOCR (PP-StructureV3)                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📚 API Documentation

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/login` | User authentication |
| `POST` | `/api/upload` | Upload PDF files |
| `GET` | `/api/processing/{id}/data` | Get extracted data |
| `PATCH` | `/api/processing/{id}/data` | Save edited data |
| `POST` | `/api/processing/{id}/confirm` | Confirm & create contract |
| `GET` | `/api/contracts` | List contracts (paginated) |
| `GET` | `/api/contracts/{id}` | Get contract details |
| `POST` | `/api/invoices/{type}/{id}/payments` | Record payment |

### Data Extracted

```json
{
  "informasi_pelanggan": {
    "nama_sekolah": "SMK Negeri 1 Example",
    "npwp": "00.000.000.0-000.000",
    "alamat": "Jl. Example No. 123"
  },
  "layanan_utama": {
    "connectivity": 5,
    "non_connectivity": 3,
    "bundling": 2
  },
  "tata_cara_pembayaran": {
    "metode": "TERMIN",
    "termin_payments": [...]
  },
  "jangka_waktu": {
    "tanggal_mulai": "2025-01-01",
    "tanggal_selesai": "2025-12-31"
  }
}
```

Full API documentation available at `/docs` when running the backend.

---

## 📖 Documentation

Comprehensive documentation is available in the `/docs` folder:

| Document | Description |
|----------|-------------|
| [Project Overview](docs/01-PROJECT-OVERVIEW.md) | Complete project summary |
| [Local Development Setup](docs/02-LOCAL-DEVELOPMENT-SETUP.md) | Step-by-step dev guide |
| [Database Setup](docs/03-DATABASE-SETUP.md) | Database configuration |
| [Architecture](docs/04-ARCHITECTURE.md) | System design & patterns |
| [Deployment Guide](docs/05-DEPLOYMENT-GUIDE.md) | Production deployment |

---

## 🎓 About This Project

This project was developed as part of my internship at **PT Telkom Indonesia** through the **Digistar Class Intern Program Batch 3 2025**.

### Internship Details

| | |
|---|---|
| **Program** | Digistar Class Intern Batch 3 2025 |
| **Company** | PT Telkom Indonesia (Persero) Tbk |
| **Division** | Payment Collection |
| **Period** | 2025 |
| **Role** | Software Developer Intern |

### Project Status

| Component | Status |
|-----------|--------|
| Core OCR Pipeline | ✅ Complete |
| Upload & Processing | ✅ Complete |
| Review Interface | ✅ Complete |
| Contract Management | ✅ Complete |
| Master Data (Backbone) | ✅ Complete |
| Invoice Management | ✅ Complete |
| Production Deployment | ⏳ Pending Server |

---

## 🙏 Acknowledgments

<p align="center">
  <img src="https://github.com/notsuperganang/ocr-v3-telkom/blob/main/frontend/src/assets/logo-telkom.png?raw=true" alt="Telkom Indonesia" width="200"/>
</p>

### Special Thanks

I would like to express my sincere gratitude to:

- **PT Telkom Indonesia (Persero) Tbk** - For providing this incredible opportunity to work on a real-world enterprise project and for the invaluable learning experience during my internship.

- **Digistar Class Program** - For creating a structured internship program that bridges academic learning with industry practice.

- **My Mentors & Supervisors** - For their guidance, patience, and expertise throughout the development of this project.

- **The Payment Collection Team** - For the domain knowledge, requirements, and continuous feedback that shaped this solution.

---

## 👨‍💻 Author

<p align="center">
  <img src="https://github.com/notsuperganang.png" width="150" style="border-radius: 50%"/>
</p>

<h3 align="center">Ganang Setyo Hadi</h3>

<p align="center">
  <a href="https://github.com/notsuperganang">
    <img src="https://img.shields.io/badge/GitHub-notsuperganang-181717?style=for-the-badge&logo=github" alt="GitHub"/>
  </a>
</p>

<p align="center">
  <em>Fullstack Developer Intern at Telkom Indonesia</em><br/>
  <em>Digistar Class Batch 3 2025</em>
</p>

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>Built with ❤️ during my internship at Telkom Indonesia</strong>
</p>

<p align="center">
  <img src="https://github.com/notsuperganang/ocr-v3-telkom/blob/main/frontend/src/assets/icon-telkom.png?raw=true" alt="Telkom" width="50"/>
</p>

<p align="center">
  <sub>© 2025 Ganang Setyo Hadi | Digistar Class Intern Program Batch 3</sub>
</p>
