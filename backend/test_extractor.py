#!/usr/bin/env python3
"""
Test script for data extractor in new backend structure.
"""
import sys
import os
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.data_extractor import extract_from_page1_one_time
import json

def test_extractor():
    """Test the data extractor with sample data."""
    
    # Path to test OCR data (from project root when script called from root)
    test_input = "data/dev-output/KB_SMKN_1_BIREUN_TTD_2024_VALIDASI_page_1_results/page_1_res.json"
    test_output = "data/dev-output/test-new-backend.json"
    
    # Load OCR data
    with open(test_input, 'r', encoding='utf-8') as f:
        ocr_data = json.load(f)
    
    # Extract data
    result = extract_from_page1_one_time(ocr_data)
    
    # Save result  
    with open(test_output, 'w', encoding='utf-8') as f:
        json.dump(result.model_dump(), f, indent=2, ensure_ascii=False, default=str)
    
    # Print key results
    print(f"✅ Extraction successful!")
    print(f"Customer: {result.informasi_pelanggan.nama_pelanggan}")
    print(f"Annual Cost: Rp {result.rincian_layanan[0].biaya_langganan_tahunan:,.0f}")
    print(f"Output saved to: {test_output}")

if __name__ == "__main__":
    test_extractor()