from django import template
import arabic_reshaper
from bidi.algorithm import get_display

register = template.Library()

@register.filter(name='reshape')
def reshape_arabic(text):
    if not isinstance(text, str):
        return text
    # wkhtmltopdf handles Arabic shaping natively when dir="rtl" is used.
    # Reshaping here causes double-reversal and disconnected characters.
    return text
