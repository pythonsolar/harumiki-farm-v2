"""
Django management command to test compare page performance and data retrieval
"""
from django.core.management.base import BaseCommand
from django.test import Client
from django.urls import reverse
import json
import time
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Test compare page performance and data issues'

    def add_arguments(self, parser):
        parser.add_argument(
            '--month',
            type=int,
            default=None,
            help='Month to test (0-11)'
        )
        parser.add_argument(
            '--year',
            type=int,
            default=None,
            help='Year to test'
        )

    def handle(self, *args, **options):
        # Test the API directly instead of through HTTP
        from strawberry.views import CompareGH1and2, update_compare_data
        
        # Calculate date range
        import calendar
        
        # Set default month/year if not provided
        if options['month'] is None:
            options['month'] = datetime.now().month - 1  # Current month (0-based)
        if options['year'] is None:
            options['year'] = datetime.now().year
            
        self.stdout.write(f"Testing compare data for {options['month']+1}/{options['year']}")
        
        month = options['month']
        year = options['year']
        today = datetime.today()
        
        first_date = datetime(year, month + 1, 1)
        
        if year == today.year and (month + 1) == today.month:
            last_date = today
        else:
            last_day = calendar.monthrange(year, month + 1)[1]
            last_date = datetime(year, month + 1, last_day, 23, 59, 59)
            if last_date > today:
                last_date = today
        
        first_date_str = first_date.strftime("%Y-%m-%d")
        last_date_str = last_date.strftime("%Y-%m-%d")
        start = f"{first_date_str}T00:00:00"
        end = f"{last_date_str}T23:59:59"
        
        self.stdout.write(f"Date range: {start} to {end}")
        
        # Test data fetching directly
        start_time = time.time()
        try:
            context_history = update_compare_data(start, end)
            elapsed = time.time() - start_time
            
            self.stdout.write(f"Data fetch completed in {elapsed:.2f} seconds")
            self.stdout.write(f"Fetched {len(context_history)} datasets")
            
            # Analyze the data
            empty_datasets = []
            populated_datasets = []
            
            for key, value in context_history.items():
                if isinstance(value, dict) and 'values' in value:
                    if not value['values'] or len(value['values']) == 0:
                        empty_datasets.append(key)
                    else:
                        populated_datasets.append((key, len(value['values'])))
                else:
                    empty_datasets.append(key)
            
            # Report findings
            self.stdout.write(f"\nEmpty datasets ({len(empty_datasets)}):")
            for dataset in sorted(empty_datasets):
                self.stdout.write(f"  - {dataset}")
                
            self.stdout.write(f"\nPopulated datasets ({len(populated_datasets)}):")
            for dataset, count in sorted(populated_datasets):
                self.stdout.write(f"  + {dataset}: {count} points")
                
            # Check for specific critical datasets
            critical_datasets = [
                'pm_GH1', 'pm_GH2', 'pm_outside',
                'CO2_Farm1', 'CO2_Farm2',
                'ppfd_GH1_R8', 'ppfd_GH1_R24', 'ppfd_GH2_R16', 'ppfd_GH2_R24'
            ]
            
            self.stdout.write("\nCritical dataset status:")
            for dataset in critical_datasets:
                if dataset in empty_datasets:
                    self.stdout.write(self.style.ERROR(f"  ✗ {dataset}: EMPTY"))
                else:
                    matching = [d for d in populated_datasets if d[0] == dataset]
                    if matching:
                        self.stdout.write(self.style.SUCCESS(f"  ✓ {dataset}: {matching[0][1]} points"))
                    else:
                        self.stdout.write(self.style.WARNING(f"  ? {dataset}: NOT FOUND"))
                        
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error: {str(e)}"))
            import traceback
            traceback.print_exc()