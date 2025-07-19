# strawberry/management/commands/test_api.py
from django.core.management.base import BaseCommand
from django.conf import settings
import requests

class Command(BaseCommand):
    help = 'Test API connection'

    def handle(self, *args, **options):
        url = f"{settings.SMART_FARM_API_URL}/get-latest-data"
        headers = {"x-api-key": settings.SMART_FARM_API_KEY}
        
        self.stdout.write(f"Testing API: {url}")
        self.stdout.write(f"API Key exists: {bool(settings.SMART_FARM_API_KEY)}")
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            self.stdout.write(f"Status Code: {response.status_code}")
            self.stdout.write(f"Response: {response.text[:500]}")  # First 500 chars
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error: {str(e)}"))