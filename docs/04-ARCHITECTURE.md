# Architecture Guide

This document explains the high-level architecture and codebase structure of the Telkom Contract Extractor.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser)                              │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    React Frontend (Vite)                         │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     │   │
│  │  │Dashboard│ │ Upload  │ │ Review  │ │Contracts│ │ Invoices│     │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘     │   │
│  │       │           │           │           │           │          │   │
│  │       └───────────┴───────────┴───────────┴───────────┘          │   │
│  │                              │                                   │   │
│  │                    React Query (State Management)                │   │
│  └──────────────────────────────┼───────────────────────────────────┘   │
│                                 │ HTTP/REST                             │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  │
┌─────────────────────────────────┼───────────────────────────────────────┐
│                           SERVER                                        │
│                                 │                                       │
│  ┌──────────────────────────────┼───────────────────────────────────┐   │
│  │                    FastAPI Backend                               │   │
│  │                              │                                   │   │
│  │  ┌───────────────────────────┴────────────────────────────────┐  │   │
│  │  │                      API Routes                            │  │   │
│  │  │  /auth  /upload  /processing  /contracts  /invoices        │  │   │
│  │  └───────────────────────────┬────────────────────────────────┘  │   │
│  │                              │                                   │   │
│  │  ┌───────────────────────────┴────────────────────────────────┐  │   │
│  │  │                    Service Layer                           │  │   │
│  │  │  ocr_service  data_extractor  invoice_service              │  │   │
│  │  └───────────────────────────┬────────────────────────────────┘  │   │
│  │                              │                                   │   │
│  │  ┌───────────────────────────┴────────────────────────────────┐  │   │
│  │  │               SQLAlchemy ORM + Alembic                     │  │   │
│  │  └───────────────────────────┬────────────────────────────────┘  │   │
│  └──────────────────────────────┼───────────────────────────────────┘   │
│                                 │                                       │
│  ┌──────────────────────────────┼───────────────────────────────────┐   │
│  │                    PostgreSQL Database                           │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     │   │
│  │  │ users   │ │contracts│ │accounts │ │ invoices│ │  files  │     │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    PaddleOCR (PP-StructureV3)                    │   │
│  │                    CPU-optimized inference                       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
telkom-contract-extractor/
├── backend/                    # FastAPI backend application
│   ├── app/
│   │   ├── api/               # API route modules
│   │   │   ├── upload.py      # File upload endpoints
│   │   │   ├── processing.py  # OCR processing endpoints
│   │   │   ├── contracts.py   # Contract CRUD endpoints
│   │   │   ├── invoices.py    # Invoice management endpoints
│   │   │   ├── accounts.py    # Account CRUD endpoints
│   │   │   ├── segments.py    # Segment reference data
│   │   │   ├── witels.py      # Witel reference data
│   │   │   ├── account_managers.py
│   │   │   ├── admin.py       # System statistics
│   │   │   ├── dashboard.py   # Dashboard KPIs
│   │   │   └── users.py       # User management
│   │   │
│   │   ├── auth/              # Authentication module
│   │   │   ├── routes.py      # Login, register endpoints
│   │   │   └── dependencies.py # JWT validation
│   │   │
│   │   ├── models/            # Data models
│   │   │   ├── database.py    # SQLAlchemy models
│   │   │   └── schemas.py     # Pydantic schemas
│   │   │
│   │   ├── services/          # Business logic
│   │   │   ├── ocr_service.py      # PaddleOCR integration
│   │   │   ├── data_extractor.py   # Extraction logic
│   │   │   └── invoice_service.py  # Invoice operations
│   │   │
│   │   ├── core/              # Core utilities
│   │   ├── utils/             # Helper functions
│   │   ├── main.py            # FastAPI app entry point
│   │   ├── config.py          # Configuration
│   │   └── database.py        # Database setup
│   │
│   ├── alembic/               # Database migrations
│   │   └── versions/          # Migration files
│   │
│   ├── storage/               # File storage
│   │   ├── uploads/           # Uploaded PDFs
│   │   ├── processed/         # OCR results
│   │   └── exports/           # Excel exports
│   │
│   ├── logs/                  # Application logs
│   ├── tests/                 # Backend tests
│   ├── requirements.txt       # Python dependencies
│   ├── alembic.ini           # Alembic configuration
│   ├── Dockerfile            # Backend container
│   └── .env                  # Environment variables
│
├── frontend/                   # React frontend application
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── ui/           # Radix UI primitives
│   │   │   ├── forms/        # Form components
│   │   │   └── layout/       # Layout components
│   │   │
│   │   ├── pages/             # Route components
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── UploadPage.tsx
│   │   │   ├── ProcessingPage.tsx
│   │   │   ├── ReviewPage.tsx
│   │   │   ├── ContractsPage.tsx
│   │   │   ├── ContractDetailPage.tsx
│   │   │   ├── ContractEditPage.tsx
│   │   │   ├── InvoicesPage.tsx
│   │   │   ├── AccountsPage.tsx
│   │   │   ├── SegmentsPage.tsx
│   │   │   ├── WitelsPage.tsx
│   │   │   └── AccountManagersPage.tsx
│   │   │
│   │   ├── services/          # API service layer
│   │   │   └── api.ts        # Axios client + endpoints
│   │   │
│   │   ├── hooks/             # Custom React hooks
│   │   ├── context/           # React Context providers
│   │   ├── types/             # TypeScript definitions
│   │   ├── lib/               # Utility functions
│   │   ├── assets/            # Static assets
│   │   ├── App.tsx           # Main app + routing
│   │   └── main.tsx          # Entry point
│   │
│   ├── public/                # Static files
│   ├── package.json          # Node dependencies
│   ├── vite.config.ts        # Vite configuration
│   ├── tailwind.config.js    # Tailwind CSS config
│   ├── tsconfig.json         # TypeScript config
│   ├── Dockerfile            # Frontend container
│   └── nginx.conf            # Production Nginx config
│
├── docs/                       # Documentation (this folder)
├── docker-compose.yml         # Docker orchestration
├── CLAUDE.md                  # Detailed project guidelines
└── README.md                  # Quick start guide
```

---

## Backend Architecture

### Entry Point: `app/main.py`

The FastAPI application is initialized here with:
- CORS middleware configuration
- Router registration
- Lifespan events (startup/shutdown)
- Health check endpoints

```python
# Simplified structure
app = FastAPI(title="Telkom Contract Extractor")

