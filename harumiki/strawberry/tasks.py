"""
Celery Tasks for Smart Farm Data Processing
Background jobs for data synchronization, aggregation, and quality monitoring
"""

from celery import shared_task
from celery.utils.log import get_task_logger
from django.conf import settings
from django.utils import timezone
from datetime import datetime, timedelta
from typing import Dict, Any
import time

from .services import APIDataService, AggregationService, DataQualityService
from .models import (
    Sensor, RealtimeData, RecentData, HistoricalData, 
    ArchiveData, AggregationJob, SystemHealth
)

logger = get_task_logger(__name__)

# ================================================================================
# 1. DATA SYNCHRONIZATION TASKS
# ================================================================================

@shared_task(bind=True, max_retries=3)
def sync_latest_sensor_data(self, farm_id: int = None):
    """
    Sync latest sensor data from API
    Runs every 1-2 minutes for real-time updates
    """
    try:
        start_time = time.time()
        
        # Initialize API service
        api_config = {
            'base_url': settings.SMART_FARM_API_URL,
            'api_key': settings.SMART_FARM_API_KEY,
            'timeout': getattr(settings, 'API_TIMEOUT', 30)
        }
        api_service = APIDataService(api_config)
        
        # Sync data
        stats = api_service.sync_latest_data(farm_id)
        
        elapsed_time = time.time() - start_time
        
        logger.info(f"Latest data sync completed in {elapsed_time:.2f}s: {stats}")
        
        return {
            'status': 'success',
            'stats': stats,
            'elapsed_time': elapsed_time,
            'timestamp': timezone.now().isoformat()
        }
        
    except Exception as exc:
        logger.error(f"Error syncing latest data: {exc}")
        
        # Retry with exponential backoff
        countdown = 2 ** self.request.retries
        raise self.retry(exc=exc, countdown=countdown)

@shared_task(bind=True, max_retries=2)
def sync_historical_sensor_data(self, sensor_id: str, start_time: str, end_time: str):
    """
    Sync historical data for a specific sensor
    Used for backfilling or data recovery
    """
    try:
        # Parse datetime strings
        start_dt = datetime.fromisoformat(start_time)
        end_dt = datetime.fromisoformat(end_time)
        
        # Get sensor
        sensor = Sensor.objects.get(sensor_id=sensor_id, is_active=True)
        
        # Initialize API service
        api_config = {
            'base_url': settings.SMART_FARM_API_URL,
            'api_key': settings.SMART_FARM_API_KEY,
            'timeout': getattr(settings, 'API_TIMEOUT', 60)
        }
        api_service = APIDataService(api_config)
        
        # Fetch historical data
        data_points = api_service.fetch_historical_data(sensor, start_dt, end_dt)
        
        # Store in database
        realtime_records = []
        for point in data_points:
            realtime_record = RealtimeData(
                sensor=sensor,
                timestamp=point['timestamp'],
                value=point['raw_data'],
                processed_value=point['processed_value'],
                quality_flag=point['quality_flag']
            )
            realtime_records.append(realtime_record)
        
        # Bulk insert
        if realtime_records:
            RealtimeData.objects.bulk_create(
                realtime_records,
                batch_size=1000,
                ignore_conflicts=True
            )
        
        logger.info(f"Historical sync completed for {sensor_id}: {len(realtime_records)} records")
        
        return {
            'status': 'success',
            'sensor_id': sensor_id,
            'records_created': len(realtime_records),
            'timestamp': timezone.now().isoformat()
        }
        
    except Exception as exc:
        logger.error(f"Error syncing historical data for {sensor_id}: {exc}")
        raise self.retry(exc=exc, countdown=60)

# ================================================================================
# 2. DATA AGGREGATION TASKS
# ================================================================================

