import re
import unicodedata
from datetime import date

def slugify(text: str) -> str:
    """Convert text to URL-friendly slug."""
    text = unicodedata.normalize('NFKD', text)
    text = text.encode('ascii', 'ignore').decode('ascii')
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    text = text.strip('-')
    return text

def generate_gira_slug(titulo: str, data: date) -> str:
    """Generate public slug for gira."""
    titulo_slug = slugify(titulo)
    data_str = data.strftime("%Y-%m-%d")
    return f"{titulo_slug}-{data_str}"
