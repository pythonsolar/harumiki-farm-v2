"""
Harumiki Smart Farm Django Views
Optimized and refactored for better maintainability and performance
"""

import csv
import io
import json
import os
import zipfile
from datetime import datetime, timedelta
from decimal import Decimal
from io import StringIO

import requests
from django.conf import settings
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q
from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.utils.dateparse import parse_date
from django.utils.html import mark_safe
import calendar

from .models import *

# ========== API Configuration ==========
# Use settings from Django configuration (loaded from .env)
API_CONFIG = {
    'base_url': settings.SMART_FARM_API_URL,
    'api_key': settings.SMART_FARM_API_KEY,
    'timeout': getattr(settings, 'API_TIMEOUT', 30)  # Default to 30 if not set
}

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

# ========== Main View Functions ==========
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
    Build context data for specified farm
    
    Args:
        farm_key (str): 'farm1' or 'farm2'
    
    Returns:
        dict: Context data for template rendering
    """
    if farm_key not in SENSOR_MAPPINGS:
        raise ValueError(f"Invalid farm key: {farm_key}")
    
    sensors = SENSOR_MAPPINGS[farm_key]
    context = {}
    
    # Get PM2.5 data
    context.update(get_pm_data(sensors['pm']))
    
    # Get water quality data
    context.update(get_water_data(sensors['water']))
    
    # Get CO2 data
    context.update(get_co2_data(sensors['co2']))
    
    # Get NPK data
    context.update(get_npk_data(sensors['npk'], farm_key))
    
    # Get soil moisture data
    context.update(get_soil_data(sensors['soil']))
    
    # Get PPFD and calculate DLI
    context.update(get_light_data(sensors['ppfd'], farm_key))
    
    # Get air temperature and humidity
    context.update(get_air_data(sensors['air_sensors'], farm_key))
    
    # Get additional light sensors (LUX, UV)
    context.update(get_additional_light_data(sensors['light'], farm_key))
    
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
    Get latest value from specific sensor
    
    Args:
        sensor_id (str): Sensor identifier
        value_key (str): Value key to extract from response
    
    Returns:
        float/int/None: Sensor value or None if error
    """
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
            return sensor_data.get(value_key)
        else:
            print(f"No data found for sensor {sensor_id}")
            return None
            
    except requests.RequestException as e:
        print(f"API request failed for sensor {sensor_id}: {str(e)}")
        return None
    except (KeyError, IndexError, ValueError) as e:
        print(f"Data parsing error for sensor {sensor_id}: {str(e)}")
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
        print(f"Historical data request failed for sensor {sensor_id}: {str(e)}")
        return {"error": f"Request failed: {str(e)}"}
    except (KeyError, ValueError) as e:
        print(f"Historical data parsing error for sensor {sensor_id}: {str(e)}")
        return {"error": f"Data parsing failed: {str(e)}"}