@shared_task(bind=True)
def aggregate_5min_data(self, start_time: str = None, end_time: str = None):
    """
    Aggregate realtime data to 5-minute intervals
    Runs every 5 minutes
    """
    task_id = self.request.id
    
    try:
        # Default to last 10 minutes if not specified
        if not start_time or not end_time:
            end_dt = timezone.now().replace(second=0, microsecond=0)
            start_dt = end_dt - timedelta(minutes=10)
        else:
            start_dt = datetime.fromisoformat(start_time)
            end_dt = datetime.fromisoformat(end_time)
        
        # Create job record
        job = AggregationJob.objects.create(
            level='5min',
            start_time=start_dt,
            end_time=end_dt,
            status='running',
            total_sensors=Sensor.objects.filter(is_active=True).count()
        )
        job.started_at = timezone.now()
        job.save()
        
        try:
            # Perform aggregation
            stats = AggregationService.aggregate_to_recent_data(start_dt, end_dt)
            
            # Update job record
            job.status = 'completed'
            job.completed_at = timezone.now()
            job.processed_sensors = stats['sensors_processed']
            job.records_created = stats['records_created']
            job.save()
            
            logger.info(f"5-minute aggregation completed: {stats}")
            
            return {
                'status': 'success',
                'job_id': job.id,
                'stats': stats,
                'duration': str(job.duration) if job.duration else None
            }
            
        except Exception as e:
            # Update job record with error
            job.status = 'failed'
            job.error_message = str(e)
            job.completed_at = timezone.now()
            job.save()
            raise
            
    except Exception as exc:
        logger.error(f"Error in 5-minute aggregation: {exc}")
        raise

@shared_task(bind=True)
def aggregate_hourly_data(self, start_time: str = None, end_time: str = None):
    """
    Aggregate 5-minute data to hourly intervals
    Runs every hour
    """
    try:
        # Default to last 2 hours if not specified
        if not start_time or not end_time:
            end_dt = timezone.now().replace(minute=0, second=0, microsecond=0)
            start_dt = end_dt - timedelta(hours=2)
        else:
            start_dt = datetime.fromisoformat(start_time)
            end_dt = datetime.fromisoformat(end_time)
        
        # Create job record
        job = AggregationJob.objects.create(
            level='hourly',
            start_time=start_dt,
            end_time=end_dt,
            status='running',
            total_sensors=Sensor.objects.filter(is_active=True).count()
        )
        job.started_at = timezone.now()
        job.save()
        
        stats = {'records_created': 0, 'sensors_processed': 0, 'errors': 0}
        
        # Get all active sensors
        sensors = Sensor.objects.filter(is_active=True)
        
        for sensor in sensors:
            try:
                # Query 5-minute data for this sensor and time range
                recent_data = RecentData.objects.filter(
                    sensor=sensor,
                    timestamp__gte=start_dt,
                    timestamp__lt=end_dt
                ).values('timestamp__hour').annotate(
                    avg_value=Avg('avg_value'),
                    min_value=Min('min_value'),
                    max_value=Max('max_value'),
                    sample_count=Sum('sample_count'),
                    quality_score=Avg('good_samples') * 100 / Avg('sample_count')
                ).filter(sample_count__gt=0)
                
                # Create hourly records
                hourly_records = []
                for data in recent_data:
                    hour_timestamp = start_dt.replace(
                        hour=data['timestamp__hour'],
                        minute=0,
                        second=0,
                        microsecond=0
                    )
                    
                    hourly_record = HistoricalData(
                        sensor=sensor,
                        timestamp=hour_timestamp,
                        avg_value=data['avg_value'],
                        min_value=data['min_value'],
                        max_value=data['max_value'],
                        sample_count=data['sample_count'],
                        quality_score=data['quality_score'] or 0
                    )
                    hourly_records.append(hourly_record)
                
                # Bulk create
                if hourly_records:
                    HistoricalData.objects.bulk_create(
                        hourly_records,
                        ignore_conflicts=True,
                        batch_size=100
                    )
                    stats['records_created'] += len(hourly_records)
                
                stats['sensors_processed'] += 1
                
            except Exception as e:
                logger.error(f"Error aggregating hourly data for {sensor.sensor_id}: {e}")
                stats['errors'] += 1
        
        # Update job record
        job.status = 'completed'
        job.completed_at = timezone.now()
        job.processed_sensors = stats['sensors_processed']
        job.records_created = stats['records_created']
        job.save()
        
        logger.info(f"Hourly aggregation completed: {stats}")
        
        return {
            'status': 'success',
            'job_id': job.id,
            'stats': stats,
            'duration': str(job.duration) if job.duration else None
        }
        
    except Exception as exc:
        logger.error(f"Error in hourly aggregation: {exc}")
        raise

