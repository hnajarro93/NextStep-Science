import os
import io
import csv
from dataclasses import dataclass

import filetype
from PIL import Image, UnidentifiedImageError
from pypdf import PdfReader
from pypdf.errors import PdfReadError

@dataclass
class ValidatedDocument:
    original_filename: str
    extension: str
    content: bytes

MAX_SIZE_BYTES: int = int(os.getenv("MAX_DOCUMENT_SIZE_BYTES", 52428800))
ALLOWED_EXTENSIONS: set[str] = {'.csv', '.pdf', '.png', '.jpg', '.jpeg'}

def _validate_pdf_structure(content: bytes) -> bool:
    try:
        kind = filetype.guess(content)
        if kind is None or kind.extension != 'pdf':
            return False
        reader = PdfReader(io.BytesIO(content))
        return len(reader.pages) > 0
    except PdfReadError:
        return False

def _validate_image_structure(content: bytes, expected_ext: str) -> bool:
    try:
        kind = filetype.guess(content)
        if kind is None or kind.extension not in ['jpg', 'png']:
            return False
        with Image.open(io.BytesIO(content)) as img:
            img.verify() 
            img_format = img.format.lower()
            if img_format == 'jpeg' and expected_ext in ['.jpg', '.jpeg']:
                return True
            if img_format == 'png' and expected_ext == '.png':
                return True
        return False
    except UnidentifiedImageError:
        return False

def _validate_csv_structure(content: bytes) -> bool:
    try:
        text_content = content.decode('utf-8')
        sniffer = csv.Sniffer()
        sample = text_content[:2048]
        if not sniffer.has_header(sample):
            sniffer.sniff(sample)
        return True
    except (UnicodeDecodeError, csv.Error):
        return False

def is_content_valid(file_bytes: bytes, ext: str) -> bool:
    if ext == '.pdf':
        return _validate_pdf_structure(file_bytes)
    elif ext in ['.png', '.jpg', '.jpeg']:
        return _validate_image_structure(file_bytes, ext)
    elif ext == '.csv':
        return _validate_csv_structure(file_bytes)
    return False