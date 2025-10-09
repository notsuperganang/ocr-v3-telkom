# telkom_extractor.py
# Ekstraktor Telkom Contract — Page 1 (One Time Charge) + merge helper untuk Page 2
# -----------------------------------------------------
# Prasyarat: file schemas.py berisi kelas Pydantic yang sudah kamu kirim.

from __future__ import annotations
import re
import json
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

# Import model pydantic kamu
# Import pydantic models (support both "python -m app.services.data_extractor" and direct script run)
try:  # Preferred absolute import when package root is on sys.path
    from app.models.schemas import (
        Perwakilan,
        KontakPersonPelanggan,
        InformasiPelanggan,
        JangkaWaktu,
        KontakPersonTelkom,
        LayananUtama,
        RincianLayanan,
        TataCaraPembayaran,
        TerminPayment,
        TelkomContractData,
    )
except ModuleNotFoundError:  # Fallback for direct invocation: python app/services/data_extractor.py
    import os, sys as _sys
    _ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    if _ROOT not in _sys.path:
        _sys.path.insert(0, _ROOT)
    from app.models.schemas import (
        Perwakilan,
        KontakPersonPelanggan,
        InformasiPelanggan,
        JangkaWaktu,
        KontakPersonTelkom,
        LayananUtama,
        RincianLayanan,
        TataCaraPembayaran,
        TerminPayment,
        TelkomContractData,
    )

# -------------------- Utilities --------------------
_MONEY_TOKEN = re.compile(r"^\s*(?:Rp\.?|Rp)?\s*[\d\.\,]+[-,]*\s*$", re.I)

def _texts_from_ocr(ocr_json: Any) -> List[str]:
    """
    Normalisasi struktur OCR ke list of strings (urutan token baris/kolom).
    Kompatibel dengan PaddleOCR-style: ocr['overall_ocr_res']['rec_texts'].
    """
    if isinstance(ocr_json, dict):
        # PaddleOCR aggregated
        overall = ocr_json.get("overall_ocr_res") or {}
        if isinstance(overall, dict) and isinstance(overall.get("rec_texts"), list):
            return [str(t) for t in overall["rec_texts"]]
        # Generic variants
        if isinstance(ocr_json.get("lines"), list):
            return [str(t) for t in ocr_json["lines"]]
        if isinstance(ocr_json.get("text"), str):
            return [ln for ln in ocr_json["text"].splitlines()]
    if isinstance(ocr_json, list):
        return [str(t) for t in ocr_json]
    if isinstance(ocr_json, str):
        return ocr_json.splitlines()
    return []

def _texts_from_parsing_res_list(ocr_json: Any) -> List[str]:
    """
    Extract text from PP-StructureV3's parsing_res_list (layout-aware structured output).

    This provides better document structure preservation than rec_texts for contracts
    where sections appear out of order in the flat rec_texts array.

    Returns:
        List of text tokens optimized for label-value extraction
    """
    if not isinstance(ocr_json, dict):
        return []

    parsing_res_list = ocr_json.get("parsing_res_list", [])
    if not isinstance(parsing_res_list, list):
        return []

    texts = []
    for block in parsing_res_list:
        if not isinstance(block, dict):
            continue

        block_content = block.get("block_content", "")
        if not block_content:
            continue

        # Split on newlines to create separate tokens
        lines = block_content.split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Strategy: For label-value pairs, add both the full line AND split tokens
            # Examples:
            # "Nama SMKNPENERBANGANACEH" -> ["Nama SMKNPENERBANGANACEH", "Nama", "SMKNPENERBANGANACEH"]
            # "Alamat NPWP JL.BLANG..." -> ["Alamat NPWP JL.BLANG...", "Alamat", rest...]

            # Check if line starts with common field labels
            field_labels = ["Nama", "Alamat", "NPWP", "Jabatan", "NIK"]
            is_field_line = any(line.startswith(label + " ") for label in field_labels)

            # Also check for "representative" format: "Diwakili secara sah oleh:Nama VALUE Jabatan VALUE2"
            is_representative_line = "Diwakili secara sah oleh" in line and "Nama" in line

            if is_field_line:
                # This is a "Label Value" line
                # Add full line first (for extracting complete value)
                texts.append(line)

                # Split to extract label and value separately
                parts = line.split(None, 1)  # Split on first whitespace only
                if len(parts) == 2:
                    label, value = parts
                    texts.append(label)
                    texts.append(value)
                elif len(parts) == 1:
                    texts.append(parts[0])
            elif is_representative_line:
                # Special handling for representative section
                # Example: "Diwakili secara sah oleh:Nama HELFIANDI,S.Pd.,M.Pd Jabatan KEPALASEKOLAH"
                # Don't add the full line to avoid containing match picking up wrong text
                # Just tokenize it properly
                tokens = line.split()
                texts.extend(tokens)
                # Also add "Nama" standalone for exact matching
                if "Nama" in line:
                    texts.append("Nama")
            else:
                # Not a field line, add as-is
                texts.append(line)
                # Also tokenize for flexibility (e.g., section titles)
                if ' ' in line:
                    texts.extend(line.split())

    return texts

def _find_eq(texts: List[str], label: str, start: int = 0) -> Optional[int]:
    """Cari index token yang sama persis (case-insensitive) dengan label."""
    tgt = label.strip().lower()
    for i in range(start, len(texts)):
        if texts[i].strip().lower() == tgt:
            return i
    return None

def _value_after(texts: List[str], label: str, start: int = 0) -> Optional[str]:
    """Ambil token setelah label tertentu (exact-match)."""
    idx = _find_eq(texts, label, start)
    if idx is not None and idx + 1 < len(texts):
        return texts[idx + 1].strip()
    return None

def _parse_rupiah_token(tok: str) -> float:
    """Konversi token rupiah 'Rp 1.234.567,89' -> 1234567.89 (float)."""
    s = re.sub(r"[^\d,\.]", "", tok)
    
    # Handle trailing dots (like "896.462.640.-" -> "896.462.640.")
    s = s.rstrip(".")
    
    if s.count(",") == 1 and s.count(".") >= 1:
        # Format ID: titik thousand, koma decimal
        s = s.replace(".", "").replace(",", ".")
    else:
        # Handle Indonesian thousand separator (dots) without decimal comma
        if s.count(".") >= 2:  # Multiple dots = thousand separators
            s = s.replace(".", "")
        else:
            s = s.replace(",", "")
    
    try:
        return float(s)
    except Exception:
        return 0.0

def _next_money(texts: List[str], start_idx: int) -> float:
    """Ambil token uang pada posisi sesudah start_idx.

    Returns the monetary amount if found and realistic (>= 1000),
    otherwise returns 0.0 to avoid extracting section numbers as costs.
    """
    for j in range(start_idx + 1, min(start_idx + 5, len(texts))):
        if _MONEY_TOKEN.match(texts[j]):
            amount = _parse_rupiah_token(texts[j])
            # Validate: reject unrealistic small amounts (e.g., section numbers like "4")
            if amount >= 1000:
                return amount
    # fallback: token persis setelahnya
    if start_idx + 1 < len(texts) and any(ch.isdigit() for ch in texts[start_idx + 1]):
        amount = _parse_rupiah_token(texts[start_idx + 1])
        # Same validation for fallback
        if amount >= 1000:
            return amount
    return 0.0

def _find_count_after_phrase(texts: List[str], phrase: str) -> int:
    """Cari angka tepat setelah sebuah frasa (exact-match token)."""
    idx = _find_eq(texts, phrase)
    if idx is not None and idx + 1 < len(texts):
        nxt = re.sub(r"[^\d]", "", texts[idx + 1])
        if nxt.isdigit():
            return int(nxt)
    return 0

def _find_count_robust(texts: List[str], service_patterns: List[str], max_distance: int = 2) -> int:
    """
    Cari angka service dengan multiple strategies dan proximity matching.
    Simplified untuk akurasi yang lebih baik dengan prioritas exact/adjacent matching.
    """
    for pattern in service_patterns:
        # Strategy 1: Exact match + immediate next token (highest priority)
        count = _find_count_after_phrase(texts, pattern)
        if count > 0:
            return count
    
    # Strategy 2: Try all patterns with fuzzy matching (only if exact failed)
    for pattern in service_patterns:
        # Enhanced fuzzy match + immediate next token only
        idx = _find_fuzzy(texts, pattern, 0.75)  # Higher threshold for reliability
        if idx is not None and idx + 1 < len(texts):
            nxt = texts[idx + 1].strip()
            # Be strict about next token - must be pure digit
            if nxt.isdigit() and 0 <= int(nxt) <= 20:
                return int(nxt)
    
    # Strategy 3: Containing match with tight proximity (last resort)
    for pattern in service_patterns:
        idx = _find_containing(texts, pattern)
        if idx is not None:
            # Look for number in very tight radius only (adjacent tokens)
            for i in range(max(0, idx - 1), min(len(texts), idx + 2)):
                if i != idx:
                    token = texts[i].strip()
                    # Only accept pure digits for high confidence
                    if token.isdigit() and 0 <= int(token) <= 20:
                        return int(token)
    
    return 0

def _slice_after_keyword(texts: List[str], keyword: str, span: int = 12) -> str:
    """Gabung beberapa token setelah kata kunci (untuk raw_text simpanan)."""
    # cari token yang mengandung keyword (case-insensitive)
    for i, t in enumerate(texts):
        if keyword.lower() in t.lower():
            return " ".join(texts[i : min(i + span, len(texts))]).strip()
    return ""

def _get_payment_section_text(texts: List[str]) -> str:
    """
    Ekstrak teks dari seksi pembayaran untuk analisis metode pembayaran.
    Prioritas: teks di sekitar header TATA CARA PEMBAYARAN, lalu fallback ke seluruh dokumen.
    """
    # Priority 1: Section 5 dengan berbagai format
    section5_patterns = [
        "5.TATACARAPEMBAYARAN",     # PT MPG format (tanpa spasi)
        "5.TATA CARA PEMBAYARAN",   # Standard format
        "5. TATA CARA PEMBAYARAN",  # Dengan spasi setelah angka
        "5.TATACARA PEMBAYARAN",    # Variasi spasi
        "5. TATACARA PEMBAYARAN",   # Kombinasi
    ]
    
    for pattern in section5_patterns:
        payment_section = _slice_after_keyword(texts, pattern, span=20)
        if payment_section:
            return payment_section
    
    # Priority 2: Header pembayaran umum dengan berbagai format
    general_patterns = [
        "TATACARAPEMBAYARAN",       # Tanpa spasi sama sekali
        "TATA CARA PEMBAYARAN",     # Standard
        "TATACARA PEMBAYARAN",      # Partial spasi
    ]
    
    for pattern in general_patterns:
        payment_section = _slice_after_keyword(texts, pattern, span=20)
        if payment_section:
            return payment_section
    
    # Fallback: header pembayaran alternatif
    payment_section = _slice_after_keyword(texts, "PEMBAYARAN", span=20)
    if payment_section:
        return payment_section
        
    payment_section = _slice_after_keyword(texts, "KETENTUAN PEMBAYARAN", span=20)
    if payment_section:
        return payment_section
    
    # Fallback terakhir: gabung seluruh teks dokumen
    return " ".join(texts)

