# Project Overview

## Telkom Contract Data Extractor & Management System

### Introduction

The **Telkom Contract Data Extractor** is a full-stack web application designed to automate the extraction of structured data from Indonesian Telkom contract PDF documents. The system uses **PaddleOCR's PP-StructureV3** pipeline for intelligent document processing and features a **human-in-the-loop validation workflow** to ensure data accuracy.

### Purpose

Telkom Indonesia handles thousands of contract documents annually. Previously, data from these contracts was manually extracted and entered into spreadsheets—a time-consuming and error-prone process. This application:

1. **Automates OCR extraction** from contract PDFs
2. **Provides a review interface** for human validation and correction
3. **Manages contract lifecycle** including payment tracking and invoicing
4. **Exports data** to Excel for reporting and integration with other systems

### Key Features

#### Document Processing
- **Batch Upload**: Upload multiple PDF contracts simultaneously
- **OCR Processing**: Automatic text and table extraction using PP-StructureV3
- **Smart Extraction**: Regex patterns and fuzzy matching extract structured data from Indonesian contracts

#### Human-in-the-Loop Validation
- **Split-View Interface**: PDF viewer (left) + editable form (right)
- **Manual Save**: Explicit save action prevents data loss from incomplete input
- **Confirmation Workflow**: Only confirmed data is saved as final contracts

#### Contract Management
- **Contract Registry**: Searchable, filterable list of all confirmed contracts
- **Account Linking**: Contracts linked to master account data
- **Termin Payments**: Track payment schedules with automatic status updates (PENDING/DUE/OVERDUE)

#### Invoice Management (Phase 2)
- **Invoice Lifecycle**: DRAFT → SENT → PAID workflow
- **Tax Handling**: Automatic PPh 23 (2%) and PPN (11%) calculation
- **Payment Tracking**: Record partial payments, upload supporting documents
- **Document Storage**: Store BUPOT, Faktur Pajak, payment receipts

#### Master Data Management
- **Accounts**: Client master data with segment, witel, and account manager assignments
- **Segments**: Client classification (Regional 1-7, Enterprise, Government, SME)
- **Witels**: Regional office reference data
- **Account Managers**: Telkom AM contact information

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS |
| **UI Components** | Radix UI, React Hook Form, Zod |
| **State Management** | React Query (@tanstack/react-query) |
| **Backend** | Python 3.10, FastAPI |
| **OCR Engine** | PaddleOCR PP-StructureV3 |
| **Database** | PostgreSQL 15 |
| **ORM** | SQLAlchemy with Alembic migrations |
| **Authentication** | JWT tokens with role-based access |
| **PDF Viewing** | React PDF |

### User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| **STAFF** | Regular users | Full CRUD on contracts, accounts, invoices |
| **MANAGER** | Supervisors | Same as STAFF (role exists for future permission refinement) |

### Test Users (Pre-seeded)

| Username | Password | Role |
|----------|----------|------|
| `paycol` | `paycol123` | MANAGER |
| `petugas` | `petugas123` | STAFF |

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

### Data Extracted from Contracts

The system extracts the following structured data:

**Customer Information (Informasi Pelanggan)**
- School/Institution name (SMK schools)
- NPWP (Tax ID)
- Address
- Customer representative name and title

**Service Details (Layanan Utama)**
- Connectivity services count
- Non-connectivity services count
- Bundling services count
- Installation cost per service type
- Annual subscription cost per service type

**Payment Information (Tata Cara Pembayaran)**
- Payment method (One-time, Recurring, Termin)
- Termin payment schedule with amounts
- Total contract value

**Contract Duration (Jangka Waktu)**
- Start date
- End date
- Contract period in months

**Contact Information**
- Telkom contact person
- Customer contact persons

### Database Statistics (Current Snapshot)

| Table | Record Count |
|-------|-------------|
| Users | 3 |
| Contracts | 8 |
| Accounts | 134 |
| Segments | 6 |
| Witels | 1 |
| Account Managers | 13 |
| Processing Jobs | 8 |
| Files | 8 |

### Project Status

| Phase | Status | Description |
|-------|--------|-------------|
| Core OCR Pipeline | ✅ Complete | PP-StructureV3 integration working |
| Upload & Processing | ✅ Complete | Batch upload with queue management |
| Review Interface | ✅ Complete | Split-view with form validation |
| Contract Management | ✅ Complete | CRUD with search and filters |
| Master Data (Backbone) | ✅ Complete | Accounts, Segments, Witels, AMs |
| Invoice Management | ✅ Complete | Payment tracking, tax calculation |
| Deployment | ⏳ Pending | Server not yet available |

### Known Limitations

1. **OCR Accuracy**: Complex table layouts may require manual correction
2. **Indonesian Language**: Optimized for Indonesian contracts; other languages untested
3. **PDF Quality**: Low-resolution scans may reduce extraction accuracy
4. **Single Instance**: No horizontal scaling implemented yet

### Future Enhancements (Suggestions)

1. **Dashboard Analytics**: Add charts and visualizations for contract metrics
2. **Email Notifications**: Alert users on payment due dates
3. **Bulk Export**: Export multiple contracts at once
4. **API Integration**: Connect with Telkom's existing systems
5. **Mobile Responsive**: Optimize UI for tablet/mobile use

### Related Documentation

- [Local Development Setup](./02-LOCAL-DEVELOPMENT-SETUP.md)
- [Database Setup](./03-DATABASE-SETUP.md)
- [Architecture Guide](./04-ARCHITECTURE.md)
- [Deployment Guide](./05-DEPLOYMENT-GUIDE.md)
