#!/usr/bin/env python
"""
Create sample sensor data for testing localhost functionality
"""

import os
import sys
import django
from datetime import datetime, timedelta
from django.utils import timezone
import random
import json

# Django setup
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'harumiki.settings')
django.setup()

from strawberry.models import Sensor, RealtimeData, LatestSensorValue

def create_sample_data():
    """Create sample sensor data for the last 7 days"""
    print("Creating sample sensor data...")
    
    # Get all active sensors
    sensors = Sensor.objects.filter(is_active=True)
    print(f"Found {sensors.count()} sensors")
    
    # Time range: last 7 days
    end_time = timezone.now()
    start_time = end_time - timedelta(days=7)
    
    # Generate data every 5 minutes
    time_interval = timedelta(minutes=5)
    current_time = start_time
    
    total_records = 0
    
    while current_time <= end_time:
        realtime_records = []
        latest_records = []
        
        for sensor in sensors:
            # Generate realistic values based on sensor type
            value = generate_realistic_value(sensor)
            
            # Create raw data (JSON format)
            raw_data = {
                sensor.api_value_key: value,
                'timestamp': current_time.isoformat(),
                'sensor_id': sensor.api_sensor_id
            }
            
            # Create realtime data record
            realtime_record = RealtimeData(
                sensor=sensor,
                timestamp=current_time,
                value=raw_data,
                processed_value=value,
                quality_flag='good'
            )
            realtime_records.append(realtime_record)
            
            # Update latest sensor value
            latest_record, created = LatestSensorValue.objects.get_or_create(
                sensor=sensor,
                defaults={
                    'timestamp': current_time,
                    'value': raw_data,
                    'processed_value': value,
                    'quality_flag': 'good'
                }
            )
            
            # Update if this is newer data
            if not created and current_time > latest_record.timestamp:
                latest_record.timestamp = current_time
                latest_record.value = raw_data
                latest_record.processed_value = value
                latest_record.updated_at = timezone.now()
                latest_records.append(latest_record)
        
        # Bulk create realtime records
        RealtimeData.objects.bulk_create(realtime_records, batch_size=100, ignore_conflicts=True)
        
        # Bulk update latest records
        if latest_records:
            LatestSensorValue.objects.bulk_update(
                latest_records, 
                ['timestamp', 'value', 'processed_value', 'updated_at'],
                batch_size=100
            )
        
        total_records += len(realtime_records)
        current_time += time_interval
        
        # Progress indicator
        if total_records % 1000 == 0:
            print(f"Created {total_records} records...")
    
    print(f"Sample data creation completed! Total records: {total_records}")
    
    # Summary
    print("\n=== Data Summary ===")
    print(f"RealtimeData records: {RealtimeData.objects.count()}")
    print(f"LatestSensorValue records: {LatestSensorValue.objects.count()}")
    print(f"Sensors with data: {sensors.count()}")
    print(f"Time range: {start_time.strftime('%Y-%m-%d %H:%M')} to {end_time.strftime('%Y-%m-%d %H:%M')}")

def generate_realistic_value(sensor):
    """Generate realistic sensor values based on sensor type"""
    sensor_type = sensor.sensor_type.code
    
    # Base values with some randomness
    base_values = {
        'pm25': random.uniform(10, 50),  # μg/m³
        'co2': random.uniform(400, 800),  # ppm
        'ec': random.uniform(1.2, 2.5),  # mS/cm
        'temperature': random.uniform(22, 28),  # °C
        'humidity': random.uniform(60, 85),  # %RH
        'npk_nitrogen': random.uniform(100, 180),  # mg/L
        'npk_phosphorus': random.uniform(20, 60),  # mg/L
        'npk_potassium': random.uniform(120, 200),  # mg/L
        'soil_moisture': random.uniform(45, 75),  # %
        'ppfd': random.uniform(200, 800),  # μmol/s.m²
        'uv': random.uniform(1, 8),  # UV index
        'lux': random.uniform(10000, 40000),  # lux
    }
    
    base_value = base_values.get(sensor_type, random.uniform(10, 100))
    
    # Add time-based variation (simulate day/night cycles for some sensors)
    current_hour = timezone.now().hour
    if sensor_type in ['ppfd', 'lux', 'uv']:
        # Light sensors: lower at night, higher during day
        if 6 <= current_hour <= 18:  # Day time
            base_value *= random.uniform(0.8, 1.2)
        else:  # Night time
            base_value *= random.uniform(0.1, 0.3)
    
    # Add random variation
    variation = random.uniform(-0.1, 0.1)  # ±10%
    final_value = base_value * (1 + variation)
    
    # Ensure value is within expected range
    if sensor.sensor_type.min_value is not None:
        final_value = max(final_value, sensor.sensor_type.min_value)
    if sensor.sensor_type.max_value is not None:
        final_value = min(final_value, sensor.sensor_type.max_value)
    
    # Round to appropriate decimal places
    decimal_places = sensor.sensor_type.decimal_places
    return round(final_value, decimal_places)

if __name__ == '__main__':
    create_sample_data()