def _normalize_payment_text(text: str) -> str:
    """
    Normalisasi teks pembayaran untuk deteksi yang konsisten.
    """
    text = text.lower().strip()
    # Hapus spasi berlebih dan normalize
    text = re.sub(r'\s+', ' ', text)
    # Standardisasi singkatan bulan
    text = text.replace('/bln', ' per bulan')
    text = text.replace('bln', ' bulan')
    return text

def _detect_payment_type(texts: List[str]) -> tuple[str, str, str]:
    """
    Deteksi metode pembayaran dari teks OCR.
    
    Returns:
        tuple: (method_type, description, confidence)
        - method_type: "one_time_charge", "recurring", atau "unknown"
        - description: Deskripsi metode pembayaran
        - confidence: "high", "medium", "low"
    """
    # Ekstrak teks dari seksi pembayaran
    payment_text = _get_payment_section_text(texts)
    normalized_text = _normalize_payment_text(payment_text).lower()

    # Simplified detection: just check for keyword presence
    # Priority 1: Check for "termin" (highest priority)
    if 'termin' in normalized_text:
        return "termin", "Pembayaran termin terdeteksi", "high"

    # Priority 2: Check for "one time charge" or "otc"
    otc_keywords = ['one time charge', 'onetime', 'otc', 'sekali bayar']
    for keyword in otc_keywords:
        if keyword in normalized_text:
            return "one_time_charge", f"One Time Charge terdeteksi ('{keyword}')", "high"

    # Priority 3: Check for "recurring" theme
    recurring_keywords = ['recurring', 'perbulan', 'per bulan', 'bulanan', 'monthly', 'setiap bulan']
    for keyword in recurring_keywords:
        if keyword in normalized_text:
            return "recurring", f"Pembayaran bulanan terdeteksi ('{keyword}')", "high"
    
    # NOTE: Removed unreliable "BULANAN" header detection as it causes false positives
    # Header tables are not reliable indicators of payment method
    # Source of truth should be section 5. TATA CARA PEMBAYARAN only
    
    # Default: tidak dapat menentukan, assume one_time_charge untuk backward compatibility
    return "one_time_charge", "Metode pembayaran tidak terdeteksi", "low"

def _extract_termin_count_only(texts: List[str]) -> Optional[int]:
    """
    Extract termin count even without amount details.
    Handles formats like 'Termin4X', 'Termin 4X', '4X termin', etc.
    """
    payment_text = _get_payment_section_text(texts)
    
    # Pattern untuk termin count saja (lebih fleksibel)
    count_patterns = [
        r'termin[-\s]*(\d+)[x]*\b',        # Termin4X, Termin-4X, Termin 4X, Termin4
        r'(\d+)[x]*\s*termin\b',           # 4X termin, 4 termin, 4X Termin
        r'termin[-\s]*(\d+)[-\s]*[kx]\b',  # Termin-4K, Termin 4X, Termin4K
    ]
    
    for pattern in count_patterns:
        match = re.search(pattern, payment_text, re.I)
        if match:
            try:
                count = int(match.group(1))
                if 1 <= count <= 20:  # Reasonable range for termin count
                    return count
            except (ValueError, IndexError):
                continue
    return None

def _extract_termin_payments(texts: List[str]) -> tuple[List[TerminPayment], int, float]:
    """
    Ekstrak daftar pembayaran termin dari teks OCR.
    
    Returns:
        tuple: (termin_list, total_count, total_amount)
    """
    # Cari teks dari seksi pembayaran
    payment_text = _get_payment_section_text(texts)
    
    # Pattern untuk menangkap termin dengan berbagai format
    # Use \s* (zero or more spaces) to handle OCR text with missing spaces
    # Captures date range: "Januari2025-Maret2025" or "Januari 2025-Maret 2025"
    # Made "yaitu periode" and "sebesar" optional to handle OCR variations
    termin_pattern = re.compile(
        r'Termin[-\s]*(\d+)[,\s]*(?:yaitu\s*periode\s*)?(\w+\s*\d{4})[\s-]*(\w+\s*\d{4})?[\s:]*(?:sebesar\s*[:]*\s*)?Rp\.?([\d\.,]+)',
        re.IGNORECASE
    )
    
    termin_payments = []
    total_amount = 0.0
    
    # Cari semua matches dalam teks
    matches = termin_pattern.findall(payment_text)
    
    for match in matches:
        try:
            termin_num = int(match[0])
            start_date = match[1].strip()
            end_date = match[2].strip() if match[2] else ""
            amount_str = match[3].strip()

            # Format period dengan date range jika end_date tersedia
            if end_date:
                period = f"{start_date} - {end_date}"
            else:
                period = start_date

            # Bersihkan amount string dari karakter trailing
            amount_str = re.sub(r'[^\d\.,]', '', amount_str)
            # Parse amount dengan handling format Indonesia (titik sebagai thousand separator, koma sebagai decimal)
            amount = _parse_rupiah_token("Rp " + amount_str)

            # Buat raw text untuk debugging
            raw_match = re.search(
                rf'Termin[-\s]*{termin_num}[^R]*?[Rp\.\s]*{re.escape(amount_str)}[,\.]?',
                payment_text, re.IGNORECASE
            )
            raw_text = raw_match.group(0) if raw_match else f"Termin-{termin_num} {period} {amount_str}"

            termin_payment = TerminPayment(
                termin_number=termin_num,
                period=period,
                amount=amount,
                raw_text=raw_text.strip()
            )

            termin_payments.append(termin_payment)
            total_amount += amount

        except (ValueError, IndexError):
            # Log error tapi lanjutkan parsing termin lainnya
            continue
    
    # Sort berdasarkan nomor termin
    termin_payments.sort(key=lambda t: t.termin_number)

    return termin_payments, len(termin_payments), total_amount

def _auto_generate_termin_payments(count: int, total_amount: float) -> List[TerminPayment]:
    """
    Auto-generate equal termin payment splits when explicit breakdown not found.

    This function creates placeholder termin payments by evenly dividing the total
    contract cost (biaya_instalasi + biaya_langganan_tahunan) across the specified
    number of termin periods.

    Args:
        count: Number of termin periods (e.g., 4 for "Termin 4X")
        total_amount: Total contract amount to split (biaya_instalasi + biaya_langganan_tahunan)

    Returns:
        List of auto-generated TerminPayment objects with equal splits.
        Returns empty list if count or total_amount is invalid.

    Example:
        >>> _auto_generate_termin_payments(4, 100000000)
        [
            TerminPayment(termin_number=1, period="Termin 1", amount=25000000, ...),
            TerminPayment(termin_number=2, period="Termin 2", amount=25000000, ...),
            ...
        ]
    """
    if count <= 0 or total_amount <= 0:
        return []

    # Calculate equal split amount per termin
    amount_per_termin = total_amount / count

    # Generate termin payment entries
    return [
        TerminPayment(
            termin_number=i + 1,
            period=f"Termin {i + 1}",
            amount=amount_per_termin,
            raw_text=f"Auto-generated: dibagi rata dari total Rp {total_amount:,.0f}"
        )
        for i in range(count)
    ]


def _generate_termin_payments_with_dates(
    count: int,
    total_amount: float,
    start_date: Optional[str],
    end_date: Optional[str]
) -> List[TerminPayment]:
    """
    Generate termin payments with actual month/year assignments based on contract duration.

    Distributes termin payment dates evenly across the contract period by dividing
    the total duration by the number of termins.

    Args:
        count: Number of termin periods (e.g., 4 for "Termin 4X")
        total_amount: Total contract amount to split
        start_date: Contract start date in YYYY-MM-DD format
        end_date: Contract end date in YYYY-MM-DD format

    Returns:
        List of TerminPayment objects with month/year period assignments.
        Falls back to basic generation if dates are invalid.

    Example:
        >>> _generate_termin_payments_with_dates(4, 100000000, "2024-01-01", "2024-12-31")
        [
            TerminPayment(termin_number=1, period="Maret 2024", amount=25000000, ...),
            TerminPayment(termin_number=2, period="Juni 2024", amount=25000000, ...),
            TerminPayment(termin_number=3, period="September 2024", amount=25000000, ...),
            TerminPayment(termin_number=4, period="Desember 2024", amount=25000000, ...),
        ]
    """
    if count <= 0 or total_amount <= 0:
        return []

    # Fallback to basic generation if dates are missing
    if not start_date or not end_date:
        return _auto_generate_termin_payments(count, total_amount)

    try:
        from datetime import datetime
        from dateutil.relativedelta import relativedelta

        # Parse dates
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")

        # Calculate total contract duration in months
        duration_months = (end.year - start.year) * 12 + (end.month - start.month) + 1

        if duration_months <= 0:
            # Invalid duration, fall back to basic generation
            return _auto_generate_termin_payments(count, total_amount)

        # Calculate interval between termins
        interval_months = duration_months / count

        # Calculate equal split amount per termin
        amount_per_termin = total_amount / count

        # Indonesian month names
        month_names_id = [
            "Januari", "Februari", "Maret", "April", "Mei", "Juni",
            "Juli", "Agustus", "September", "Oktober", "November", "Desember"
        ]

        # Generate termin payments with month assignments
        termin_payments = []
        for i in range(count):
            # For the last termin, use the end date
            if i == count - 1:
                termin_date = end
            else:
                # Calculate termin month: distribute evenly within contract period
                # Round to nearest month, with slight bias towards end of period
                import math
                target_month = round((duration_months / count) * (i + 1))
                months_to_add = target_month - 1  # -1 because relativedelta is 0-indexed from start
                termin_date = start + relativedelta(months=months_to_add)

            # Format period as "Bulan YYYY" (Indonesian)
            period = f"{month_names_id[termin_date.month - 1]} {termin_date.year}"

            termin_payments.append(
                TerminPayment(
                    termin_number=i + 1,
                    period=period,
                    amount=amount_per_termin,
                    raw_text=f"Auto-generated: {period}, dibagi rata dari total Rp {total_amount:,.0f}"
                )
            )

        return termin_payments

    except (ValueError, ImportError) as e:
        # If date parsing fails or dateutil not available, fall back to basic generation
        return _auto_generate_termin_payments(count, total_amount)

# -------------------- Robust Text Matching Utilities --------------------

def _normalize_text_for_matching(text: str) -> str:
    """
    Normalisasi teks OCR untuk pencocokan yang robust.
    Mengatasi variasi spasi, punctuation, dan OCR errors umum.
    """
    if not text:
        return ""
    
    # Lowercase dan hapus spasi berlebih
    text = re.sub(r'\s+', ' ', text.lower().strip())
    
    # Hapus punctuation umum yang sering muncul/hilang di OCR
    text = re.sub(r'[\.,:;\-_\(\)\[\]]+', '', text)
    
    # Normalisasi OCR errors umum
    text = text.replace('0', 'o')  # Angka nol jadi huruf O (untuk teks)
    text = text.replace('1', 'l')  # Angka satu jadi huruf l (untuk beberapa kasus)
    
    return text

