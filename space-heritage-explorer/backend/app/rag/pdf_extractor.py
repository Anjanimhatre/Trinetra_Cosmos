"""PDF text extraction: PyMuPDF first, pypdf as fallback.
Scanned PDFs with no text layer return '' (OCR can be added later)."""
from io import BytesIO


def extract_pdf_text(data: bytes) -> str:
    try:
        import fitz  # PyMuPDF

        with fitz.open(stream=data, filetype="pdf") as doc:
            text = "\n".join(page.get_text() for page in doc)
        if text.strip():
            return text
    except Exception:
        pass
    try:
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(data))
        return "\n".join((p.extract_text() or "") for p in reader.pages)
    except Exception:
        return ""
