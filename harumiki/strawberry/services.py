"""
Smart Farm Data Services
High-performance service layer for time-series data operations
Implements smart query routing and caching strategies
"""

from django.core.cache import cache
from django.db.models import Q, Avg, Min, Max, Count, StdDev
from django.utils import timezone
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Union, Any
import logging
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from decimal import Decimal

from .models import (
    Sensor, SensorType, RealtimeData, RecentData, 
    HistoricalData, ArchiveData, LatestSensorValue,
    DataQuality, AggregationJob
)

logger = logging.getLogger(__name__)

class SensorDataService:
    """
    Main service class for sensor data operations
    Provides intelligent query routing and caching
    """
    
    @staticmethod
    def get_latest_values(farm_id: Optional[int] = None, sensor_ids: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Get latest sensor values with optimized caching
        
        Args:
            farm_id: Filter by farm (1 or 2)
            sensor_ids: Filter by specific sensor IDs
            
        Returns:
            Dict with sensor data
        """
        cache_key = f"latest_values_{farm_id}_{hash(str(sensor_ids)) if sensor_ids else 'all'}"
        
        # Try cache first
        cached_data = cache.get(cache_key)
        if cached_data:
            logger.info(f"Cache hit for latest values: {cache_key}")
            return cached_data
        
        # Build query
        queryset = LatestSensorValue.objects.select_related(
            'sensor', 'sensor__sensor_type'
        ).filter(sensor__is_active=True)
        
        if farm_id:
            queryset = queryset.filter(sensor__farm=farm_id)
        
        if sensor_ids:
            queryset = queryset.filter(sensor__sensor_id__in=sensor_ids)
        
        # Execute query and format results
        result = {}
        for latest_value in queryset:
            sensor = latest_value.sensor
            result[sensor.sensor_id] = {
                'value': latest_value.processed_value,
                'raw_value': latest_value.value,
                'timestamp': latest_value.timestamp.isoformat(),
                'quality': latest_value.quality_flag,
                'unit': sensor.sensor_type.unit,
                'location': sensor.location,
                'farm': sensor.farm,
            }
        
        # Cache for 60 seconds
        cache.set(cache_key, result, 60)
        logger.info(f"Cached latest values: {len(result)} sensors")
        
        return result
    
    @staticmethod
    def get_historical_data(
        sensor_id: str,
        start_time: datetime,
        end_time: datetime,
        max_points: int = 1000,
        aggregation_level: str = 'auto'
    ) -> Dict[str, Any]:
        """
        Smart historical data retrieval with automatic table selection
        
        Args:
            sensor_id: Sensor identifier
            start_time: Start datetime
            end_time: End datetime
            max_points: Maximum points to return
            aggregation_level: 'auto', 'realtime', '5min', 'hourly', 'daily'
            
        Returns:
            Dict with timestamps, values, and metadata
        """
        duration = end_time - start_time
        
        # Determine optimal data source
        if aggregation_level == 'auto':
            if duration <= timedelta(hours=2):
                model_class = RealtimeData
                aggregation_level = 'realtime'
            elif duration <= timedelta(days=7):
                model_class = RecentData
                aggregation_level = '5min'
            elif duration <= timedelta(days=90):
                model_class = HistoricalData
                aggregation_level = 'hourly'
            else:
                model_class = ArchiveData
                aggregation_level = 'daily'
        else:
            model_mapping = {
                'realtime': RealtimeData,
                '5min': RecentData,
                'hourly': HistoricalData,
                'daily': ArchiveData,
            }
            model_class = model_mapping.get(aggregation_level, RecentData)
        
        # Create cache key
        cache_key = f"hist_{sensor_id}_{aggregation_level}_{start_time.date()}_{end_time.date()}_{max_points}"
        
        # Try cache first
        cached_data = cache.get(cache_key)
        if cached_data:
            logger.info(f"Cache hit for historical data: {sensor_id}")
            return cached_data
        
        # Get sensor object
        try:
            sensor = Sensor.objects.get(sensor_id=sensor_id, is_active=True)
        except Sensor.DoesNotExist:
            logger.warning(f"Sensor not found: {sensor_id}")
            return {'timestamps': [], 'values': [], 'error': 'Sensor not found'}
        
        # Query data
        queryset = model_class.objects.filter(
            sensor=sensor,
            timestamp__gte=start_time,
            timestamp__lte=end_time
        ).order_by('timestamp')
        
        # Apply sampling if needed
        total_points = queryset.count()
        if total_points > max_points:
            # Calculate sampling interval
            interval = max(1, total_points // max_points)
            queryset = queryset[::interval]
            logger.info(f"Applied sampling: {total_points} -> {len(queryset)} points")
        
        # Extract data based on model type
        timestamps = []
        values = []
        
        if model_class == RealtimeData:
            for record in queryset:
                timestamps.append(record.timestamp.isoformat())
                values.append(record.processed_value)
        else:
            # Aggregated data models
            for record in queryset:
                timestamps.append(record.timestamp.isoformat())
                values.append(record.avg_value)
        
        result = {
            'timestamps': timestamps,
            'values': values,
            'aggregation_level': aggregation_level,
            'total_points': len(values),
            'sensor_info': {
                'id': sensor.sensor_id,
                'type': sensor.sensor_type.name,
                'unit': sensor.sensor_type.unit,
                'location': sensor.location,
                'farm': sensor.farm,
            }
        }
        
        # Cache based on data age
        if aggregation_level in ['realtime', '5min']:
            cache_timeout = 300  # 5 minutes for recent data
        else:
            cache_timeout = 1800  # 30 minutes for historical data
        
        cache.set(cache_key, result, cache_timeout)
        logger.info(f"Retrieved historical data: {sensor_id}, {len(values)} points")
        
        return result
    
    @staticmethod
    def get_multiple_sensors_data(
        sensor_ids: List[str],
        start_time: datetime,
        end_time: datetime,
        max_points: int = 500
    ) -> Dict[str, Dict[str, Any]]:
        """
        Get historical data for multiple sensors concurrently
        
        Args:
            sensor_ids: List of sensor IDs
            start_time: Start datetime
            end_time: End datetime
            max_points: Maximum points per sensor
            
        Returns:
            Dict with sensor_id as key and data as value
        """
        results = {}
        
        # Use ThreadPoolExecutor for concurrent queries
        with ThreadPoolExecutor(max_workers=5) as executor:
            future_to_sensor = {
                executor.submit(
                    SensorDataService.get_historical_data,
                    sensor_id, start_time, end_time, max_points
                ): sensor_id
                for sensor_id in sensor_ids
            }
            
            # Collect results with timeout
            for future in as_completed(future_to_sensor, timeout=30):
                sensor_id = future_to_sensor[future]
                try:
                    results[sensor_id] = future.result()
                except Exception as e:
                    logger.error(f"Error fetching data for {sensor_id}: {e}")
                    results[sensor_id] = {
                        'timestamps': [],
                        'values': [],
                        'error': str(e)
                    }
        
        return results

class APIDataService:
    """
    Service for API data integration and synchronization
    """
    
    def __init__(self, api_config: Dict[str, Any]):
        """
        Initialize with API configuration
        
        Args:
            api_config: Dict with 'base_url', 'api_key', 'timeout'
        """
        self.api_config = api_config
        self.session = requests.Session()
        self.session.headers.update({"x-api-key": api_config['api_key']})
        
        # Configure connection pooling
        adapter = requests.adapters.HTTPAdapter(
            pool_connections=10,
            pool_maxsize=10,
            max_retries=3
        )
        self.session.mount('http://', adapter)
        self.session.mount('https://', adapter)
    
    def fetch_latest_data(self, sensor: Sensor) -> Optional[Dict[str, Any]]:
        """
        Fetch latest data from API for a specific sensor
        
        Args:
            sensor: Sensor model instance
            
        Returns:
            Dict with sensor data or None if error
        """
        url = f"{self.api_config['base_url']}/get-latest-data"
        params = {"sensor_id": sensor.api_sensor_id}
        
        try:
            response = self.session.get(
                url,
                params=params,
                timeout=self.api_config['timeout']
            )
            response.raise_for_status()
            
            data = response.json()
            if data.get("status") == "ok" and data.get("result"):
                sensor_data = data["result"][0]
                
                # Extract main value
                raw_value = sensor_data.get(sensor.api_value_key)
                processed_value = sensor.get_calibrated_value(raw_value)
                
                return {
                    'raw_data': sensor_data,
                    'processed_value': processed_value,
                    'timestamp': timezone.now(),
                    'quality_flag': 'good' if processed_value is not None else 'missing'
                }
        
        except requests.RequestException as e:
            logger.error(f"API request failed for {sensor.sensor_id}: {e}")
        except (KeyError, ValueError, TypeError) as e:
            logger.error(f"Data parsing error for {sensor.sensor_id}: {e}")
        
        return None
    
    def fetch_historical_data(
        self,
        sensor: Sensor,
        start_time: datetime,
        end_time: datetime
    ) -> List[Dict[str, Any]]:
        """
        Fetch historical data from API
        
        Args:
            sensor: Sensor model instance
            start_time: Start datetime
            end_time: End datetime
            
        Returns:
            List of data points
        """
        url = f"{self.api_config['base_url']}/get-data"
        params = {
            "sensor_id": sensor.api_sensor_id,
            "start": start_time.isoformat(),
            "end": end_time.isoformat()
        }
        
        try:
            response = self.session.get(
                url,
                params=params,
                timeout=60  # Longer timeout for historical data
            )
            response.raise_for_status()
            
            data = response.json()
            if "result" not in data:
                logger.warning(f"No result in API response for {sensor.sensor_id}")
                return []
            
            data_points = []
            for record in data["result"]:
                datetime_str = record.get('datetime')
                record_data = record.get('data')
                
                if datetime_str:
                    timestamp = datetime.fromisoformat(datetime_str.replace('Z', '+00:00'))
                    
                    if record_data is None:
                        processed_value = None
                        quality_flag = 'missing'
                    else:
                        raw_value = record_data.get(sensor.api_value_key)
                        processed_value = sensor.get_calibrated_value(raw_value)
                        quality_flag = 'good' if processed_value is not None else 'bad'
                    
                    data_points.append({
                        'timestamp': timestamp,
                        'raw_data': record_data or {},
                        'processed_value': processed_value,
                        'quality_flag': quality_flag
                    })
            
            logger.info(f"Fetched {len(data_points)} data points for {sensor.sensor_id}")
            return data_points
        
        except requests.RequestException as e:
            logger.error(f"Historical data request failed for {sensor.sensor_id}: {e}")
        except (KeyError, ValueError, TypeError) as e:
            logger.error(f"Historical data parsing error for {sensor.sensor_id}: {e}")
        
        return []
    
    def sync_latest_data(self, farm_id: Optional[int] = None) -> Dict[str, int]:
        """
        Sync latest data for all active sensors
        
        Args:
            farm_id: Optional farm filter
            
        Returns:
            Dict with sync statistics
        """
        # Get active sensors
        sensors = Sensor.objects.filter(is_active=True)
        if farm_id:
            sensors = sensors.filter(farm=farm_id)
        
        stats = {
            'total_sensors': sensors.count(),
            'success_count': 0,
            'error_count': 0,
            'updated_count': 0
        }
        
        # Sync data for each sensor
        for sensor in sensors:
            try:
                api_data = self.fetch_latest_data(sensor)
                if api_data:
                    # Update or create latest value record
                    latest_value, created = LatestSensorValue.objects.update_or_create(
                        sensor=sensor,
                        defaults={
                            'timestamp': api_data['timestamp'],
                            'value': api_data['raw_data'],
                            'processed_value': api_data['processed_value'],
                            'quality_flag': api_data['quality_flag']
                        }
                    )
                    
                    # Update sensor last_seen
                    sensor.last_seen = api_data['timestamp']
                    sensor.save(update_fields=['last_seen'])
                    
                    stats['success_count'] += 1
                    if not created:
                        stats['updated_count'] += 1
                else:
                    stats['error_count'] += 1
                    
            except Exception as e:
                logger.error(f"Error syncing {sensor.sensor_id}: {e}")
                stats['error_count'] += 1
        
        logger.info(f"Sync completed: {stats}")
        return stats

class AggregationService:
    """
    Service for data aggregation operations
    """
    
    @staticmethod
    def aggregate_to_recent_data(start_time: datetime, end_time: datetime) -> Dict[str, int]:
        """
        Aggregate realtime data to 5-minute intervals
        
        Args:
            start_time: Start time for aggregation
            end_time: End time for aggregation
            
        Returns:
            Dict with aggregation statistics
        """
        from django.db.models import Avg, Min, Max, Count, StdDev
        from django.db.models.functions import TruncMinute
        
        stats = {'records_created': 0, 'sensors_processed': 0, 'errors': 0}
        
        # Get all active sensors
        sensors = Sensor.objects.filter(is_active=True)
        
        for sensor in sensors:
            try:
                # Query realtime data for this sensor
                realtime_data = RealtimeData.objects.filter(
                    sensor=sensor,
                    timestamp__gte=start_time,
                    timestamp__lt=end_time
                ).values(
                    'timestamp__hour',
                    'timestamp__minute'
                ).annotate(
                    interval_start=TruncMinute('timestamp', kind='hour'),
                    avg_value=Avg('processed_value'),
                    min_value=Min('processed_value'),
                    max_value=Max('processed_value'),
                    sample_count=Count('id'),
                    std_deviation=StdDev('processed_value'),
                    good_samples=Count('id', filter=Q(quality_flag='good')),
                    suspect_samples=Count('id', filter=Q(quality_flag='suspect')),
                    bad_samples=Count('id', filter=Q(quality_flag='bad')),
                    missing_samples=Count('id', filter=Q(quality_flag='missing'))
                ).filter(sample_count__gt=0)
                
                # Create recent data records
                recent_records = []
                for data in realtime_data:
                    # Round to 5-minute intervals
                    minute = (data['timestamp__minute'] // 5) * 5
                    interval_timestamp = start_time.replace(
                        hour=data['timestamp__hour'],
                        minute=minute,
                        second=0,
                        microsecond=0
                    )
                    
                    recent_record = RecentData(
                        sensor=sensor,
                        timestamp=interval_timestamp,
                        avg_value=data['avg_value'],
                        min_value=data['min_value'],
                        max_value=data['max_value'],
                        sample_count=data['sample_count'],
                        std_deviation=data['std_deviation'],
                        good_samples=data['good_samples'],
                        suspect_samples=data['suspect_samples'],
                        bad_samples=data['bad_samples'],
                        missing_samples=data['missing_samples']
                    )
                    recent_records.append(recent_record)
                
                # Bulk create records
                if recent_records:
                    RecentData.objects.bulk_create(
                        recent_records,
                        ignore_conflicts=True,
                        batch_size=1000
                    )
                    stats['records_created'] += len(recent_records)
                
                stats['sensors_processed'] += 1
                
            except Exception as e:
                logger.error(f"Error aggregating data for {sensor.sensor_id}: {e}")
                stats['errors'] += 1
        
        logger.info(f"5-minute aggregation completed: {stats}")
        return stats
    
    @staticmethod
    def calculate_dli(sensor_id: str, date: datetime.date) -> Optional[float]:
        """
        Calculate Daily Light Integral for PPFD sensors
        
        Args:
            sensor_id: PPFD sensor ID
            date: Date to calculate DLI for
            
        Returns:
            DLI value in mol/m²/day or None
        """
        try:
            sensor = Sensor.objects.get(
                sensor_id=sensor_id,
                sensor_type__code='ppfd',
                is_active=True
            )
        except Sensor.DoesNotExist:
            logger.warning(f"PPFD sensor not found: {sensor_id}")
            return None
        
        # Get start and end times (6:00 AM to 6:00 PM)
        start_time = datetime.combine(date, datetime.min.time().replace(hour=6))
        end_time = datetime.combine(date, datetime.min.time().replace(hour=18))
        
        # Query aggregated data (prefer recent_data for better resolution)
        ppfd_data = RecentData.objects.filter(
            sensor=sensor,
            timestamp__gte=start_time,
            timestamp__lt=end_time
        ).aggregate(
            avg_ppfd=Avg('avg_value'),
            sample_count=Count('id')
        )
        
        if ppfd_data['avg_ppfd'] and ppfd_data['sample_count'] > 0:
            # Calculate DLI: average PPFD × photoperiod (seconds) / 1,000,000
            # 12 hours = 12 × 3600 = 43,200 seconds
            dli = (ppfd_data['avg_ppfd'] * 43200) / 1000000
            return round(dli, 2)
        
        return None

class DataQualityService:
    """
    Service for data quality monitoring and validation
    """
    
    @staticmethod
    def calculate_daily_quality(sensor: Sensor, date: datetime.date) -> Dict[str, Any]:
        """
        Calculate data quality metrics for a sensor on a specific date
        
        Args:
            sensor: Sensor model instance
            date: Date to calculate quality for
            
        Returns:
            Dict with quality metrics
        """
        start_time = datetime.combine(date, datetime.min.time())
        end_time = datetime.combine(date, datetime.max.time())
        
        # Expected data points (assuming 1-minute intervals)
        expected_count = 24 * 60  # 1440 points per day
        
        # Query actual data
        quality_stats = RealtimeData.objects.filter(
            sensor=sensor,
            timestamp__gte=start_time,
            timestamp__lte=end_time
        ).aggregate(
            actual_count=Count('id'),
            good_count=Count('id', filter=Q(quality_flag='good')),
            suspect_count=Count('id', filter=Q(quality_flag='suspect')),
            bad_count=Count('id', filter=Q(quality_flag='bad')),
            missing_count=Count('id', filter=Q(quality_flag='missing'))
        )
        
        actual_count = quality_stats['actual_count'] or 0
        quality_score = (actual_count / expected_count * 100) if expected_count > 0 else 0
        
        # Find missing periods (simplified)
        missing_periods = []
        if actual_count < expected_count:
            # This is a simplified implementation
            # In production, you'd want more sophisticated gap detection
            missing_periods.append({
                'start': start_time.isoformat(),
                'end': end_time.isoformat(),
                'estimated_missing': expected_count - actual_count
            })
        
        return {
            'date': date,
            'expected_count': expected_count,
            'actual_count': actual_count,
            'quality_score': round(quality_score, 2),
            'good_count': quality_stats['good_count'] or 0,
            'suspect_count': quality_stats['suspect_count'] or 0,
            'bad_count': quality_stats['bad_count'] or 0,
            'missing_count': quality_stats['missing_count'] or 0,
            'missing_periods': missing_periods
        }
    
    @staticmethod
    def update_daily_quality_records(date: datetime.date) -> Dict[str, int]:
        """
        Update daily quality records for all sensors
        
        Args:
            date: Date to update quality for
            
        Returns:
            Dict with update statistics
        """
        stats = {'updated': 0, 'created': 0, 'errors': 0}
        
        sensors = Sensor.objects.filter(is_active=True)
        
        for sensor in sensors:
            try:
                quality_data = DataQualityService.calculate_daily_quality(sensor, date)
                
                quality_record, created = DataQuality.objects.update_or_create(
                    sensor=sensor,
                    date=date,
                    defaults={
                        'expected_count': quality_data['expected_count'],
                        'actual_count': quality_data['actual_count'],
                        'quality_score': quality_data['quality_score'],
                        'good_count': quality_data['good_count'],
                        'suspect_count': quality_data['suspect_count'],
                        'bad_count': quality_data['bad_count'],
                        'missing_count': quality_data['missing_count'],
                        'missing_periods': quality_data['missing_periods']
                    }
                )
                
                if created:
                    stats['created'] += 1
                else:
                    stats['updated'] += 1
                    
            except Exception as e:
                logger.error(f"Error updating quality for {sensor.sensor_id}: {e}")
                stats['errors'] += 1
        
        logger.info(f"Daily quality update completed: {stats}")
        return stats