def _calculate_text_similarity(text1: str, text2: str) -> float:
    """
    Hitung similarity antara dua teks menggunakan Jaccard similarity pada kata.
    Returns 0.0-1.0, dimana 1.0 = identik.
    """
    norm1 = _normalize_text_for_matching(text1)
    norm2 = _normalize_text_for_matching(text2)
    
    if not norm1 or not norm2:
        return 0.0
    
    # Jaccard similarity pada kata-kata
    words1 = set(norm1.split())
    words2 = set(norm2.split())
    
    if not words1 and not words2:
        return 1.0
    if not words1 or not words2:
        return 0.0
        
    intersection = words1.intersection(words2)
    union = words1.union(words2)
    
    return len(intersection) / len(union) if union else 0.0

def _find_fuzzy(texts: List[str], target: str, threshold: float = 0.6, start: int = 0) -> Optional[int]:
    """
    Cari teks menggunakan fuzzy matching dengan similarity threshold.
    """
    best_match = None
    best_score = 0.0
    
    for i in range(start, len(texts)):
        score = _calculate_text_similarity(texts[i], target)
        if score >= threshold and score > best_score:
            best_score = score
            best_match = i
    
    return best_match

def _find_containing(texts: List[str], target: str, start: int = 0) -> Optional[int]:
    """
    Cari token yang mengandung target substring (case-insensitive).
    Lebih permissive daripada exact match.
    """
    target_norm = _normalize_text_for_matching(target)
    
    for i in range(start, len(texts)):
        text_norm = _normalize_text_for_matching(texts[i])
        if target_norm in text_norm or text_norm in target_norm:
            return i
    
    return None

def _find_near_label(texts: List[str], labels: List[str], start: int = 0, max_distance: int = 5) -> Optional[int]:
    """
    Cari salah satu dari beberapa variasi label dalam jarak tertentu.
    """
    for label in labels:
        # Try exact match first
        idx = _find_eq(texts, label, start)
        if idx is not None:
            return idx
            
        # Try fuzzy match
        idx = _find_fuzzy(texts, label, 0.7, start)
        if idx is not None:
            return idx
            
        # Try containing match
        idx = _find_containing(texts, label, start)
        if idx is not None:
            return idx
    
    return None

def _extract_field_multi_strategy(texts: List[str], field_patterns: List[str], start_idx: int = 0) -> Optional[str]:
    """
    Ekstrak field menggunakan multiple strategies dalam urutan prioritas.
    """
    for pattern in field_patterns:
        # Strategy 1: Exact match + next token
        idx = _find_eq(texts, pattern, start_idx)
        if idx is not None and idx + 1 < len(texts):
            candidate = texts[idx + 1].strip()
            if candidate and candidate not in ['', 'Nama', 'Alamat', 'NPWP']:  # Skip obvious labels
                return candidate
        
        # Strategy 2: Fuzzy match + next token
        idx = _find_fuzzy(texts, pattern, 0.7, start_idx)
        if idx is not None and idx + 1 < len(texts):
            candidate = texts[idx + 1].strip()
            if candidate and candidate not in ['', 'Nama', 'Alamat', 'NPWP']:
                return candidate
        
        # Strategy 3: Containing match (for concatenated text)
        idx = _find_containing(texts, pattern, start_idx)
        if idx is not None:
            text = texts[idx]
            # Try to extract value after pattern in same token
            pattern_norm = _normalize_text_for_matching(pattern)
            text_norm = _normalize_text_for_matching(text)
            pos = text_norm.find(pattern_norm)
            if pos >= 0:
                remainder = text[pos + len(pattern):].strip()
                if remainder and remainder not in ['', 'Nama', 'Alamat', 'NPWP']:
                    return remainder
    
    return None

def _extract_cost_from_biaya_section(texts: List[str], cost_type: str) -> float:
    """
    Extract cost from structured BIAYA-BIAYA section.
    Pattern: "4.BIAYA-BIAYA(Rupiah)" -> "Biaya Instalasi" -> "Rp. X" -> "Biaya Langganan Tahunan" -> "Rp. Y"
    
    Args:
        texts: List of OCR text tokens
        cost_type: "instalasi" or "langganan"
    
    Returns:
        float: Extracted cost amount or 0.0 if not found
    """
    # Find the biaya section header
    biaya_header_patterns = [
        "4.BIAYA-BIAYA(Rupiah)",
        "4. BIAYA-BIAYA(Rupiah)", 
        "4.BIAYA-BIAYA (Rupiah)",
        "4. BIAYA-BIAYA (Rupiah)",
        "BIAYA-BIAYA(Rupiah)",
        "BIAYA-BIAYA (Rupiah)"
    ]
    
    start_idx = None
    for pattern in biaya_header_patterns:
        idx = _find_eq(texts, pattern)
        if idx is not None:
            start_idx = idx
            break
    
    if start_idx is None:
        return 0.0
    
    
    # Parse structured sequence starting from biaya header
    # Expected pattern: header -> "Biaya Instalasi" -> "Rp. X" -> "Biaya Langganan Tahunan" -> "Rp. Y"
    i = start_idx + 1
    instalasi_amount = 0.0
    langganan_amount = 0.0
    
    while i < len(texts):
        current_text = texts[i].strip()
        
        # Look for instalasi cost
        if ("Biaya Instalasi" in current_text or "BiayaInstalasi" in current_text) and i + 1 < len(texts):
            next_token = texts[i + 1].strip()
            if _MONEY_TOKEN.match(next_token):
                instalasi_amount = _parse_rupiah_token(next_token)
                i += 2  # Skip the money token
                continue
        
        # Look for langganan cost with more pattern variations
        if (("Biaya Langganan Tahunan" in current_text or
             "BiayaLanggananTahunan" in current_text or
             "BiayaLanggananITahun" in current_text or  # OCR variation: "I" instead of "1"
             "BiayaLangganan1Tahun" in current_text or  # OCR variation: explicit "1"
             "BiayaLangganan12Bulan" in current_text or  # PT MIFA format
             "Biaya Langganan 12 Bulan" in current_text or
             "Biaya Langganan Bulanan" in current_text or  # PT KLIK DATA: monthly fee
             "BiayaLanggananBulanan" in current_text or  # Concatenated variation
             "Biaya Langganan Selama" in current_text) and i + 1 < len(texts)):
            next_token = texts[i + 1].strip()
            if _MONEY_TOKEN.match(next_token):
                amount = _parse_rupiah_token(next_token)
                # Check if it's monthly fee - multiply by 12 to get yearly
                if "Bulanan" in current_text or "bulanan" in current_text:
                    langganan_amount = amount * 12
                else:
                    langganan_amount = amount
                i += 2  # Skip the money token
                continue
        
        # Stop if we hit the next major section
        if current_text.startswith("5.") or "TATA CARA PEMBAYARAN" in current_text:
            break
            
        i += 1
        
        # Safety limit - don't parse too far from biaya header
        if i > start_idx + 20:
            break
    
    if cost_type == "instalasi":
        return instalasi_amount
    elif cost_type == "langganan":
        return langganan_amount
    else:
        return 0.0

def _extract_cost_robust(texts: List[str], cost_patterns: List[str], max_distance: int = 10) -> float:
    """
    Ekstrak biaya dengan multiple strategies dan table parsing.
    """
    for pattern in cost_patterns:
        # Strategy 1: Exact match + next token (existing logic)
        idx = _find_eq(texts, pattern)
        if idx is not None:
            amount = _next_money(texts, idx)
            if amount > 0:
                return amount
        
        # Strategy 2: Fuzzy match + next token  
        idx = _find_fuzzy(texts, pattern, 0.7)
        if idx is not None:
            amount = _next_money(texts, idx)
            if amount > 0:
                return amount
        
        # Strategy 3: Containing match + nearby amounts
        idx = _find_containing(texts, pattern)
        if idx is not None:
            # Cari amount dalam radius max_distance tokens
            for i in range(max(0, idx - max_distance), min(len(texts), idx + max_distance + 1)):
                token = texts[i].strip()
                if _MONEY_TOKEN.match(token):
                    amount = _parse_rupiah_token(token)
                    if amount > 0:
                        return amount
        
        # Strategy 4: Look in HTML tables untuk pattern
        for text in texts:
            if '<table>' in text.lower() or '<html>' in text.lower():
                # Simple HTML parsing untuk amounts
                amounts = re.findall(r'(?:Rp\.?\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)', text)
                if amounts:
                    # Return first substantial amount (> 1000)
                    for amount_str in amounts:
                        amount = _parse_rupiah_token(amount_str)
                        if amount > 1000:  # Skip small amounts likely to be counts
                            return amount
    
    return 0.0

def _extract_cost_value_before_label(texts: List[str]) -> tuple[float, float]:
    """
    Handle cases where cost values appear BEFORE their labels in the texts array.
    This pattern appears in contracts like KONTRAK-PT-LKMS-MAHIRAH-MUAMALAH-2025.
    
    Pattern:
    "Rp. 0.," <- Biaya Instalasi value
    "Biaya Instalasi" <- Label
    "Rp. 20.113.200," <- Biaya Langganan Tahunan value  
    "Biaya Langganan Tahunan" <- Label
    
    Note: biaya_langganan_tahunan should never be free (0), only biaya_instalasi can be free.
    """
    biaya_instalasi = 0.0
    biaya_langganan_tahunan = 0.0
    
    # Look for "4. BIAYA-BIAYA" section first to locate the area
    biaya_section_idx = None
    for i, text in enumerate(texts):
        if "biaya-biaya" in text.lower() or "4. biaya-biaya" in text.lower():
            biaya_section_idx = i
            break
    
    if biaya_section_idx is not None:
        # Search in the section around "BIAYA-BIAYA" (before and after)
        search_start = max(0, biaya_section_idx - 5)
        search_end = min(len(texts), biaya_section_idx + 10)
        section_texts = texts[search_start:search_end]
        
        # Look for the pattern: amount followed by label
        instalasi_found = False
        langganan_found = False
        
        for i in range(len(section_texts) - 1):
            current_text = section_texts[i].strip()
            next_text = section_texts[i + 1].strip()
            
            # Check if current text is a money amount and next is "Biaya Instalasi"
            if (_MONEY_TOKEN.match(current_text) and 
                "biaya instalasi" in next_text.lower() and not instalasi_found):
                biaya_instalasi = _parse_rupiah_token(current_text)
                instalasi_found = True
            
            # Check if current text is a money amount and next is "Biaya Langganan Tahunan"
            elif (_MONEY_TOKEN.match(current_text) and 
                  ("biaya langganan tahunan" in next_text.lower() or "langganan tahunan" in next_text.lower()) and 
                  not langganan_found):
                amount = _parse_rupiah_token(current_text)
                # biaya_langganan_tahunan should never be 0 unless instalasi is the main cost
                if amount > 0:
                    biaya_langganan_tahunan = amount
                    langganan_found = True
    
    return biaya_instalasi, biaya_langganan_tahunan

