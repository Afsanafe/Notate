"""Import documents without contacting any outside service."""

import base64
import html
import re
import shutil
import subprocess
import tempfile
import zipfile
from functools import lru_cache
from pathlib import Path

import bleach
import markdown
from markdown.extensions import Extension
from markdown.inlinepatterns import SimpleTagInlineProcessor
from markdown.treeprocessors import Treeprocessor
from markdown.preprocessors import Preprocessor
from markdownify import MarkdownConverter
from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph
from pypdf import PdfReader
from pypdf.errors import DependencyError


ALLOWED_TAGS = ["p", "br", "strong", "em", "b", "i", "u", "s", "h1", "h2", "h3", "h4", "h5", "h6",
                "ul", "ol", "li", "blockquote", "pre", "code", "a", "hr", "table", "thead",
                "tbody", "tr", "th", "td"]


def note_attribute(tag, name, value):
    if tag == 'a' and name in {'href', 'title'}:
        return True
    return name == 'class' and ((tag == 'strong' and value in {'md-answer-label','md-question-label','md-example-label'})
        or (tag == 'em' and value in {'md-answer-text','md-question-text','md-example-text'})
        or (tag == 'ul' and value in {'md-list-disc','md-list-circle','md-list-square',
                                     'md-list-disc md-example-list', 'md-list-circle md-example-list',
                                     'md-list-square md-example-list'}))


def clean_note(value):
    return bleach.clean(value, tags=ALLOWED_TAGS, attributes=note_attribute,
                        protocols=["http", "https", "mailto"], strip=True)


class StrikeExtension(Extension):
    def extendMarkdown(self, md):
        md.inlinePatterns.register(SimpleTagInlineProcessor(r'(~~)(.+?)~~', 's'), 'strikethrough', 175)


class ExampleListPreprocessor(Preprocessor):
    def run(self, lines):
        # Render the requested tab-indented example as a list. Only the render
        # input changes; the saved Markdown retains its exact newline and tab.
        result = []; index = 0
        while index < len(lines):
            line = lines[index]; result.append(line); index += 1
            if not re.fullmatch(r'(?:\*\*For Example:\*\*|__For Example:__)\s*', line):
                continue
            if index >= len(lines) or not re.match(r'^(?:\t| {4})[-+*] ', lines[index]):
                continue
            result.append('')
            while index < len(lines) and re.match(r'^(?:\t| {4})', lines[index]) and lines[index].strip():
                result.append(lines[index][1:] if lines[index].startswith('\t') else lines[index][4:])
                index += 1
            # A blank line alone can merge adjacent Markdown lists. This render-
            # only HTML boundary is removed by clean_note's comment sanitizer.
            result.extend(['', '<!--notate-example-end-->', ''])
        return result


class InlineAnswerProcessor(Treeprocessor):
    def run(self, root):
        # The shortcuts use ordinary Markdown. Add only
        # presentation classes; source text and annotation offsets stay intact.
        for parent in root.iter():
            children = list(parent)
            for label, answer in zip(children, children[1:]):
                kind = {'Answ:':'answer','Answer:':'answer','Question:':'question'}.get(''.join(label.itertext()))
                if label.tag == 'strong' and kind and not (label.tail or '').strip() and answer.tag == 'em':
                    label.set('class', f'md-{kind}-label')
                    answer.set('class', f'md-{kind}-text')
            for label in children:
                if label.tag == 'strong' and ''.join(label.itertext()) == 'For Example:':
                    label.set('class','md-example-label')
        def lists(parent, depth=0):
            children = list(parent)
            for index, child in enumerate(children):
                example = (child.tag == 'ul' and index > 0 and children[index-1].tag == 'p'
                           and ''.join(children[index-1].itertext()).strip() == 'For Example:')
                level = depth + int(example)
                if child.tag == 'ul':
                    child.set('class', ['md-list-disc','md-list-circle','md-list-square'][level % 3]
                              + (' md-example-list' if example else ''))
                    if example:
                        for text in child.iter('em'):
                            if text.get('class') is None: text.set('class','md-example-text')
                lists(child, level + 1 if child.tag in {'ul','ol'} else depth)
        lists(root)


class InlineAnswerExtension(Extension):
    def extendMarkdown(self, md):
        md.preprocessors.register(ExampleListPreprocessor(md), 'example_list', 24)
        md.treeprocessors.register(InlineAnswerProcessor(md), 'inline_answer', 5)


@lru_cache(maxsize=256)
def render_comment_markdown(value):
    rendered = markdown.markdown(value, extensions=['fenced_code', 'tables', 'sane_lists', 'nl2br', StrikeExtension(), InlineAnswerExtension()])
    return clean_note(rendered)


def render_note_markdown(value):
    # Large notes do not belong in the comment preview's process-wide cache.
    return clean_note(markdown.markdown(value, extensions=[
        'fenced_code', 'tables', 'sane_lists', 'nl2br', StrikeExtension(), InlineAnswerExtension()]))


class NoteMarkdownConverter(MarkdownConverter):
    def convert_u(self, el, text, parent_tags):
        # Markdown has no underline syntax; retain existing underlined text.
        return f'<u>{text}</u>'

    def convert_s(self, el, text, parent_tags):
        return f'~~{text}~~'


