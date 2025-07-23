"""
Harumiki Smart Farm Django Views
Optimized and refactored for better maintainability and performance
"""

import csv
import io
import json
import logging
import os
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from decimal import Decimal
from io import StringIO

import requests
from django.conf import settings
from django.contrib import messages
from django.core.cache import cache
from django.core.paginator import Paginator
from django.db.models import Q
from django.http import HttpResponse, JsonResponse
import gzip
from django.shortcuts import redirect, render
from django.utils.dateparse import parse_date
from django.utils.html import mark_safe
from django.views.decorators.cache import cache_page
from django.views.decorators.gzip import gzip_page
import calendar
import time

from .models import *

# Configure secure logging
logger = logging.getLogger(__name__)

# ========== API Configuration ==========
# Use settings from Django configuration (loaded from .env)
API_CONFIG = {
    'base_url': settings.SMART_FARM_API_URL,
    'api_key': settings.SMART_FARM_API_KEY,
    'timeout': getattr(settings, 'API_TIMEOUT', 30)  # Default to 30 if not set
}

# Create session for connection pooling
api_session = requests.Session()
api_session.headers.update({"x-api-key": API_CONFIG['api_key']})
# Configure connection pool
adapter = requests.adapters.HTTPAdapter(
    pool_connections=10,
    pool_maxsize=10,
    max_retries=3
)
api_session.mount('http://', adapter)
api_session.mount('https://', adapter)

# ========== Sensor Configuration ==========
SENSOR_MAPPINGS = {
    'farm1': {
        'pm': {'PM25_R1': 'atmos', 'PM25_OUTSIDE': 'atmos'},
        'water': {'EC': ['conduct', 'temp']},
        'co2': {'CO2_R1': 'val'},
        'npk': {
            'NPK4': ['nitrogen', 'phosphorus', 'potassium', 'temperature'],  # R8
            'NPK5': ['nitrogen', 'phosphorus', 'potassium', 'temperature'],  # R16
            'NPK6': ['nitrogen', 'phosphorus', 'potassium', 'temperature'],  # R24
        },
        'soil': ['soil7', 'soil8', 'soil9', 'soil10', 'soil11', 'soil12'],
        'ppfd': ['ppfd3', 'ppfd4'],  # R8, R24
        'air_sensors': {
            'SHT45T3': ['Temp', 'Hum'],  # R8
            'SHT45T4': ['Temp', 'Hum'],  # R16
            'SHT45T5': ['Temp', 'Hum'],  # R24
        },
        'light': {'LUX1': 'lux', 'UV1': 'uv_value'},
    },
    'farm2': {
        'pm': {'PM25_R2': 'atmos', 'PM25_OUTSIDE': 'atmos'},
        'water': {'EC': ['conduct', 'temp']},
        'co2': {'CO2_R1': 'val', 'CO2_R2': 'val'},
        'npk': {
            'NPK1': ['nitrogen', 'phosphorus', 'potassium', 'temperature'],  # R8
            'NPK2': ['nitrogen', 'phosphorus', 'potassium', 'temperature'],  # R16
            'NPK3': ['nitrogen', 'phosphorus', 'potassium', 'temperature'],  # R24
        },
        'soil': ['soil1', 'soil2', 'soil3', 'soil4', 'soil5', 'soil6', 'soil13'],
        'ppfd': ['ppfd1', 'ppfd2'],  # R16, R24
        'air_sensors': {
            'SHT45T1': ['Temp', 'Hum'],  # R8
            'SHT45T6': ['Temp', 'Hum'],  # R16
            'SHT45T2': ['Temp', 'Hum'],  # R24
        },
        'light': {'LUX2': 'lux', 'UV2': 'uv_value'},
    }
}

# Import aggregation utilities
try:
    from .utils.data_aggregation import aggregate_sensor_data, calculate_date_range_days
except ImportError:
    # Fallback if utils not created yet
    logger.warning("data_aggregation module not found, using basic aggregation")
    
    def aggregate_sensor_data(data, interval_minutes=None, date_range_days=None):
        """Basic fallback aggregation"""
        return data
    
    def calculate_date_range_days(start_datetime, end_datetime):
        """Basic date range calculation"""
        return 30

# Add this new function after the imports
def get_history_val_optimized(sensor_id, name_value, start_datetime, end_datetime, aggregate=True, max_points=500):
    """
    Optimized version of get_history_val with automatic data aggregation and smart sampling
    
    Args:
        sensor_id (str): Sensor identifier
        name_value (str): Value key to extract
        start_datetime (str): Start time in ISO format
        end_datetime (str): End time in ISO format
        aggregate (bool): Whether to aggregate data
        max_points (int): Maximum data points to return
    
    Returns:
        dict: Historical data (possibly aggregated and sampled)
    """
    # Create cache key for this specific request
    cache_key = f"optimized_data_{sensor_id}_{name_value}_{start_datetime[:10]}_{end_datetime[:10]}"
    
    # Try cache first
    cached_result = cache.get(cache_key)
    if cached_result:
        logger.info(f"Cache hit for optimized data: {sensor_id}")
        return cached_result
    
    # Get raw data using existing function
    raw_data = get_history_val(sensor_id, name_value, start_datetime, end_datetime)
    
    # Skip processing if no data
    if not raw_data or 'values' not in raw_data or not raw_data['values']:
        return raw_data
    
    data_length = len(raw_data['values'])
    
    # Apply smart sampling for large datasets
    if data_length > max_points:
        logger.info(f"Applying smart sampling: {data_length} -> {max_points} points")
        raw_data = apply_smart_sampling(raw_data, max_points)
        data_length = len(raw_data['values'])
    
    # Apply aggregation for medium-large datasets (lowered threshold for faster loading)
    if aggregate and data_length > 100:
        date_range_days = calculate_date_range_days(start_datetime, end_datetime)
        
        try:
            aggregated_data = aggregate_sensor_data(
                raw_data,
                date_range_days=date_range_days
            )
            # Cache the result for 10 minutes for better performance
            cache.set(cache_key, aggregated_data, 600)
            return aggregated_data
        except Exception as e:
            logger.error(f"Aggregation failed for {sensor_id}: {e}")
    
    # Cache even non-aggregated data
    cache.set(cache_key, raw_data, 300)
    return raw_data

