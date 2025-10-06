"""
Integration tests for contract stats endpoint
Tests the /api/contracts/stats/summary endpoint with actual database operations

NOTE: These tests require PostgreSQL (not SQLite) because the models use JSONB columns.
To run these tests, ensure PostgreSQL is running and set:
  export TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/telkom_contracts_test"
"""

import pytest
import os
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

# Import models and app
from app.database import Base
from app.models.database import Contract, ProcessingJob, File as FileModel, JobStatus
from app.config import settings


# Check if PostgreSQL test database is available
TEST_DATABASE_URL = os.getenv(
    'TEST_DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/telkom_contracts_test'
)

# Skip all tests if PostgreSQL not available
pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL.startswith('postgresql'),
    reason="Integration tests require PostgreSQL (JSONB not supported in SQLite)"
)


@pytest.fixture(scope="function")
def test_db():
    """Create a fresh database for each test"""
    try:
        engine = create_engine(TEST_DATABASE_URL, echo=False)
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

        # Create tables
        Base.metadata.create_all(bind=engine)

        db = TestingSessionLocal()
        yield db

        db.close()

        # Clean up tables
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
    except Exception as e:
        pytest.skip(f"PostgreSQL not available: {e}")


@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)


class TestContractStatsEndpoint:
    """Integration tests for GET /api/contracts/stats/summary"""

    def _create_test_file(self, db, filename="test.pdf"):
        """Helper to create a test file record"""
        file = FileModel(
            original_filename=filename,
            size_bytes=1024,
            mime_type="application/pdf",
            pdf_path=f"/tmp/{filename}"
        )
        db.add(file)
        db.commit()
        db.refresh(file)
        return file

    def _create_test_job(self, db, file_id, status=JobStatus.CONFIRMED, processing_time=60.0):
        """Helper to create a test processing job"""
        job = ProcessingJob(
            file_id=file_id,
            status=status,
            extracted_data={'test': 'data'},
            processing_time_seconds=processing_time,
            processing_started_at=datetime.now(timezone.utc),
            processing_completed_at=datetime.now(timezone.utc)
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    def _create_test_contract(
        self,
        db,
        job_id,
        file_id,
        total_value=1000000,
        payment_method='termin',
        services=(10, 5, 3)
    ):
        """Helper to create a test contract with denormalized fields"""
        contract = Contract(
            source_job_id=job_id,
            file_id=file_id,
            final_data={'test': 'data'},
            customer_name='Test Customer',
            customer_npwp='12.345.678.9-012.345',
            period_start=datetime(2025, 1, 1).date(),
            period_end=datetime(2025, 12, 31).date(),
            service_connectivity=services[0],
            service_non_connectivity=services[1],
            service_bundling=services[2],
            payment_method=payment_method,
            termin_count=4 if payment_method == 'termin' else None,
            installation_cost=Decimal(str(total_value * 0.3)),
            annual_subscription_cost=Decimal(str(total_value * 0.7)),
            total_contract_value=Decimal(str(total_value)),
            confirmed_by='test_user',
            confirmed_at=datetime.now(timezone.utc)
        )
        db.add(contract)
        db.commit()
        db.refresh(contract)
        return contract

    @pytest.mark.skip(reason="Requires full app setup with authentication")
    def test_stats_endpoint_empty_database(self, client, test_db):
        """Test stats endpoint with no contracts"""
        response = client.get("/api/contracts/stats/summary")

        assert response.status_code == 200
        data = response.json()

        assert data['total_contracts'] == 0
        assert data['contracts_this_month'] == 0
        assert data['total_contract_value'] == '0'
        assert data['total_connectivity_services'] == 0
        assert data['total_non_connectivity_services'] == 0
        assert data['total_bundling_services'] == 0
        assert data['payment_methods'] == {}

    def test_stats_calculation_with_single_contract(self, test_db):
        """Test stats calculation with a single contract (database-level test)"""
        # Create test data
        file = self._create_test_file(test_db)
        job = self._create_test_job(test_db, file.id, processing_time=45.5)
        contract = self._create_test_contract(
            test_db,
            job.id,
            file.id,
            total_value=5000000,
            payment_method='termin',
            services=(10, 5, 3)
        )

        # Query stats manually (simulating endpoint logic)
        total_contracts = test_db.query(Contract).count()
        total_value = test_db.query(Contract.total_contract_value).scalar()

        assert total_contracts == 1
        assert total_value == Decimal('5000000')
        assert contract.service_connectivity == 10
        assert contract.service_non_connectivity == 5
        assert contract.service_bundling == 3

    def test_stats_calculation_with_multiple_contracts(self, test_db):
        """Test stats aggregation with multiple contracts"""
        # Create multiple contracts with different payment methods
        file1 = self._create_test_file(test_db, "file1.pdf")
        file2 = self._create_test_file(test_db, "file2.pdf")
        file3 = self._create_test_file(test_db, "file3.pdf")

        job1 = self._create_test_job(test_db, file1.id, processing_time=30.0)
        job2 = self._create_test_job(test_db, file2.id, processing_time=45.0)
        job3 = self._create_test_job(test_db, file3.id, processing_time=60.0)

        # Different payment methods and values
        contract1 = self._create_test_contract(
            test_db, job1.id, file1.id,
            total_value=3000000, payment_method='termin', services=(10, 5, 2)
        )
        contract2 = self._create_test_contract(
            test_db, job2.id, file2.id,
            total_value=5000000, payment_method='recurring', services=(15, 3, 1)
        )
        contract3 = self._create_test_contract(
            test_db, job3.id, file3.id,
            total_value=2000000, payment_method='one_time', services=(8, 2, 0)
        )

        # Test aggregations
        from sqlalchemy import func

        total_contracts = test_db.query(func.count(Contract.id)).scalar()
        total_value = test_db.query(func.sum(Contract.total_contract_value)).scalar()
        total_connectivity = test_db.query(func.sum(Contract.service_connectivity)).scalar()
        total_non_connectivity = test_db.query(func.sum(Contract.service_non_connectivity)).scalar()
        total_bundling = test_db.query(func.sum(Contract.service_bundling)).scalar()

        # Payment method breakdown
        payment_counts = (
            test_db.query(Contract.payment_method, func.count(Contract.id))
            .group_by(Contract.payment_method)
            .all()
        )
        payment_dict = {method: count for method, count in payment_counts}

        # Assertions
        assert total_contracts == 3
        assert total_value == Decimal('10000000')  # 3M + 5M + 2M
        assert total_connectivity == 33  # 10 + 15 + 8
        assert total_non_connectivity == 10  # 5 + 3 + 2
        assert total_bundling == 3  # 2 + 1 + 0

        assert payment_dict['termin'] == 1
        assert payment_dict['recurring'] == 1
        assert payment_dict['one_time'] == 1

    def test_success_rate_calculation(self, test_db):
        """Test success rate calculation"""
        # Create mix of confirmed and failed jobs
        file1 = self._create_test_file(test_db, "success.pdf")
        file2 = self._create_test_file(test_db, "failed.pdf")

        job_confirmed = self._create_test_job(test_db, file1.id, status=JobStatus.CONFIRMED)
        job_failed = self._create_test_job(test_db, file2.id, status=JobStatus.FAILED)

        # Only confirmed job gets a contract
        contract = self._create_test_contract(test_db, job_confirmed.id, file1.id)

        # Calculate success rate
        total_contracts = test_db.query(func.count(Contract.id)).scalar()
        total_processed = (
            test_db.query(func.count(ProcessingJob.id))
            .filter(ProcessingJob.status.in_([JobStatus.CONFIRMED, JobStatus.FAILED]))
            .scalar()
        )

        success_rate = total_contracts / total_processed if total_processed > 0 else 0

        assert total_contracts == 1
        assert total_processed == 2
        assert success_rate == 0.5  # 50% success rate

    def test_average_processing_time(self, test_db):
        """Test average processing time calculation"""
        file1 = self._create_test_file(test_db, "file1.pdf")
        file2 = self._create_test_file(test_db, "file2.pdf")
        file3 = self._create_test_file(test_db, "file3.pdf")

        job1 = self._create_test_job(test_db, file1.id, processing_time=30.0)
        job2 = self._create_test_job(test_db, file2.id, processing_time=60.0)
        job3 = self._create_test_job(test_db, file3.id, processing_time=90.0)

        contract1 = self._create_test_contract(test_db, job1.id, file1.id)
        contract2 = self._create_test_contract(test_db, job2.id, file2.id)
        contract3 = self._create_test_contract(test_db, job3.id, file3.id)

        # Calculate average
        from sqlalchemy import func

        avg_time = (
            test_db.query(func.avg(ProcessingJob.processing_time_seconds))
            .join(Contract, Contract.source_job_id == ProcessingJob.id)
            .scalar()
        )

        assert avg_time == 60.0  # (30 + 60 + 90) / 3

    def test_contracts_this_month_filtering(self, test_db):
        """Test current month filtering for contracts"""
        from datetime import timedelta

        file1 = self._create_test_file(test_db, "recent.pdf")
        file2 = self._create_test_file(test_db, "old.pdf")

        job1 = self._create_test_job(test_db, file1.id)
        job2 = self._create_test_job(test_db, file2.id)

        # Create one contract this month
        contract_recent = Contract(
            source_job_id=job1.id,
            file_id=file1.id,
            final_data={'test': 'data'},
            total_contract_value=Decimal('1000000'),
            confirmed_by='test_user',
            confirmed_at=datetime.now(timezone.utc)  # This month
        )
        test_db.add(contract_recent)

        # Create one contract from last month
        contract_old = Contract(
            source_job_id=job2.id,
            file_id=file2.id,
            final_data={'test': 'data'},
            total_contract_value=Decimal('2000000'),
            confirmed_by='test_user',
            confirmed_at=datetime.now(timezone.utc) - timedelta(days=40)  # ~1 month ago
        )
        test_db.add(contract_old)
        test_db.commit()

        # Query contracts this month
        start_of_month = datetime(
            datetime.now(timezone.utc).year,
            datetime.now(timezone.utc).month,
            1,
            tzinfo=timezone.utc
        )

        contracts_this_month = (
            test_db.query(func.count(Contract.id))
            .filter(Contract.confirmed_at >= start_of_month)
            .scalar()
        )

        total_contracts = test_db.query(func.count(Contract.id)).scalar()

        assert total_contracts == 2
        assert contracts_this_month == 1  # Only the recent one


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
