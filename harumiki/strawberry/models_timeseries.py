# Time-Series Database Models for Smart Farm
# Based on the professional schema design

from django.db import models
from django.contrib.postgres.fields import JSONField
from django.contrib.postgres.indexes import BrinIndex, BTreeIndex
from django.db.models import Index, Q
from django.utils import timezone
from datetime import timedelta

class SensorType(models.Model):
    """Master data for sensor types"""
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    unit = models.CharField(max_length=20)
    min_value = models.FloatField(null=True, blank=True)
    max_value = models.FloatField(null=True, blank=True)
    
    class Meta:
        db_table = 'sensor_types'
        
    def __str__(self):
        return f"{self.name} ({self.unit})"

class Sensor(models.Model):
    """Master data for individual sensors"""
    sensor_id = models.CharField(max_length=50, unique=True)
    sensor_type = models.ForeignKey(SensorType, on_delete=models.PROTECT)
    farm = models.IntegerField(choices=[(1, 'Farm 1'), (2, 'Farm 2')])
    location = models.CharField(max_length=50)
    is_active = models.BooleanField(default=True)
    metadata = JSONField(default=dict, blank=True)  # เก็บข้อมูลเพิ่มเติม
    
    class Meta:
        db_table = 'sensors'
        indexes = [
            Index(fields=['sensor_id']),
            Index(fields=['farm', 'sensor_type']),
        ]
        
    def __str__(self):
        return f"{self.sensor_id} - Farm {self.farm} ({self.location})"

class RealtimeData(models.Model):
    """Raw sensor data - keep for 1 week"""
    sensor = models.ForeignKey(Sensor, on_delete=models.CASCADE)
    timestamp = models.DateTimeField(db_index=True)
    value = JSONField()  # Store raw sensor data as JSON
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'realtime_data'
        indexes = [
            BrinIndex(fields=['timestamp']),  # BRIN index for time-series
            Index(fields=['sensor', '-timestamp']),
        ]
        # Django doesn't support native partitioning, need custom SQL
        
    def __str__(self):
        return f"{self.sensor.sensor_id} @ {self.timestamp}"

class RecentData(models.Model):
    """5-minute aggregated data - keep for 3 months"""
    sensor = models.ForeignKey(Sensor, on_delete=models.CASCADE)
    timestamp = models.DateTimeField()
    avg_value = models.FloatField()
    min_value = models.FloatField()
    max_value = models.FloatField()
    sample_count = models.IntegerField()
    std_deviation = models.FloatField(null=True)
    percentile_25 = models.FloatField(null=True)
    percentile_75 = models.FloatField(null=True)
    
    class Meta:
        db_table = 'recent_data'
        unique_together = ['sensor', 'timestamp']
        indexes = [
            BrinIndex(fields=['timestamp']),
            Index(fields=['sensor', '-timestamp']),
        ]
        
class HistoricalData(models.Model):
    """Hourly aggregated data - keep for 1 year"""
    sensor = models.ForeignKey(Sensor, on_delete=models.CASCADE)
    timestamp = models.DateTimeField()
    avg_value = models.FloatField()
    min_value = models.FloatField()
    max_value = models.FloatField()
    sample_count = models.IntegerField()
    std_deviation = models.FloatField(null=True)
    percentile_25 = models.FloatField(null=True)
    percentile_75 = models.FloatField(null=True)
    
    class Meta:
        db_table = 'historical_data'
        unique_together = ['sensor', 'timestamp']
        indexes = [
            BrinIndex(fields=['timestamp']),
            Index(fields=['sensor', '-timestamp']),
        ]

class ArchiveData(models.Model):
    """Daily aggregated data - keep forever"""
    sensor = models.ForeignKey(Sensor, on_delete=models.CASCADE)
    timestamp = models.DateTimeField()
    avg_value = models.FloatField()
    min_value = models.FloatField()
    max_value = models.FloatField()
    sample_count = models.IntegerField()
    std_deviation = models.FloatField(null=True)
    percentile_25 = models.FloatField(null=True)
    percentile_75 = models.FloatField(null=True)
    total_value = models.FloatField(null=True)  # For DLI, rainfall, etc.
    
    class Meta:
        db_table = 'archive_data'
        unique_together = ['sensor', 'timestamp']
        indexes = [
            BrinIndex(fields=['timestamp']),
            Index(fields=['sensor', '-timestamp']),
        ]