# Middleware
app.add_middleware(CORSMiddleware, ...)

# Route registration
app.include_router(auth_router)
app.include_router(upload_router)
app.include_router(contracts_router)
# ... more routers
```

### API Route Pattern

Each route module follows this pattern:

```python
# backend/app/api/contracts.py

from fastapi import APIRouter, Depends
from app.auth.dependencies import get_db_and_user

router = APIRouter(prefix="/api/contracts", tags=["contracts"])

@router.get("/")
async def list_contracts(
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    db, user = db_and_user
    # Implementation...
```

**Key Pattern**: Always use `get_db_and_user` dependency to get both database session and authenticated user.

### Service Layer Pattern

Services contain business logic and follow a **functional pattern** (no commits inside services):

```python
# backend/app/services/invoice_service.py

def add_payment(
    db: Session,  # Receives session, doesn't create it
    invoice_type: str,
    invoice_id: int,
    payment_data: PaymentCreateRequest,
    user_id: int
) -> PaymentTransaction:
    # Validate
    invoice = _get_invoice(db, invoice_type, invoice_id)
    if not invoice:
        raise ValueError("Invoice not found")

    # Create transaction
    transaction = PaymentTransaction(...)
    db.add(transaction)

    # Update invoice
    invoice.paid_amount += payment_data.amount

    # DO NOT COMMIT - caller handles this
    return transaction
```

**Why No Commits in Services?**
- Transaction boundaries controlled at API layer
- Caller can rollback entire operation on any error
- Multiple service calls can be atomic

### OCR Service: Singleton Pattern

The OCR service uses a singleton to avoid reloading models:

```python
# backend/app/services/ocr_service.py

_ocr_service_instance = None

def get_ocr_service():
    global _ocr_service_instance
    if _ocr_service_instance is None:
        _ocr_service_instance = OCRService()
    return _ocr_service_instance

class OCRService:
    def __init__(self):
        # Load PP-StructureV3 models (expensive operation)
        self.pipeline = PPStructureV3(...)

    def process_document(self, file_path: str) -> dict:
        # Process PDF and return extracted data
        ...
```

### Data Extractor: Functional Pattern

The data extractor uses pure functions for testability:

```python
# backend/app/services/data_extractor.py

def extract_from_page1_one_time(ocr_results: dict) -> TelkomContractData:
    """Extract contract data from page 1 (one-time payment contracts)"""
    data = TelkomContractData()

    # Extract customer info
    data.informasi_pelanggan = extract_customer_info(ocr_results)

    # Extract services
    data.layanan_utama = extract_services(ocr_results)

    # Extract payment info
    data.tata_cara_pembayaran = extract_payment_info(ocr_results)

    return data

def merge_with_page2(page1_data: TelkomContractData, page2_results: dict) -> TelkomContractData:
    """Merge page 2 data (duration, contacts) with page 1 data"""
    ...
```

### Database Models: SQLAlchemy

```python
# backend/app/models/database.py

from sqlalchemy import Column, Integer, String, ForeignKey, JSONB
from sqlalchemy.orm import relationship

class Contract(Base):
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True)
    job_id = Column(Integer, ForeignKey("processing_jobs.id"))
    account_id = Column(Integer, ForeignKey("accounts.id"))
    final_data = Column(JSONB, nullable=False)  # Source of truth
    customer_name = Column(String)  # Denormalized for queries

    # Relationships
    job = relationship("ProcessingJob", back_populates="contract")
    account = relationship("Account", back_populates="contracts")
    term_payments = relationship("ContractTermPayment", back_populates="contract")