def _extract_cost_special_cases(texts: List[str]) -> tuple[float, float]:
    """
    Handle special cases like "Free", "Rp 0", combined text patterns, and value-before-label patterns.
    """
    biaya_instalasi = 0.0
    biaya_langganan = 0.0
    
    # First check for "Free" pattern which is common and needs special handling
    full_text = " ".join(texts).lower()
    
    # PT MPG pattern: "Free", "Biaya Langganan Bulanan", "Rp896.462.640.-" as separate text blocks
    if "free" in full_text:
        if "instalasi" in full_text and "free" in full_text:
            # Instalasi free, set to 0 and find langganan amount
            biaya_instalasi = 0.0
            
            # Handle separated pattern where Free, Biaya Langganan, and amount are separate blocks
            found_free_idx = None
            found_langganan_idx = None
            amount_idx = None
            
            for i, text in enumerate(texts):
                if "free" == text.lower().strip():
                    found_free_idx = i
                elif "biaya langganan bulanan" in text.lower():
                    found_langganan_idx = i
                elif "rp" in text.lower() and re.match(r'^\s*Rp[\d\.\,\-]+', text, re.I):
                    amount_idx = i
            
            # If we found the separated pattern, extract the amount
            if found_free_idx and found_langganan_idx and amount_idx:
                # Check if the order makes sense (free, then langganan, then amount)
                if found_free_idx < found_langganan_idx < amount_idx:
                    parsed_amount = _parse_rupiah_token(texts[amount_idx])
                    biaya_langganan = parsed_amount
                    return biaya_instalasi, biaya_langganan
            
            # Try structured extraction first (more reliable)
            biaya_langganan = _extract_cost_from_biaya_section(texts, "langganan")

            # Fallback to enhanced pattern matching if structured extraction fails
            if biaya_langganan == 0.0:
                langganan_patterns = [
                    "Biaya Langganan Tahunan", "Langganan Tahunan", "Langganan Selama",
                    "Biaya Langganan Selama1Tahun", "Biaya Langganan Selama1tahun",
                    "Biaya Langganan Selama 1Tahun", "Biaya Langganan Selama 1tahun",
                    "Biaya Langganan Bulanan"  # Handle PT MPG edge case
                ]
                biaya_langganan = _extract_cost_robust(texts, langganan_patterns)
            return biaya_instalasi, biaya_langganan
        elif "langganan" in full_text and "free" in full_text:
            # Langganan free, cari instalasi amount  
            biaya_langganan = 0.0
            instalasi_patterns = ["Biaya Instalasi"]
            biaya_instalasi = _extract_cost_robust(texts, instalasi_patterns)
            return biaya_instalasi, biaya_langganan
    
    # First try structured biaya section parsing (most reliable for standard contracts)
    biaya_instalasi_structured = _extract_cost_from_biaya_section(texts, "instalasi")
    biaya_langganan_structured = _extract_cost_from_biaya_section(texts, "langganan")
    
    # Use structured results if both found or if langganan found (langganan is more critical)
    if biaya_langganan_structured > 0:
        return biaya_instalasi_structured, biaya_langganan_structured
    
    # Fallback: try the value-before-label pattern extraction
    instalasi_before, langganan_before = _extract_cost_value_before_label(texts)
    # Only use if we actually found meaningful values (not default 0,0)
    if langganan_before > 0 or (instalasi_before > 0 and langganan_before > 0):  
        return instalasi_before, langganan_before
    
    # If still no values found, try other pattern matching approaches
    
    # Case: Table-based extraction with specific patterns
    for text in texts:
        if "biaya instalasi" in text.lower() and "langganan" in text.lower():
            # Combined cost text, extract both
            amounts = re.findall(r'(?:Rp\.?\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)', text)
            if len(amounts) >= 2:
                biaya_instalasi = _parse_rupiah_token(amounts[0])
                biaya_langganan = _parse_rupiah_token(amounts[1])
                break
    
    return biaya_instalasi, biaya_langganan