class LatestSensorValue(models.Model):
    """Cache for current sensor values"""
    sensor = models.OneToOneField(Sensor, on_delete=models.CASCADE, primary_key=True)
    timestamp = models.DateTimeField()
    value = JSONField()
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'latest_sensor_values'

class DataQuality(models.Model):
    """Track data quality and missing periods"""
    sensor = models.ForeignKey(Sensor, on_delete=models.CASCADE)
    date = models.DateField()
    expected_count = models.IntegerField()
    actual_count = models.IntegerField()
    missing_periods = JSONField(default=list)
    quality_score = models.FloatField(default=100.0)  # 0-100%
    
    class Meta:
        db_table = 'data_quality'
        unique_together = ['sensor', 'date']
        indexes = [
            Index(fields=['sensor', '-date']),
            Index(fields=['quality_score']),  # Find problematic sensors
        ]

# Additional optimization models

class AggregationJob(models.Model):
    """Track aggregation jobs for reliability"""
    LEVEL_CHOICES = [
        ('5min', '5 Minutes'),
        ('hourly', 'Hourly'),
        ('daily', 'Daily'),
    ]
    
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    status = models.CharField(max_length=20, choices=[
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ])
    records_processed = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True)
    
    class Meta:
        db_table = 'aggregation_jobs'
        indexes = [
            Index(fields=['level', 'status', '-created_at']),
        ]

class AlertThreshold(models.Model):
    """Define alert thresholds for sensors"""
    sensor = models.ForeignKey(Sensor, on_delete=models.CASCADE)
    min_threshold = models.FloatField(null=True)
    max_threshold = models.FloatField(null=True)
    duration_minutes = models.IntegerField(default=5)  # How long before alert
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'alert_thresholds'

# Query helper methods
class TimeSeriesQuerySet(models.QuerySet):
    """Custom QuerySet for time-series operations"""
    
    def in_range(self, start, end):
        """Filter by time range"""
        return self.filter(timestamp__gte=start, timestamp__lte=end)
    
    def downsample(self, interval='1H'):
        """Downsample data to specified interval"""
        # Implementation would use raw SQL or pandas
        pass
    
    def fill_missing(self, method='linear'):
        """Fill missing data points"""
        # Implementation for interpolation
        pass

# Manager for time-series models
class TimeSeriesManager(models.Manager):
    def get_queryset(self):
        return TimeSeriesQuerySet(self.model, using=self._db)
    
    def get_latest_values(self, sensor_ids=None):
        """Get latest values for multiple sensors"""
        qs = LatestSensorValue.objects.select_related('sensor')
        if sensor_ids:
            qs = qs.filter(sensor__sensor_id__in=sensor_ids)
        return qs
    
    def get_aggregated_data(self, sensor_id, start, end, level='auto'):
        """Automatically choose appropriate data table based on date range"""
        duration = end - start
        
        if duration <= timedelta(days=7):
            # Use realtime data
            model = RealtimeData
        elif duration <= timedelta(days=90):
            # Use 5-minute data
            model = RecentData
        elif duration <= timedelta(days=365):
            # Use hourly data
            model = HistoricalData
        else:
            # Use daily data
            model = ArchiveData
            
        return model.objects.filter(
            sensor__sensor_id=sensor_id,
            timestamp__gte=start,
            timestamp__lte=end
        ).order_by('timestamp')

# Attach custom manager to time-series models
RealtimeData.objects = TimeSeriesManager()
RecentData.objects = TimeSeriesManager()
HistoricalData.objects = TimeSeriesManager()
ArchiveData.objects = TimeSeriesManager()