def apply_smart_sampling(data, target_points):
    """
    Apply smart sampling to reduce data points while preserving important patterns
    """
    if not data or 'values' not in data or len(data['values']) <= target_points:
        return data
    
    values = data['values']
    datetimes = data.get('datetimes', [])
    
    # Calculate sampling interval
    total_points = len(values)
    interval = max(1, total_points // target_points)
    
    # Sample data with interval, always include first and last points
    sampled_indices = set([0, total_points - 1])  # Always include first and last
    
    # Add evenly spaced points
    for i in range(0, total_points, interval):
        sampled_indices.add(i)
    
    # Sort indices
    sampled_indices = sorted(sampled_indices)
    
    # Extract sampled data
    sampled_values = [values[i] for i in sampled_indices]
    sampled_datetimes = [datetimes[i] for i in sampled_indices] if datetimes else []
    
    return {
        'values': sampled_values,
        'datetimes': sampled_datetimes
    }

# ========== Main View Functions ==========
@cache_page(300)  # Cache for 5 minutes
@gzip_page
def Farm1(request):
    """
    Dashboard view for Farm 1
    Displays real-time sensor data and calculated DLI values
    """
    try:
        context = get_farm_context('farm1')
        return render(request, 'strawberry/farm-1.html', context)
    except Exception as e:
        messages.error(request, f'เกิดข้อผิดพลาดในการโหลดข้อมูล Farm 1: {str(e)}')
        return render(request, 'strawberry/farm-1.html', {})

@cache_page(300)  # Cache for 5 minutes
@gzip_page
def Farm2(request):
    """
    Dashboard view for Farm 2
    Displays real-time sensor data and calculated DLI values
    """
    try:
        context = get_farm_context('farm2')
        return render(request, 'strawberry/farm-2.html', context)
    except Exception as e:
        messages.error(request, f'เกิดข้อผิดพลาดในการโหลดข้อมูล Farm 2: {str(e)}')
        return render(request, 'strawberry/farm-2.html', {})

# ========== Context Building Functions ==========
def get_farm_context(farm_key):
    """
    Build context data for specified farm using concurrent API calls
    
    Args:
        farm_key (str): 'farm1' or 'farm2'
    
    Returns:
        dict: Context data for template rendering
    """
    if farm_key not in SENSOR_MAPPINGS:
        raise ValueError(f"Invalid farm key: {farm_key}")
    
    sensors = SENSOR_MAPPINGS[farm_key]
    context = {}
    
    # Use ThreadPoolExecutor for concurrent API calls
    with ThreadPoolExecutor(max_workers=5) as executor:
        # Submit all data gathering tasks concurrently
        futures = {
            'pm': executor.submit(get_pm_data, sensors['pm']),
            'water': executor.submit(get_water_data, sensors['water']),
            'co2': executor.submit(get_co2_data, sensors['co2']),
            'npk': executor.submit(get_npk_data, sensors['npk'], farm_key),
            'soil': executor.submit(get_soil_data, sensors['soil']),
            'light': executor.submit(get_light_data, sensors['ppfd'], farm_key),
            'air': executor.submit(get_air_data, sensors['air_sensors'], farm_key),
            'additional_light': executor.submit(get_additional_light_data, sensors['light'], farm_key),
        }
        
        # Collect results as they complete
        for key, future in futures.items():
            try:
                result = future.result(timeout=10)  # 10 second timeout per task
                context.update(result)
            except Exception as e:
                logger.error("Error getting %s data: %s", key, str(e))
                # Continue with other data even if one fails
                continue
    
    return context

def get_pm_data(pm_sensors):
    """Get PM2.5 sensor data"""
    context = {}
    for sensor_id, value_key in pm_sensors.items():
        value = get_latest_sensor_value(sensor_id, value_key)
        if 'R1' in sensor_id:
            context['pm_R1'] = value
        elif 'R2' in sensor_id:
            context['pm_R2'] = value
        elif 'OUTSIDE' in sensor_id:
            context['pm_outside'] = value
    return context

def get_water_data(water_sensors):
    """Get water quality sensor data"""
    context = {}
    for sensor_id, value_keys in water_sensors.items():
        for value_key in value_keys:
            value = get_latest_sensor_value(sensor_id, value_key)
            if value_key == 'conduct':
                context['ECWM_Q'] = value if 'farm1' else value
                context['ECWM'] = value
            elif value_key == 'temp':
                context['TempWM_Q'] = value if 'farm1' else value
                context['TempWM'] = value
    return context

def get_co2_data(co2_sensors):
    """Get CO2 sensor data"""
    context = {}
    for sensor_id, value_key in co2_sensors.items():
        value = get_latest_sensor_value(sensor_id, value_key)
        context[sensor_id] = value
    return context

def get_npk_data(npk_sensors, farm_key):
    """Get NPK sensor data"""
    context = {}
    zone_mapping = {
        0: 'R8',   # NPK4/NPK1
        1: 'R16',  # NPK5/NPK2
        2: 'R24'   # NPK6/NPK3
    }
    
    suffix = '_Q' if farm_key == 'farm1' else '_P'
    
    for i, (sensor_id, nutrients) in enumerate(npk_sensors.items()):
        zone = zone_mapping[i]
        for nutrient in nutrients:
            value = get_latest_sensor_value(sensor_id, nutrient)
            
            # Handle temperature variable naming inconsistency
            if nutrient == 'temperature':
                context[f'temp_npk{zone}{suffix}'] = value
            else:
                context[f'{nutrient}{zone}{suffix}'] = value
    
    return context

def get_soil_data(soil_sensors):
    """Get soil moisture sensor data"""
    context = {}
    for sensor_id in soil_sensors:
        value = get_latest_sensor_value(sensor_id, 'soil')
        context[sensor_id] = value
    return context

def get_light_data(ppfd_sensors, farm_key):
    """Get PPFD data and calculate DLI"""
    context = {}
    
    # Get current PPFD values with correct template variable names
    if farm_key == 'farm1':
        # Farm 1: ppfd3 (R8), ppfd4 (R24)
        for i, sensor_id in enumerate(ppfd_sensors):
            value = get_latest_sensor_value(sensor_id, 'ppfd')
            context[sensor_id] = value  # ppfd3, ppfd4
    else:  # farm2
        # Farm 2: ppfd_R16_P, ppfd_R24_P
        zone_mapping = ['R16', 'R24']
        for i, sensor_id in enumerate(ppfd_sensors):
            value = get_latest_sensor_value(sensor_id, 'ppfd')
            if i < len(zone_mapping):
                context[f'ppfd_{zone_mapping[i]}_P'] = value
            # Also set for JavaScript (ppfd1, ppfd2 IDs)
            context[sensor_id] = value
    
    # Calculate DLI for yesterday
    dli_data = calculate_daily_light_integral(ppfd_sensors)
    
    if farm_key == 'farm1':
        context.update({
            'DLI_R8_Q': dli_data.get('dli_0', 0),
            'DLI_R24_Q': dli_data.get('dli_1', 0)
        })
    else:  # farm2
        context.update({
            'DLI_R16_P': dli_data.get('dli_0', 0),
            'DLI_R24_P': dli_data.get('dli_1', 0)
        })
    
    return context

def get_air_data(air_sensors, farm_key):
    """Get air temperature and humidity data"""
    context = {}
    zone_mapping = ['R8', 'R16', 'R24']
    suffix = '_Q' if farm_key == 'farm1' else '_P'
    
    for i, (sensor_id, measurements) in enumerate(air_sensors.items()):
        zone = zone_mapping[i] if i < len(zone_mapping) else f'R{i+1}'
        
        for measurement in measurements:
            value = get_latest_sensor_value(sensor_id, measurement)
            if value is not None:
                value = round(value, 2)
            
            if measurement == 'Temp':
                if farm_key == 'farm1':
                    context[f'airtemp{zone}{suffix}'] = value
                else:
                    context[f'airTemp{zone}{suffix}'] = value
            elif measurement == 'Hum':
                if farm_key == 'farm1':
                    context[f'airhum{zone}{suffix}'] = value
                else:
                    context[f'airHum{zone}{suffix}'] = value
    
    return context

def get_additional_light_data(light_sensors, farm_key):
    """Get LUX and UV sensor data"""
    context = {}
    suffix = '_Q' if farm_key == 'farm1' else '_P'
    
    for sensor_id, value_key in light_sensors.items():
        value = get_latest_sensor_value(sensor_id, value_key)
        
        if 'LUX' in sensor_id:
            if value is not None:
                value = round(value, 1)
            if farm_key == 'farm1':
                context['LUX_R8_Q'] = value
                context['luxR8'] = value  # For JavaScript
            else:  # farm2
                context['LUX_R24_P'] = value
                context['luxR24'] = value  # For JavaScript
                
        elif 'UV' in sensor_id:
            if farm_key == 'farm1':
                context['UV_R8_Q'] = value
                context['uvR8'] = value  # For JavaScript
            else:  # farm2
                context['UV_R24_P'] = value
                context['uvR24'] = value  # For JavaScript
    
    return context

# ========== API Communication Functions ==========
def get_latest_sensor_value(sensor_id, value_key):
    """
    Get latest value from specific sensor with Redis caching
    
    Args:
        sensor_id (str): Sensor identifier
        value_key (str): Value key to extract from response
    
    Returns:
        float/int/None: Sensor value or None if error
    """
    # Create cache key
    cache_key = f"sensor_latest_{sensor_id}_{value_key}"
    
    # Try to get from cache first
    cached_value = cache.get(cache_key)
    if cached_value is not None:
        return cached_value
    
    # If not in cache, fetch from API
    url = f"{API_CONFIG['base_url']}/get-latest-data"
    headers = {"x-api-key": API_CONFIG['api_key']}
    params = {"sensor_id": sensor_id}
    
    try:
        response = requests.get(
            url, 
            headers=headers, 
            params=params, 
            timeout=API_CONFIG['timeout']
        )
        response.raise_for_status()
        
        data = response.json()
        if data.get("status") == "ok" and data.get("result"):
            sensor_data = data["result"][0]
            value = sensor_data.get(value_key)
            
            # Cache the result for 60 seconds
            if value is not None:
                cache.set(cache_key, value, 60)
            
            return value
        else:
            logger.warning("No data found for sensor %s", sensor_id[:8] + '***')
            return None
            
    except requests.RequestException as e:
        logger.error("API request failed: %s", str(e))
        return None
    except (KeyError, IndexError, ValueError) as e:
        logger.error("Data parsing error: %s", str(e))
        return None

def get_historical_sensor_data(sensor_id, value_key, start_datetime, end_datetime):
    """
    Get historical sensor data for specified time range
    
    Args:
        sensor_id (str): Sensor identifier
        value_key (str): Value key to extract
        start_datetime (str): Start time in ISO format
        end_datetime (str): End time in ISO format
    
    Returns:
        dict: Historical data with timestamps and values
    """
    url = f"{API_CONFIG['base_url']}/get-data"
    headers = {"x-api-key": API_CONFIG['api_key']}
    params = {
        "sensor_id": sensor_id,
        "start": start_datetime,
        "end": end_datetime
    }
    
    try:
        response = requests.get(
            url, 
            headers=headers, 
            params=params, 
            timeout=API_CONFIG['timeout']
        )
        response.raise_for_status()
        
        data = response.json()
        if "result" not in data:
            return {"error": "Missing 'result' in API response"}
        
        datetimes = []
        values = []
        
        for record in data["result"]:
            datetime_str = record.get('datetime')
            record_data = record.get('data')
            
            if datetime_str:
                datetimes.append(datetime_str)
                
                if record_data is None:
                    values.append(0)  # Use 0 instead of -1 for PPFD calculations
                else:
                    values.append(record_data.get(value_key, 0))
        
        return {"datetimes": datetimes, "values": values}
        
    except requests.RequestException as e:
        logger.error("Historical data request failed: %s", str(e))
        return {"error": f"Request failed: {str(e)}"}
    except (KeyError, ValueError) as e:
        logger.error("Historical data parsing error: %s", str(e))
        return {"error": f"Data parsing failed: {str(e)}"}

def get_history_val(sensor_id, name_value, start_datetime, end_datetime, max_retries=2):
    """
    Get historical sensor values with retry logic
    """
    url = f"{API_CONFIG['base_url']}/get-data"
    headers = {"x-api-key": API_CONFIG['api_key']}
    params = {
        "sensor_id": sensor_id,
        "start": start_datetime,
        "end": end_datetime
    }

    for attempt in range(max_retries):
        try:
            # เพิ่ม timeout สำหรับข้อมูลประวัติศาสตร์
            response = requests.get(
                url, 
                headers=headers, 
                params=params,
                timeout=60  # เพิ่มกลับเป็น 60 วินาทีสำหรับข้อมูลเยอะ
            )
            response.raise_for_status()
            
            data = response.json()
            logger.info(f"API response for {sensor_id}.{name_value}: status={response.status_code}, result_count={len(data.get('result', []))}")
            
            if "result" not in data:
                logger.warning(f"Missing 'result' in API response for {sensor_id}")
                return {"error": "Missing 'result' in API response", "datetimes": [], "values": []}

            # Prepare to store results
            datetimes = []
            values = []

            # Parse returned data
            for record in data["result"]:
                datetime_str = record.get('datetime')
                record_data = record.get('data')
                if datetime_str:
                    datetimes.append(datetime_str)
                    
                    # Handle missing data gracefully
                    if record_data is None:
                        values.append(-1)
                    else:
                        values.append(record_data.get(name_value, -1))

            return {"datetimes": datetimes, "values": values}

        except requests.Timeout:
            logger.warning(f"Timeout attempt {attempt + 1}/{max_retries} for sensor {sensor_id}")
            if attempt < max_retries - 1:
                time.sleep(1)  # รอ 1 วินาทีก่อน retry
                continue
            else:
                logger.error(f"Failed after {max_retries} attempts: {sensor_id}")
                return {"datetimes": [], "values": []}
                
        except requests.RequestException as e:
            logger.error(f"API request failed for {sensor_id}: {str(e)}")
            return {"datetimes": [], "values": []}
        except Exception as e:
            logger.error(f"Unexpected error for {sensor_id}: {str(e)}")
            return {"datetimes": [], "values": []}

# ========== Calculation Functions ==========
def calculate_daily_light_integral(ppfd_sensors):
    """
    Calculate Daily Light Integral (DLI) for yesterday
    
    Args:
        ppfd_sensors (list): List of PPFD sensor IDs
    
    Returns:
        dict: DLI values for each sensor
    """
    # Get yesterday's date range (6:00 AM to 5:59:59 PM)
    yesterday = datetime.now() - timedelta(days=1)
    start_datetime = f"{yesterday.strftime('%Y-%m-%d')}T06:00:00"
    end_datetime = f"{yesterday.strftime('%Y-%m-%d')}T17:59:59"
    
    dli_results = {}
    
    for i, sensor_id in enumerate(ppfd_sensors):
        try:
            # Get historical PPFD data
            historical_data = get_historical_sensor_data(
                sensor_id, 'ppfd', start_datetime, end_datetime
            )
            
            if "error" in historical_data:
                logger.error("Error getting historical data: %s", historical_data['error'])
                dli_results[f'dli_{i}'] = 0
                continue
            
            # Calculate average PPFD (excluding zeros)
            values = historical_data.get("values", [])
            if values:
                # Filter out zero values for more accurate average
                non_zero_values = [v for v in values if v > 0]
                if non_zero_values:
                    avg_ppfd = sum(non_zero_values) / len(non_zero_values)
                else:
                    avg_ppfd = 0
            else:
                avg_ppfd = 0
            
            # Calculate DLI: (avg PPFD * 12 hours * 3600 seconds) / 1,000,000
            # DLI is expressed in mol/m²/day
            dli = round(avg_ppfd * 12 * 60 * 60 / 1000000, 2)
            dli_results[f'dli_{i}'] = dli
            
        except Exception as e:
            logger.error("Error calculating DLI: %s", str(e))
            dli_results[f'dli_{i}'] = 0
    
    return dli_results

def calculate_average_and_count_zeros(raw_data):
    """
    Calculate average and count zero values (legacy function for compatibility)
    
    Args:
        raw_data (dict): Data with 'values' key
    
    Returns:
        tuple: (average_value, count_zeros)
    """
    values = raw_data.get("values", [])
    if values:
        average_value = sum(values) / len(values)
        count_zeros = values.count(0)
        return average_value, count_zeros
    else:
        return None, 0

# ========== Utility Functions ==========
def format_sensor_value(value, decimal_places=2):
    """Format sensor value with specified decimal places"""
    if value is None:
        return 0
    try:
        return round(float(value), decimal_places)
    except (ValueError, TypeError):
        return 0

def validate_sensor_data(data, expected_keys):
    """Validate that sensor data contains expected keys"""
    if not isinstance(data, dict):
        return False
    return all(key in data for key in expected_keys)

# ========== Error Handling Functions ==========
def handle_api_error(error, sensor_id=None):
    """Centralized error handling for API calls"""
    # Don't expose sensor_id or detailed error info
    logger.error("API Error: %s", str(error))
    return None

# ========== Graph Views ==========
def Graph1(request):
    """Display historical graph for Farm 1"""
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    if start_date is None:
        start_date = datetime.now().strftime("%Y-%m-%d")
    if end_date is None:
        end_date = datetime.now().strftime("%Y-%m-%d") 
    start = f"{start_date}T00:00:00"
    end = f"{end_date}T23:59:59"
    context_history = update_graph1(start, end)
    
    return render(request, 'strawberry/graph-1.html', context_history)

def Graph2(request):
    """Display historical graph for Farm 2"""
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    if start_date is None:
        start_date = datetime.now().strftime("%Y-%m-%d")
    if end_date is None:
        end_date = datetime.now().strftime("%Y-%m-%d") 
    start = f"{start_date}T00:00:00"
    end = f"{end_date}T23:59:59"
    context_history = update_graph2(start, end)
    
    return render(request, 'strawberry/graph-2.html', context_history)

def update_graph1(start_datetime, end_datetime):
    """Fetch historical data for Farm 1 sensors"""
    pm_R1 = get_history_val("PM25_R1", "atmos", start_datetime, end_datetime)
    pm_outside = get_history_val("PM25_OUTSIDE", "atmos", start_datetime, end_datetime)
    ECWM = get_history_val("EC", "conduct", start_datetime, end_datetime)
    TempWM = get_history_val("EC", "temp", start_datetime, end_datetime)
    CO2_R1 = get_history_val("CO2_R1", "val", start_datetime, end_datetime)
    CO2_R2 = get_history_val("CO2_R2", "val", start_datetime, end_datetime)
    nitrogen4 = get_history_val("NPK4", "nitrogen", start_datetime, end_datetime)
    nitrogen5 = get_history_val("NPK5", "nitrogen", start_datetime, end_datetime)
    nitrogen6 = get_history_val("NPK6", "nitrogen", start_datetime, end_datetime)
    phosphorus4 = get_history_val("NPK4", "phosphorus", start_datetime, end_datetime)
    phosphorus5 = get_history_val("NPK5", "phosphorus", start_datetime, end_datetime)
    phosphorus6 = get_history_val("NPK6", "phosphorus", start_datetime, end_datetime)
    potassium4 = get_history_val("NPK4", "potassium", start_datetime, end_datetime)
    potassium5 = get_history_val("NPK5", "potassium", start_datetime, end_datetime)
    potassium6 = get_history_val("NPK6", "potassium", start_datetime, end_datetime)
    temp_npk4 = get_history_val("NPK4", "temperature", start_datetime, end_datetime)
    temp_npk5 = get_history_val("NPK5", "temperature", start_datetime, end_datetime)
    temp_npk6 = get_history_val("NPK6", "temperature", start_datetime, end_datetime)
    soil7 = get_history_val("soil7", "soil", start_datetime, end_datetime)
    soil8 = get_history_val("soil8", "soil", start_datetime, end_datetime)
    soil9 = get_history_val("soil9", "soil", start_datetime, end_datetime)
    soil10 = get_history_val("soil10", "soil", start_datetime, end_datetime)
    soil11 = get_history_val("soil11", "soil", start_datetime, end_datetime)
    soil12 = get_history_val("soil12", "soil", start_datetime, end_datetime)
    ppfd3 = get_history_val("ppfd3", "ppfd", start_datetime, end_datetime)
    ppfd4 = get_history_val("ppfd4", "ppfd", start_datetime, end_datetime)
    airtemp3 = get_history_val("SHT45T3", "Temp", start_datetime, end_datetime)
    airtemp4 = get_history_val("SHT45T4", "Temp", start_datetime, end_datetime)
    airtemp5 = get_history_val("SHT45T5", "Temp", start_datetime, end_datetime)
    airhum3 = get_history_val("SHT45T3", "Hum", start_datetime, end_datetime)
    airhum4 = get_history_val("SHT45T4", "Hum", start_datetime, end_datetime)
    airhum5 = get_history_val("SHT45T5", "Hum", start_datetime, end_datetime)
    UV_R8 = get_history_val("UV1", "uv_value", start_datetime, end_datetime)
    LUX_R8 = get_history_val("Lux1", "lux", start_datetime, end_datetime)

    # Return context for template
    context_history = {
        'pm_R1': pm_R1,
        'pm_outside': pm_outside,
        'ECWM': ECWM,
        'TempWM': TempWM,
        'CO2_R1': CO2_R1,
        'CO2_R2': CO2_R2,
        'nitrogen4': nitrogen4,
        'phosphorus4': phosphorus4,
        'potassium4': potassium4,
        'temp_npk4': temp_npk4,
        'nitrogen5': nitrogen5,
        'phosphorus5': phosphorus5,
        'potassium5': potassium5,
        'temp_npk5': temp_npk5,
        'nitrogen6': nitrogen6, 
        'phosphorus6': phosphorus6, 
        'potassium6': potassium6, 
        'temp_npk6': temp_npk6,
        "soil7": soil7,
        "soil8": soil8,
        "soil9": soil9,
        "soil10": soil10,
        "soil11": soil11,
        "soil12": soil12,
        "ppfd3": ppfd3,
        "ppfd4": ppfd4,
        "airTemp3": airtemp3,
        "airTemp4": airtemp4,
        "airTemp5": airtemp5,
        "airHum3": airhum3,
        "airHum4": airhum4,
        "airHum5": airhum5,
        "UV_R8": UV_R8,
        "LUX_R8": LUX_R8,
    }
    
    return context_history

def update_graph2(start_datetime, end_datetime):
    """Fetch historical data for Farm 2 sensors with batch processing"""
    # Define all sensor queries
    sensor_queries = [
        ('pm_R2', 'PM25_R2', 'atmos'),
        ('pm_outside', 'PM25_OUTSIDE', 'atmos'),
        ('ECWM', 'EC', 'conduct'),
        ('TempWM', 'EC', 'temp'),
        ('CO2_R1', 'CO2_R1', 'val'),
        ('CO2_R2', 'CO2_R2', 'val'),
        ('nitrogenR8', 'NPK1', 'nitrogen'),
        ('nitrogenR16', 'NPK2', 'nitrogen'),
        ('nitrogenR24', 'NPK3', 'nitrogen'),
        ('phosphorusR8', 'NPK1', 'phosphorus'),
        ('phosphorusR16', 'NPK2', 'phosphorus'),
        ('phosphorusR24', 'NPK3', 'phosphorus'),
        ('potassiumR8', 'NPK1', 'potassium'),
        ('potassiumR16', 'NPK2', 'potassium'),
        ('potassiumR24', 'NPK3', 'potassium'),
        ('temp_npkR8', 'NPK1', 'temperature'),
        ('temp_npkR16', 'NPK2', 'temperature'),
        ('temp_npkR24', 'NPK3', 'temperature'),
        ('soil1', 'soil1', 'soil'),
        ('soil2', 'soil2', 'soil'),
        ('soil3', 'soil3', 'soil'),
        ('soil4', 'soil4', 'soil'),
        ('soil5', 'soil5', 'soil'),
        ('soil6', 'soil6', 'soil'),
        ('soil13', 'soil13', 'soil'),
        ('ppfdR16', 'ppfd1', 'ppfd'),
        ('ppfdR24', 'ppfd2', 'ppfd'),
        ('airTempR8', 'SHT45T1', 'Temp'),
        ('airTempR24', 'SHT45T2', 'Temp'),
        ('airHumR8', 'SHT45T1', 'Hum'),
        ('airHumR24', 'SHT45T2', 'Hum'),
        ('UV_R24', 'UV2', 'uv_value'),
        ('LUX_R24', 'Lux2', 'lux')
    ]
    
    # Use ThreadPoolExecutor for concurrent calls
    context_history = {}
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {}
        
        # Submit all requests
        for key, sensor_id, value_key in sensor_queries:
            futures[key] = executor.submit(
                get_history_val_optimized,
                sensor_id, value_key, start_datetime, end_datetime,
                aggregate=True, max_points=400
            )
        
        # Collect results
        for key, future in futures.items():
            try:
                context_history[key] = future.result(timeout=30)
            except Exception as e:
                logger.error(f"Error fetching {key}: {e}")
                context_history[key] = {'datetimes': [], 'values': []}
    
    return context_history

# Complete SENSOR_NORMALIZE_MAX dictionary with all sensors
SENSOR_NORMALIZE_MAX = {
    # Air Quality
    'pm_R1': 100,
    'pm_R2': 100,
    'pm_outside': 100,
    'CO2_R1': 1500,
    'CO2_R2': 1500,
    
    # Light Sensors
    'UV_R8': 500,
    'UV_R24': 500,
    'LUX_R8': 45000,
    'LUX_R24': 45000,
    'ppfd3': 1000,
    'ppfd4': 1000,
    'ppfdR16': 1000,
    'ppfdR24': 1000,
    
    # NPK Nutrients - Farm 1
    'nitrogen4': 100,
    'nitrogen5': 100,
    'nitrogen6': 100,
    'phosphorus4': 100,
    'phosphorus5': 100,
    'phosphorus6': 100,
    'potassium4': 100,
    'potassium5': 100,
    'potassium6': 100,
    
    # NPK Nutrients - Farm 2
    'nitrogenR8': 100,
    'nitrogenR16': 100,
    'nitrogenR24': 100,
    'phosphorusR8': 100,
    'phosphorusR16': 100,
    'phosphorusR24': 100,
    'potassiumR8': 100,
    'potassiumR16': 100,
    'potassiumR24': 100,
    
    # Temperature - Farm 1
    'airTemp3': 100,
    'airTemp4': 100,
    'airTemp5': 100,
    'temp_npk4': 100,
    'temp_npk5': 100,
    'temp_npk6': 100,
    'TempWM': 100,
    
    # Temperature - Farm 2
    'airTempR8': 100,
    'airTempR24': 100,
    'temp_npkR8': 100,
    'temp_npkR16': 100,
    'temp_npkR24': 100,
    
    # Humidity & Moisture - Farm 1
    'airHum3': 100,
    'airHum4': 100,
    'airHum5': 100,
    'soil7': 100,
    'soil8': 100,
    'soil9': 100,
    'soil10': 100,
    'soil11': 100,
    'soil12': 100,
    
    # Humidity & Moisture - Farm 2
    'airHumR8': 100,
    'airHumR24': 100,
    'soil1': 100,
    'soil2': 100,
    'soil3': 100,
    'soil4': 100,
    'soil5': 100,
    'soil6': 100,
    'soil13': 100,
    
    # Water Quality
    'ECWM': 1500,
}

def normalize_data(context_dict):
    """
    Normalize sensor data to 0-100 scale
    """
    normalized_context = {}
    
    for key, data in context_dict.items():
        # Get max value for this sensor, default to 100
        max_val = SENSOR_NORMALIZE_MAX.get(key, 100)
        
        # Check if data is a dictionary with 'values' key
        if isinstance(data, dict) and 'values' in data:
            # Normalize each value
            normalized_values = []
            for value in data['values']:
                if value is None or value == -1:
                    # Handle missing data
                    normalized_values.append(None)
                else:
                    # Normalize to 0-100 scale
                    normalized_value = (value / max_val) * 100
                    # Ensure value doesn't exceed 100
                    normalized_value = min(normalized_value, 100)
                    # Round to 2 decimal places
                    normalized_values.append(round(normalized_value, 2))
            
            # Keep original structure with normalized values
            normalized_context[key] = {
                'datetimes': data['datetimes'],
                'values': normalized_values
            }
        else:
            # Pass through non-sensor data unchanged
            normalized_context[key] = data
    
    return normalized_context

def Graph_all1(request):
    """
    Show all sensors on a single normalized graph - Farm 1
    """
    # Get date parameters
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    
    # Default to today if no dates provided
    if start_date is None:
        start_date = datetime.now().strftime("%Y-%m-%d")
    if end_date is None:
        end_date = datetime.now().strftime("%Y-%m-%d")
    
    # Format datetime strings
    start = f"{start_date}T00:00:00"
    end = f"{end_date}T23:59:59"
    
    # Get raw data using existing function for Farm 1
    raw_context = update_graph1(start, end)
    
    # Normalize the data
    normalized_context = normalize_data(raw_context)
    
    # Add normalization info to context for display
    normalized_context['sensor_max_values'] = SENSOR_NORMALIZE_MAX
    normalized_context['farm_number'] = 1
    
    return render(request, 'strawberry/graph-all1.html', normalized_context)

def Graph_all2(request):
    """
    Show all sensors on a single normalized graph - Farm 2
    """
    # Get date parameters
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    
    # Default to today if no dates provided
    if start_date is None:
        start_date = datetime.now().strftime("%Y-%m-%d")
    if end_date is None:
        end_date = datetime.now().strftime("%Y-%m-%d")
    
    # Format datetime strings
    start = f"{start_date}T00:00:00"
    end = f"{end_date}T23:59:59"
    
    # Get raw data using existing function for Farm 2
    raw_context = update_graph2(start, end)
    
    # Normalize the data
    normalized_context = normalize_data(raw_context)
    
    # Add normalization info to context for display
    normalized_context['sensor_max_values'] = SENSOR_NORMALIZE_MAX
    normalized_context['farm_number'] = 2
    
    return render(request, 'strawberry/graph-all2.html', normalized_context)

# ========== Export Views ==========
def Download_csv(request):
    """Render the export page"""
    return render(request, 'strawberry/export.html')

def export(request):
    """Export single sensor data to CSV"""
    # Get parameters from request
    sensor_id = request.GET.get('Sensor_id')
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    
    # Validate inputs
    if not sensor_id:
        messages.error(request, "Please select a sensor")
        return redirect('export')
    
    # Default dates if not provided
    if start_date is None:
        start_date = datetime.now().strftime("%Y-%m-%d")
    if end_date is None:
        end_date = datetime.now().strftime("%Y-%m-%d")
    
    # Format datetime strings
    start = f"{start_date}T00:00:00"
    end = f"{end_date}T23:59:59"
    
    # API configuration
    url = f"{API_CONFIG['base_url']}/get-data"
    headers = {"x-api-key": API_CONFIG['api_key']}
    params = {
        "sensor_id": sensor_id,
        "start": start,
        "end": end
    }
    
    try:
        # Make API request
        response = requests.get(
            url, 
            headers=headers, 
            params=params,
            timeout=API_CONFIG['timeout']
        )
        response.raise_for_status()
        
        data = response.json()
        
        if data["status"] == "ok" and len(data["result"]) > 0:
            # Create CSV in memory
            csv_output = StringIO()
            
            # Get all unique keys from all records with data
            all_keys = set()
            valid_records = []
            for record in data["result"]:
                if record.get("data"):
                    all_keys.update(record["data"].keys())
                    valid_records.append(record)
            
            if not valid_records:
                messages.warning(request, f"No valid data found for sensor {sensor_id} in the selected date range")
                return redirect('export')
            
            # Sort keys for consistent output
            fieldnames = sorted(list(all_keys))
            
            writer = csv.DictWriter(csv_output, fieldnames=fieldnames)
            writer.writeheader()
            
            # Write data rows
            for record in valid_records:
                writer.writerow(record["data"])
            
            # Prepare response
            csv_output.seek(0)
            response = HttpResponse(csv_output.getvalue(), content_type='text/csv')
            filename = f'{sensor_id}_data_{start_date}_to_{end_date}.csv'
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            # Log success
            logger.info("Successfully exported sensor data for date range %s to %s", start_date, end_date)
            
            return response
        else:
            messages.warning(request, f"No data found for sensor {sensor_id} in the selected date range")
            return redirect('export')
            
    except requests.RequestException as e:
        messages.error(request, f"Network error: {str(e)}")
        return redirect('export')
    except Exception as e:
        messages.error(request, f"An error occurred: {str(e)}")
        return redirect('export')

def export_multiple(request):
    """Export multiple sensors to a ZIP file"""
    if request.method == 'POST':
        # Get selected sensors
        selected_sensors = request.POST.getlist('sensors[]')
        start_date = request.POST.get('start_date')
        end_date = request.POST.get('end_date')
        
        if not selected_sensors:
            messages.error(request, "Please select at least one sensor")
            return redirect('export')
        
        # Default dates if not provided
        if not start_date:
            start_date = datetime.now().strftime("%Y-%m-%d")
        if not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")
        
        # API configuration
        url = f"{API_CONFIG['base_url']}/get-data"
        headers = {"x-api-key": API_CONFIG['api_key']}
        
        # Create ZIP file in memory
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            success_count = 0
            
            for sensor_id in selected_sensors:
                params = {
                    "sensor_id": sensor_id,
                    "start": f"{start_date}T00:00:00",
                    "end": f"{end_date}T23:59:59"
                }
                
                try:
                    response = requests.get(
                        url, 
                        headers=headers, 
                        params=params,
                        timeout=API_CONFIG['timeout']
                    )
                    response.raise_for_status()
                    
                    data = response.json()
                    
                    if data["status"] == "ok" and len(data["result"]) > 0:
                        # Create CSV for this sensor
                        csv_output = StringIO()
                        
                        # Get all unique keys
                        all_keys = set()
                        valid_records = []
                        for record in data["result"]:
                            if record.get("data"):
                                all_keys.update(record["data"].keys())
                                valid_records.append(record)
                        
                        if not valid_records:
                            logger.warning("No valid data found for sensor export")
                            continue
                        
                        fieldnames = sorted(list(all_keys))
                        writer = csv.DictWriter(csv_output, fieldnames=fieldnames)
                        writer.writeheader()
                        
                        # Write data
                        for record in valid_records:
                            writer.writerow(record["data"])
                        
                        # Add to ZIP
                        filename = f'{sensor_id}_data_{start_date}_to_{end_date}.csv'
                        zip_file.writestr(filename, csv_output.getvalue())
                        success_count += 1
                        
                except Exception as e:
                    logger.error("Error during sensor data export: %s", str(e))
                    continue
            
            if success_count == 0:
                messages.error(request, "No data could be exported")
                return redirect('export')
        
        # Prepare ZIP response
        zip_buffer.seek(0)
        response = HttpResponse(zip_buffer.getvalue(), content_type='application/zip')
        filename = f'harumiki_data_{start_date}_to_{end_date}.zip'
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        messages.success(request, f"Successfully exported {success_count} sensors")
        return response
    
    return redirect('export')

def export_by_farm(request):
    """Export all sensors from a specific farm"""
    farm = request.GET.get('farm')
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    
    # Define sensors for each farm
    farm_sensors = {
        'farm1': [
            'PM25_R1', 'CO2_R1', 'ppfd3', 'ppfd4', 'LUX1', 'UV1',
            'NPK4', 'NPK5', 'NPK6', 'Soil7', 'Soil8', 'Soil9', 
            'Soil10', 'Soil11', 'Soil12', 'SHT45T3', 'SHT45T4', 'SHT45T5'
        ],
        'farm2': [
            'PM25_R2', 'CO2_R2', 'ppfd1', 'ppfd2', 'LUX2', 'UV2',
            'NPK1', 'NPK2', 'NPK3', 'soil1', 'soil2', 'soil3',
            'soil4', 'soil5', 'soil6', 'Soil13', 'SHT45T1', 'SHT45T2', 'SHT45T6'
        ],
        'common': ['PM25_OUTSIDE', 'EC', 'EC2']
    }
    
    if farm not in ['farm1', 'farm2']:
        messages.error(request, "Invalid farm selection")
        return redirect('export')
    
    # Get sensors for selected farm + common sensors
    sensors_to_export = farm_sensors[farm] + farm_sensors['common']
    
    # Default dates if not provided
    if not start_date:
        start_date = datetime.now().strftime("%Y-%m-%d")
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")
    
    # API configuration
    url = f"{API_CONFIG['base_url']}/get-data"
    headers = {"x-api-key": API_CONFIG['api_key']}
    
    # Create ZIP file in memory
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        success_count = 0
        
        for sensor_id in sensors_to_export:
            params = {
                "sensor_id": sensor_id,
                "start": f"{start_date}T00:00:00",
                "end": f"{end_date}T23:59:59"
            }
            
            try:
                response = requests.get(
                    url, 
                    headers=headers, 
                    params=params,
                    timeout=API_CONFIG['timeout']
                )
                response.raise_for_status()
                
                data = response.json()
                
                if data["status"] == "ok" and len(data["result"]) > 0:
                    # Create CSV for this sensor
                    csv_output = StringIO()
                    
                    # Get all unique keys
                    all_keys = set()
                    valid_records = []
                    for record in data["result"]:
                        if record.get("data"):
                            all_keys.update(record["data"].keys())
                            valid_records.append(record)
                    
                    if not valid_records:
                        logger.warning("No valid data found for farm sensor export")
                        continue
                    
                    # Sort keys for consistent output
                    fieldnames = sorted(list(all_keys))
                    
                    writer = csv.DictWriter(csv_output, fieldnames=fieldnames)
                    writer.writeheader()
                    
                    # Write data rows
                    for record in valid_records:
                        writer.writerow(record["data"])
                    
                    # Add to ZIP
                    filename = f'{sensor_id}_data_{start_date}_to_{end_date}.csv'
                    zip_file.writestr(filename, csv_output.getvalue())
                    success_count += 1
                    
            except Exception as e:
                logger.error("Error during farm sensor export: %s", str(e))
                continue
        
        if success_count == 0:
            messages.error(request, f"No data could be exported for {farm}")
            return redirect('export')
    
    # Prepare ZIP response
    zip_buffer.seek(0)
    response = HttpResponse(zip_buffer.getvalue(), content_type='application/zip')
    filename = f'{farm}_data_{start_date}_to_{end_date}.zip'
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    
    messages.success(request, f"Successfully exported {success_count} sensors from {farm}")
    return response

def SmartFarmR1(request):
    """Dashboard view for Smart Farm R1"""
    context = get_farm_context('farm1')
    return render(request, 'strawberry/smartfarmR1.html', context)

def SmartFarmR2(request):
    """Dashboard view for Smart Farm R2"""
    context = get_farm_context('farm2')
    return render(request, 'strawberry/smartfarmR2.html', context)

def CompareGH1and2(request):
    """
    Compare sensor data between GH1 and GH2 for a selected month
    Optimized with caching and data aggregation
    """
    view_start_time = time.time()
    
    # Get month and year from request
    month = request.GET.get('month')
    year = request.GET.get('year')
    today = datetime.today()
    
    # Set defaults
    if month is None:
        current_month = datetime.now().month - 1  # 0-based for select
        month = current_month
    else:
        month = int(month)
        current_month = month
    
    if year is None:
        year = datetime.now().year
    else:
        year = int(year)
    
    # Calculate date range - ตั้งแต่วันที่ 1 ของเดือนถึงปัจจุบัน
    first_date = datetime(year, month + 1, 1)
    
    # ถ้าเป็นเดือนปัจจุบัน ให้แสดงถึงเวลาปัจจุบัน
    # ถ้าเป็นเดือนในอดีต ให้แสดงทั้งเดือน
    if year == today.year and (month + 1) == today.month:
        # เดือนปัจจุบัน - แสดงถึงเวลาปัจจุบัน
        last_date = today
        logger.info("Current month selected - showing data up to today")
    else:
        # เดือนในอดีต - แสดงทั้งเดือน
        last_day = calendar.monthrange(year, month + 1)[1]
        last_date = datetime(year, month + 1, last_day, 23, 59, 59)
        
        # ไม่ให้ query ข้อมูลในอนาคต
        if last_date > today:
            last_date = today
        logger.info("Past month selected - showing full month data")
    
    # ตรวจสอบว่าไม่ query ข้อมูลในอนาคต
    if first_date > today:
        first_date = today.replace(day=1)  # วันที่ 1 ของเดือนปัจจุบัน
    
    # Format datetime strings
    first_date_str = first_date.strftime("%Y-%m-%d")
    last_date_str = last_date.strftime("%Y-%m-%d")
    start = f"{first_date_str}T00:00:00"
    end = f"{last_date_str}T23:59:59"
    
    # Generate cache key based on actual date range
    cache_key = f"compare_data_{year}_{month}_{first_date_str}_{last_date_str}"
    
    # For new selective loading system, we don't need to load all data upfront
    # Charts will be loaded individually via AJAX
    logger.info(f"CompareGH1and2: Using selective loading for {start} to {end}")
    context_history = {
        'message': 'Data will be loaded selectively via AJAX',
        'optimized': True
    }
    
    # Build context
    context = {
        'first_date': first_date_str,
        'last_date': last_date_str,
        'month': month,
        'year': year,
        'current_month': current_month,
        'month_name': calendar.month_name[month + 1],
    }
    
    # Log context for debugging
    data_summary = {}
    total_points = 0
    for key, value in context_history.items():
        if isinstance(value, dict) and 'values' in value:
            points = len(value['values']) if value['values'] else 0
            data_summary[key] = points
            total_points += points
        else:
            data_summary[key] = 'invalid_format'
    
    elapsed = time.time() - view_start_time
    
    logger.info(f"CompareGH1and2: Context built with {len(context_history)} datasets")
    logger.info(f"CompareGH1and2: Date range {first_date_str} to {last_date_str}")
    logger.info(f"CompareGH1and2: Total data points: {total_points}")
    logger.info(f"CompareGH1and2: View completed in {elapsed:.2f} seconds")
    
    # Add performance warning
    if total_points > 100000:
        logger.warning(f"Large dataset warning: {total_points} total points may impact browser performance")
    
    # Merge contexts
    context.update(context_history)
    
    # เพิ่มข้อมูลเพื่อ debug
    context['debug_info'] = {
        'total_datasets': len(context_history),
        'total_points': total_points,
        'view_time': elapsed,
        'optimized': True,  # Using selective loading
        'mode': 'selective'
    }
    
    return render(request, 'strawberry/compare.html', context)

def update_compare_data(start_datetime, end_datetime):
    """
    Fetch historical data with better timeout handling
    """
    start_time = time.time()
    
    # Define priority sensors (most important first) - เซ็นเซอร์ที่ทำงานดีกว่า
    high_priority_queries = [
        ('pm_GH2', 'PM25_R2', 'atmos'),  # ลองใช้ R2 แทน R1 ที่มีปัญหา
        ('CO2_Farm2', 'CO2_R2', 'val'),   # ลองใช้ R2 แทน R1 ที่มีปัญหา
        ('UV_FARM1', 'UV1', 'uv_value'),
        ('LUX_FARM1', 'Lux1', 'lux'),
        ('nitrogen_GH1_R8', 'NPK4', 'nitrogen'),
        ('airTemp_GH1_R8', 'SHT45T3', 'Temp'),
        ('ECWM', 'EC', 'conduct'),
        ('TempWM', 'EC', 'temp'),
    ]
    
    # All other queries with priority grouping
    critical_queries = [
        # Most important sensors first
        ('pm_GH1', 'PM25_R1', 'atmos'),
        ('pm_GH2', 'PM25_R2', 'atmos'), 
        ('pm_outside', 'PM25_OUTSIDE', 'atmos'),
        ('ECWM', 'EC', 'conduct'),
        ('TempWM', 'EC', 'temp'),
    ]
    
    all_sensor_queries = critical_queries + [
        
        # CO2 sensors  
        ('CO2_Farm1', 'CO2_R1', 'val'),
        ('CO2_Farm2', 'CO2_R2', 'val'),
        
        # UV sensors
        ('UV_FARM1', 'UV1', 'uv'),
        ('UV_FARM2', 'UV2', 'uv'),
        
        # LUX sensors
        ('LUX_FARM1', 'LUX1', 'lux'),
        ('LUX_FARM2', 'LUX2', 'lux'),
        
        # PPFD sensors
        ('ppfd_GH1_R8', 'ppfd3', 'ppfd'),
        ('ppfd_GH1_R24', 'ppfd4', 'ppfd'),
        ('ppfd_GH2_R16', 'ppfd1', 'ppfd'),
        ('ppfd_GH2_R24', 'ppfd2', 'ppfd'),
        
        # NPK sensors - Nitrogen
        ('nitrogen_GH1_R8', 'NPK4', 'n'),
        ('nitrogen_GH1_R16', 'NPK5', 'n'),
        ('nitrogen_GH1_R24', 'NPK6', 'n'),
        ('nitrogen_GH2_R8', 'NPK1', 'n'),
        ('nitrogen_GH2_R16', 'NPK2', 'n'),
        ('nitrogen_GH2_R24', 'NPK3', 'n'),
        
        # NPK sensors - Phosphorus
        ('phosphorus_GH1_R8', 'NPK4', 'p'),
        ('phosphorus_GH1_R16', 'NPK5', 'p'),
        ('phosphorus_GH1_R24', 'NPK6', 'p'),
        ('phosphorus_GH2_R8', 'NPK1', 'p'),
        ('phosphorus_GH2_R16', 'NPK2', 'p'),
        ('phosphorus_GH2_R24', 'NPK3', 'p'),
        
        # NPK sensors - Potassium
        ('potassium_GH1_R8', 'NPK4', 'k'),
        ('potassium_GH1_R16', 'NPK5', 'k'),
        ('potassium_GH1_R24', 'NPK6', 'k'),
        ('potassium_GH2_R8', 'NPK1', 'k'),
        ('potassium_GH2_R16', 'NPK2', 'k'),
        ('potassium_GH2_R24', 'NPK3', 'k'),
        
        # NPK Temperature sensors
        ('temp_npk_GH1_R8', 'NPK4', 'temperature'),
        ('temp_npk_GH1_R16', 'NPK5', 'temperature'),
        ('temp_npk_GH1_R24', 'NPK6', 'temperature'),
        ('temp_npk_GH2_R8', 'NPK1', 'temperature'),
        ('temp_npk_GH2_R16', 'NPK2', 'temperature'),
        ('temp_npk_GH2_R24', 'NPK3', 'temperature'),
        
        # SHT45 Temperature sensors
        ('airTemp_GH1_R8', 'SHT45T4', 'temperature'),
        ('airTemp_GH1_R16', 'SHT45T5', 'temperature'),
        ('airTemp_GH1_R24', 'SHT45T6', 'temperature'),
        ('airTemp_GH2_R8', 'SHT45T1', 'temperature'),
        ('airTemp_GH2_R16', 'SHT45T2', 'temperature'),
        ('airTemp_GH2_R24', 'SHT45T3', 'temperature'),
        
        # Water Temperature sensors
        ('TempWM', 'WM_Temp_C', 'val'),
        ('TempWP', 'WP_Temp_C', 'val'),
        
        # SHT45 Humidity sensors
        ('airHum_GH1_R8', 'SHT45T4', 'humidity'),
        ('airHum_GH1_R16', 'SHT45T5', 'humidity'),
        ('airHum_GH1_R24', 'SHT45T6', 'humidity'),
        ('airHum_GH2_R8', 'SHT45T1', 'humidity'),
        ('airHum_GH2_R16', 'SHT45T2', 'humidity'),
        ('airHum_GH2_R24', 'SHT45T3', 'humidity'),
        
        # Soil moisture sensors
        ('soil_GH1_R8_Q1', 'soil1', 'moisture'),
        ('soil_GH1_R8_Q2', 'soil2', 'moisture'),
        ('soil_GH1_R16_Q3', 'soil3', 'moisture'),
        ('soil_GH1_R16_Q4', 'soil4', 'moisture'),
        ('soil_GH1_R24_Q5', 'soil5', 'moisture'),
        ('soil_GH1_R24_Q6', 'soil6', 'moisture'),
        ('soil_GH2_R8_P1', 'Soil7', 'moisture'),
        ('soil_GH2_R8_P2', 'Soil8', 'moisture'),
        ('soil_GH2_R8_P3', 'Soil9', 'moisture'),
        ('soil_GH2_R24_P4', 'Soil10', 'moisture'),
        ('soil_GH2_R24_P5', 'Soil11', 'moisture'),
        ('soil_GH2_R24_P6', 'Soil12', 'moisture'),
        ('soil_GH2_R16_P8', 'Soil13', 'moisture'),
        
        # EC sensors - moved to critical
        ('ECWP', 'EC2', 'val'),
    ]
    
    context_history = {}
    
    logger.info(f"update_compare_data: Fetching data from {start_datetime} to {end_datetime}")
    
    # Process critical sensors first with dedicated workers
    with ThreadPoolExecutor(max_workers=4) as executor:
        future_to_sensor = {}
        
        # Submit critical sensors first (most important for display)
        for key, sensor_id, value_key in critical_queries:
            future = executor.submit(
                get_history_val_optimized,
                sensor_id, 
                value_key, 
                start_datetime, 
                end_datetime,
                aggregate=True,
                max_points=500  # Reduced for critical data
            )
            future_to_sensor[future] = key
        
        # Wait for critical sensors to complete with shorter timeout
        completed = 0
        try:
            for future in as_completed(future_to_sensor, timeout=60):  # Reduced timeout
                key = future_to_sensor[future]
                try:
                    result = future.result()
                    context_history[key] = result
                    completed += 1
                    logger.info(f"Critical sensor {key} completed")
                except Exception as e:
                    logger.error(f"Error fetching {key}: {e}")
                    context_history[key] = {'datetimes': [], 'values': []}
        except TimeoutError:
            logger.warning(f"Critical sensors timeout: {completed}/{len(future_to_sensor)} completed")
            # Cancel remaining futures
            for future in future_to_sensor:
                if not future.done():
                    future.cancel()
                    key = future_to_sensor[future]
                    context_history[key] = {'datetimes': [], 'values': []}
                    logger.warning(f"Cancelled critical sensor: {key}")
    
    # Then fetch remaining sensors in batches
    remaining_queries = [q for q in all_sensor_queries if q[0] not in context_history]
    
    # Process remaining sensors in smaller batches to avoid overwhelming the system
    batch_size = 6
    for i in range(0, len(remaining_queries), batch_size):
        batch = remaining_queries[i:i + batch_size]
        
        with ThreadPoolExecutor(max_workers=3) as executor:
            future_to_sensor = {}
            
            for key, sensor_id, value_key in batch:
                future = executor.submit(
                    get_history_val_optimized,
                    sensor_id, 
                    value_key, 
                    start_datetime, 
                    end_datetime,
                    aggregate=True,
                    max_points=400  # Further reduced for non-critical data
                )
                future_to_sensor[future] = key
        
            # Process batch with reasonable timeout
            try:
                for future in as_completed(future_to_sensor, timeout=90):
                    key = future_to_sensor[future]
                    try:
                        result = future.result()
                        context_history[key] = result
                    except Exception as e:
                        logger.error(f"Error fetching {key}: {e}")
                        context_history[key] = {'datetimes': [], 'values': []}
            except TimeoutError:
                logger.warning(f"Batch timeout after 90s")
                # Provide empty data for any incomplete sensors
                for future in future_to_sensor:
                    if not future.done():
                        future.cancel()
                        key = future_to_sensor[future]
                        context_history[key] = {'datetimes': [], 'values': []}
                        logger.warning(f"Cancelled sensor: {key}")
        
        # Small delay between batches to prevent API overload
        if i + batch_size < len(remaining_queries):
            time.sleep(0.5)
    
    # Ensure all expected datasets exist with at least empty data
    expected_keys = [q[0] for q in all_sensor_queries]
    for key in expected_keys:
        if key not in context_history:
            context_history[key] = {'datetimes': [], 'values': []}
            logger.info(f"Added empty fallback data for: {key}")
    
    elapsed = time.time() - start_time
    
    # Calculate total data points
    total_points = sum(
        len(v.get('values', [])) 
        for v in context_history.values() 
        if isinstance(v, dict)
    )
    
    logger.info(
        f"update_compare_data: Fetched {len(context_history)} datasets "
        f"with {total_points} points in {elapsed:.2f}s"
    )
    
    return context_history

@gzip_page
def get_compare_chart_data(request):
    """
    API endpoint to fetch specific chart data on demand
    """
    if not request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({'status': 'error', 'message': 'AJAX request required'}, status=400)
    
    chart_type = request.GET.get('chart_type')
    month = request.GET.get('month')
    year = request.GET.get('year')
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    
    if not all([chart_type, month, year, start_date, end_date]):
        return JsonResponse({'status': 'error', 'message': 'Missing required parameters'}, status=400)
    
    try:
        month = int(month) - 1  # Convert 1-based month from frontend to 0-based for Python date calculations
        year = int(year)
    except ValueError:
        return JsonResponse({'status': 'error', 'message': 'Invalid month or year'}, status=400)
    
    # Format datetime strings
    start_datetime = f"{start_date}T00:00:00"
    end_datetime = f"{end_date}T23:59:59"
    
    # Generate cache key for this specific chart
    cache_key = f"chart_data_{chart_type}_{year}_{month}_{start_date}_{end_date}"
    
    # Try cache first
    cached_data = cache.get(cache_key)
    if cached_data:
        logger.info(f"Using cached chart data for {chart_type}")
        return JsonResponse({
            'status': 'success',
            'data': cached_data,
            'cached': True
        })
    
    logger.info(f"Fetching fresh data for chart: {chart_type}")
    logger.info(f"Date range: {start_datetime} to {end_datetime}")
    
    try:
        # Get chart-specific data based on chart type
        chart_data = get_chart_specific_data(chart_type, start_datetime, end_datetime)
        
        # Debug logging
        logger.info(f"Chart data keys returned: {list(chart_data.keys()) if chart_data else 'None'}")
        if chart_data:
            for key, value in chart_data.items():
                if isinstance(value, list):
                    logger.info(f"Data for {key}: {len(value)} points")
                    if len(value) > 0:
                        logger.info(f"Sample data for {key}: {value[:3]}")  # First 3 points
        
        if not chart_data:
            return JsonResponse({
                'status': 'error', 
                'message': f'No data available for chart type: {chart_type}'
            }, status=404)
        
        # Cache the result
        today = datetime.today()
        if year == today.year and (month + 1) == today.month:
            cache_timeout = 300  # 5 minutes for current month
        else:
            cache_timeout = 1800  # 30 minutes for past months
        
        cache.set(cache_key, chart_data, cache_timeout)
        
        # Count sensors with data
        total_sensors = len([k for k in chart_data.keys() if not k.endswith('-times')])
        sensors_with_data = len([k for k, v in chart_data.items() 
                               if not k.endswith('-times') and len(v) > 0])
        
        response_data = {
            'status': 'success',
            'data': chart_data,
            'cached': False,
            'meta': {
                'total_sensors': total_sensors,
                'sensors_with_data': sensors_with_data,
                'date_range': f"{start_datetime} to {end_datetime}",
                'chart_type': chart_type,
                'optimized': True  # Flag to indicate this is optimized response
            }
        }
        
        response = JsonResponse(response_data)
        
        # Add caching headers for better performance
        response['Cache-Control'] = 'public, max-age=300'  # 5 minutes
        response['X-Optimized'] = 'true'
        
        return response
        
    except Exception as e:
        logger.error(f"Error fetching chart data for {chart_type}: {str(e)}")
        return JsonResponse({
            'status': 'error',
            'message': 'Failed to fetch chart data'
        }, status=500)

def get_chart_specific_data(chart_type, start_datetime, end_datetime):
    """
    Fetch data for specific chart type only
    Enhanced with multiple sensor ID variations and better error handling
    """
    chart_data = {}
    
    # Define chart-specific queries with multiple sensor ID variations
    # อัพเดท chart_queries ใน get_chart_specific_data function
    # ใช้ sensor IDs ที่ถูกต้องตาม debug data

    chart_queries = {
        'pm': [
            ('pm-gh1', 'PM25_R1', 'atmos'),
            ('pm-gh2', 'PM25_R2', 'atmos'),
            ('pm-outside', 'PM25_OUTSIDE', 'atmos')
        ],
        'co2': [
            ('co2-farm1', 'CO2_R1', 'val'),
            ('co2-farm2', 'CO2_R2', 'val')  # Note: CO2_R2 has no historical data
        ],
        'luxuv': [
            ('uv-farm1', 'UV1', 'uv_value'),
            ('lux-farm1', ['LUX1', 'Lux1'], 'lux'),  # Try both cases
            ('uv-farm2', 'UV2', 'uv_value'),
            ('lux-farm2', ['LUX2', 'Lux2'], 'lux')   # Try both cases
        ],
        'ppfd': [
            ('ppfd-gh1-r8', 'ppfd3', 'ppfd'),
            ('ppfd-gh1-r24', 'ppfd4', 'ppfd'),
            ('ppfd-gh2-r16', 'ppfd1', 'ppfd'),
            ('ppfd-gh2-r24', 'ppfd2', 'ppfd')
        ],
        'nitrogen': [
            ('nitrogen-gh1-r8', 'NPK4', 'nitrogen'),
            ('nitrogen-gh1-r16', 'NPK5', 'nitrogen'),
            ('nitrogen-gh1-r24', 'NPK6', 'nitrogen'),
            ('nitrogen-gh2-r8', 'NPK1', 'nitrogen'),
            ('nitrogen-gh2-r16', 'NPK2', 'nitrogen'),
            ('nitrogen-gh2-r24', 'NPK3', 'nitrogen')
        ],
        'phosphorus': [
            ('phosphorus-gh1-r8', 'NPK4', 'phosphorus'),
            ('phosphorus-gh1-r16', 'NPK5', 'phosphorus'),
            ('phosphorus-gh1-r24', 'NPK6', 'phosphorus'),
            ('phosphorus-gh2-r8', 'NPK1', 'phosphorus'),
            ('phosphorus-gh2-r16', 'NPK2', 'phosphorus'),
            ('phosphorus-gh2-r24', 'NPK3', 'phosphorus')
        ],
        'potassium': [
            ('potassium-gh1-r8', 'NPK4', 'potassium'),
            ('potassium-gh1-r16', 'NPK5', 'potassium'),
            ('potassium-gh1-r24', 'NPK6', 'potassium'),
            ('potassium-gh2-r8', 'NPK1', 'potassium'),
            ('potassium-gh2-r16', 'NPK2', 'potassium'),
            ('potassium-gh2-r24', 'NPK3', 'potassium')
        ],
        'tempsoil': [
            ('temp-npk-gh1-r8', 'NPK4', 'temperature'),
            ('temp-npk-gh1-r16', 'NPK5', 'temperature'),
            ('temp-npk-gh1-r24', 'NPK6', 'temperature'),
            ('temp-npk-gh2-r8', 'NPK1', 'temperature'),
            ('temp-npk-gh2-r16', 'NPK2', 'temperature'),
            ('temp-npk-gh2-r24', 'NPK3', 'temperature')
        ],
        'tempairwater': [
            ('air-temp-gh1-r8', 'SHT45T3', 'Temp'),
            ('air-temp-gh1-r16', 'SHT45T4', 'Temp'),
            ('air-temp-gh1-r24', 'SHT45T5', 'Temp'),
            ('air-temp-gh2-r8', 'SHT45T1', 'Temp'),
            ('air-temp-gh2-r16', 'SHT45T6', 'Temp'),
            ('air-temp-gh2-r24', 'SHT45T2', 'Temp'),
            ('temp-wm', 'EC', 'temp'),
            ('temp-wp', 'EC2', 'temp')
        ],
        'humidity': [
            ('air-hum-gh1-r8', 'SHT45T3', 'Hum'),
            ('air-hum-gh1-r16', 'SHT45T4', 'Hum'),
            ('air-hum-gh1-r24', 'SHT45T5', 'Hum'),
            ('air-hum-gh2-r8', 'SHT45T1', 'Hum'),
            ('air-hum-gh2-r16', 'SHT45T6', 'Hum'),
            ('air-hum-gh2-r24', 'SHT45T2', 'Hum')
        ],
        'moisture': [
            ('soil-gh1-r8q1', 'soil7', 'soil'),
            ('soil-gh1-r8q2', 'soil8', 'soil'),
            ('soil-gh1-r16q3', 'soil9', 'soil'),
            ('soil-gh1-r16q4', 'soil10', 'soil'),
            ('soil-gh1-r24q5', 'soil11', 'soil'),
            ('soil-gh1-r24q6', 'soil12', 'soil'),
            ('soil-gh2-r8p1', 'soil1', 'soil'),
            ('soil-gh2-r8p2', 'soil2', 'soil'),
            ('soil-gh2-r8p3', 'soil3', 'soil'),
            ('soil-gh2-r24p4', 'soil4', 'soil'),
            ('soil-gh2-r24p5', 'soil5', 'soil'),
            ('soil-gh2-r24p6', 'soil6', 'soil'),
            ('soil-gh2-r16p8', 'soil13', 'soil')
        ],
        'ec': [
            ('ecwm', 'EC', 'conduct'),
            ('ecwp', 'EC2', 'conduct')
        ]
    }
    
    queries = chart_queries.get(chart_type, [])
    if not queries:
        logger.error(f"Unknown chart type: {chart_type}")
        return None
    
    logger.info(f"Chart type {chart_type} has {len(queries)} sensors to query")
    
    # Helper function to try multiple sensor IDs
    def try_sensor_variations(sensor_ids, value_key, start_dt, end_dt):
        """Try multiple sensor ID variations and return the first one with data"""
        if not isinstance(sensor_ids, list):
            sensor_ids = [sensor_ids]
        
        for sensor_id in sensor_ids:
            try:
                result = get_history_val_optimized(
                    sensor_id,
                    value_key,
                    start_dt,
                    end_dt,
                    aggregate=True,
                    max_points=250
                )
                
                # If we got data, return it
                if result and result.get('values') and len(result['values']) > 0:
                    logger.info(f"Found data for {sensor_id}.{value_key}")
                    return result
                    
            except Exception as e:
                logger.debug(f"Failed to get data for {sensor_id}.{value_key}: {e}")
                continue
        
        # No data found for any variation
        logger.warning(f"No data found for any variation of {sensor_ids}")
        return {'values': [], 'datetimes': []}
    
    # Use ThreadPoolExecutor for concurrent API calls
    with ThreadPoolExecutor(max_workers=4) as executor:
        future_to_key = {}
        
        for key, sensor_id, value_key in queries:
            future = executor.submit(
                try_sensor_variations,
                sensor_id,
                value_key,
                start_datetime,
                end_datetime
            )
            future_to_key[future] = key
        
        # Collect results with timeout
        timeout_duration = 120 if len(queries) > 10 else 80
        logger.info(f"Using timeout of {timeout_duration}s for {len(queries)} sensors")
        
        completed_futures = 0
        total_futures = len(future_to_key)
        
        try:
            for future in as_completed(future_to_key, timeout=timeout_duration):
                key = future_to_key[future]
                completed_futures += 1
                
                try:
                    result = future.result()
                    
                    if result:
                        logger.info(f"({completed_futures}/{total_futures}) Result for {key}: "
                                  f"{len(result.get('values', []))} values")
                        
                        chart_data[key] = result.get('values', [])
                        
                        # Add timestamps for first dataset with data
                        if '-times' not in chart_data and result.get('datetimes'):
                            chart_data[key + '-times'] = result.get('datetimes', [])
                    else:
                        chart_data[key] = []
                        
                except Exception as e:
                    logger.error(f"Error fetching {key}: {e}")
                    chart_data[key] = []
        
        except TimeoutError:
            logger.error(f"Timeout after {timeout_duration}s - completed {completed_futures}/{total_futures} sensors")
            # Fill missing sensors with empty data
            for future, key in future_to_key.items():
                if key not in chart_data:
                    chart_data[key] = []
                    logger.warning(f"Sensor {key} timed out - using empty data")
    
    # Ensure we have at least one timestamp array
    if not any(k.endswith('-times') for k in chart_data.keys()):
        # Generate default timestamps if none found
        logger.warning("No timestamps found in any dataset, generating defaults")
        chart_data['default-times'] = []
    
    # Log summary
    sensors_with_data = sum(1 for k, v in chart_data.items() 
                          if not k.endswith('-times') and len(v) > 0)
    logger.info(f"Chart {chart_type}: {sensors_with_data} sensors have data")
    
    return chart_data

def test_compare(request):
    """
    Test page for debugging compare functionality
    """
    return render(request, 'strawberry/test_compare.html', {
        'debug_mode': True,
        'current_time': datetime.now().isoformat()
    })

# Add this debug view to your views.py to check sensor availability

def debug_sensors(request):
    """
    Debug view to check which sensors are available and returning data
    """
    import json
    from datetime import datetime, timedelta
    
    # Get date range (last 7 days)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)
    start_str = start_date.strftime("%Y-%m-%dT00:00:00")
    end_str = end_date.strftime("%Y-%m-%dT23:59:59")
    
    # All sensors to check
    sensors_to_check = {
        'PM Sensors': [
            ('PM25_R1', 'atmos'),
            ('PM25_R2', 'atmos'),
            ('PM25_OUTSIDE', 'atmos')
        ],
        'CO2 Sensors': [
            ('CO2_R1', 'val'),
            ('CO2_R2', 'val')
        ],
        'Light Sensors': [
            ('UV1', 'uv_value'),
            ('UV2', 'uv_value'),
            ('LUX1', 'lux'),
            ('Lux1', 'lux'),  # Check both cases
            ('LUX2', 'lux'),
            ('Lux2', 'lux')   # Check both cases
        ],
        'PPFD Sensors': [
            ('ppfd1', 'ppfd'),
            ('ppfd2', 'ppfd'),
            ('ppfd3', 'ppfd'),
            ('ppfd4', 'ppfd')
        ],
        'NPK Sensors': [
            ('NPK1', 'nitrogen'),
            ('NPK2', 'nitrogen'),
            ('NPK3', 'nitrogen'),
            ('NPK4', 'nitrogen'),
            ('NPK5', 'nitrogen'),
            ('NPK6', 'nitrogen')
        ],
        'Soil Sensors': [
            ('soil1', 'soil'),
            ('soil2', 'soil'),
            ('soil3', 'soil'),
            ('soil4', 'soil'),
            ('soil5', 'soil'),
            ('soil6', 'soil'),
            ('soil7', 'soil'),
            ('soil8', 'soil'),
            ('soil9', 'soil'),
            ('soil10', 'soil'),
            ('soil11', 'soil'),
            ('soil12', 'soil'),
            ('soil13', 'soil')
        ],
        'Temperature Sensors': [
            ('SHT45T1', 'Temp'),
            ('SHT45T2', 'Temp'),
            ('SHT45T3', 'Temp'),
            ('SHT45T4', 'Temp'),
            ('SHT45T5', 'Temp'),
            ('SHT45T6', 'Temp')
        ],
        'EC Sensors': [
            ('EC', 'conduct'),
            ('EC2', 'conduct')
        ]
    }
    
    results = {}
    
    for category, sensors in sensors_to_check.items():
        results[category] = []
        
        for sensor_id, value_key in sensors:
            # Try to get latest value
            latest_value = get_latest_sensor_value(sensor_id, value_key)
            
            # Try to get some historical data
            historical_data = get_history_val(sensor_id, value_key, start_str, end_str)
            data_count = len(historical_data.get('values', []))
            
            results[category].append({
                'sensor_id': sensor_id,
                'value_key': value_key,
                'latest_value': latest_value,
                'has_data': latest_value is not None,
                'historical_data_points': data_count,
                'status': 'OK' if latest_value is not None else 'NO DATA'
            })
    
    # Return JSON response
    return JsonResponse({
        'timestamp': datetime.now().isoformat(),
        'date_range': f"{start_str} to {end_str}",
        'results': results
    }, json_dumps_params={'indent': 2})

# Add this URL pattern to urls.py:
# path('debug-sensors/', debug_sensors, name='debug-sensors'),