# -------------------- Page 1 Extractor (One Time Charge) --------------------
def extract_from_page1_one_time(ocr_json_page1: Any) -> TelkomContractData:
    """
    Ekstraksi dari PAGE 1 untuk kasus 'One Time Charge'.
    - Mengisi: informasi_pelanggan (nama, alamat, npwp, perwakilan jika ada),
               layanan_utama (count),
               rincian_layanan (biaya instalasi & langganan tahunan),
               tata_cara_pembayaran (one_time_charge + raw_text).
    - Placeholder: kontak_person_telkom, informasi_pelanggan.kontak_person, jangka_waktu.
    """
    t0 = time.time()
    texts = _texts_from_ocr(ocr_json_page1)

    # --- Informasi Pelanggan (Enhanced Robust Extraction) ---
    nama_pelanggan = alamat = npwp = None
    perwakilan_nama = perwakilan_jabatan = None

    # Cari section pelanggan dengan multiple patterns
    # Note: Use section-specific patterns to avoid matching standalone numbers
    # The "2. PELANGGAN" pattern can match standalone "2" via containing match ("2" in "2. PELANGGAN")
    # So we need exact/fuzzy match first, then fallback to word "PELANGGAN" only
    pelanggan_patterns = ["2. PELANGGAN", "2.PELANGGAN", "2.  PELANGGAN", "2.PELANGGAN ", "PELANGGAN"]

    # Try exact match first (most reliable)
    idx_pelanggan = None
    for pattern in ["2. PELANGGAN", "2.PELANGGAN", "2.  PELANGGAN"]:
        idx = _find_eq(texts, pattern, 0)
        if idx is not None:
            # Check if this match is reasonable (not at the very end)
            # Some contracts have "2. PELANGGAN" at the end but actual data earlier
            if idx < len(texts) * 0.9:  # Must be in first 90% of document
                idx_pelanggan = idx
                break

    # If exact failed, try fuzzy (still reliable)
    if idx_pelanggan is None:
        idx_pelanggan = _find_fuzzy(texts, "2. PELANGGAN", 0.8, 0)
        if idx_pelanggan is not None and idx_pelanggan >= len(texts) * 0.9:
            idx_pelanggan = None  # Reject if too late in document

    # Try alternative pattern: "Identitas Perusahaan/Institusi" (appears in some contracts)
    # This helps when "2. PELANGGAN" appears at wrong position in rec_texts
    if idx_pelanggan is None:
        for pattern in ["Identitas Perusahaan/Institusi", "Identitas Perusahaan", "IdentitasPerusahaan/Institusi"]:
            idx = _find_eq(texts, pattern, 0)
            if idx is not None:
                idx_pelanggan = idx
                break
        if idx_pelanggan is None:
            idx_pelanggan = _find_fuzzy(texts, "Identitas Perusahaan", 0.7, 0)

    # Last resort: find "PELANGGAN" word alone (but not if it's at the very end)
    if idx_pelanggan is None:
        idx = _find_eq(texts, "PELANGGAN", 0)
        if idx is not None and idx < len(texts) * 0.9:
            idx_pelanggan = idx

    if idx_pelanggan is not None:
        # Multi-strategy extraction untuk fields utama
        nama_patterns = ["Nama", "nama", "NAMA"]
        alamat_patterns = ["Alamat", "alamat", "ALAMAT", "Alamat NPWP"]  # Handle concatenated case
        npwp_patterns = ["NPWP", "npwp"]

        nama_pelanggan = _extract_field_multi_strategy(texts, nama_patterns, idx_pelanggan)
        alamat = _extract_field_multi_strategy(texts, alamat_patterns, idx_pelanggan) 
        npwp = _extract_field_multi_strategy(texts, npwp_patterns, idx_pelanggan)
        
        # Clean up NPWP if it contains unwanted text
        if npwp and "diwakili" in npwp.lower():
            npwp = None  # Reset jika dapat noise text

        # Jika alamat dan NPWP concatenated, coba pisahkan
        if alamat and not npwp:
            # Cari pola NPWP dalam alamat (XX.XXX.XXX.X-XXX.XXX)
            npwp_match = re.search(r'\d{2}\.\d{3}\.\d{3}\.\d{1}-\d{3}\.\d{3}', alamat)
            if npwp_match:
                npwp = npwp_match.group(0)
                # Hapus NPWP dari alamat
                alamat = alamat.replace(npwp, '').strip()

        # Cari perwakilan dengan flexible matching
        # Note: OCR typos include "saholeh" (missing space), "saholeh：" (Chinese colon)
        # Try shorter, more specific patterns first to avoid false matches via containing
        perwakilan_patterns = [
            "Diwakili secara saholeh",  # OCR typo: missing space (try first)
            "diwakili secara saholeh",  # OCR typo lowercase
            "Diwakili secara sah oleh",  # Normal format without colon
            "diwakili secara sah oleh",
        ]
        # Manual search to avoid false positives from containing match
        idx_rep = None
        for pattern in perwakilan_patterns:
            # Try exact match first
            idx = _find_eq(texts, pattern, idx_pelanggan)
            if idx is not None:
                idx_rep = idx
                break
            # Try fuzzy match
            idx = _find_fuzzy(texts, pattern, 0.7, idx_pelanggan)
            if idx is not None:
                idx_rep = idx
                break

        # If still not found, try containing match carefully (only for longer patterns)
        if idx_rep is None:
            idx_rep = _find_containing(texts, "Diwakili secara sah", idx_pelanggan)
        
        if idx_rep is not None:
            perwakilan_nama = _extract_field_multi_strategy(texts, nama_patterns, idx_rep)
            jabatan_patterns = ["Jabatan", "jabatan", "JABATAN"]
            perwakilan_jabatan = _extract_field_multi_strategy(texts, jabatan_patterns, idx_rep)

    informasi_pelanggan = InformasiPelanggan(
        nama_pelanggan=nama_pelanggan,
        alamat=alamat,
        npwp=npwp,
        perwakilan=Perwakilan(nama=perwakilan_nama, jabatan=perwakilan_jabatan) if (perwakilan_nama or perwakilan_jabatan) else None,
        kontak_person=None,  # placeholder (ada di Page 2)
    )

    # --- Fallback: Try parsing_res_list if customer data is missing ---
    # Some contracts have poor rec_texts ordering (e.g., "2. PELANGGAN" at the end)
    # but correct structure in parsing_res_list
    if not nama_pelanggan and isinstance(ocr_json_page1, dict):
        parsing_texts = _texts_from_parsing_res_list(ocr_json_page1)
        if parsing_texts:
            # Re-run customer extraction with parsing_res_list derived texts
            idx_pelanggan_parsing = None
            for pattern in ["2. PELANGGAN", "2.PELANGGAN", "2.  PELANGGAN"]:
                idx = _find_eq(parsing_texts, pattern, 0)
                if idx is not None:
                    idx_pelanggan_parsing = idx
                    break

            if idx_pelanggan_parsing is None:
                idx_pelanggan_parsing = _find_fuzzy(parsing_texts, "2. PELANGGAN", 0.8, 0)

            if idx_pelanggan_parsing is None:
                idx_pelanggan_parsing = _find_eq(parsing_texts, "PELANGGAN", 0)

            if idx_pelanggan_parsing is not None:
                # Extract customer fields from parsing texts
                nama_patterns = ["Nama", "nama", "NAMA"]
                alamat_patterns = ["Alamat", "alamat", "ALAMAT", "Alamat NPWP"]
                npwp_patterns = ["NPWP", "npwp"]

                nama_pelanggan = _extract_field_multi_strategy(parsing_texts, nama_patterns, idx_pelanggan_parsing)
                alamat = _extract_field_multi_strategy(parsing_texts, alamat_patterns, idx_pelanggan_parsing)
                npwp = _extract_field_multi_strategy(parsing_texts, npwp_patterns, idx_pelanggan_parsing)

                # Special handling for "Alamat NPWP <address>" pattern (SMK Penerbangan case)
                # where alamat field returns "NPWP <address>" instead of just the address
                if alamat and alamat.startswith("NPWP "):
                    # This is actually "NPWP <address>" - the address starts after "NPWP "
                    actual_address = alamat[5:].strip()  # Remove "NPWP " prefix
                    alamat = actual_address
                    # Don't set npwp since the value after "NPWP" is the address, not NPWP number

                # Clean up NPWP
                if npwp and "diwakili" in npwp.lower():
                    npwp = None

                # Try to extract NPWP from alamat if needed
                if alamat and not npwp:
                    npwp_match = re.search(r'\d{2}\.\d{3}\.\d{3}\.\d{1}-\d{3}\.\d{3}', alamat)
                    if npwp_match:
                        npwp = npwp_match.group(0)
                        alamat = alamat.replace(npwp, '').strip()

                # Extract representative
                perwakilan_patterns = [
                    "Diwakili secara saholeh",
                    "diwakili secara saholeh",
                    "Diwakili secara sah oleh",
                    "diwakili secara sah oleh",
                ]
                idx_rep_parsing = None
                for pattern in perwakilan_patterns:
                    idx = _find_eq(parsing_texts, pattern, idx_pelanggan_parsing)
                    if idx is not None:
                        idx_rep_parsing = idx
                        break
                    idx = _find_fuzzy(parsing_texts, pattern, 0.7, idx_pelanggan_parsing)
                    if idx is not None:
                        idx_rep_parsing = idx
                        break

                if idx_rep_parsing is None:
                    idx_rep_parsing = _find_containing(parsing_texts, "Diwakili secara sah", idx_pelanggan_parsing)

                if idx_rep_parsing is not None:
                    perwakilan_nama = _extract_field_multi_strategy(parsing_texts, nama_patterns, idx_rep_parsing)
                    jabatan_patterns = ["Jabatan", "jabatan", "JABATAN"]
                    perwakilan_jabatan = _extract_field_multi_strategy(parsing_texts, jabatan_patterns, idx_rep_parsing)

                # Update informasi_pelanggan with parsing-based extraction
                informasi_pelanggan = InformasiPelanggan(
                    nama_pelanggan=nama_pelanggan,
                    alamat=alamat,
                    npwp=npwp,
                    perwakilan=Perwakilan(nama=perwakilan_nama, jabatan=perwakilan_jabatan) if (perwakilan_nama or perwakilan_jabatan) else None,
                    kontak_person=None,
                )

    # --- Layanan Utama (Enhanced Robust Counts) ---
    # Multiple patterns untuk setiap service type dengan variasi spasi OCR
    connectivity_patterns = [
        "Layanan Connectivity TELKOM",          # Standard format (SMK Penerbangan, SMKN Bireun)
        "LayananConnectivityTELKOM",            # Tanpa spasi sama sekali
        "LayananConnectivity TELKOM",           # PT MPG format (tanpa spasi setelah "Layanan")
        "Layanan ConnectivityTELKOM",           # Tanpa spasi setelah "Connectivity"
        "Connectivity TELKOM",                   # Simplified format
        "LAYANAN CONNECTIVITY TELKOM",          # Uppercase variant
        "LAYANANCONNECTIVITYTELKOM",            # Full concatenated
    ]
    
    non_connectivity_patterns = [
        "Layanan Non-Connectivity TELKOM",          # Standard format
        "LayananNon-ConnectivityTELKOM",            # Tanpa spasi setelah "Layanan"
        "Layanan Non-ConnectivityTELKOM",           # Tanpa spasi setelah "Non-Connectivity"
        "LayananNon-Connectivity TELKOM",           # Tanpa spasi sebelum, dengan spasi setelah
        "Non-Connectivity TELKOM",                   # Simplified format
        "LAYANAN NON-CONNECTIVITY TELKOM",          # Uppercase variant
        "LAYANANNON-CONNECTIVITYTELKOM",            # Full concatenated
    ]
    
    bundling_patterns = [
        "Bundling Layanan Connectivity TELKOM& Solusi",        # Standard format 
        "BundlingLayananConnectivityTELKOM&Solusi",            # PT MPG format (full concatenated)
        "Bundling LayananConnectivityTELKOM&Solusi",           # SMK Penerbangan format 
        "Bundling Layanan Connectivity TELKOM & Solusi",       # SMKN Bireun format (dengan spasi sebelum &)
        "BundlingLayanan Connectivity TELKOM&Solusi",          # Mixed format
        "Bundling LayananConnectivity TELKOM&Solusi",          # Mixed format 2
        "BUNDLING LAYANAN CONNECTIVITY TELKOM& SOLUSI",        # Uppercase variant
        "BUNDLINGLAYANANCONNECTIVITYTELKOM&SOLUSI",           # Full uppercase concatenated
    ]
    
    connectivity = _find_count_robust(texts, connectivity_patterns)
    non_connectivity = _find_count_robust(texts, non_connectivity_patterns)
    bundling = _find_count_robust(texts, bundling_patterns)
    
    layanan_utama = LayananUtama(
        connectivity_telkom=connectivity,
        non_connectivity_telkom=non_connectivity,
        bundling=bundling,
    )

    # --- Rincian Layanan (Enhanced Robust Cost Extraction) ---
    biaya_instalasi = 0.0
    biaya_langganan_tahunan = 0.0

    # Try special cases first (Free, combined patterns)
    special_instalasi, special_langganan = _extract_cost_special_cases(texts)
    if special_instalasi > 0 or special_langganan > 0:  # Only use if we found actual values
        biaya_instalasi = special_instalasi
        biaya_langganan_tahunan = special_langganan
    else:
        # Multiple patterns untuk biaya instalasi
        instalasi_patterns = [
            "Biaya Instalasi",
            "BiayaInstalasi", 
            "BIAYA INSTALASI",
            "Biaya Instalasi Rp"
        ]
        
        # Multiple patterns untuk biaya langganan (only specific patterns to avoid false matches)
        langganan_patterns = [
            "Biaya Langganan Tahunan",       # Most specific first
            "BiayaLanggananTahunan",
            "BiayaLanggananITahun",          # OCR variation: "I" (capital i) instead of "1"
            "BiayaLangganan1Tahun",          # OCR variation: explicit number "1"
            "BIAYA LANGGANAN TAHUNAN",
            "Biaya Langganan Selama1Tahun",  # Handle concatenated case
            "Biaya Langganan Selama1tahun",  # Handle lowercase OCR variation
            "Biaya Langganan Selama 1Tahun", # Handle spaced variation
            "Biaya Langganan Selama 1tahun", # Handle spaced + lowercase variation
            "BiayaLanggananSelama1Tahun",    # Handle completely concatenated
            "BiayaLanggananSelama1tahun",    # Handle concatenated + lowercase
            "Biaya Langganan Selama",        # Keep this for general "Selama" patterns
            "Biaya Langganan Bulanan",       # Monthly fee (will be multiplied by 12)
            "BiayaLanggananBulanan"          # Monthly fee concatenated
        ]
        
        # First try structured biaya section parsing
        biaya_langganan_tahunan = _extract_cost_from_biaya_section(texts, "langganan")
        if biaya_langganan_tahunan == 0.0:
            # Fallback to pattern-based extraction
            biaya_langganan_tahunan = _extract_cost_robust(texts, langganan_patterns)
        
        # First try structured biaya section parsing for instalasi too
        biaya_instalasi = _extract_cost_from_biaya_section(texts, "instalasi")
        if biaya_instalasi == 0.0:
            # Fallback to pattern-based extraction
            biaya_instalasi = _extract_cost_robust(texts, instalasi_patterns)

    rincian_layanan = [
        RincianLayanan(
            biaya_instalasi=biaya_instalasi,
            biaya_langganan_tahunan=biaya_langganan_tahunan,
            tata_cara_pembayaran=None,  # di level utama kita isi di bawah
        )
    ]

    # --- Tata Cara Pembayaran (Dynamic Detection) ---
    raw_tata = _slice_after_keyword(texts, "TATA CARA PEMBAYARAN", span=16)
    
    # Deteksi metode pembayaran secara dinamis
    method_type, description, confidence = _detect_payment_type(texts)
    
    # Jika termin, ekstrak detail pembayaran termin
    termin_payments = None
    total_termin_count = None
    total_amount = None
    
    if method_type == "termin":
        # Try to extract full termin details first
        termin_list, count, amount = _extract_termin_payments(texts)
        if termin_list:  # Jika berhasil ekstrak termin lengkap
            termin_payments = termin_list
            total_termin_count = count
            total_amount = amount
            description = f"Pembayaran termin ({count} periode)"
        else:
            # Fallback: extract termin count only (for edge cases without amounts)
            count_only = _extract_termin_count_only(texts)

            if count_only:
                # Calculate total contract cost for auto-generation
                total_contract_cost = biaya_langganan_tahunan + biaya_instalasi

                if total_contract_cost > 0:
                    # AUTO-GENERATE: Split total cost evenly across termins
                    termin_payments = _auto_generate_termin_payments(count_only, total_contract_cost)
                    total_termin_count = count_only
                    total_amount = total_contract_cost
                    description = f"Pembayaran termin ({count_only} periode, dibagi rata otomatis)"
                else:
                    # No cost data available, can't auto-generate amounts
                    total_termin_count = count_only
                    total_amount = 0
                    description = f"Pembayaran termin ({count_only} periode, menunggu input biaya)"
            else:
                # Last resort: termin detected but no count found
                description = "Pembayaran termin terdeteksi (gagal ekstrak detail)"
    
    tata_cara_pembayaran = TataCaraPembayaran(
        method_type=method_type,
        description=description,
        termin_payments=termin_payments,
        total_termin_count=total_termin_count,
        total_amount=total_amount,
        raw_text=raw_tata or None,
    )

    # --- Kontak Person Telkom (placeholder; ada di Page 2) ---
    kontak_person_telkom = KontakPersonTelkom(
        nama=None, jabatan=None, email=None, telepon=None
    )

    # --- Jangka Waktu (placeholder; ada di Page 2) ---
    jangka_waktu = JangkaWaktu(mulai=None, akhir=None)

    data = TelkomContractData(
        informasi_pelanggan=informasi_pelanggan,
        layanan_utama=layanan_utama,
        rincian_layanan=rincian_layanan,
        tata_cara_pembayaran=tata_cara_pembayaran,
        kontak_person_telkom=kontak_person_telkom,
        jangka_waktu=jangka_waktu,
        extraction_timestamp=datetime.now(),
        processing_time_seconds=round(time.time() - t0, 3),
    )
    return data