def get_history_val(sensor_id, name_value, start_datetime, end_datetime):
    """
    Get historical sensor values (refactored to use API_CONFIG)
    
    Args:
        sensor_id (str): Sensor identifier
        name_value (str): Value key to extract
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

        # Check if we have data in the desired time range
        start_time = datetime.fromisoformat(start_datetime)
        end_time = datetime.fromisoformat(end_datetime)

        # Check if we have data points that fall within 15 minutes of start_time
        if not any(start_time <= datetime.fromisoformat(dt) <= end_time for dt in datetimes):
            # Fill values with -1 until we find a valid timestamp
            current_time = start_time
            while current_time <= end_time:
                if current_time.strftime("%Y-%m-%d %H:%M:%S") in datetimes:
                    idx = datetimes.index(current_time.strftime("%Y-%m-%d %H:%M:%S"))
                    values.append(values[idx])
                else:
                    values.append(-1)
                current_time += timedelta(minutes=1)  # Increment by one minute

        return {"datetimes": datetimes, "values": values}

    except requests.RequestException as e:
        print(f"Failed to retrieve data for sensor {sensor_id}: {str(e)}")
        return {"error": f"Failed to retrieve data: {str(e)}"}
    except Exception as e:
        print(f"Unexpected error for sensor {sensor_id}: {str(e)}")
        return {"error": f"Unexpected error: {str(e)}"}

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
                print(f"Error getting historical data for {sensor_id}: {historical_data['error']}")
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
            print(f"Error calculating DLI for sensor {sensor_id}: {str(e)}")
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
    error_msg = f"API Error"
    if sensor_id:
        error_msg += f" for sensor {sensor_id}"
    error_msg += f": {str(error)}"
    print(error_msg)
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
    """Fetch historical data for Farm 2 sensors"""
    pm_R2 = get_history_val("PM25_R2", "atmos", start_datetime, end_datetime)
    pm_outside = get_history_val("PM25_OUTSIDE", "atmos", start_datetime, end_datetime)
    ECWM = get_history_val("EC", "conduct", start_datetime, end_datetime)
    TempWM = get_history_val("EC", "temp", start_datetime, end_datetime)
    CO2_R1 = get_history_val("CO2_R1", "val", start_datetime, end_datetime)
    CO2_R2 = get_history_val("CO2_R2", "val", start_datetime, end_datetime)
    nitrogen1 = get_history_val("NPK1", "nitrogen", start_datetime, end_datetime)
    nitrogen2 = get_history_val("NPK2", "nitrogen", start_datetime, end_datetime)
    nitrogen3 = get_history_val("NPK3", "nitrogen", start_datetime, end_datetime)
    phosphorus1 = get_history_val("NPK1", "phosphorus", start_datetime, end_datetime)
    phosphorus2 = get_history_val("NPK2", "phosphorus", start_datetime, end_datetime)
    phosphorus3 = get_history_val("NPK3", "phosphorus", start_datetime, end_datetime)
    potassium1 = get_history_val("NPK1", "potassium", start_datetime, end_datetime)
    potassium2 = get_history_val("NPK2", "potassium", start_datetime, end_datetime)
    potassium3 = get_history_val("NPK3", "potassium", start_datetime, end_datetime)
    temp_npkR8 = get_history_val("NPK1", "temperature", start_datetime, end_datetime)
    temp_npkR16 = get_history_val("NPK2", "temperature", start_datetime, end_datetime)
    temp_npkR24 = get_history_val("NPK3", "temperature", start_datetime, end_datetime)
    soil1 = get_history_val("soil1", "soil", start_datetime, end_datetime)
    soil2 = get_history_val("soil2", "soil", start_datetime, end_datetime)
    soil3 = get_history_val("soil3", "soil", start_datetime, end_datetime)
    soil4 = get_history_val("soil4", "soil", start_datetime, end_datetime)
    soil5 = get_history_val("soil5", "soil", start_datetime, end_datetime)
    soil6 = get_history_val("soil6", "soil", start_datetime, end_datetime)
    soil13 = get_history_val("soil13", "soil", start_datetime, end_datetime)
    ppfd_R16 = get_history_val("ppfd1", "ppfd", start_datetime, end_datetime)
    ppfd_R24 = get_history_val("ppfd2", "ppfd", start_datetime, end_datetime)
    airtempR8 = get_history_val("SHT45T1", "Temp", start_datetime, end_datetime)
    airtempR24 = get_history_val("SHT45T2", "Temp", start_datetime, end_datetime)
    airhumR8 = get_history_val("SHT45T1", "Hum", start_datetime, end_datetime)
    airhumR24 = get_history_val("SHT45T2", "Hum", start_datetime, end_datetime)
    UV_R24 = get_history_val("UV2", "uv_value", start_datetime, end_datetime)
    LUX_R24 = get_history_val("Lux2", "lux", start_datetime, end_datetime)

    # Return context for template
    context_history = {
        'pm_R2': pm_R2,
        'pm_outside': pm_outside,
        'ECWM': ECWM,
        'TempWM': TempWM,
        'CO2_R1': CO2_R1,
        'CO2_R2': CO2_R2,
        'nitrogenR8': nitrogen1,
        'phosphorusR8': phosphorus1,
        'potassiumR8': potassium1,
        'temp_npkR8': temp_npkR8,
        'nitrogenR16': nitrogen2,
        'phosphorusR16': phosphorus2,
        'potassiumR16': potassium2,
        'temp_npkR16': temp_npkR16,
        'nitrogenR24': nitrogen3, 
        'phosphorusR24': phosphorus3, 
        'potassiumR24': potassium3, 
        'temp_npkR24': temp_npkR24,
        "soil1": soil1,
        "soil2": soil2,
        "soil3": soil3,
        "soil4": soil4,
        "soil5": soil5,
        "soil6": soil6,
        "soil13": soil13,
        "ppfdR16": ppfd_R16,
        "ppfdR24": ppfd_R24,
        "airTempR8": airtempR8,
        "airTempR24": airtempR24,
        "airHumR8": airhumR8,
        "airHumR24": airhumR24,
        "UV_R24": UV_R24,
        "LUX_R24": LUX_R24,
    }
    
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
            print(f"Successfully exported {sensor_id} data from {start_date} to {end_date}")
            
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
                            print(f"No valid data found for sensor {sensor_id}")
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
                    print(f"Error exporting {sensor_id}: {str(e)}")
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
                        print(f"No valid data found for sensor {sensor_id}")
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
                print(f"Error exporting {sensor_id}: {str(e)}")
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
    """
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
    
    # Calculate date range
    first_date = datetime(year, month + 1, 1)
    last_day = calendar.monthrange(year, month + 1)[1]
    last_date = datetime(year, month + 1, last_day)
    
    # Don't query future dates
    if last_date > today:
        last_date = today
    if first_date > today:
        first_date = today
    
    # Format datetime strings
    first_date_str = first_date.strftime("%Y-%m-%d")
    last_date_str = last_date.strftime("%Y-%m-%d")
    start = f"{first_date_str}T00:00:00"
    end = f"{last_date_str}T23:59:59"
    
    # Get sensor data
    context_history = update_compare_data(start, end)
    
    # Build context
    context = {
        'first_date': first_date_str,
        'last_date': last_date_str,
        'month': month,
        'year': year,
        'current_month': current_month,
        'month_name': calendar.month_name[month + 1],
    }
    
    # Merge contexts
    context.update(context_history)
    
    return render(request, 'strawberry/compare.html', context)

