# strawberry/templatetags/json_filters.py
"""
Django Template Filters for JSON handling
Create this file as: your_app/templatetags/json_filters.py
"""

import json
from django import template
from django.core.serializers.json import DjangoJSONEncoder
from django.utils.safestring import mark_safe

register = template.Library()

@register.filter
def json_safe(value):
    """
    Convert to JSON with comprehensive error handling
    Returns empty array if conversion fails
    """
    if value is None:
        return '[]'
    
    try:
        # Handle different input types
        if isinstance(value, str):
            # Already a string, check if it's valid JSON
            try:
                json.loads(value)
                return mark_safe(value)
            except:
                return '[]'
        
        elif isinstance(value, (list, tuple)):
            return mark_safe(json.dumps(list(value), cls=DjangoJSONEncoder))
        
        elif isinstance(value, dict):
            return mark_safe(json.dumps(value, cls=DjangoJSONEncoder))
        
        else:
            return mark_safe(json.dumps(value, cls=DjangoJSONEncoder))
            
    except Exception as e:
        print(f"JSON encoding error for {type(value)}: {e}")
        return '[]'

@register.filter
def jsonify(value):
    """
    Convert Python object to JSON string for use in JavaScript
    Usage: {{ data|jsonify }}
    """
    return json_safe(value)

@register.filter
def json_values(sensor_data):
    """
    Extract values from sensor data dict
    Usage: {{ sensor_data|json_values }}
    """
    if isinstance(sensor_data, dict) and 'values' in sensor_data:
        return json_safe(sensor_data['values'])
    return '[]'

@register.filter
def json_datetimes(sensor_data):
    """
    Extract datetimes from sensor data dict
    Usage: {{ sensor_data|json_datetimes }}
    """
    if isinstance(sensor_data, dict) and 'datetimes' in sensor_data:
        return json_safe(sensor_data['datetimes'])
    return '[]'

@register.filter
def debug_type(value):
    """
    Debug filter to show variable type
    Usage: {{ variable|debug_type }}
    """
    return f"{type(value).__name__}: {repr(value)[:100]}..."

@register.filter
def to_json(value):
    """Convert to proper JSON format"""
    return mark_safe(json.dumps(value))