# -------------------- Indonesian date parsing (robust) --------------------
_ID_MONTHS = {
    "jan": 1, "januari": 1,
    "feb": 2, "februari": 2,
    "mar": 3, "maret": 3,
    "apr": 4, "april": 4,
    "mei": 5,
    "jun": 6, "juni": 6,
    "jul": 7, "juli": 7,
    "agu": 8, "agustus": 8,
    "sep": 9, "sept": 9, "september": 9,
    "okt": 10, "oktober": 10,
    "nov": 11, "november": 11,
    "des": 12, "desember": 12,
}

def _to_iso_date(y: int, m: int, d: int) -> Optional[str]:
    try:
        return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
    except Exception:
        return None

def _parse_date_id(s: str) -> Optional[str]:
    s = s.strip()
    print(f"🔍 DEBUG _parse_date_id: Attempting to parse '{s}'")
    
    # ISO: YYYY-MM-DD
    m = re.search(r"\b(20\d{2}|19\d{2})-(\d{1,2})-(\d{1,2})\b", s)
    if m:
        result = _to_iso_date(m.group(1), m.group(2), m.group(3))
        print(f"✅ DEBUG _parse_date_id: ISO format matched: {result}")
        return result
    
    # DD[-/]MM[-/]YYYY
    m = re.search(r"\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2}|19\d{2})\b", s)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        result = _to_iso_date(y, mo, d)
        print(f"✅ DEBUG _parse_date_id: DD/MM/YYYY format matched: {result}")
        return result
    
    # D Month YYYY (Indonesia) with spaces
    m = re.search(r"\b(\d{1,2})\s+([A-Za-z\.]+)\s+(20\d{2}|19\d{2})\b", s)
    if m:
        d = int(m.group(1))
        mon = m.group(2).lower().strip(".")
        y = int(m.group(3))
        print(f"🔍 DEBUG _parse_date_id: Spaced format - day: {d}, month: '{mon}', year: {y}")
        if mon in _ID_MONTHS:
            result = _to_iso_date(y, _ID_MONTHS[mon], d)
            print(f"✅ DEBUG _parse_date_id: Spaced format matched: {result}")
            return result
        else:
            print(f"❌ DEBUG _parse_date_id: Month '{mon}' not found in _ID_MONTHS")
    
    # Concatenated format: DDMonthYYYY (e.g., "23Februari2027")  
    m = re.search(r"(\d{1,2})([A-Za-z]+)(\d{4})", s)  # Removed \b boundaries
    if m:
        d = int(m.group(1))
        mon = m.group(2).lower()
        y = int(m.group(3))
        print(f"🔍 DEBUG _parse_date_id: Concatenated format - day: {d}, month: '{mon}', year: {y}")
        if mon in _ID_MONTHS:
            result = _to_iso_date(y, _ID_MONTHS[mon], d)
            print(f"✅ DEBUG _parse_date_id: Concatenated format matched: {result}")
            return result
        else:
            print(f"❌ DEBUG _parse_date_id: Month '{mon}' not found in _ID_MONTHS")
    
    # Format with optional spaces: DD [space] Month YYYY (e.g., "31 Desember2025")
    m = re.search(r"(\d{1,2})\s*([A-Za-z]+)(\d{4})", s)  # Removed \b boundaries  
    if m:
        d = int(m.group(1))
        mon = m.group(2).lower()
        y = int(m.group(3))
        print(f"🔍 DEBUG _parse_date_id: Optional spaces format - day: {d}, month: '{mon}', year: {y}")
        if mon in _ID_MONTHS:
            result = _to_iso_date(y, _ID_MONTHS[mon], d)
            print(f"✅ DEBUG _parse_date_id: Optional spaces format matched: {result}")
            return result
        else:
            print(f"❌ DEBUG _parse_date_id: Month '{mon}' not found in _ID_MONTHS")
    
    # CRITICAL PATTERN: DD+Month + space + YYYY (e.g., "23Februari 2027")
    m = re.search(r"(\d{1,2})([A-Za-z]+)\s+(\d{4})", s)
    if m:
        d = int(m.group(1))
        mon = m.group(2).lower()
        y = int(m.group(3))
        print(f"🔍 DEBUG _parse_date_id: CRITICAL pattern - day: {d}, month: '{mon}', year: {y}")
        if mon in _ID_MONTHS:
            result = _to_iso_date(y, _ID_MONTHS[mon], d)
            print(f"✅ DEBUG _parse_date_id: CRITICAL pattern matched: {result}")
            return result
        else:
            print(f"❌ DEBUG _parse_date_id: Month '{mon}' not found in _ID_MONTHS")
    
    print(f"❌ DEBUG _parse_date_id: No pattern matched for '{s}'")
    return None

# -------------------- Page 2: robust jangka waktu + kontak --------------------
def _blob(texts: List[str]) -> str:
    return "\n".join(texts)

def _norm_label(s: str) -> str:
    s = s.lower().strip()
    s = s.replace("*", "").replace(")", "").replace("(", "")
    s = s.replace(":", "")
    s = s.replace("telepon/gsm", "telepon")
    s = s.replace("e-mail", "email").replace("email", "email")
    return s.strip()  # Final strip to remove any trailing spaces

_EMAIL_RE = re.compile(r"[\w\.-]+@[\w\.-]+\.\w+", re.I)
_PHONE_RE = re.compile(r"(?:\+62|0)[\d\-\s]{7,20}", re.I)

def _is_email(tok: str) -> bool:
    return bool(_EMAIL_RE.fullmatch(tok.strip()))

def _is_phone(tok: str) -> bool:
    return bool(_PHONE_RE.fullmatch(tok.strip()))

def _find_date_range_in_texts(texts: List[str]) -> tuple[Optional[str], Optional[str]]:
    """
    Find date range by looking for specific lines in texts array containing "berlaku sejak tanggal".
    Handles both "hingga" and "sampai dengan" variations, including concatenated dates and trailing text.
    """
    print("🔍 DEBUG: _find_date_range_in_texts called")
    print(f"🔍 DEBUG: Total texts to search: {len(texts)}")
    
    # Enhanced patterns that handle all possible OCR variations and formatting issues
    date_range_patterns = [
        # Pattern 1: Standard spaced format with "berlaku sejak tanggal"
        r"berlaku\s+sejak\s+tanggal\s+(\d{1,2}\s+\w+\s+\d{4})\s+(?:hingga|sampai\s+dengan)\s+(\d{1,2}\s+\w+\s+\d{4})",
        
        # Pattern 2: Standard format with concatenated end date
        r"berlaku\s+sejak\s+tanggal\s+(\d{1,2}\s+\w+\s+\d{4})\s+(?:hingga|sampai\s+dengan)\s*(\d{1,2}\w+\d{4})",
        
        # Pattern 3: CRITICAL - Concatenated "sejaktanggal" format (like the penerbangan sample)
        r"berlaku\s+sejaktanggal\s+(\d{1,2}\w+\d{4})\s+(?:hingga|sampai\s+dengan)\s*(\d{1,2}\w+\d{4})",
        
        # Pattern 4: Mixed concatenated start, spaced end
        r"berlaku\s+sejaktanggal\s+(\d{1,2}\w+\d{4})\s+(?:hingga|sampai\s+dengan)\s+(\d{1,2}\s+\w+\s+\d{4})",
        
        # Pattern 5: Flexible "berlaku sejak" without "tanggal"
        r"berlaku\s+sejak\s+(\d{1,2}\s+\w+\s+\d{4})\s+(?:hingga|sampai\s+dengan)\s*(\d{1,2}\w+\d{4})",
        
        # Pattern 6: Very flexible fallback - any "sejak" pattern
        r"sejak\s*tanggal?\s*(\d{1,2}[\w\s]+\d{4})\s+(?:hingga|sampai\s+dengan)\s*(\d{1,2}[\w\s]*\d{4})",
        
        # Pattern 7: OCR concatenation variations
        r"berlaku.*?(\d{1,2}\w+\d{4}).*?(?:hingga|sampai.*?dengan).*?(\d{1,2}\w+\d{4})",
        
        # Pattern 8: Very permissive date range finder
        r"(\d{1,2}[\w\s]+\d{4})\s+(?:hingga|sampai\s+dengan)\s*(\d{1,2}[\w\s]*\d{4})"
    ]
    
    # First, look for any lines containing the search phrase
    matching_lines = []
    for i, text_line in enumerate(texts):
        # Enhanced search terms to catch all possible variations
        search_terms = [
            "berlaku sejak tanggal",
            "berlaku sejaktanggal",  # concatenated version
            "berlaku sejak",
            "sejak tanggal", 
            "sejaktanggal"
        ]
        
        if any(term in text_line.lower() for term in search_terms):
            matching_lines.append((i, text_line))
            print(f"🔍 DEBUG: Found matching line at index {i}: '{text_line}'")
    
    if not matching_lines:
        print("🔍 DEBUG: No lines found containing 'berlaku sejak tanggal'")
        return None, None
    
    for line_idx, text_line in matching_lines:
        print(f"🔍 DEBUG: Processing line {line_idx}: '{text_line}'")
        
        # Try all patterns on this line
        for pattern_idx, pattern in enumerate(date_range_patterns):
            print(f"🔍 DEBUG: Trying pattern {pattern_idx + 1}: {pattern}")
            match = re.search(pattern, text_line, flags=re.I)
            if match:
                print(f"✅ DEBUG: Pattern {pattern_idx + 1} MATCHED!")
                start_str = match.group(1).strip()
                end_str = match.group(2).strip()
                print(f"🔍 DEBUG: Raw captures - start: '{start_str}', end: '{end_str}'")
                
                # Clean up captured groups - normalize spaces
                start_str = re.sub(r'\s+', ' ', start_str)
                end_str = re.sub(r'\s+', ' ', end_str)
                print(f"🔍 DEBUG: Cleaned captures - start: '{start_str}', end: '{end_str}'")
                
                # Additional cleanup for concatenated dates
                # Handle cases like "23Februari2027" -> ensure proper parsing
                if not ' ' in end_str and len(end_str) > 8:  # Likely concatenated format
                    print(f"🔍 DEBUG: Detected concatenated end date: '{end_str}'")
                    # Try to add spaces for better parsing: "23Februari2027" -> "23 Februari 2027"
                    concatenated_match = re.match(r'(\d{1,2})([A-Za-z]+)(\d{4})', end_str)
                    if concatenated_match:
                        day, month, year = concatenated_match.groups()
                        end_str_spaced = f"{day} {month} {year}"
                        print(f"🔍 DEBUG: Trying spaced version: '{end_str_spaced}'")
                        # Try parsing the spaced version first
                        end_date_spaced = _parse_date_id(end_str_spaced)
                        if end_date_spaced:
                            print(f"✅ DEBUG: Spaced version parsed successfully: {end_date_spaced}")
                            end_str = end_str_spaced
                        else:
                            print(f"❌ DEBUG: Spaced version parsing failed")
                
                # Parse both dates
                print(f"🔍 DEBUG: Attempting to parse dates...")
                start_date = _parse_date_id(start_str)
                end_date = _parse_date_id(end_str)
                print(f"🔍 DEBUG: Parse results - start: {start_date}, end: {end_date}")
                
                # Return if both dates are valid and different
                if start_date and end_date and start_date != end_date:
                    print(f"✅ DEBUG: SUCCESS! Returning dates: start={start_date}, end={end_date}")
                    return start_date, end_date
                
                # If parsing failed but we had a match, try parsing original concatenated format
                if not end_date and not ' ' in match.group(2).strip():
                    print(f"🔍 DEBUG: Retrying with original concatenated format: '{match.group(2).strip()}'")
                    end_date = _parse_date_id(match.group(2).strip())
                    print(f"🔍 DEBUG: Retry parse result: {end_date}")
                    if start_date and end_date and start_date != end_date:
                        print(f"✅ DEBUG: SUCCESS on retry! Returning dates: start={start_date}, end={end_date}")
                        return start_date, end_date
                
                print(f"❌ DEBUG: Pattern {pattern_idx + 1} matched but date parsing failed")
            else:
                print(f"❌ DEBUG: Pattern {pattern_idx + 1} did not match")
    
    print("❌ DEBUG: No successful matches found, returning None, None")
    return None, None

