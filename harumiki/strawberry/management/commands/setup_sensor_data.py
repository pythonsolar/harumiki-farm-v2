"""
Management command to setup sensor data and migrate from old API-based system
to new time-series database structure
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.conf import settings
from datetime import datetime, timedelta
import logging

from strawberry.models import (
    SensorType, Sensor, LatestSensorValue, 
    RealtimeData, DataQuality, SystemHealth
)
from strawberry.services import APIDataService

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Setup sensor master data and initial configuration for time-series database'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--initialize',
            action='store_true',
            help='Initialize sensor types and sensors from configuration',
        )
        parser.add_argument(
            '--sync-latest',
            action='store_true',
            help='Sync latest sensor data from API',
        )
        parser.add_argument(
            '--backfill-days',
            type=int,
            default=0,
            help='Number of days to backfill historical data',
        )
        parser.add_argument(
            '--farm-id',
            type=int,
            choices=[1, 2],
            help='Specific farm to process (1 or 2)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )
    
    def handle(self, *args, **options):
        """Main command handler"""
        self.dry_run = options.get('dry_run', False)
        self.farm_id = options.get('farm_id')
        
        if self.dry_run:
            self.stdout.write(
                self.style.WARNING('DRY RUN MODE - No changes will be made')
            )
        
        if options.get('initialize'):
            self.initialize_sensor_data()
        
        if options.get('sync_latest'):
            self.sync_latest_data()
        
        backfill_days = options.get('backfill_days', 0)
        if backfill_days > 0:
            self.backfill_historical_data(backfill_days)
        
        self.stdout.write(
            self.style.SUCCESS('Sensor data setup completed successfully')
        )
    
    def initialize_sensor_data(self):
        """Initialize sensor types and sensors from SENSOR_MAPPINGS configuration"""
        self.stdout.write('Initializing sensor types and sensors...')
        
        # Define sensor types based on the configuration
        sensor_types_config = [
            {
                'code': 'pm25',
                'name': 'PM 2.5',
                'unit': 'μg/m³',
                'min_value': 0,
                'max_value': 500,
                'description': 'Particulate Matter 2.5 micrometers'
            },
            {
                'code': 'co2',
                'name': 'Carbon Dioxide',
                'unit': 'ppm',
                'min_value': 300,
                'max_value': 5000,
                'description': 'CO2 concentration'
            },
            {
                'code': 'ec',
                'name': 'Electrical Conductivity',
                'unit': 'mS/cm',
                'min_value': 0,
                'max_value': 10,
                'description': 'Water electrical conductivity'
            },
            {
                'code': 'temperature',
                'name': 'Temperature',
                'unit': '°C',
                'min_value': -10,
                'max_value': 60,
                'description': 'Temperature measurement'
            },
            {
                'code': 'humidity',
                'name': 'Humidity',
                'unit': '%RH',
                'min_value': 0,
                'max_value': 100,
                'description': 'Relative humidity'
            },
            {
                'code': 'npk_nitrogen',
                'name': 'Nitrogen (N)',
                'unit': 'mg/L',
                'min_value': 0,
                'max_value': 200,
                'description': 'Nitrogen content in NPK sensor'
            },
            {
                'code': 'npk_phosphorus',
                'name': 'Phosphorus (P)',
                'unit': 'mg/L',
                'min_value': 0,
                'max_value': 200,
                'description': 'Phosphorus content in NPK sensor'
            },
            {
                'code': 'npk_potassium',
                'name': 'Potassium (K)',
                'unit': 'mg/L',
                'min_value': 0,
                'max_value': 200,
                'description': 'Potassium content in NPK sensor'
            },
            {
                'code': 'soil_moisture',
                'name': 'Soil Moisture',
                'unit': '%',
                'min_value': 0,
                'max_value': 100,
                'description': 'Soil moisture percentage'
            },
            {
                'code': 'ppfd',
                'name': 'PPFD',
                'unit': 'μmol/s.m²',
                'min_value': 0,
                'max_value': 2000,
                'description': 'Photosynthetic Photon Flux Density'
            },
            {
                'code': 'uv',
                'name': 'UV Index',
                'unit': 'UV',
                'min_value': 0,
                'max_value': 15,
                'description': 'UV radiation index'
            },
            {
                'code': 'lux',
                'name': 'Illuminance',
                'unit': 'lux',
                'min_value': 0,
                'max_value': 100000,
                'description': 'Light illuminance'
            }
        ]
        
        # Create sensor types
        created_types = 0
        for type_config in sensor_types_config:
            if not self.dry_run:
                sensor_type, created = SensorType.objects.get_or_create(
                    code=type_config['code'],
                    defaults=type_config
                )
                if created:
                    created_types += 1
                    self.stdout.write(f"  Created sensor type: {sensor_type.name}")
        
        self.stdout.write(f"Sensor types processed: {created_types} created")
        
        # Define sensors based on SENSOR_MAPPINGS
        sensors_config = self.get_sensors_configuration()
        
        # Create sensors
        created_sensors = 0
        for sensor_config in sensors_config:
            if self.farm_id and sensor_config['farm'] != self.farm_id:
                continue
                
            if not self.dry_run:
                try:
                    sensor_type = SensorType.objects.get(code=sensor_config['sensor_type_code'])
                    sensor, created = Sensor.objects.get_or_create(
                        sensor_id=sensor_config['sensor_id'],
                        defaults={
                            'sensor_type': sensor_type,
                            'farm': sensor_config['farm'],
                            'location': sensor_config['location'],
                            'api_sensor_id': sensor_config['api_sensor_id'],
                            'api_value_key': sensor_config['api_value_key'],
                            'zone': sensor_config.get('zone', ''),
                            'metadata': sensor_config.get('metadata', {})
                        }
                    )
                    if created:
                        created_sensors += 1
                        self.stdout.write(f"  Created sensor: {sensor.sensor_id}")
                except SensorType.DoesNotExist:
                    self.stdout.write(
                        self.style.ERROR(f"Sensor type not found: {sensor_config['sensor_type_code']}")
                    )
        
        self.stdout.write(f"Sensors processed: {created_sensors} created")
    
    def get_sensors_configuration(self):
        """Get sensors configuration based on original SENSOR_MAPPINGS"""
        sensors = []
        
        # Farm 1 sensors
        farm1_sensors = [
            # PM sensors
            {'sensor_id': 'PM25_R1', 'api_sensor_id': 'PM25_R1', 'api_value_key': 'atmos', 
             'sensor_type_code': 'pm25', 'farm': 1, 'location': 'Inside R1'},
            {'sensor_id': 'PM25_OUTSIDE', 'api_sensor_id': 'PM25_OUTSIDE', 'api_value_key': 'atmos',
             'sensor_type_code': 'pm25', 'farm': 1, 'location': 'Outside'},
            
            # Water sensors
            {'sensor_id': 'EC_CONDUCT', 'api_sensor_id': 'EC', 'api_value_key': 'conduct',
             'sensor_type_code': 'ec', 'farm': 1, 'location': 'Water Monitoring'},
            {'sensor_id': 'EC_TEMP', 'api_sensor_id': 'EC', 'api_value_key': 'temp',
             'sensor_type_code': 'temperature', 'farm': 1, 'location': 'Water Monitoring'},
            
            # CO2 sensors
            {'sensor_id': 'CO2_R1', 'api_sensor_id': 'CO2_R1', 'api_value_key': 'val',
             'sensor_type_code': 'co2', 'farm': 1, 'location': 'Inside R1'},
            
            # NPK sensors
            {'sensor_id': 'NPK4_N', 'api_sensor_id': 'NPK4', 'api_value_key': 'nitrogen',
             'sensor_type_code': 'npk_nitrogen', 'farm': 1, 'location': 'R8', 'zone': 'R8'},
            {'sensor_id': 'NPK4_P', 'api_sensor_id': 'NPK4', 'api_value_key': 'phosphorus',
             'sensor_type_code': 'npk_phosphorus', 'farm': 1, 'location': 'R8', 'zone': 'R8'},
            {'sensor_id': 'NPK4_K', 'api_sensor_id': 'NPK4', 'api_value_key': 'potassium',
             'sensor_type_code': 'npk_potassium', 'farm': 1, 'location': 'R8', 'zone': 'R8'},
            {'sensor_id': 'NPK4_T', 'api_sensor_id': 'NPK4', 'api_value_key': 'temperature',
             'sensor_type_code': 'temperature', 'farm': 1, 'location': 'R8', 'zone': 'R8'},
            
            {'sensor_id': 'NPK5_N', 'api_sensor_id': 'NPK5', 'api_value_key': 'nitrogen',
             'sensor_type_code': 'npk_nitrogen', 'farm': 1, 'location': 'R16', 'zone': 'R16'},
            {'sensor_id': 'NPK5_P', 'api_sensor_id': 'NPK5', 'api_value_key': 'phosphorus',
             'sensor_type_code': 'npk_phosphorus', 'farm': 1, 'location': 'R16', 'zone': 'R16'},
            {'sensor_id': 'NPK5_K', 'api_sensor_id': 'NPK5', 'api_value_key': 'potassium',
             'sensor_type_code': 'npk_potassium', 'farm': 1, 'location': 'R16', 'zone': 'R16'},
            {'sensor_id': 'NPK5_T', 'api_sensor_id': 'NPK5', 'api_value_key': 'temperature',
             'sensor_type_code': 'temperature', 'farm': 1, 'location': 'R16', 'zone': 'R16'},
            
            {'sensor_id': 'NPK6_N', 'api_sensor_id': 'NPK6', 'api_value_key': 'nitrogen',
             'sensor_type_code': 'npk_nitrogen', 'farm': 1, 'location': 'R24', 'zone': 'R24'},
            {'sensor_id': 'NPK6_P', 'api_sensor_id': 'NPK6', 'api_value_key': 'phosphorus',
             'sensor_type_code': 'npk_phosphorus', 'farm': 1, 'location': 'R24', 'zone': 'R24'},
            {'sensor_id': 'NPK6_K', 'api_sensor_id': 'NPK6', 'api_value_key': 'potassium',
             'sensor_type_code': 'npk_potassium', 'farm': 1, 'location': 'R24', 'zone': 'R24'},
            {'sensor_id': 'NPK6_T', 'api_sensor_id': 'NPK6', 'api_value_key': 'temperature',
             'sensor_type_code': 'temperature', 'farm': 1, 'location': 'R24', 'zone': 'R24'},
            
            # Soil sensors
            {'sensor_id': 'soil7', 'api_sensor_id': 'soil7', 'api_value_key': 'soil',
             'sensor_type_code': 'soil_moisture', 'farm': 1, 'location': 'Soil Point 7'},
            {'sensor_id': 'soil8', 'api_sensor_id': 'soil8', 'api_value_key': 'soil',
             'sensor_type_code': 'soil_moisture', 'farm': 1, 'location': 'Soil Point 8'},
            {'sensor_id': 'soil9', 'api_sensor_id': 'soil9', 'api_value_key': 'soil',
             'sensor_type_code': 'soil_moisture', 'farm': 1, 'location': 'Soil Point 9'},
            {'sensor_id': 'soil10', 'api_sensor_id': 'soil10', 'api_value_key': 'soil',
             'sensor_type_code': 'soil_moisture', 'farm': 1, 'location': 'Soil Point 10'},
            {'sensor_id': 'soil11', 'api_sensor_id': 'soil11', 'api_value_key': 'soil',
             'sensor_type_code': 'soil_moisture', 'farm': 1, 'location': 'Soil Point 11'},
            {'sensor_id': 'soil12', 'api_sensor_id': 'soil12', 'api_value_key': 'soil',
             'sensor_type_code': 'soil_moisture', 'farm': 1, 'location': 'Soil Point 12'},
            
            # PPFD sensors
            {'sensor_id': 'ppfd3', 'api_sensor_id': 'ppfd3', 'api_value_key': 'ppfd',
             'sensor_type_code': 'ppfd', 'farm': 1, 'location': 'R8', 'zone': 'R8'},
            {'sensor_id': 'ppfd4', 'api_sensor_id': 'ppfd4', 'api_value_key': 'ppfd',
             'sensor_type_code': 'ppfd', 'farm': 1, 'location': 'R24', 'zone': 'R24'},
            
            # Air sensors
            {'sensor_id': 'SHT45T3_TEMP', 'api_sensor_id': 'SHT45T3', 'api_value_key': 'Temp',
             'sensor_type_code': 'temperature', 'farm': 1, 'location': 'R8', 'zone': 'R8'},
            {'sensor_id': 'SHT45T3_HUM', 'api_sensor_id': 'SHT45T3', 'api_value_key': 'Hum',
             'sensor_type_code': 'humidity', 'farm': 1, 'location': 'R8', 'zone': 'R8'},
            {'sensor_id': 'SHT45T4_TEMP', 'api_sensor_id': 'SHT45T4', 'api_value_key': 'Temp',
             'sensor_type_code': 'temperature', 'farm': 1, 'location': 'R16', 'zone': 'R16'},
            {'sensor_id': 'SHT45T4_HUM', 'api_sensor_id': 'SHT45T4', 'api_value_key': 'Hum',
             'sensor_type_code': 'humidity', 'farm': 1, 'location': 'R16', 'zone': 'R16'},
            {'sensor_id': 'SHT45T5_TEMP', 'api_sensor_id': 'SHT45T5', 'api_value_key': 'Temp',
             'sensor_type_code': 'temperature', 'farm': 1, 'location': 'R24', 'zone': 'R24'},
            {'sensor_id': 'SHT45T5_HUM', 'api_sensor_id': 'SHT45T5', 'api_value_key': 'Hum',
             'sensor_type_code': 'humidity', 'farm': 1, 'location': 'R24', 'zone': 'R24'},
            
            # Light sensors
            {'sensor_id': 'UV1', 'api_sensor_id': 'UV1', 'api_value_key': 'uv_value',
             'sensor_type_code': 'uv', 'farm': 1, 'location': 'R8', 'zone': 'R8'},
            {'sensor_id': 'LUX1', 'api_sensor_id': 'LUX1', 'api_value_key': 'lux',
             'sensor_type_code': 'lux', 'farm': 1, 'location': 'R8', 'zone': 'R8'},
        ]
        
        # Farm 2 sensors (similar structure)
        farm2_sensors = [
            # PM sensors
            {'sensor_id': 'PM25_R2', 'api_sensor_id': 'PM25_R2', 'api_value_key': 'atmos',
             'sensor_type_code': 'pm25', 'farm': 2, 'location': 'Inside R2'},
            {'sensor_id': 'PM25_OUTSIDE_F2', 'api_sensor_id': 'PM25_OUTSIDE', 'api_value_key': 'atmos',
             'sensor_type_code': 'pm25', 'farm': 2, 'location': 'Outside'},
            
            # Water sensors
            {'sensor_id': 'EC2_CONDUCT', 'api_sensor_id': 'EC2', 'api_value_key': 'conduct',
             'sensor_type_code': 'ec', 'farm': 2, 'location': 'Water Monitoring'},
            {'sensor_id': 'EC2_TEMP', 'api_sensor_id': 'EC2', 'api_value_key': 'temp',
             'sensor_type_code': 'temperature', 'farm': 2, 'location': 'Water Monitoring'},
            
            # CO2 sensors
            {'sensor_id': 'CO2_R2', 'api_sensor_id': 'CO2_R2', 'api_value_key': 'val',
             'sensor_type_code': 'co2', 'farm': 2, 'location': 'Inside R2'},
            
            # Add more Farm 2 sensors following the same pattern...
        ]
        
        sensors.extend(farm1_sensors)
        sensors.extend(farm2_sensors)
        
        return sensors
    
    def sync_latest_data(self):
        """Sync latest sensor data from API"""
        self.stdout.write('Syncing latest sensor data from API...')
        
        if self.dry_run:
            self.stdout.write('  (DRY RUN) Would sync latest data for all active sensors')
            return
        
        try:
            # Initialize API service
            api_config = {
                'base_url': settings.SMART_FARM_API_URL,
                'api_key': settings.SMART_FARM_API_KEY,
                'timeout': getattr(settings, 'API_TIMEOUT', 30)
            }
            api_service = APIDataService(api_config)
            
            # Sync data
            stats = api_service.sync_latest_data(self.farm_id)
            
            self.stdout.write(f"  Sync completed: {stats}")
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error syncing latest data: {e}')
            )
    
    def backfill_historical_data(self, days):
        """Backfill historical data for specified number of days"""
        self.stdout.write(f'Backfilling {days} days of historical data...')
        
        if self.dry_run:
            self.stdout.write(f'  (DRY RUN) Would backfill {days} days of data')
            return
        
        end_time = timezone.now()
        start_time = end_time - timedelta(days=days)
        
        # Get active sensors
        sensors = Sensor.objects.filter(is_active=True)
        if self.farm_id:
            sensors = sensors.filter(farm=self.farm_id)
        
        total_sensors = sensors.count()
        processed_sensors = 0
        
        try:
            # Initialize API service
            api_config = {
                'base_url': settings.SMART_FARM_API_URL,
                'api_key': settings.SMART_FARM_API_KEY,
                'timeout': getattr(settings, 'API_TIMEOUT', 60)
            }
            api_service = APIDataService(api_config)
            
            for sensor in sensors:
                self.stdout.write(f'  Processing {sensor.sensor_id}...')
                
                try:
                    # Fetch historical data
                    data_points = api_service.fetch_historical_data(
                        sensor, start_time, end_time
                    )
                    
                    if data_points:
                        # Create realtime data records
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
                        RealtimeData.objects.bulk_create(
                            realtime_records,
                            batch_size=1000,
                            ignore_conflicts=True
                        )
                        
                        self.stdout.write(f'    Inserted {len(realtime_records)} records')
                    else:
                        self.stdout.write('    No data available')
                
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'    Error processing {sensor.sensor_id}: {e}')
                    )
                
                processed_sensors += 1
                if processed_sensors % 10 == 0:
                    self.stdout.write(f'  Progress: {processed_sensors}/{total_sensors} sensors')
            
            self.stdout.write(f'Backfill completed: {processed_sensors} sensors processed')
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error in backfill: {e}')
            )