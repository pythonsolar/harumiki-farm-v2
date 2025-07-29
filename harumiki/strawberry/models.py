"""
Smart Farm Time-Series Database Models
Optimized for high-performance IoT data storage and retrieval
Based on professional time-series database design patterns
"""

from django.db import models
from django.contrib.postgres.indexes import BrinIndex
from django.db.models import Index, Avg, Min, Max, Count, StdDev, JSONField
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

# ================================================================================
# 1. MASTER DATA TABLES
# ================================================================================

class SensorType(models.Model):
    """Master data for sensor types with validation rules"""
    code = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=100)
    unit = models.CharField(max_length=20)
    min_value = models.FloatField(null=True, blank=True, help_text="Expected minimum value")
    max_value = models.FloatField(null=True, blank=True, help_text="Expected maximum value")
    decimal_places = models.PositiveSmallIntegerField(default=2)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'sensor_types'
        ordering = ['code']
        
    def __str__(self):
        return f"{self.name} ({self.unit})"

class Sensor(models.Model):
    """Master data for individual sensors with location mapping"""
    sensor_id = models.CharField(max_length=50, unique=True, db_index=True)
    sensor_type = models.ForeignKey(SensorType, on_delete=models.PROTECT, related_name='sensors')
    farm = models.PositiveSmallIntegerField(choices=[(1, 'Farm 1'), (2, 'Farm 2')])
    location = models.CharField(max_length=50, help_text="Physical location (R8, R16, R24, etc.)")
    zone = models.CharField(max_length=20, blank=True, help_text="Zone identifier")
    is_active = models.BooleanField(default=True)
    
    # API mapping fields
    api_sensor_id = models.CharField(max_length=50, help_text="ID used in API calls")
    api_value_key = models.CharField(max_length=50, help_text="Key to extract value from API response")
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True, help_text="Additional sensor configuration")
    calibration_offset = models.FloatField(default=0.0)
    calibration_multiplier = models.FloatField(default=1.0)
    
    # Tracking
    last_seen = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'sensors'
        indexes = [
            Index(fields=['sensor_id']),
            Index(fields=['farm', 'sensor_type']),
            Index(fields=['api_sensor_id', 'api_value_key']),
            Index(fields=['is_active', 'farm']),
        ]
        unique_together = ['api_sensor_id', 'api_value_key']
        
    def __str__(self):
        return f"{self.sensor_id} - Farm {self.farm} ({self.location})"
    
    def get_calibrated_value(self, raw_value):
        """Apply calibration to raw sensor value"""
        if raw_value is None:
            return None
        return (raw_value * self.calibration_multiplier) + self.calibration_offset

# ================================================================================
# 2. TIME-SERIES DATA TABLES (Multi-Tier Storage)
# ================================================================================

class TimeSeriesQuerySet(models.QuerySet):
    """Custom QuerySet with time-series optimizations"""
    
    def in_range(self, start, end):
        """Filter by time range with optimization"""
        return self.filter(timestamp__gte=start, timestamp__lte=end)
    
    def for_sensor(self, sensor_id):
        """Filter by sensor ID (supports both PK and sensor_id string)"""
        if isinstance(sensor_id, str):
            return self.filter(sensor__sensor_id=sensor_id)
        return self.filter(sensor_id=sensor_id)
    
    def latest_first(self):
        """Order by timestamp descending"""
        return self.order_by('-timestamp')
    
    def with_sensor_info(self):
        """Select related sensor information"""
        return self.select_related('sensor', 'sensor__sensor_type')

class TimeSeriesManager(models.Manager):
    """Custom manager for time-series models"""
    
    def get_queryset(self):
        return TimeSeriesQuerySet(self.model, using=self._db)
    
    def bulk_insert_optimized(self, data_list, batch_size=1000):
        """Optimized bulk insert for time-series data"""
        return self.bulk_create(data_list, batch_size=batch_size, ignore_conflicts=True)

class RealtimeData(models.Model):
    """Raw sensor data - partitioned by week, kept for 1 week"""
    sensor = models.ForeignKey(Sensor, on_delete=models.CASCADE, db_index=True)
    timestamp = models.DateTimeField(db_index=True)
    value = models.JSONField(help_text="Raw sensor data as JSON")
    processed_value = models.FloatField(null=True, help_text="Main processed value for queries")
    quality_flag = models.CharField(max_length=10, default='good', choices=[
        ('good', 'Good'),
        ('suspect', 'Suspect'),
        ('bad', 'Bad'),
        ('missing', 'Missing')
    ])
    created_at = models.DateTimeField(auto_now_add=True)
    
    objects = TimeSeriesManager()
    
    class Meta:
        db_table = 'realtime_data'
        indexes = [
            BrinIndex(fields=['timestamp']),  # BRIN index optimal for time-series
            Index(fields=['sensor', '-timestamp']),
            Index(fields=['timestamp', 'quality_flag']),
            Index(fields=['sensor', 'timestamp', 'quality_flag']),  # Composite index
        ]
        # Note: Django doesn't support native partitioning, implement via raw SQL
        
    def __str__(self):
        return f"{self.sensor.sensor_id} @ {self.timestamp}: {self.processed_value}"
    
    def save(self, *args, **kwargs):
        """Auto-extract processed_value from JSON"""
        if self.value and not self.processed_value:
            # Extract main value based on sensor's API configuration
            main_key = self.sensor.api_value_key
            if main_key in self.value:
                raw_value = self.value[main_key]
                self.processed_value = self.sensor.get_calibrated_value(raw_value)
        super().save(*args, **kwargs)