def _extract_jangka_waktu(texts: List[str]) -> tuple[Optional[str], Optional[str]]:
    """
    Enhanced robust extraction untuk jangka waktu kontrak.
    Prioritizes direct extraction from individual text lines containing date ranges.
    """
    # Strategy 1: Direct extraction from texts array - look for "berlaku sejak tanggal" lines
    start_date, end_date = _find_date_range_in_texts(texts)
    if start_date and end_date:
        return start_date, end_date
    
    # Strategy 2: Look in JANGKA WAKTU section with focused approach
    jangka_waktu_patterns = ["6.JANGKA WAKTU", "6. JANGKA WAKTU", "6.JANGKAWAKTU", "JANGKA WAKTU"]
    jangka_idx = _find_near_label(texts, jangka_waktu_patterns)
    
    if jangka_idx is not None:
        # Get section texts and try direct extraction first
        section_texts = texts[jangka_idx:min(jangka_idx + 15, len(texts))]
        start_date, end_date = _find_date_range_in_texts(section_texts)
        if start_date and end_date:
            return start_date, end_date
        
        # Fallback: Look for date patterns in section
        for text_line in section_texts:
            # Simple date range patterns within section
            date_patterns = [
                r"(\d{1,2}\s+\w+\s+\d{4})\s+(?:hingga|sampai\s+dengan)\s+(\d{1,2}[\s\w]*\d{4})",
                r"(\d{1,2}\w+\d{4})\s+(?:hingga|sampai\s+dengan)\s+(\d{1,2}\w+\d{4})"
            ]
            
            for pattern in date_patterns:
                match = re.search(pattern, text_line, flags=re.I)
                if match:
                    start_str = match.group(1).strip()
                    end_str = match.group(2).strip()
                    
                    start = _parse_date_id(start_str)
                    end = _parse_date_id(end_str)
                    if start and end and start != end:
                        return start, end
    
    # Strategy 3: Enhanced proximity search for contract date ranges
    date_tokens = []
    seen_dates = set()
    
    # Collect more date candidates for better selection
    for i, tok in enumerate(texts):
        d = _parse_date_id(tok)
        if d and d not in seen_dates:
            date_tokens.append((i, d, tok))  # Include original text for context
            seen_dates.add(d)
        if len(date_tokens) >= 10:  # Get more candidates
            break
    
    print(f"🔍 DEBUG: Found {len(date_tokens)} unique dates: {[(i, d) for i, d, _ in date_tokens]}")
    
    if len(date_tokens) >= 2:
        # Smart date pair selection algorithm
        best_pair = None
        best_score = -1
        
        for i in range(len(date_tokens)):
            for j in range(i + 1, len(date_tokens)):
                idx1, date1, text1 = date_tokens[i]
                idx2, date2, text2 = date_tokens[j]
                
                # Ensure chronological order
                start_date, end_date = (date1, date2) if date1 < date2 else (date2, date1)
                start_idx, end_idx = (idx1, idx2) if date1 < date2 else (idx2, idx1)
                
                # Calculate date range (in days)
                from datetime import datetime
                try:
                    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d")
                    days_diff = (end_dt - start_dt).days
                except:
                    continue
                
                # Scoring criteria for contract date ranges
                score = 0
                
                # 1. Prefer reasonable contract durations (30 days to 5 years)
                if 30 <= days_diff <= 1825:  # 30 days to 5 years
                    score += 100
                elif 1 <= days_diff <= 30:  # Very short contracts
                    score += 20
                else:
                    score -= 50  # Too short or too long
                
                # 2. Prefer dates that are closer together in the text (contract dates are usually mentioned together)
                text_distance = abs(start_idx - end_idx)
                if text_distance <= 5:
                    score += 50
                elif text_distance <= 10:
                    score += 20
                else:
                    score -= 10
                
                # 3. Penalize obvious signature dates (single day differences or dates at end of document)
                if days_diff <= 2:  # Likely signature dates
                    score -= 100
                
                # 4. Prefer dates from earlier in jangka waktu section
                if start_idx <= 15:  # Earlier in the section
                    score += 30
                
                print(f"🔍 DEBUG: Date pair ({start_date}, {end_date}) - days: {days_diff}, text_distance: {text_distance}, score: {score}")
                
                if score > best_score:
                    best_score = score
                    best_pair = (start_date, end_date)
        
        if best_pair and best_score > 0:
            print(f"✅ DEBUG: Selected best date pair with score {best_score}: {best_pair}")
            return best_pair
        
        # Fallback: if no good pair found, use chronological order but skip obvious signature dates
        dates_only = [date for _, date, _ in date_tokens]
        dates_only.sort()
        
        # Try to find a pair that's not just 1-2 days apart (signature dates)
        for i in range(len(dates_only) - 1):
            for j in range(i + 1, len(dates_only)):
                try:
                    start_dt = datetime.strptime(dates_only[i], "%Y-%m-%d")
                    end_dt = datetime.strptime(dates_only[j], "%Y-%m-%d")
                    days_diff = (end_dt - start_dt).days
                    if days_diff >= 30:  # At least 30 days for a reasonable contract
                        print(f"✅ DEBUG: Fallback selection: {dates_only[i]}, {dates_only[j]} ({days_diff} days)")
                        return dates_only[i], dates_only[j]
                except:
                    continue
        
        # Last resort: first two different dates
        if len(dates_only) >= 2 and dates_only[0] != dates_only[1]:
            print(f"⚠️  DEBUG: Last resort selection: {dates_only[0]}, {dates_only[1]}")
            return dates_only[0], dates_only[1]
    
    return None, None

def _extract_contact_blocks(texts: List[str]) -> tuple[Dict[str, str], Dict[str, str]]:
    """
    Enhanced robust extraction untuk contact blocks:
    - Blok pertama: TELKOM
    - Blok kedua: PELANGGAN
    Menggunakan fuzzy matching dan multiple strategies.
    """
    # Strategy 1: Cari anchor "7.KONTAK PERSON" dengan fuzzy matching
    kontak_patterns = [
        "7. KONTAKPERSON",      # PT KLIK DATA: space after period, concatenated word
        "7.KONTAKPERSON",       # No space after period, concatenated
        "7. KONTAK PERSON",     # Space after period, spaced words
        "7.KONTAK PERSON",      # No space after period, spaced words
        "KONTAKPERSON",         # Just header, concatenated
        "KONTAK PERSON",        # Just header, spaced
        "7KONTAK PERSON"        # Missing period
    ]
    start = _find_near_label(texts, kontak_patterns)
    
    if start is None:
        # Strategy 2: Cari berdasarkan context pattern
        for i, text in enumerate(texts):
            if "kontak" in text.lower() and "person" in text.lower():
                start = i
                break
    
    if start is None:
        return {}, {}

    # Ambil subarray wajar (hingga sebelum tanda tangan)
    sub = texts[start : min(start + 120, len(texts))]

    # Strategy 1: Cari token "TELKOM" dengan fuzzy matching
    telkom_patterns = ["TELKOM", "PT TELKOM", "PT. TELKOM"]
    telkom_anchor = _find_near_label(sub, telkom_patterns, 0)
    
    if telkom_anchor is None:
        # Strategy 2: Cari berdasarkan context pattern
        for i, text in enumerate(sub):
            if "telkom" in text.lower():
                telkom_anchor = i
                break
        if telkom_anchor is None:
            telkom_anchor = 0  # fallback ke awal sub
    
    telkom_tokens = sub[telkom_anchor : ]

    # Enhanced robust contact reading dengan fuzzy matching
    def read_contact(seq: List[str]) -> tuple[Dict[str, str], int]:
        fields = {"nama": None, "jabatan": None, "telepon": None, "email": None}
        field_patterns = {
            "nama": ["Nama", "nama", "NAMA", "Name"],
            "jabatan": ["Jabatan", "jabatan", "JABATAN", "Posisi", "Position"],
            "telepon": ["Telepon", "telepon", "TELEPON", "Tlp", "TLP", "Phone", "No. Tlp"],
            "email": ["Email", "email", "EMAIL", "E-mail", "e-mail", "E-Mail"]
        }
        
        i = 0
        last_label = None
        hits = 0
        
        while i < len(seq):
            tok_raw = seq[i].strip()
            
            # Strategy 1: Exact label matching (existing logic)
            tok_norm = _norm_label(tok_raw)
            matched_field = None
            for field, patterns in field_patterns.items():
                if any(_norm_label(pattern) == tok_norm for pattern in patterns):
                    matched_field = field
                    break
            
            if matched_field:
                # Heuristik switch: jika muncul "Nama" baru DAN sudah ada minimal 2 field → akhir blok
                if matched_field == "nama" and sum(1 for v in fields.values() if v) >= 2:
                    break
                last_label = matched_field
                i += 1
                continue
            
            # Strategy 2: Fuzzy label matching jika exact gagal
            if not matched_field:
                for field, patterns in field_patterns.items():
                    for pattern in patterns:
                        if _calculate_text_similarity(tok_raw, pattern) >= 0.7:
                            matched_field = field
                            break
                    if matched_field:
                        break
                
                if matched_field:
                    last_label = matched_field
                    i += 1
                    continue
            
            # Process value jika ada active label
            if last_label:
                val = tok_raw.strip()
                
                # Enhanced validation dengan OCR error tolerance
                if last_label == "email":
                    # Fix common OCR errors in email addresses FIRST
                    # Pattern: 406090atelkom.co.id → 406090@telkom.co.id
                    fixed_val = val
                    if re.match(r'^\d+a[a-z]+\.(co\.id|com)', fixed_val, re.I):
                        fixed_val = re.sub(r'(\d+)a([a-z]+)', r'\1@\2', fixed_val, count=1)
                    # Pattern: 406090attelkom.co.id → 406090@telkom.co.id
                    elif re.match(r'^\d+at[a-z]+\.(co\.id|com)', fixed_val, re.I):
                        fixed_val = re.sub(r'(\d+)at([a-z]+)', r'\1@\2', fixed_val, count=1)

                    # Cek current token dan next token untuk email
                    email_candidates = [fixed_val, val]  # Try fixed version first
                    if i + 1 < len(seq):
                        email_candidates.append(seq[i + 1].strip())

                    valid_email = None
                    for email_candidate in email_candidates:
                        if _is_email(email_candidate):
                            valid_email = email_candidate
                            if email_candidate != val:
                                i += 1  # Skip next token jika itu yang dipake
                            break
                    
                    if valid_email:
                        val = valid_email
                    else:
                        # Coba bersihkan OCR errors umum dalam email
                        cleaned_val = val.replace(' ', '').replace('0', 'o')  # Angka nol jadi huruf o
                        if _is_email(cleaned_val):
                            val = cleaned_val
                        else:
                            last_label = None
                            i += 1
                            continue
                
                elif last_label == "telepon":
                    # Similar logic untuk telepon
                    phone_candidates = [val]
                    if i + 1 < len(seq):
                        phone_candidates.append(seq[i + 1].strip())
                    
                    valid_phone = None
                    for phone_candidate in phone_candidates:
                        if _is_phone(phone_candidate):
                            valid_phone = phone_candidate
                            if phone_candidate != val:
                                i += 1
                            break
                    
                    if valid_phone:
                        val = valid_phone
                    else:
                        # Bersihkan spasi berlebih untuk telepon
                        cleaned_val = re.sub(r'\s+', '', val)
                        if _is_phone(cleaned_val):
                            val = cleaned_val
                        else:
                            last_label = None
                            i += 1
                            continue
                
                # Assign jika field belum terisi dan value valid
                if fields.get(last_label) is None and val and val not in ['', '-', 'N/A']:
                    fields[last_label] = val
                    hits += 1
                
                last_label = None
                i += 1
                
                # Stop heuristik: jika minimal nama + jabatan sudah ketemu
                if hits >= 2 and fields.get("nama") and fields.get("jabatan"):
                    # Lanjut sedikit untuk email/telepon
                    if hits >= 4:
                        break
                continue

            # Heuristik stop patterns
            if any(stop_phrase in tok_raw.lower() for stop_phrase in ["wajib diisi", "tanda tangan", "ttd"]):
                i += 1
                break
            
            i += 1

        return fields, i

    telkom_fields, consumed = read_contact(telkom_tokens)

    # PELANGGAN mulai setelah tokens yang telah dibaca
    pelanggan_tokens = telkom_tokens[consumed:]
    pelanggan_fields, _ = read_contact(pelanggan_tokens)

    # Bersihkan nilai kosong
    telkom_fields = {k: v for k, v in telkom_fields.items() if v}
    pelanggan_fields = {k: v for k, v in pelanggan_fields.items() if v}
    return telkom_fields, pelanggan_fields