@shared_task(bind=True)
def aggregate_daily_data(self, date: str = None):
    """
    Aggregate hourly data to daily intervals and calculate DLI
    Runs daily at midnight
    """
    try:
        # Default to yesterday if not specified
        if not date:
            target_date = (timezone.now() - timedelta(days=1)).date()
        else:
            target_date = datetime.fromisoformat(date).date()
        
        start_dt = datetime.combine(target_date, datetime.min.time())
        end_dt = datetime.combine(target_date, datetime.max.time())
        
        # Create job record
        job = AggregationJob.objects.create(
            level='daily',
            start_time=start_dt,
            end_time=end_dt,
            status='running',
            total_sensors=Sensor.objects.filter(is_active=True).count()
        )
        job.started_at = timezone.now()
        job.save()
        
        stats = {'records_created': 0, 'sensors_processed': 0, 'errors': 0, 'dli_calculated': 0}
        
        # Get all active sensors
        sensors = Sensor.objects.filter(is_active=True)
        
        for sensor in sensors:
            try:
                # Query hourly data for this sensor and date
                hourly_data = HistoricalData.objects.filter(
                    sensor=sensor,
                    timestamp__date=target_date
                ).aggregate(
                    avg_value=Avg('avg_value'),
                    min_value=Min('min_value'),
                    max_value=Max('max_value'),
                    sample_count=Sum('sample_count'),
                    quality_score=Avg('quality_score')
                )
                
                if hourly_data['avg_value'] is not None:
                    # Calculate special values for PPFD sensors (DLI)
                    total_value = None
                    if sensor.sensor_type.code == 'ppfd':
                        dli = AggregationService.calculate_dli(sensor.sensor_id, target_date)
                        if dli is not None:
                            total_value = dli
                            stats['dli_calculated'] += 1
                    
                    # Create daily record
                    daily_record = ArchiveData.objects.update_or_create(
                        sensor=sensor,
                        timestamp=start_dt,
                        defaults={
                            'avg_value': hourly_data['avg_value'],
                            'min_value': hourly_data['min_value'],
                            'max_value': hourly_data['max_value'],
                            'sample_count': hourly_data['sample_count'] or 0,
                            'quality_score': hourly_data['quality_score'] or 0,
                            'total_value': total_value,
                            'duration_hours': 24.0,
                            'uptime_percentage': (hourly_data['quality_score'] or 0)
                        }
                    )[1]  # Returns (object, created)
                    
                    if daily_record:
                        stats['records_created'] += 1
                
                stats['sensors_processed'] += 1
                
            except Exception as e:
                logger.error(f"Error aggregating daily data for {sensor.sensor_id}: {e}")
                stats['errors'] += 1
        
        # Update job record
        job.status = 'completed'
        job.completed_at = timezone.now()
        job.processed_sensors = stats['sensors_processed']
        job.records_created = stats['records_created']
        job.save()
        
        logger.info(f"Daily aggregation completed for {target_date}: {stats}")
        
        return {
            'status': 'success',
            'job_id': job.id,
            'date': str(target_date),
            'stats': stats,
            'duration': str(job.duration) if job.duration else None
        }
        
    except Exception as exc:
        logger.error(f"Error in daily aggregation: {exc}")
        raise

# ================================================================================
# 3. DATA QUALITY MONITORING TASKS
# ================================================================================

@shared_task
def update_data_quality_metrics(date: str = None):
    """
    Update daily data quality metrics for all sensors
    Runs daily after data aggregation
    """
    try:
        # Default to yesterday if not specified
        if not date:
            target_date = (timezone.now() - timedelta(days=1)).date()
        else:
            target_date = datetime.fromisoformat(date).date()
        
        # Update quality records
        stats = DataQualityService.update_daily_quality_records(target_date)
        
        logger.info(f"Data quality update completed for {target_date}: {stats}")
        
        return {
            'status': 'success',
            'date': str(target_date),
            'stats': stats,
            'timestamp': timezone.now().isoformat()
        }
        
    except Exception as exc:
        logger.error(f"Error updating data quality metrics: {exc}")
        raise

# ================================================================================
# 4. MAINTENANCE TASKS
# ================================================================================