```

### Pydantic Schemas

```python
# backend/app/models/schemas.py

from pydantic import BaseModel

class TelkomContractData(BaseModel):
    """Main contract data structure"""
    informasi_pelanggan: InformasiPelanggan
    layanan_utama: LayananUtama
    rincian_layanan: List[RincianLayanan]
    tata_cara_pembayaran: TataCaraPembayaran
    jangka_waktu: JangkaWaktu
    kontak_person_telkom: Optional[KontakPersonTelkom]

class InformasiPelanggan(BaseModel):
    nama_sekolah: str
    npwp: str
    alamat: str
    nama_perwakilan: str
    jabatan_perwakilan: str
```

---

## Frontend Architecture

### React + TypeScript + Vite

The frontend uses a modern React stack:

- **Vite**: Fast development server with HMR
- **TypeScript**: Type safety
- **React Router**: Client-side routing
- **React Query**: Server state management
- **React Hook Form + Zod**: Form handling with validation
- **Tailwind CSS**: Utility-first styling
- **Radix UI**: Accessible component primitives

### Application Structure

```typescript
// frontend/src/App.tsx

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/processing" element={<ProcessingPage />} />
              <Route path="/review/:jobId" element={<ReviewPage />} />
              <Route path="/contracts" element={<ContractsPage />} />
              {/* ... more routes */}
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

### API Service Layer

```typescript
// frontend/src/services/api.ts

import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API functions
export const contractsApi = {
  list: (params: ContractListParams) =>
    api.get<ContractListResponse>('/api/contracts', { params }),

  get: (id: number) =>
    api.get<Contract>(`/api/contracts/${id}`),

  update: (id: number, data: ContractUpdateData) =>
    api.put(`/api/contracts/${id}`, data),
};
```

### React Query for Server State

```typescript
// frontend/src/pages/ContractsPage.tsx

function ContractsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['contracts', filters],
    queryFn: () => contractsApi.list(filters),
  });

  const deleteMutation = useMutation({
    mutationFn: contractsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });

  // Render...
}
```

### Form Handling with React Hook Form + Zod

```typescript
// frontend/src/components/forms/ExtractionForm.tsx

const contractSchema = z.object({
  informasi_pelanggan: z.object({
    nama_sekolah: z.string().min(1, "Nama sekolah wajib diisi"),
    npwp: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}$/, "Format NPWP tidak valid"),
    // ...
  }),
  // ...
});

function ExtractionForm({ initialData, onSave, onConfirm }) {
  const form = useForm({
    resolver: zodResolver(contractSchema),
    defaultValues: initialData,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onConfirm)}>
        <FormField
          name="informasi_pelanggan.nama_sekolah"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama Sekolah</FormLabel>
              <Input {...field} />
              <FormMessage />
            </FormItem>
          )}
        />
        {/* More fields... */}
      </form>
    </Form>
  );
}
```

### Component Structure

```
components/
├── ui/                     # Radix UI primitives (shadcn/ui pattern)
│   ├── button.tsx
│   ├── input.tsx
│   ├── dialog.tsx
│   ├── table.tsx
│   └── ...
│
├── forms/                  # Form components
│   ├── ExtractionForm.tsx  # Main contract form
│   ├── TerminPaymentRow.tsx
│   └── CustomerContactsSection.tsx
│
├── layout/                 # Layout components
│   ├── Sidebar.tsx
│   ├── Header.tsx
│   └── ProtectedLayout.tsx
│
└── shared/                 # Shared components
    ├── DataTable.tsx
    ├── Pagination.tsx
    └── LoadingSpinner.tsx
```

---

## Key Design Decisions

### 1. Human-in-the-Loop Validation

OCR is not perfect. The system requires human review before data is finalized:

```
Upload → OCR → Extract → Human Review → Confirm → Contract
                              ↑
                        (Edit if needed)
```