def note_html_to_markdown(value):
    return NoteMarkdownConverter(heading_style='ATX', bullets='-',
                                 escape_misc=True).convert(clean_note(value))


def pdf_pages(path):
    try:
        reader = PdfReader(path)
        if reader.is_encrypted and not reader.decrypt(""):
            raise ValueError("This PDF is password protected. Import an unlocked copy.")
        count = len(reader.pages)
        if not count:
            raise ValueError("This PDF has no pages.")
        return count
    except DependencyError as exc:
        raise ValueError("AES support is missing from this installation. Update Notate's dependencies and restart the app.") from exc
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("This PDF could not be read. Check that the file is a valid PDF.") from exc


def convert_office(path, output_dir):
    executable = shutil.which("libreoffice") or shutil.which("soffice")
    if not executable:
        mac = Path("/Applications/LibreOffice.app/Contents/MacOS/soffice")
        executable = str(mac) if mac.exists() else None
    if not executable:
        return None
    with tempfile.TemporaryDirectory(prefix="notate-office-") as profile:
        subprocess.run([executable, f"-env:UserInstallation={Path(profile).as_uri()}", "--headless",
                        "--convert-to", "pdf", "--outdir", str(output_dir), str(path)],
                       check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=90)
    result = output_dir / f"{path.stem}.pdf"
    if not result.exists():
        raise ValueError("LibreOffice could not convert this document to PDF.")
    return result


def docx_html(path):
    # Bound uncompressed size before a parser allocates the Word archive.
    try:
        with zipfile.ZipFile(path) as archive:
            if sum(info.file_size for info in archive.infolist()) > 200 * 1024 * 1024:
                raise ValueError("This Word document expands beyond the 200 MB limit.")
        document = Document(path)
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("This file is not a readable .docx document.") from exc

    def paragraph_html(paragraph):
        pieces = []
        for run in paragraph.runs:
            text = html.escape(run.text).replace("\n", "<br>")
            if run.bold:
                text = f"<strong>{text}</strong>"
            if run.italic:
                text = f"<em>{text}</em>"
            if run.underline:
                text = f"<u>{text}</u>"
            if run.font.strike:
                text = f"<s>{text}</s>"
            pieces.append(text)
            for image in run._element.xpath(".//a:blip"):
                relation = image.get(qn("r:embed"))
                part = document.part.related_parts.get(relation)
                if part and part.content_type in {"image/png", "image/jpeg", "image/gif", "image/webp"}:
                    encoded = base64.b64encode(part.blob).decode("ascii")
                    pieces.append(f'<img alt="Document image" src="data:{part.content_type};base64,{encoded}">')
        name = paragraph.style.name.lower() if paragraph.style else ""
        tag = "p"
        if name.startswith("heading ") and name[-1:] in "1234":
            tag = "h" + name[-1]
        if name == "title":
            tag = "h1"
        prefix = "• " if "list" in name else ""
        return f"<{tag}>{prefix}{''.join(pieces) or '<br>'}</{tag}>"

    output = []
    for child in document.element.body:
        if child.tag == qn("w:p"):
            output.append(paragraph_html(Paragraph(child, document)))
        elif child.tag == qn("w:tbl"):
            table = Table(child, document)
            rows = ["<tr>" + "".join("<td>" + "".join(paragraph_html(p) for p in cell.paragraphs)
                                    + "</td>" for cell in row.cells) + "</tr>" for row in table.rows]
            output.append("<table>" + "".join(rows) + "</table>")
    return "".join(output)


def prepare_document(path, original_name):
    extension = Path(original_name).suffix.lower()
    if extension == ".pdf":
        return {"kind": "pdf", "content": "", "pdf_path": None, "page_count": pdf_pages(path)}
    if extension in {".docx", ".doc", ".odt", ".rtf"}:
        # Validate docx before conversion as well as before HTML extraction.
        content = docx_html(path) if extension == ".docx" else ""
        try:
            converted = convert_office(path, path.parent)
        except (subprocess.SubprocessError, ValueError):
            if extension != ".docx":
                raise ValueError("This document could not be converted by LibreOffice.")
            converted = None
        if converted:
            return {"kind": "document", "content": "", "pdf_path": converted.name,
                    "page_count": pdf_pages(converted)}
        if extension != ".docx":
            raise ValueError("Install LibreOffice to import .doc, .odt, or .rtf files, or save the document as PDF/.docx.")
        return {"kind": "document", "content": content, "pdf_path": None, "page_count": None}
    if extension in {".txt", ".md", ".markdown"}:
        try:
            value = path.read_text(encoding="utf-8-sig")
        except UnicodeDecodeError as exc:
            raise ValueError("Text files must use UTF-8 encoding.") from exc
        content = clean_note(markdown.markdown(value, extensions=["tables", "fenced_code", InlineAnswerExtension()])) if extension != ".txt" else "".join(
            f"<p>{html.escape(line) or '<br>'}</p>" for line in value.splitlines())
        return {"kind": "document", "content": content, "pdf_path": None, "page_count": None}
    raise ValueError("Supported files: PDF, DOCX, TXT, MD; DOC, ODT, and RTF with LibreOffice.")
