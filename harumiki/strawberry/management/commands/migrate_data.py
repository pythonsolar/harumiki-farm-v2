"""
Management command to migrate data from old system to new time-series database
Handles data conversion, aggregation, and quality validation
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from datetime import datetime, timedelta
import logging
import json

from strawberry.models import (
    Sensor, RealtimeData, RecentData, HistoricalData, 
    ArchiveData, DataQuality, AggregationJob
)
from strawberry.services import AggregationService, DataQualityService

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Migrate and process existing data in time-series database'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--start-date',
            type=str,
            help='Start date for migration (YYYY-MM-DD)',
        )
        parser.add_argument(
            '--end-date',
            type=str,
            help='End date for migration (YYYY-MM-DD)',
        )
        parser.add_argument(
            '--days',
            type=int,
            default=7,
            help='Number of days to process (from today backwards)',
        )
        parser.add_argument(
            '--skip-aggregation',
            action='store_true',
            help='Skip data aggregation steps',
        )
        parser.add_argument(
            '--skip-quality',
            action='store_true',
            help='Skip data quality calculation',
        )
        parser.add_argument(
            '--sensor-id',
            type=str,
            help='Process specific sensor only',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=1000,
            help='Batch size for bulk operations',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )
    
    def handle(self, *args, **options):
        """Main command handler"""
        self.dry_run = options.get('dry_run', False)
        self.batch_size = options.get('batch_size', 1000)
        
        if self.dry_run:
            self.stdout.write(
                self.style.WARNING('DRY RUN MODE - No changes will be made')
            )
        
        # Determine date range
        start_date, end_date = self.get_date_range(options)
        
        self.stdout.write(f'Processing data from {start_date} to {end_date}')
        
        # Get sensors to process
        sensors = self.get_sensors_to_process(options.get('sensor_id'))
        self.stdout.write(f'Processing {sensors.count()} sensors')
        
        # Step 1: Process realtime data (if needed)
        if RealtimeData.objects.exists():
            self.stdout.write('Realtime data already exists, skipping import')
        else:
            self.stdout.write('No existing realtime data found')
        
        # Step 2: Aggregate to 5-minute intervals
        if not options.get('skip_aggregation'):
            self.aggregate_5min_data(start_date, end_date, sensors)
            
            # Step 3: Aggregate to hourly intervals
            self.aggregate_hourly_data(start_date, end_date, sensors)
            
            # Step 4: Aggregate to daily intervals
            self.aggregate_daily_data(start_date, end_date, sensors)
        
        # Step 5: Calculate data quality metrics
        if not options.get('skip_quality'):
            self.calculate_data_quality(start_date, end_date, sensors)
        
        self.stdout.write(
            self.style.SUCCESS('Data migration completed successfully')
        )
    
    def get_date_range(self, options):
        """Determine start and end dates for processing"""
        if options.get('start_date') and options.get('end_date'):
            start_date = datetime.strptime(options['start_date'], '%Y-%m-%d').date()
            end_date = datetime.strptime(options['end_date'], '%Y-%m-%d').date()
        else:
            # Use days parameter to go backwards from today
            days = options.get('days', 7)
            end_date = timezone.now().date()
            start_date = end_date - timedelta(days=days)
        
        return start_date, end_date
    
    def get_sensors_to_process(self, sensor_id):
        """Get sensors to process based on filter"""
        sensors = Sensor.objects.filter(is_active=True)
        
        if sensor_id:
            sensors = sensors.filter(sensor_id=sensor_id)
        
        return sensors
    
    def aggregate_5min_data(self, start_date, end_date, sensors):
        """Aggregate realtime data to 5-minute intervals"""
        self.stdout.write('Aggregating to 5-minute intervals...')
        
        current_date = start_date
        total_days = (end_date - start_date).days + 1
        processed_days = 0
        
        while current_date <= end_date:
            start_datetime = datetime.combine(current_date, datetime.min.time())
            end_datetime = datetime.combine(current_date, datetime.max.time())
            
            self.stdout.write(f'  Processing {current_date} ({processed_days + 1}/{total_days})')
            
            if not self.dry_run:
                try:
                    # Create aggregation job
                    job = AggregationJob.objects.create(
                        level='5min',
                        start_time=start_datetime,
                        end_time=end_datetime,
                        status='running',
                        total_sensors=sensors.count()
                    )
                    job.started_at = timezone.now()
                    job.save()
                    
                    # Process aggregation
                    stats = AggregationService.aggregate_to_recent_data(
                        start_datetime, end_datetime
                    )
                    
                    # Update job
                    job.status = 'completed'
                    job.completed_at = timezone.now()
                    job.processed_sensors = stats.get('sensors_processed', 0)
                    job.records_created = stats.get('records_created', 0)
                    job.save()
                    
                    self.stdout.write(f'    Created {stats.get("records_created", 0)} 5-minute records')
                    
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'    Error aggregating {current_date}: {e}')
                    )
                    if 'job' in locals():
                        job.status = 'failed'
                        job.error_message = str(e)
                        job.completed_at = timezone.now()
                        job.save()
            
            current_date += timedelta(days=1)
            processed_days += 1
        
        self.stdout.write('5-minute aggregation completed')
    
    def aggregate_hourly_data(self, start_date, end_date, sensors):
        """Aggregate 5-minute data to hourly intervals"""
        self.stdout.write('Aggregating to hourly intervals...')
        
        current_date = start_date
        
        while current_date <= end_date:
            start_datetime = datetime.combine(current_date, datetime.min.time())
            end_datetime = datetime.combine(current_date, datetime.max.time())
            
            self.stdout.write(f'  Processing {current_date}')
            
            if not self.dry_run:
                try:
                    # Create aggregation job
                    job = AggregationJob.objects.create(
                        level='hourly',
                        start_time=start_datetime,
                        end_time=end_datetime,
                        status='running',
                        total_sensors=sensors.count()
                    )
                    job.started_at = timezone.now()
                    job.save()
                    
                    # Process each sensor
                    records_created = 0
                    sensors_processed = 0
                    
                    for sensor in sensors:
                        try:
                            # Get 5-minute data for this day
                            recent_data = RecentData.objects.filter(
                                sensor=sensor,
                                timestamp__gte=start_datetime,
                                timestamp__lt=end_datetime
                            )
                            
                            if recent_data.exists():
                                # Group by hour and aggregate
                                from django.db.models import Avg, Min, Max, Sum
                                from django.db.models.functions import TruncHour
                                
                                hourly_aggregates = recent_data.annotate(
                                    hour=TruncHour('timestamp')
                                ).values('hour').annotate(
                                    avg_value=Avg('avg_value'),
                                    min_value=Min('min_value'),
                                    max_value=Max('max_value'),
                                    sample_count=Sum('sample_count'),
                                    quality_score=Avg('good_samples') * 100 / Avg('sample_count')
                                )
                                
                                # Create hourly records
                                hourly_records = []
                                for agg in hourly_aggregates:
                                    hourly_record = HistoricalData(
                                        sensor=sensor,
                                        timestamp=agg['hour'],
                                        avg_value=agg['avg_value'],
                                        min_value=agg['min_value'],
                                        max_value=agg['max_value'],
                                        sample_count=agg['sample_count'],
                                        quality_score=agg['quality_score'] or 0
                                    )
                                    hourly_records.append(hourly_record)
                                
                                # Bulk create
                                if hourly_records:
                                    HistoricalData.objects.bulk_create(
                                        hourly_records,
                                        ignore_conflicts=True,
                                        batch_size=self.batch_size
                                    )
                                    records_created += len(hourly_records)
                            
                            sensors_processed += 1
                            
                        except Exception as e:
                            self.stdout.write(
                                self.style.ERROR(f'    Error processing sensor {sensor.sensor_id}: {e}')
                            )
                    
                    # Update job
                    job.status = 'completed'
                    job.completed_at = timezone.now()
                    job.processed_sensors = sensors_processed
                    job.records_created = records_created
                    job.save()
                    
                    self.stdout.write(f'    Created {records_created} hourly records')
                    
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'    Error aggregating hourly data for {current_date}: {e}')
                    )
            
            current_date += timedelta(days=1)
        
        self.stdout.write('Hourly aggregation completed')
    
    def aggregate_daily_data(self, start_date, end_date, sensors):
        """Aggregate hourly data to daily intervals"""
        self.stdout.write('Aggregating to daily intervals...')
        
        current_date = start_date
        
        while current_date <= end_date:
            self.stdout.write(f'  Processing {current_date}')
            
            if not self.dry_run:
                try:
                    # Create aggregation job
                    job = AggregationJob.objects.create(
                        level='daily',
                        start_time=datetime.combine(current_date, datetime.min.time()),
                        end_time=datetime.combine(current_date, datetime.max.time()),
                        status='running',
                        total_sensors=sensors.count()
                    )
                    job.started_at = timezone.now()
                    job.save()
                    
                    records_created = 0
                    sensors_processed = 0
                    dli_calculated = 0
                    
                    for sensor in sensors:
                        try:
                            # Get hourly data for this day
                            from django.db.models import Avg, Min, Max, Sum
                            
                            daily_aggregate = HistoricalData.objects.filter(
                                sensor=sensor,
                                timestamp__date=current_date
                            ).aggregate(
                                avg_value=Avg('avg_value'),
                                min_value=Min('min_value'),
                                max_value=Max('max_value'),
                                sample_count=Sum('sample_count'),
                                quality_score=Avg('quality_score')
                            )
                            
                            if daily_aggregate['avg_value'] is not None:
                                # Calculate special values for PPFD sensors (DLI)
                                total_value = None
                                if sensor.sensor_type.code == 'ppfd':
                                    dli = AggregationService.calculate_dli(sensor.sensor_id, current_date)
                                    if dli is not None:
                                        total_value = dli
                                        dli_calculated += 1
                                
                                # Create or update daily record
                                daily_record, created = ArchiveData.objects.update_or_create(
                                    sensor=sensor,
                                    timestamp=datetime.combine(current_date, datetime.min.time()),
                                    defaults={
                                        'avg_value': daily_aggregate['avg_value'],
                                        'min_value': daily_aggregate['min_value'],
                                        'max_value': daily_aggregate['max_value'],
                                        'sample_count': daily_aggregate['sample_count'] or 0,
                                        'quality_score': daily_aggregate['quality_score'] or 0,
                                        'total_value': total_value,
                                        'duration_hours': 24.0,
                                        'uptime_percentage': daily_aggregate['quality_score'] or 0
                                    }
                                )
                                
                                if created:
                                    records_created += 1
                            
                            sensors_processed += 1
                            
                        except Exception as e:
                            self.stdout.write(
                                self.style.ERROR(f'    Error processing sensor {sensor.sensor_id}: {e}')
                            )
                    
                    # Update job
                    job.status = 'completed'
                    job.completed_at = timezone.now()
                    job.processed_sensors = sensors_processed
                    job.records_created = records_created
                    job.save()
                    
                    self.stdout.write(f'    Created {records_created} daily records, {dli_calculated} DLI values')
                    
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'    Error aggregating daily data for {current_date}: {e}')
                    )
            
            current_date += timedelta(days=1)
        
        self.stdout.write('Daily aggregation completed')
    
    def calculate_data_quality(self, start_date, end_date, sensors):
        """Calculate data quality metrics"""
        self.stdout.write('Calculating data quality metrics...')
        
        current_date = start_date
        
        while current_date <= end_date:
            self.stdout.write(f'  Processing quality for {current_date}')
            
            if not self.dry_run:
                try:
                    stats = DataQualityService.update_daily_quality_records(current_date)
                    self.stdout.write(f'    Quality records: {stats}')
                    
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'    Error calculating quality for {current_date}: {e}')
                    )
            
            current_date += timedelta(days=1)
        
        self.stdout.write('Data quality calculation completed')
    
    def cleanup_old_aggregation_jobs(self):
        """Clean up old aggregation job records"""
        self.stdout.write('Cleaning up old aggregation jobs...')
        
        if not self.dry_run:
            # Keep jobs from last 30 days
            cutoff_date = timezone.now() - timedelta(days=30)
            
            deleted_count = AggregationJob.objects.filter(
                created_at__lt=cutoff_date
            ).delete()[0]
            
            self.stdout.write(f'  Deleted {deleted_count} old job records')
        else:
            self.stdout.write('  (DRY RUN) Would clean up old aggregation jobs')
    
    def verify_data_integrity(self, start_date, end_date):
        """Verify data integrity after migration"""
        self.stdout.write('Verifying data integrity...')
        
        issues = []
        
        # Check for missing aggregation levels
        for sensor in Sensor.objects.filter(is_active=True):
            realtime_count = RealtimeData.objects.filter(
                sensor=sensor,
                timestamp__date__range=[start_date, end_date]
            ).count()
            
            recent_count = RecentData.objects.filter(
                sensor=sensor,
                timestamp__date__range=[start_date, end_date]
            ).count()
            
            historical_count = HistoricalData.objects.filter(
                sensor=sensor,
                timestamp__date__range=[start_date, end_date]
            ).count()
            
            archive_count = ArchiveData.objects.filter(
                sensor=sensor,
                timestamp__date__range=[start_date, end_date]
            ).count()
            
            # Expected ratios (approximate)
            days_range = (end_date - start_date).days + 1
            expected_archive = days_range
            expected_historical = days_range * 24  # hourly
            expected_recent = days_range * 24 * 12  # 5-minute intervals
            
            if archive_count < expected_archive * 0.8:  # Allow 20% tolerance
                issues.append(f'Sensor {sensor.sensor_id}: Low archive data ({archive_count}/{expected_archive})')
            
            if historical_count < expected_historical * 0.8:
                issues.append(f'Sensor {sensor.sensor_id}: Low historical data ({historical_count}/{expected_historical})')
        
        if issues:
            self.stdout.write(self.style.WARNING('Data integrity issues found:'))
            for issue in issues:
                self.stdout.write(f'  - {issue}')
        else:
            self.stdout.write(self.style.SUCCESS('Data integrity verification passed'))
        
        return len(issues) == 0