### 2. Manual Save (No Auto-Save)

Auto-save was removed because it caused data loss:
- User types incomplete data
- Auto-save triggers
- Backend parser fails on incomplete data
- Termin payments get incorrectly synced/deleted

**Solution**: Explicit save button with form validation.

### 3. Denormalized Columns

The `contracts` table has both:
- `final_data` JSONB (source of truth)
- Denormalized columns (`customer_name`, `total_contract_value`, etc.)

**Why?**
- JSONB queries are slower for filtering/sorting
- Denormalized columns enable efficient indexes
- Dashboard KPIs need fast aggregations

### 4. Service Layer Never Commits

```python
# ❌ Wrong - service commits
def create_invoice(db, data):
    invoice = Invoice(**data)
    db.add(invoice)
    db.commit()  # Don't do this!
    return invoice

# ✅ Correct - caller commits
@router.post("/invoices")
def create_invoice_endpoint(db_and_user = Depends(get_db_and_user)):
    db, user = db_and_user
    try:
        invoice = invoice_service.create_invoice(db, data)
        db.commit()  # Caller commits
        return invoice
    except Exception:
        db.rollback()  # Caller handles rollback
        raise
```

### 5. Invoice Status via Database Trigger

Invoice status updates are automatic via PostgreSQL triggers:
- Prevents inconsistent states
- Single source of truth for status logic
- Manual status change only: DRAFT → SENT

---

## Data Flow Examples

### Upload & Processing Flow

```
1. User uploads PDF
   → POST /api/upload
   → File saved to storage/uploads/
   → File record created in `files` table
   → ProcessingJob created with status=QUEUED

2. Background processing
   → OCR Service processes PDF
   → PP-StructureV3 extracts text/tables
   → Data Extractor runs regex patterns
   → Results saved to job.extracted_data
   → Status → AWAITING_REVIEW

3. User reviews in split-view
   → GET /api/processing/{job_id}/data
   → Returns extracted_data + edited_data
   → User makes corrections in form
   → PATCH /api/processing/{job_id}/data (manual save)
   → Changes saved to job.edited_data

4. User confirms
   → POST /api/processing/{job_id}/confirm
   → Contract record created from edited_data
   → Termin payments synced
   → Job status → CONFIRMED
```

### Invoice Payment Flow

```
1. Invoice created (from termin payment)
   → invoice_number generated
   → Tax breakdown calculated by trigger
   → status = DRAFT

2. Invoice sent to customer
   → PATCH /api/invoices/term/{id}/send
   → status → SENT
   → sent_date recorded

3. Customer makes payment
   → POST /api/invoices/term/{id}/payments
   → Payment transaction created
   → Invoice.paid_amount updated
   → Trigger updates status → PARTIALLY_PAID or PAID_PENDING_PPH23

4. Upload supporting documents
   → POST /api/invoices/term/{id}/documents
   → BUPOT, payment receipts stored
   → status → PAID (when all conditions met)
```

---

## Testing Strategy

### Backend Tests

```bash
cd backend
pytest                              # Run all tests
pytest tests/test_invoice_service.py -v  # Invoice service tests
pytest tests/test_invoice_api.py -v      # Invoice API tests
```

Test structure:
- **Unit tests**: Service layer functions
- **Integration tests**: API endpoints with database

### Frontend Tests

```bash
cd frontend
npm run test
```

### Manual Testing

1. Use the web interface for full workflow testing
2. Sample PDFs in `tests/test_samples/`
3. API testing via http://localhost:8000/docs (Swagger UI)

---

## Performance Considerations

### OCR Performance
- PP-StructureV3 is CPU-intensive
- First request loads models (slow)
- Subsequent requests use cached models
- Consider GPU for production

### Database Performance
- Indexes on frequently queried columns
- JSONB indexes for `final_data` queries
- Connection pooling via SQLAlchemy

### Frontend Performance
- React Query caching reduces API calls
- Lazy loading for routes
- Virtualization for long lists (if needed)

---

## Security Considerations

1. **Authentication**: JWT tokens with expiration
2. **Authorization**: Role-based (STAFF/MANAGER)
3. **Input Validation**: Pydantic + Zod schemas
4. **SQL Injection**: SQLAlchemy ORM prevents injection
5. **XSS**: React escapes output by default
6. **CORS**: Configured for specific origins
7. **File Upload**: Type/size validation, stored outside web root

---

## Next Steps

- [Deployment Guide](./05-DEPLOYMENT-GUIDE.md) - Production deployment instructions
- [Database Setup](./03-DATABASE-SETUP.md) - Database details
- Check `CLAUDE.md` for comprehensive development guidelines
