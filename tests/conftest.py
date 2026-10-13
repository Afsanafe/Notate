import io

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject

from notate.app import create_app


@pytest.fixture
def app(tmp_path):
    return create_app(tmp_path / "workspace")


@pytest.fixture
def client(app):
    with TestClient(app) as client:
        yield client


def readable_pdf(pages=2):
    writer = PdfWriter()
    font = DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),
                             NameObject('/BaseFont'):NameObject('/Helvetica')})
    font_reference = writer._add_object(font)
    for number in range(1, pages + 1):
        page = writer.add_blank_page(width=612, height=792)
        page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):font_reference})})
        stream = DecodedStreamObject()
        stream.set_data(f'BT /F1 24 Tf 64 708 Td (A field guide to better questions) Tj /F1 12 Tf 0 -40 Td (Reading is a conversation with an idea.) Tj 0 -24 Td (Highlight a thought. Ask a question. Find an answer.) Tj 0 -24 Td (Your discoveries belong together in Notate.) Tj 0 -50 Td (Page {number}) Tj ET'.encode())
        page[NameObject('/Contents')] = writer._add_object(stream)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


@pytest.fixture
def pdf_bytes():
    return readable_pdf()