class RecentData(models.Model):
    """5-minute aggregated data - kept for 3 months"""
    sensor = models.ForeignKey(Sensor, on_delete=models.CASCADE, db_index=True)
    timestamp = models.DateTimeField(db_index=True, help_text="5-minute interval boundary")
    
    # Statistical aggregations
    avg_value = models.FloatField()
    min_value = models.FloatField()
    max_value = models.FloatField()
    sample_count = models.PositiveIntegerField()
    std_deviation = models.FloatField(null=True)
    median_value = models.FloatField(null=True)
    
    # Quality metrics
    good_samples = models.PositiveIntegerField(default=0)
    suspect_samples = models.PositiveIntegerField(default=0)
    bad_samples = models.PositiveIntegerField(default=0)
    missing_samples = models.PositiveIntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    objects = TimeSeriesManager()
    
    class Meta:
        db_table = 'recent_data'
        unique_together = ['sensor', 'timestamp']
        indexes = [
            BrinIndex(fields=['timestamp']),
            Index(fields=['sensor', '-timestamp']),
            Index(fields=['timestamp', 'sample_count']),
        ]
        
    @property
    def quality_percentage(self):
        """Calculate data quality percentage"""
        if self.sample_count == 0:
            return 0
        return (self.good_samples / self.sample_count) * 100

class HistoricalData(models.Model):
    """Hourly aggregated data - kept for 1 year"""
    sensor = models.ForeignKey(Sensor, on_delete=models.CASCADE, db_index=True)
    timestamp = models.DateTimeField(db_index=True, help_text="Hour boundary")
    
    # Statistical aggregations
    avg_value = models.FloatField()
    min_value = models.FloatField()
    max_value = models.FloatField()
    sample_count = models.PositiveIntegerField()
    std_deviation = models.FloatField(null=True)
    median_value = models.FloatField(null=True)
    percentile_25 = models.FloatField(null=True)
    percentile_75 = models.FloatField(null=True)
    
    # Quality metrics
    quality_score = models.FloatField(default=100.0, help_text="Data quality percentage")
    gap_count = models.PositiveIntegerField(default=0, help_text="Number of data gaps")
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    objects = TimeSeriesManager()
    
    class Meta:
        db_table = 'historical_data'
        unique_together = ['sensor', 'timestamp']
        indexes = [
            BrinIndex(fields=['timestamp']),
            Index(fields=['sensor', '-timestamp']),
            Index(fields=['quality_score']),
        ]