@shared_task
def cleanup_old_data():
    """
    Clean up old data according to retention policies
    Runs daily at 2 AM
    """
    try:
        now = timezone.now()
        stats = {
            'realtime_deleted': 0,
            'recent_deleted': 0,
            'historical_deleted': 0,
            'errors': 0
        }
        
        # Delete realtime data older than 1 week
        one_week_ago = now - timedelta(days=7)
        realtime_deleted = RealtimeData.objects.filter(
            timestamp__lt=one_week_ago
        ).delete()
        stats['realtime_deleted'] = realtime_deleted[0] if realtime_deleted else 0
        
        # Delete recent data older than 3 months
        three_months_ago = now - timedelta(days=90)
        recent_deleted = RecentData.objects.filter(
            timestamp__lt=three_months_ago
        ).delete()
        stats['recent_deleted'] = recent_deleted[0] if recent_deleted else 0
        
        # Delete historical data older than 1 year
        one_year_ago = now - timedelta(days=365)
        historical_deleted = HistoricalData.objects.filter(
            timestamp__lt=one_year_ago
        ).delete()
        stats['historical_deleted'] = historical_deleted[0] if historical_deleted else 0
        
        logger.info(f"Data cleanup completed: {stats}")
        
        return {
            'status': 'success',
            'stats': stats,
            'timestamp': timezone.now().isoformat()
        }
        
    except Exception as exc:
        logger.error(f"Error in data cleanup: {exc}")
        stats['errors'] += 1
        raise

@shared_task
def update_system_health():
    """
    Update system health metrics
    Runs every hour
    """
    try:
        from django.db import connection
        
        # Get database metrics
        with connection.cursor() as cursor:
            # Count records in each table
            cursor.execute("SELECT COUNT(*) FROM realtime_data")
            realtime_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM recent_data")
            recent_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM historical_data")
            historical_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM archive_data")
            archive_count = cursor.fetchone()[0]
        
        # Get sensor counts
        total_sensors = Sensor.objects.count()
        active_sensors = Sensor.objects.filter(is_active=True).count()
        
        # Calculate overall quality score
        recent_quality = DataQuality.objects.filter(
            date__gte=timezone.now().date() - timedelta(days=7)
        ).aggregate(
            avg_quality=Avg('quality_score')
        )
        overall_quality = recent_quality['avg_quality'] or 0
        
        # Count sensors with issues (quality < 80%)
        sensors_with_issues = DataQuality.objects.filter(
            date=timezone.now().date() - timedelta(days=1),
            quality_score__lt=80
        ).count()
        
        # Create health record
        health_record = SystemHealth.objects.create(
            total_sensors=total_sensors,
            active_sensors=active_sensors,
            realtime_records=realtime_count,
            recent_records=recent_count,
            historical_records=historical_count,
            archive_records=archive_count,
            overall_quality_score=overall_quality,
            sensors_with_issues=sensors_with_issues
        )
        
        logger.info(f"System health updated: {health_record.id}")
        
        return {
            'status': 'success',
            'health_id': health_record.id,
            'metrics': {
                'total_sensors': total_sensors,
                'active_sensors': active_sensors,
                'overall_quality': round(overall_quality, 2),
                'sensors_with_issues': sensors_with_issues
            }
        }
        
    except Exception as exc:
        logger.error(f"Error updating system health: {exc}")
        raise

# ================================================================================
# 5. COMPOSITE TASKS
# ================================================================================

@shared_task
def full_data_pipeline(start_time: str = None, end_time: str = None):
    """
    Run the complete data processing pipeline
    Used for batch processing or recovery
    """
    try:
        pipeline_start = time.time()
        results = {}
        
        # Step 1: Sync latest data
        sync_result = sync_latest_sensor_data.delay()
        results['sync'] = sync_result.get(timeout=300)
        
        # Step 2: 5-minute aggregation
        agg_5min_result = aggregate_5min_data.delay(start_time, end_time)
        results['5min_aggregation'] = agg_5min_result.get(timeout=600)
        
        # Step 3: Hourly aggregation (only if processing older data)
        if start_time and end_time:
            agg_hourly_result = aggregate_hourly_data.delay(start_time, end_time)
            results['hourly_aggregation'] = agg_hourly_result.get(timeout=600)
        
        # Step 4: Update data quality
        quality_result = update_data_quality_metrics.delay()
        results['quality_update'] = quality_result.get(timeout=300)
        
        pipeline_duration = time.time() - pipeline_start
        
        logger.info(f"Full data pipeline completed in {pipeline_duration:.2f}s")
        
        return {
            'status': 'success',
            'duration': pipeline_duration,
            'results': results,
            'timestamp': timezone.now().isoformat()
        }
        
    except Exception as exc:
        logger.error(f"Error in full data pipeline: {exc}")
        raise