def update_compare_data(start_datetime, end_datetime):
    """
    Fetch historical data for all sensors in both greenhouses
    """
    
    # Define sensor groups for cleaner code
    SENSOR_GROUPS = {
        'pm': {
            'GH1': ('PM25_R1', 'atmos'),
            'GH2': ('PM25_R2', 'atmos'),
            'outside': ('PM25_OUTSIDE', 'atmos'),
        },
        'co2': {
            'Farm1': ('CO2_R1', 'val'),
            'Farm2': ('CO2_R2', 'val'),
        },
        'water': {
            'mix': ('EC', ['conduct', 'temp']),
            'pure': ('EC2', ['conduct', 'temp']),
        },
        'light': {
            'FARM1': {
                'UV': ('UV1', 'uv_value'),
                'LUX': ('LUX1', 'lux'),
            },
            'FARM2': {
                'UV': ('UV2', 'uv_value'),
                'LUX': ('LUX2', 'lux'),
            }
        },
        'ppfd': {
            'GH1': {
                'R8': ('ppfd3', 'ppfd'),
                'R24': ('ppfd4', 'ppfd'),
            },
            'GH2': {
                'R16': ('ppfd1', 'ppfd'),
                'R24': ('ppfd2', 'ppfd'),
            }
        },
        'npk': {
            'GH1': {
                'R8': ('NPK4', ['nitrogen', 'phosphorus', 'potassium', 'temperature']),
                'R16': ('NPK5', ['nitrogen', 'phosphorus', 'potassium', 'temperature']),
                'R24': ('NPK6', ['nitrogen', 'phosphorus', 'potassium', 'temperature']),
            },
            'GH2': {
                'R8': ('NPK1', ['nitrogen', 'phosphorus', 'potassium', 'temperature']),
                'R16': ('NPK2', ['nitrogen', 'phosphorus', 'potassium', 'temperature']),
                'R24': ('NPK3', ['nitrogen', 'phosphorus', 'potassium', 'temperature']),
            }
        },
        'air': {
            'GH1': {
                'R8': ('SHT45T3', ['Temp', 'Hum']),
                'R16': ('SHT45T4', ['Temp', 'Hum']),
                'R24': ('SHT45T5', ['Temp', 'Hum']),
            },
            'GH2': {
                'R8': ('SHT45T1', ['Temp', 'Hum']),
                'R16': ('SHT45T6', ['Temp', 'Hum']),
                'R24': ('SHT45T2', ['Temp', 'Hum']),
            }
        },
        'soil': {
            'GH1': {
                'R8_Q1': ('soil7', 'soil'),
                'R8_Q2': ('soil8', 'soil'),
                'R16_Q3': ('soil9', 'soil'),
                'R16_Q4': ('soil10', 'soil'),
                'R24_Q5': ('soil11', 'soil'),
                'R24_Q6': ('soil12', 'soil'),
            },
            'GH2': {
                'R8_P1': ('soil1', 'soil'),
                'R8_P2': ('soil2', 'soil'),
                'R8_P3': ('soil3', 'soil'),
                'R24_P4': ('soil4', 'soil'),
                'R24_P5': ('soil5', 'soil'),
                'R24_P6': ('soil6', 'soil'),
                'R16_P8': ('soil13', 'soil'),
            }
        }
    }
    
    context_history = {}
    
    # Fetch PM data
    context_history['pm_GH1'] = get_history_val(SENSOR_GROUPS['pm']['GH1'][0], 
                                                SENSOR_GROUPS['pm']['GH1'][1], 
                                                start_datetime, end_datetime)
    context_history['pm_GH2'] = get_history_val(SENSOR_GROUPS['pm']['GH2'][0], 
                                                SENSOR_GROUPS['pm']['GH2'][1], 
                                                start_datetime, end_datetime)
    context_history['pm_outside'] = get_history_val(SENSOR_GROUPS['pm']['outside'][0], 
                                                    SENSOR_GROUPS['pm']['outside'][1], 
                                                    start_datetime, end_datetime)
    
    # Fetch CO2 data
    context_history['CO2_Farm1'] = get_history_val(SENSOR_GROUPS['co2']['Farm1'][0], 
                                                   SENSOR_GROUPS['co2']['Farm1'][1], 
                                                   start_datetime, end_datetime)
    context_history['CO2_Farm2'] = get_history_val(SENSOR_GROUPS['co2']['Farm2'][0], 
                                                   SENSOR_GROUPS['co2']['Farm2'][1], 
                                                   start_datetime, end_datetime)
    
    # Fetch water data
    context_history['ECWM'] = get_history_val('EC', 'conduct', start_datetime, end_datetime)
    context_history['TempWM'] = get_history_val('EC', 'temp', start_datetime, end_datetime)
    context_history['ECWP'] = get_history_val('EC2', 'conduct', start_datetime, end_datetime)
    context_history['TempWP'] = get_history_val('EC2', 'temp', start_datetime, end_datetime)
    
    # Fetch light sensor data
    for location, sensors in SENSOR_GROUPS['light'].items():
        for sensor_type, (sensor_id, value_key) in sensors.items():
            key = f'{sensor_type}_{location}'
            context_history[key] = get_history_val(sensor_id, value_key, start_datetime, end_datetime)
    
    # Fetch PPFD data
    for gh in ['GH1', 'GH2']:
        for zone, (sensor_id, value_key) in SENSOR_GROUPS['ppfd'][gh].items():
            key = f'ppfd_{gh}_{zone}'
            context_history[key] = get_history_val(sensor_id, value_key, start_datetime, end_datetime)
    
    # Fetch NPK data for both greenhouses
    for gh in ['GH1', 'GH2']:
        for zone, (sensor_id, nutrients) in SENSOR_GROUPS['npk'][gh].items():
            for nutrient in nutrients:
                if nutrient == 'temperature':
                    key = f'temp_npk_{gh}_{zone}'
                else:
                    key = f'{nutrient}_{gh}_{zone}'
                context_history[key] = get_history_val(sensor_id, nutrient, start_datetime, end_datetime)
    
    # Fetch air temperature and humidity
    for gh in ['GH1', 'GH2']:
        for zone, (sensor_id, measurements) in SENSOR_GROUPS['air'][gh].items():
            for measurement in measurements:
                if measurement == 'Temp':
                    key = f'airTemp_{gh}_{zone}'
                else:  # Hum
                    key = f'airHum_{gh}_{zone}'
                context_history[key] = get_history_val(sensor_id, measurement, start_datetime, end_datetime)
    
    # Fetch soil moisture data
    for gh in ['GH1', 'GH2']:
        for location, (sensor_id, value_key) in SENSOR_GROUPS['soil'][gh].items():
            key = f'soil_{gh}_{location}'
            context_history[key] = get_history_val(sensor_id, value_key, start_datetime, end_datetime)
    
    return context_history