class ArchiveData(models.Model):
    """Daily aggregated data - kept forever"""
    sensor = models.ForeignKey(Sensor, on_delete=models.CASCADE, db_index=True)
    timestamp = models.DateTimeField(db_index=True, help_text="Day boundary (00:00:00)")
    
    # Statistical aggregations
    avg_value = models.FloatField()
    min_value = models.FloatField()
    max_value = models.FloatField()
    sample_count = models.PositiveIntegerField()
    std_deviation = models.FloatField(null=True)
    median_value = models.FloatField(null=True)
    percentile_25 = models.FloatField(null=True)
    percentile_75 = models.FloatField(null=True)
    
    # Special calculations
    total_value = models.FloatField(null=True, help_text="Daily total (for DLI, rainfall, etc.)")
    duration_hours = models.FloatField(default=24.0, help_text="Actual measurement duration")
    
    # Quality metrics
    quality_score = models.FloatField(default=100.0)
    uptime_percentage = models.FloatField(default=100.0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    objects = TimeSeriesManager()
    
    class Meta:
        db_table = 'archive_data'
        unique_together = ['sensor', 'timestamp']
        indexes = [
            BrinIndex(fields=['timestamp']),
            Index(fields=['sensor', '-timestamp']),
            Index(fields=['sensor', 'timestamp']),  # For range queries
        ]

# ================================================================================
# 3. CACHE AND SUPPORT TABLES
# ================================================================================

class LatestSensorValue(models.Model):
    """Cache table for current sensor values - updated in real-time"""
    sensor = models.OneToOneField(Sensor, on_delete=models.CASCADE, primary_key=True)
    timestamp = models.DateTimeField()
    value = JSONField()
    processed_value = models.FloatField(null=True)
    quality_flag = models.CharField(max_length=10, default='good')
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'latest_sensor_values'
        indexes = [
            Index(fields=['updated_at']),
            Index(fields=['quality_flag']),
        ]
        
    def __str__(self):
        return f"Latest: {self.sensor.sensor_id} = {self.processed_value}"

class DataQuality(models.Model):
    """Daily data quality tracking"""
    sensor = models.ForeignKey(Sensor, on_delete=models.CASCADE)
    date = models.DateField()
    expected_count = models.PositiveIntegerField()
    actual_count = models.PositiveIntegerField()
    missing_periods = JSONField(default=list, help_text="List of missing time ranges")
    quality_score = models.FloatField(default=100.0)
    
    # Detailed metrics
    good_count = models.PositiveIntegerField(default=0)
    suspect_count = models.PositiveIntegerField(default=0)
    bad_count = models.PositiveIntegerField(default=0)
    missing_count = models.PositiveIntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'data_quality'
        unique_together = ['sensor', 'date']
        indexes = [
            Index(fields=['sensor', '-date']),
            Index(fields=['quality_score']),
            Index(fields=['date', 'quality_score']),
        ]
        
    @property
    def completeness_percentage(self):
        """Calculate data completeness"""
        return (self.actual_count / self.expected_count * 100) if self.expected_count > 0 else 0

# ================================================================================
# 4. BACKGROUND JOB TRACKING
# ================================================================================

class AggregationJob(models.Model):
    """Track aggregation jobs for reliability and monitoring"""
    LEVEL_CHOICES = [
        ('5min', '5 Minutes'),
        ('hourly', 'Hourly'),
        ('daily', 'Daily'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Progress tracking
    total_sensors = models.PositiveIntegerField(default=0)
    processed_sensors = models.PositiveIntegerField(default=0)
    records_processed = models.PositiveIntegerField(default=0)
    records_created = models.PositiveIntegerField(default=0)
    
    # Error handling
    error_message = models.TextField(blank=True)
    retry_count = models.PositiveSmallIntegerField(default=0)
    max_retries = models.PositiveSmallIntegerField(default=3)
    
    # Timing
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True)
    completed_at = models.DateTimeField(null=True)
    
    class Meta:
        db_table = 'aggregation_jobs'
        indexes = [
            Index(fields=['level', 'status', '-created_at']),
            Index(fields=['status', '-created_at']),
            Index(fields=['-created_at']),
        ]
        
    @property
    def duration(self):
        """Calculate job duration"""
        if self.started_at and self.completed_at:
            return self.completed_at - self.started_at
        return None
    
    @property
    def progress_percentage(self):
        """Calculate progress percentage"""
        if self.total_sensors == 0:
            return 0
        return (self.processed_sensors / self.total_sensors) * 100

class AlertThreshold(models.Model):
    """Alert threshold configuration for sensors"""
    sensor = models.ForeignKey(Sensor, on_delete=models.CASCADE, related_name='alert_thresholds')
    
    # Threshold values
    min_threshold = models.FloatField(null=True, blank=True)
    max_threshold = models.FloatField(null=True, blank=True)
    rate_threshold = models.FloatField(null=True, blank=True, help_text="Rate of change threshold")
    
    # Alert configuration
    duration_minutes = models.PositiveIntegerField(default=5, help_text="Duration before triggering alert")
    severity = models.CharField(max_length=20, choices=[
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('critical', 'Critical'),
    ], default='warning')
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'alert_thresholds'
        indexes = [
            Index(fields=['sensor', 'is_active']),
        ]

# ================================================================================
# 5. SYSTEM METADATA
# ================================================================================

class SystemHealth(models.Model):
    """System health metrics"""
    timestamp = models.DateTimeField(auto_now_add=True)
    
    # Database metrics
    total_sensors = models.PositiveIntegerField()
    active_sensors = models.PositiveIntegerField()
    realtime_records = models.BigIntegerField()
    recent_records = models.BigIntegerField()
    historical_records = models.BigIntegerField()
    archive_records = models.BigIntegerField()
    
    # Performance metrics
    avg_query_time = models.FloatField(null=True)
    cache_hit_ratio = models.FloatField(null=True)
    api_response_time = models.FloatField(null=True)
    
    # Data quality
    overall_quality_score = models.FloatField(null=True)
    sensors_with_issues = models.PositiveIntegerField(default=0)
    
    class Meta:
        db_table = 'system_health'
        indexes = [
            Index(fields=['-timestamp']),
        ]