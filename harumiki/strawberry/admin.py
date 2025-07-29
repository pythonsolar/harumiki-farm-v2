from django.contrib import admin
from .models import (
    SensorType, Sensor, RealtimeData, RecentData, 
    HistoricalData, ArchiveData, LatestSensorValue,
    DataQuality, AggregationJob, AlertThreshold, SystemHealth
)

# Register your models here.

@admin.register(SensorType)
class SensorTypeAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'unit', 'min_value', 'max_value']
    search_fields = ['code', 'name']
    ordering = ['code']

@admin.register(Sensor)
class SensorAdmin(admin.ModelAdmin):
    list_display = ['sensor_id', 'sensor_type', 'farm', 'location', 'is_active', 'last_seen']
    list_filter = ['farm', 'sensor_type', 'is_active']
    search_fields = ['sensor_id', 'location', 'api_sensor_id']
    ordering = ['sensor_id']

@admin.register(RealtimeData)
class RealtimeDataAdmin(admin.ModelAdmin):
    list_display = ['sensor', 'timestamp', 'processed_value', 'quality_flag']
    list_filter = ['quality_flag', 'timestamp']
    date_hierarchy = 'timestamp'
    ordering = ['-timestamp']

@admin.register(RecentData)
class RecentDataAdmin(admin.ModelAdmin):
    list_display = ['sensor', 'timestamp', 'avg_value', 'min_value', 'max_value', 'sample_count']
    list_filter = ['timestamp']
    date_hierarchy = 'timestamp'
    ordering = ['-timestamp']

@admin.register(HistoricalData)
class HistoricalDataAdmin(admin.ModelAdmin):
    list_display = ['sensor', 'timestamp', 'avg_value', 'quality_score']
    list_filter = ['timestamp', 'quality_score']
    date_hierarchy = 'timestamp'
    ordering = ['-timestamp']

@admin.register(ArchiveData)
class ArchiveDataAdmin(admin.ModelAdmin):
    list_display = ['sensor', 'timestamp', 'avg_value', 'quality_score', 'uptime_percentage']
    list_filter = ['timestamp']
    date_hierarchy = 'timestamp'
    ordering = ['-timestamp']

@admin.register(LatestSensorValue)
class LatestSensorValueAdmin(admin.ModelAdmin):
    list_display = ['sensor', 'timestamp', 'processed_value', 'quality_flag', 'updated_at']
    list_filter = ['quality_flag']
    search_fields = ['sensor__sensor_id']

@admin.register(DataQuality)
class DataQualityAdmin(admin.ModelAdmin):
    list_display = ['sensor', 'date', 'quality_score', 'actual_count', 'expected_count']
    list_filter = ['date', 'quality_score']
    date_hierarchy = 'date'
    ordering = ['-date']

@admin.register(AggregationJob)
class AggregationJobAdmin(admin.ModelAdmin):
    list_display = ['level', 'start_time', 'status', 'progress_percentage', 'created_at']
    list_filter = ['level', 'status']
    ordering = ['-created_at']

@admin.register(AlertThreshold)
class AlertThresholdAdmin(admin.ModelAdmin):
    list_display = ['sensor', 'min_threshold', 'max_threshold', 'severity', 'is_active']
    list_filter = ['severity', 'is_active']
    search_fields = ['sensor__sensor_id']

@admin.register(SystemHealth)
class SystemHealthAdmin(admin.ModelAdmin):
    list_display = ['timestamp', 'total_sensors', 'active_sensors', 'overall_quality_score']
    ordering = ['-timestamp']
