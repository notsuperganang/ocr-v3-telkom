#!/usr/bin/env python3
"""
Test the complete OCR service with a real PDF file
"""
import os
import sys
import json
import uuid
from pathlib import Path

# Add backend directory to Python path
backend_path = Path(__file__).parent
sys.path.insert(0, str(backend_path))

from app.services.ocr_service import get_ocr_service
from app.services.data_extractor import extract_from_page1_one_time, merge_with_page2

def test_full_pipeline():
    """Test OCR service + data extraction pipeline"""
    
    # Input and output paths
    test_pdf = "/home/notsuperganang/Documents/dev/telkom-contract-extractor/data/test-samples/KB SMKN 1 BIREUN TTD 2024 VALIDASI.pdf"
    test_output_dir = "/home/notsuperganang/Documents/dev/telkom-contract-extractor/data/dev-output"
    
    if not os.path.exists(test_pdf):
        print(f"❌ Test PDF not found: {test_pdf}")
        return False
    
    print("="*80)
    print("🧪 TESTING FULL OCR + EXTRACTION PIPELINE")
    print("="*80)
    
    try:
        # Get OCR service
        print("1️⃣ Getting OCR service...")
        ocr_service = get_ocr_service()
        
        # Generate unique file ID
        file_id = f"test_{uuid.uuid4().hex[:8]}"
        
        # Process PDF with OCR
        print("2️⃣ Processing PDF with OCR...")
        ocr_result = ocr_service.process_pdf(
            pdf_path=test_pdf,
            output_base_dir=test_output_dir,
            file_id=file_id
        )
        
        if not ocr_result.success:
            print(f"❌ OCR processing failed: {ocr_result.error_message}")
            return False
        
        print(f"✅ OCR completed: {ocr_result.pages_processed} pages in {ocr_result.processing_time:.2f}s")
        
        # Test data extraction on page 1 and merge with page 2
        if "page_1" in ocr_result.output_paths and "page_2" in ocr_result.output_paths:
            print("3️⃣ Testing data extraction on page 1...")
            page1_path = ocr_result.output_paths["page_1"]
            page2_path = ocr_result.output_paths["page_2"]
            
            with open(page1_path, 'r', encoding='utf-8') as f:
                page1_ocr = json.load(f)
            
            with open(page2_path, 'r', encoding='utf-8') as f:
                page2_ocr = json.load(f)
            
            # Extract data from page 1
            page1_data = extract_from_page1_one_time(page1_ocr)
            
            print("4️⃣ Merging with data from page 2...")
            # Merge with page 2 data
            extracted_data = merge_with_page2(page1_data, page2_ocr)
            
            # Save extraction result
            extraction_output = os.path.join(test_output_dir, f"{file_id}_extracted.json")
            with open(extraction_output, 'w', encoding='utf-8') as f:
                json.dump(extracted_data.model_dump(), f, indent=2, ensure_ascii=False, default=str)
            
            print(f"✅ Data extraction completed (both pages)")
            print(f"🏫 Customer: {extracted_data.informasi_pelanggan.nama_pelanggan if extracted_data.informasi_pelanggan else 'N/A'}")
            
            # Check for cost extraction
            if extracted_data.rincian_layanan and len(extracted_data.rincian_layanan) > 0:
                total_cost = extracted_data.rincian_layanan[0].biaya_instalasi + extracted_data.rincian_layanan[0].biaya_langganan_tahunan
                print(f"💰 Total Cost: Rp {total_cost:,.0f}")
            
            # Check payment method  
            if extracted_data.tata_cara_pembayaran:
                payment = extracted_data.tata_cara_pembayaran
                print(f"💳 Payment method: {payment.method_type}")
                if payment.total_amount:
                    print(f"💳 Payment total: Rp {payment.total_amount:,.0f}")
                if payment.description:
                    print(f"💳 Payment description: {payment.description}")
            
            # Check contact person (from page 2)
            if extracted_data.kontak_person_telkom:
                contact = extracted_data.kontak_person_telkom
                print(f"📞 Telkom contact: {contact.nama} ({contact.jabatan})")
                if contact.email:
                    print(f"📧 Email: {contact.email}")
                if contact.telepon:
                    print(f"📱 Phone: {contact.telepon}")
            
            # Check contract duration (from page 2)
            if extracted_data.jangka_waktu:
                duration = extracted_data.jangka_waktu
                print(f"📅 Contract period: {duration.mulai} to {duration.akhir}")
            
            print(f"💾 Full extraction saved to: {extraction_output}")
        
        print("="*80)
        print("✅ FULL PIPELINE TEST SUCCESSFUL")
        print("="*80)
        return True
        
    except Exception as e:
        print(f"❌ Pipeline test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        # Cleanup
        try:
            ocr_service.cleanup_temp_files()
        except:
            pass

if __name__ == "__main__":
    success = test_full_pipeline()
    sys.exit(0 if success else 1)