# -------------------- Payment Method Specific Page 2 Handling --------------------
def _extract_page2_payment_specific(texts: List[str], payment_method: str) -> Dict[str, Any]:
    """
    Extract additional page 2 information specific to payment method.
    """
    additional_info = {}
    
    if payment_method == "termin":
        # Termin contracts may have additional payment schedule details on page 2
        full_text = " ".join(texts).lower()
        if "jadwal pembayaran" in full_text or "schedule" in full_text:
            additional_info["has_payment_schedule"] = True
            
        # Look for payment coordinator contact
        coordinator_patterns = ["koordinator pembayaran", "payment coordinator", "pic pembayaran"]
        for pattern in coordinator_patterns:
            idx = _find_containing(texts, pattern)
            if idx is not None:
                additional_info["payment_coordinator_context"] = texts[idx]
    
    elif payment_method == "recurring":
        # Recurring may have billing cycle information
        full_text = " ".join(texts).lower()
        if "siklus tagihan" in full_text or "billing cycle" in full_text:
            additional_info["has_billing_cycle"] = True
            
        # Look for automated payment setup
        auto_patterns = ["auto debit", "otomatis", "autopay"]
        for pattern in auto_patterns:
            if pattern in full_text:
                additional_info["auto_payment_mentioned"] = True
    
    elif payment_method == "one_time_charge":
        # One-time may have specific payment deadline information
        full_text = " ".join(texts).lower()
        if "batas waktu pembayaran" in full_text or "payment deadline" in full_text:
            additional_info["has_payment_deadline"] = True
    
    return additional_info

# -------------------- Page 2 Merge --------------------
def merge_with_page2(existing: TelkomContractData, ocr_json_page2: Any) -> TelkomContractData:
    texts = _texts_from_ocr(ocr_json_page2)

    # Get payment method untuk context-aware extraction
    payment_method = existing.tata_cara_pembayaran.method_type if existing.tata_cara_pembayaran else "unknown"
    
    # Payment method specific extraction
    payment_specific_info = _extract_page2_payment_specific(texts, payment_method)

    # 1) Enhanced jangka waktu extraction
    start_date, end_date = _extract_jangka_waktu(texts)
    if existing.jangka_waktu is None:
        existing.jangka_waktu = JangkaWaktu()
    if start_date:
        existing.jangka_waktu.mulai = existing.jangka_waktu.mulai or start_date
    if end_date:
        existing.jangka_waktu.akhir = existing.jangka_waktu.akhir or end_date

    # 1.5) Regenerate termin payments with date assignments if applicable
    if (existing.tata_cara_pembayaran
        and existing.tata_cara_pembayaran.method_type == "termin"
        and existing.tata_cara_pembayaran.termin_payments
        and existing.jangka_waktu
        and existing.jangka_waktu.mulai
        and existing.jangka_waktu.akhir):

        # Check if termin payments were auto-generated (look for "Auto-generated" in raw_text)
        termin_list = existing.tata_cara_pembayaran.termin_payments
        is_auto_generated = any(
            tp.raw_text and "Auto-generated" in tp.raw_text
            for tp in termin_list
        )

        # Also check if periods are generic "Termin X" format
        has_generic_periods = any(
            tp.period and tp.period.startswith("Termin ")
            for tp in termin_list
        )

        # Regenerate if auto-generated or has generic periods
        if is_auto_generated or has_generic_periods:
            count = len(termin_list)
            total_amount = existing.tata_cara_pembayaran.total_amount or sum(
                tp.amount for tp in termin_list
            )

            # Generate new termin payments with date assignments
            new_termin_payments = _generate_termin_payments_with_dates(
                count=count,
                total_amount=total_amount,
                start_date=existing.jangka_waktu.mulai,
                end_date=existing.jangka_waktu.akhir
            )

            if new_termin_payments:
                existing.tata_cara_pembayaran.termin_payments = new_termin_payments
                # Update description to reflect date-aware generation
                existing.tata_cara_pembayaran.description = (
                    f"Pembayaran termin ({count} periode, dengan jadwal bulanan)"
                )

    # 2) Enhanced kontak person extraction (TELKOM & PELANGGAN)
    telkom, pelanggan = _extract_contact_blocks(texts)

    # Isi TELKOM
    if any(telkom.values()):
        existing.kontak_person_telkom = KontakPersonTelkom(
            nama=telkom.get("nama"),
            jabatan=telkom.get("jabatan"),
            email=telkom.get("email"),
            telepon=telkom.get("telepon"),
        )

    # Isi PELANGGAN
    if existing.informasi_pelanggan is None:
        existing.informasi_pelanggan = InformasiPelanggan()
    if any(pelanggan.values()):
        existing.informasi_pelanggan.kontak_person = KontakPersonPelanggan(
            nama=pelanggan.get("nama"),
            jabatan=pelanggan.get("jabatan"),
            email=pelanggan.get("email"),
            telepon=pelanggan.get("telepon"),
        )

    return existing


# -------------------- Convenience I/O --------------------
def extract_page1_file(input_json_path: str) -> Dict[str, Any]:
    """Baca file JSON OCR page 1 dan kembalikan dict hasil model_dump()."""
    with open(input_json_path, "r", encoding="utf-8") as f:
        ocr = json.load(f)
    data = extract_from_page1_one_time(ocr)
    # mode="json" memastikan field datetime / non-JSON-native sudah di-serialize (ISO string)
    return data.model_dump(mode="json")

def merge_page2_file(existing_json_path: str, page2_json_path: str, output_json_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Baca hasil existing (file JSON TelkomContractData) + OCR page 2,
    lakukan merge, lalu simpan (opsional) & kembalikan dict.
    """
    with open(existing_json_path, "r", encoding="utf-8") as f:
        existing_dict = json.load(f)
    # Rekonstruksi model dari dict (jika perlu)
    existing = TelkomContractData(**existing_dict)

    with open(page2_json_path, "r", encoding="utf-8") as f:
        ocr2 = json.load(f)

    merged = merge_with_page2(existing, ocr2)
    # Serialize to JSON-friendly structure
    result = merged.model_dump(mode="json")

    if output_json_path:
        with open(output_json_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

    return result


# -------------------- CLI mini --------------------
if __name__ == "__main__":
    import argparse, sys, os
    ap = argparse.ArgumentParser(description="Ekstraksi Telkom Contract (Page 1 one-time + merge Page 2)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p1 = sub.add_parser("page1", help="Ekstrak dari page 1 (one-time charge)")
    p1.add_argument("--in", dest="inp", required=True, help="Path ke OCR JSON page 1")
    p1.add_argument("--out", dest="out", help="Path simpan hasil TelkomContractData (JSON)")

    m2 = sub.add_parser("merge2", help="Merge hasil page1 dengan OCR page 2")
    m2.add_argument("--existing", required=True, help="File JSON hasil page1 (TelkomContractData)")
    m2.add_argument("--page2", required=True, help="Path ke OCR JSON page 2")
    m2.add_argument("--out", required=True, help="Path simpan hasil merged JSON")

    args = ap.parse_args()

    if args.cmd == "page1":
        res = extract_page1_file(args.inp)
        if args.out:
            with open(args.out, "w", encoding="utf-8") as f:
                json.dump(res, f, ensure_ascii=False, indent=2)
        else:
            json.dump(res, sys.stdout, ensure_ascii=False, indent=2)
    elif args.cmd == "merge2":
        res = merge_page2_file(args.existing, args.page2, args.out)
        # file sudah disimpan; tampilkan ringkas ke stdout
        print(f"Saved merged result to: {args.out}")
