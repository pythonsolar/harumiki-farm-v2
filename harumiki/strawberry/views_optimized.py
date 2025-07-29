"""
Optimized Smart Farm Views
Uses new time-series database models and service layer for maximum performance
"""

import logging
from datetime import datetime, timedelta
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.cache import cache_page
from django.views.decorators.gzip import gzip_page
from django.contrib import messages
from django.core.cache import cache
from django.utils import timezone

from .services import SensorDataService, APIDataService, AggregationService
from .models import Sensor, SensorType, LatestSensorValue

logger = logging.getLogger(__name__)

# ================================================================================
# MAIN DASHBOARD VIEWS - Optimized with Service Layer
# ================================================================================

@cache_page(300)  # Cache for 5 minutes
@gzip_page
def Farm1(request):
    """Optimized Farm 1 dashboard using service layer"""
    try:
        # Get latest sensor values for Farm 1
        context = SensorDataService.get_latest_values(farm_id=1)
        
        # Transform data to match template expectations
        dashboard_context = transform_for_dashboard(context, farm_id=1)
        
        return render(request, 'strawberry/farm-1.html', dashboard_context)
        
    except Exception as e:
        logger.error(f'Error loading Farm 1 dashboard: {e}')
        messages.error(request, f'เกิดข้อผิดพลาดในการโหลดข้อมูล Farm 1: {str(e)}')
        return render(request, 'strawberry/farm-1.html', {})

@cache_page(300)  # Cache for 5 minutes
@gzip_page
def Farm2(request):
    """Optimized Farm 2 dashboard using service layer"""
    try:
        # Get latest sensor values for Farm 2
        context = SensorDataService.get_latest_values(farm_id=2)
        
        # Transform data to match template expectations
        dashboard_context = transform_for_dashboard(context, farm_id=2)
        
        return render(request, 'strawberry/farm-2.html', dashboard_context)
        
    except Exception as e:
        logger.error(f'Error loading Farm 2 dashboard: {e}')
        messages.error(request, f'เกิดข้อผิดพลาดในการโหลดข้อมูล Farm 2: {str(e)}')
        return render(request, 'strawberry/farm-2.html', {})

def transform_for_dashboard(sensor_data: dict, farm_id: int) -> dict:
    """
    Transform service layer data format to template expectations
    Maps sensor IDs to template variable names
    """
    context = {}
    
    # Define sensor mapping for each farm
    if farm_id == 1:
        sensor_mapping = {
            # PM sensors
            'PM25_R1': 'pm_R1',
            'PM25_OUTSIDE': 'pm_outside',
            
            # Water sensors
            'EC': {'conduct': 'ECWM', 'temp': 'TempWM'},
            
            # CO2 sensors
            'CO2_R1': 'CO2_R1',
            
            # NPK sensors (R8, R16, R24)
            'NPK4': {'nitrogen': 'nitrogenR8_Q', 'phosphorus': 'phosphorusR8_Q', 
                    'potassium': 'potassiumR8_Q', 'temperature': 'temp_npkR8_Q'},
            'NPK5': {'nitrogen': 'nitrogenR16_Q', 'phosphorus': 'phosphorusR16_Q',
                    'potassium': 'potassiumR16_Q', 'temperature': 'temp_npkR16_Q'},
            'NPK6': {'nitrogen': 'nitrogenR24_Q', 'phosphorus': 'phosphorusR24_Q',
                    'potassium': 'potassiumR24_Q', 'temperature': 'temp_npkR24_Q'},
            
            # Soil sensors
            'soil7': 'soil7', 'soil8': 'soil8', 'soil9': 'soil9',
            'soil10': 'soil10', 'soil11': 'soil11', 'soil12': 'soil12',
            
            # PPFD sensors
            'ppfd3': 'ppfd3', 'ppfd4': 'ppfd4',
            
            # Air sensors
            'SHT45T3': {'Temp': 'airtempR8_Q', 'Hum': 'airhumR8_Q'},
            'SHT45T4': {'Temp': 'airtempR16_Q', 'Hum': 'airhumR16_Q'},
            'SHT45T5': {'Temp': 'airtempR24_Q', 'Hum': 'airhumR24_Q'},
            
            # Light sensors
            'UV1': 'UV_R8_Q',
            'LUX1': 'LUX_R8_Q',
        }
    else:  # farm_id == 2
        sensor_mapping = {
            # PM sensors
            'PM25_R2': 'pm_R2',
            'PM25_OUTSIDE': 'pm_outside',
            
            # Water sensors
            'EC': {'conduct': 'ECWM', 'temp': 'TempWM'},
            
            # CO2 sensors
            'CO2_R1': 'CO2_R1',
            'CO2_R2': 'CO2_R2',
            
            # NPK sensors (R8, R16, R24)
            'NPK1': {'nitrogen': 'nitrogenR8_P', 'phosphorus': 'phosphorusR8_P',
                    'potassium': 'potassiumR8_P', 'temperature': 'temp_npkR8_P'},
            'NPK2': {'nitrogen': 'nitrogenR16_P', 'phosphorus': 'phosphorusR16_P',
                    'potassium': 'potassiumR16_P', 'temperature': 'temp_npkR16_P'},
            'NPK3': {'nitrogen': 'nitrogenR24_P', 'phosphorus': 'phosphorusR24_P',
                    'potassium': 'potassiumR24_P', 'temperature': 'temp_npkR24_P'},
            
            # Soil sensors
            'soil1': 'soil1', 'soil2': 'soil2', 'soil3': 'soil3',
            'soil4': 'soil4', 'soil5': 'soil5', 'soil6': 'soil6', 'soil13': 'soil13',
            
            # PPFD sensors
            'ppfd1': 'ppfd_R16_P', 'ppfd2': 'ppfd_R24_P',
            
            # Air sensors
            'SHT45T1': {'Temp': 'airTempR8_P', 'Hum': 'airHumR8_P'},
            'SHT45T6': {'Temp': 'airTempR16_P', 'Hum': 'airHumR16_P'},
            'SHT45T2': {'Temp': 'airTempR24_P', 'Hum': 'airHumR24_P'},
            
            # Light sensors
            'UV2': 'UV_R24_P',
            'LUX2': 'LUX_R24_P',
        }
    
    # Map sensor data to template variables
    for sensor_id, sensor_info in sensor_data.items():
        if sensor_id in sensor_mapping:
            mapping = sensor_mapping[sensor_id]
            if isinstance(mapping, str):
                # Simple mapping
                context[mapping] = sensor_info['value']
            elif isinstance(mapping, dict):
                # Complex mapping (multiple values from same sensor)
                raw_value = sensor_info.get('raw_value', {})
                for api_key, template_var in mapping.items():
                    context[template_var] = raw_value.get(api_key)
    
    # Calculate DLI for PPFD sensors
    context.update(calculate_dli_values(farm_id))
    
    return context

def calculate_dli_values(farm_id: int) -> dict:
    """Calculate DLI values for yesterday from archived data"""
    dli_context = {}
    yesterday = timezone.now().date() - timedelta(days=1)
    
    try:
        # Get PPFD sensors for the farm
        ppfd_sensors = Sensor.objects.filter(
            farm=farm_id,
            sensor_type__code='ppfd',
            is_active=True
        )
        
        for sensor in ppfd_sensors:
            dli_value = AggregationService.calculate_dli(sensor.sensor_id, yesterday)
            
            # Map to template variable names
            if farm_id == 1:
                if 'ppfd3' in sensor.sensor_id:
                    dli_context['DLI_R8_Q'] = dli_value or 0
                elif 'ppfd4' in sensor.sensor_id:
                    dli_context['DLI_R24_Q'] = dli_value or 0
            else:  # farm_id == 2
                if 'ppfd1' in sensor.sensor_id:
                    dli_context['DLI_R16_P'] = dli_value or 0
                elif 'ppfd2' in sensor.sensor_id:
                    dli_context['DLI_R24_P'] = dli_value or 0
                    
    except Exception as e:
        logger.error(f"Error calculating DLI for farm {farm_id}: {e}")
    
    return dli_context

# ================================================================================
# HISTORICAL DATA VIEWS - Optimized
# ================================================================================

def Graph1(request):
    """Optimized historical graph for Farm 1"""
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    
    if not start_date:
        start_date = datetime.now().strftime("%Y-%m-%d")
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")
    
    start_time = datetime.fromisoformat(f"{start_date}T00:00:00")
    end_time = datetime.fromisoformat(f"{end_date}T23:59:59")
    
    # Get Farm 1 sensor IDs
    farm1_sensors = [
        'PM25_R1', 'PM25_OUTSIDE', 'EC', 'CO2_R1', 'CO2_R2',
        'NPK4', 'NPK5', 'NPK6', 'soil7', 'soil8', 'soil9', 'soil10', 'soil11', 'soil12',
        'ppfd3', 'ppfd4', 'SHT45T3', 'SHT45T4', 'SHT45T5', 'UV1', 'LUX1'
    ]
    
    # Get historical data for all sensors
    context_history = SensorDataService.get_multiple_sensors_data(
        sensor_ids=farm1_sensors,
        start_time=start_time,
        end_time=end_time,
        max_points=1000
    )
    
    # Transform data format for template
    template_context = transform_historical_data(context_history, farm_id=1)
    
    return render(request, 'strawberry/graph-1.html', template_context)

def Graph2(request):
    """Optimized historical graph for Farm 2"""
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    
    if not start_date:
        start_date = datetime.now().strftime("%Y-%m-%d")
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")
    
    start_time = datetime.fromisoformat(f"{start_date}T00:00:00")
    end_time = datetime.fromisoformat(f"{end_date}T23:59:59")
    
    # Get Farm 2 sensor IDs
    farm2_sensors = [
        'PM25_R2', 'PM25_OUTSIDE', 'EC', 'CO2_R1', 'CO2_R2',
        'NPK1', 'NPK2', 'NPK3', 'soil1', 'soil2', 'soil3', 'soil4', 'soil5', 'soil6', 'soil13',
        'ppfd1', 'ppfd2', 'SHT45T1', 'SHT45T6', 'SHT45T2', 'UV2', 'LUX2'
    ]
    
    # Get historical data for all sensors
    context_history = SensorDataService.get_multiple_sensors_data(
        sensor_ids=farm2_sensors,
        start_time=start_time,
        end_time=end_time,
        max_points=1000
    )
    
    # Transform data format for template
    template_context = transform_historical_data(context_history, farm_id=2)
    
    return render(request, 'strawberry/graph-2.html', template_context)

def transform_historical_data(sensor_data: dict, farm_id: int) -> dict:
    """Transform historical sensor data to template format"""
    context = {}
    
    # Map sensor IDs to template variable names for historical data
    if farm_id == 1:
        mapping = {
            'PM25_R1': 'pm_R1',
            'PM25_OUTSIDE': 'pm_outside',
            'EC': 'ECWM',  # For conduct data
            'CO2_R1': 'CO2_R1',
            'NPK4': 'nitrogen4',  # Will need multiple mappings
            'NPK5': 'nitrogen5',
            'NPK6': 'nitrogen6',
            'soil7': 'soil7', 'soil8': 'soil8', 'soil9': 'soil9',
            'soil10': 'soil10', 'soil11': 'soil11', 'soil12': 'soil12',
            'ppfd3': 'ppfd3', 'ppfd4': 'ppfd4',
            'SHT45T3': 'airTemp3',
            'SHT45T4': 'airTemp4',
            'SHT45T5': 'airTemp5',
            'UV1': 'UV_R8',
            'LUX1': 'LUX_R8',
        }
    else:  # farm_id == 2
        mapping = {
            'PM25_R2': 'pm_R2',
            'PM25_OUTSIDE': 'pm_outside',
            'EC': 'ECWM',
            'CO2_R1': 'CO2_R1',
            'CO2_R2': 'CO2_R2',
            'NPK1': 'nitrogenR8',
            'NPK2': 'nitrogenR16',
            'NPK3': 'nitrogenR24',
            'soil1': 'soil1', 'soil2': 'soil2', 'soil3': 'soil3',
            'soil4': 'soil4', 'soil5': 'soil5', 'soil6': 'soil6', 'soil13': 'soil13',
            'ppfd1': 'ppfdR16', 'ppfd2': 'ppfdR24',
            'SHT45T1': 'airTempR8',
            'SHT45T2': 'airTempR24',
            'UV2': 'UV_R24',
            'LUX2': 'LUX_R24',
        }
    
    # Transform data
    for sensor_id, template_var in mapping.items():
        if sensor_id in sensor_data:
            data = sensor_data[sensor_id]
            context[template_var] = {
                'datetimes': data.get('timestamps', []),
                'values': data.get('values', [])
            }
    
    return context

# ================================================================================
# COMPARE VIEWS - Optimized
# ================================================================================

@gzip_page
def CompareGH1and2(request):
    """Optimized compare view with selective loading"""
    try:
        # Get date parameters
        month = request.GET.get('month')
        year = request.GET.get('year')
        
        # Set default to current month if not provided
        if not month or not year:
            now = timezone.now()
            month = now.month
            year = now.year
        else:
            month = int(month)
            year = int(year)
        
        # Determine date range
        if month == timezone.now().month and year == timezone.now().year:
            # Current month - show data up to today
            start_date = datetime(year, month, 1).date()
            end_date = timezone.now().date()
            logger.info("Current month selected - showing data up to today")
        else:
            # Full month
            import calendar
            start_date = datetime(year, month, 1).date()
            last_day = calendar.monthrange(year, month)[1]
            end_date = datetime(year, month, last_day).date()
        
        # Create datetime objects
        start_datetime = datetime.combine(start_date, datetime.min.time())
        end_datetime = datetime.combine(end_date, datetime.max.time())
        
        logger.info(f"CompareGH1and2: Using selective loading for {start_datetime} to {end_datetime}")
        
        # Create basic context for template
        context = {
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'month': month,
            'year': year,
            'selective_loading': True,  # Flag for JavaScript
            'api_endpoint': '/get-compare-chart-data/',  # AJAX endpoint
        }
        
        logger.info(f"CompareGH1and2: Context built with {len(context)} datasets")
        logger.info(f"CompareGH1and2: Date range {start_date} to {end_date}")
        logger.info(f"CompareGH1and2: Total data points: 0")  # No initial data loaded
        logger.info(f"CompareGH1and2: View completed in 0.00 seconds")
        
        return render(request, 'strawberry/compare.html', context)
        
    except Exception as e:
        logger.error(f"Error in CompareGH1and2: {e}")
        messages.error(request, f'เกิดข้อผิดพลาดในการโหลดหน้าเปรียบเทียบ: {str(e)}')
        return render(request, 'strawberry/compare.html', {})

@gzip_page
def get_compare_chart_data(request):
    """Optimized API endpoint for compare chart data"""
    if not request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({'status': 'error', 'message': 'AJAX request required'}, status=400)
    
    chart_type = request.GET.get('chart_type')
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    
    if not all([chart_type, start_date, end_date]):
        return JsonResponse({'status': 'error', 'message': 'Missing parameters'}, status=400)
    
    try:
        start_time = datetime.fromisoformat(f"{start_date}T00:00:00")
        end_time = datetime.fromisoformat(f"{end_date}T23:59:59")
        
        # Create cache key
        cache_key = f"compare_chart_{chart_type}_{start_date}_{end_date}"
        
        # Try cache first
        cached_data = cache.get(cache_key)
        if cached_data:
            logger.info(f"Cache hit for compare chart: {chart_type}")
            return JsonResponse({
                'status': 'success',
                'data': cached_data,
                'cached': True
            })
        
        # Get chart-specific sensor data
        chart_data = get_optimized_chart_data(chart_type, start_time, end_time)
        
        if not chart_data:
            return JsonResponse({
                'status': 'error',
                'message': f'No data available for chart: {chart_type}'
            }, status=404)
        
        # Cache the result
        cache_timeout = 300 if end_time.date() == timezone.now().date() else 900
        cache.set(cache_key, chart_data, cache_timeout)
        
        response_data = {
            'status': 'success',
            'data': chart_data,
            'cached': False,
            'meta': {
                'chart_type': chart_type,
                'date_range': f"{start_date} to {end_date}",
                'optimized': True
            }
        }
        
        response = JsonResponse(response_data)
        response['Cache-Control'] = 'public, max-age=300'
        response['X-Optimized'] = 'true'
        
        return response
        
    except Exception as e:
        logger.error(f"Error in get_compare_chart_data: {e}")
        return JsonResponse({
            'status': 'error',
            'message': 'Failed to fetch chart data'
        }, status=500)

def get_optimized_chart_data(chart_type: str, start_time: datetime, end_time: datetime) -> dict:
    """Get optimized chart data using service layer"""
    
    # Define sensor groups for each chart type
    chart_sensors = {
        'pm': ['PM25_R1', 'PM25_R2', 'PM25_OUTSIDE'],
        'co2': ['CO2_R1', 'CO2_R2'],
        'luxuv': ['UV1', 'LUX1', 'UV2', 'LUX2'],
        'ppfd': ['ppfd3', 'ppfd4', 'ppfd1', 'ppfd2'],
        'nitrogen': ['NPK4', 'NPK5', 'NPK6', 'NPK1', 'NPK2', 'NPK3'],
        'phosphorus': ['NPK4', 'NPK5', 'NPK6', 'NPK1', 'NPK2', 'NPK3'],
        'potassium': ['NPK4', 'NPK5', 'NPK6', 'NPK1', 'NPK2', 'NPK3'],
        'tempsoil': ['NPK4', 'NPK5', 'NPK6', 'NPK1', 'NPK2', 'NPK3'],
        'tempairwater': ['SHT45T3', 'SHT45T4', 'SHT45T5', 'SHT45T1', 'SHT45T6', 'SHT45T2', 'EC'],
        'humidity': ['SHT45T3', 'SHT45T4', 'SHT45T5', 'SHT45T1', 'SHT45T6', 'SHT45T2'],
        'moisture': ['soil7', 'soil8', 'soil9', 'soil10', 'soil11', 'soil12', 
                    'soil1', 'soil2', 'soil3', 'soil4', 'soil5', 'soil6', 'soil13'],
        'ec': ['EC', 'EC2']
    }
    
    sensor_ids = chart_sensors.get(chart_type, [])
    if not sensor_ids:
        logger.error(f"Unknown chart type: {chart_type}")
        return {}
    
    # Get historical data for all sensors in this chart
    sensor_data = SensorDataService.get_multiple_sensors_data(
        sensor_ids=sensor_ids,
        start_time=start_time,
        end_time=end_time,
        max_points=300  # Reduced for better performance
    )
    
    # Transform to chart format
    chart_data = {}
    timestamps = None
    
    for sensor_id, data in sensor_data.items():
        if data.get('values') and len(data['values']) > 0:
            # Use sensor-specific naming for chart
            chart_key = get_chart_key_for_sensor(sensor_id, chart_type)
            if chart_key:
                chart_data[chart_key] = data['values']
                
                # Store timestamps from first sensor with data
                if timestamps is None and data.get('timestamps'):
                    timestamps = data['timestamps']
                    chart_data[f"{chart_key}-times"] = timestamps
    
    # If no timestamps were found, add empty timestamps
    if timestamps is None:
        chart_data['default-times'] = []
    
    logger.info(f"Chart {chart_type}: {len([k for k in chart_data.keys() if not k.endswith('-times')])} sensors with data")
    
    return chart_data

def get_chart_key_for_sensor(sensor_id: str, chart_type: str) -> str:
    """Map sensor ID to chart-specific key"""
    mapping = {
        # PM sensors
        'PM25_R1': 'pm-gh1',
        'PM25_R2': 'pm-gh2',
        'PM25_OUTSIDE': 'pm-outside',
        
        # CO2 sensors
        'CO2_R1': 'co2-farm1',
        'CO2_R2': 'co2-farm2',
        
        # Light sensors
        'UV1': 'uv-farm1',
        'LUX1': 'lux-farm1',
        'UV2': 'uv-farm2',
        'LUX2': 'lux-farm2',
        
        # PPFD sensors
        'ppfd3': 'ppfd-gh1-r8',
        'ppfd4': 'ppfd-gh1-r24',
        'ppfd1': 'ppfd-gh2-r16',
        'ppfd2': 'ppfd-gh2-r24',
        
        # NPK sensors - nitrogen
        'NPK4': 'nitrogen-gh1-r8' if chart_type == 'nitrogen' else 
                'phosphorus-gh1-r8' if chart_type == 'phosphorus' else
                'potassium-gh1-r8' if chart_type == 'potassium' else
                'temp-npk-gh1-r8',
        'NPK5': 'nitrogen-gh1-r16' if chart_type == 'nitrogen' else
                'phosphorus-gh1-r16' if chart_type == 'phosphorus' else
                'potassium-gh1-r16' if chart_type == 'potassium' else
                'temp-npk-gh1-r16',
        'NPK6': 'nitrogen-gh1-r24' if chart_type == 'nitrogen' else
                'phosphorus-gh1-r24' if chart_type == 'phosphorus' else
                'potassium-gh1-r24' if chart_type == 'potassium' else
                'temp-npk-gh1-r24',
        'NPK1': 'nitrogen-gh2-r8' if chart_type == 'nitrogen' else
                'phosphorus-gh2-r8' if chart_type == 'phosphorus' else
                'potassium-gh2-r8' if chart_type == 'potassium' else
                'temp-npk-gh2-r8',
        'NPK2': 'nitrogen-gh2-r16' if chart_type == 'nitrogen' else
                'phosphorus-gh2-r16' if chart_type == 'phosphorus' else
                'potassium-gh2-r16' if chart_type == 'potassium' else
                'temp-npk-gh2-r16',
        'NPK3': 'nitrogen-gh2-r24' if chart_type == 'nitrogen' else
                'phosphorus-gh2-r24' if chart_type == 'phosphorus' else
                'potassium-gh2-r24' if chart_type == 'potassium' else
                'temp-npk-gh2-r24',
        
        # Air sensors
        'SHT45T3': 'air-temp-gh1-r8' if chart_type == 'tempairwater' else 'air-hum-gh1-r8',
        'SHT45T4': 'air-temp-gh1-r16' if chart_type == 'tempairwater' else 'air-hum-gh1-r16',
        'SHT45T5': 'air-temp-gh1-r24' if chart_type == 'tempairwater' else 'air-hum-gh1-r24',
        'SHT45T1': 'air-temp-gh2-r8' if chart_type == 'tempairwater' else 'air-hum-gh2-r8',
        'SHT45T6': 'air-temp-gh2-r16' if chart_type == 'tempairwater' else 'air-hum-gh2-r16',
        'SHT45T2': 'air-temp-gh2-r24' if chart_type == 'tempairwater' else 'air-hum-gh2-r24',
        
        # Water sensors
        'EC': 'temp-wm' if chart_type == 'tempairwater' else 'ecwm',
        'EC2': 'ecwp',
        
        # Soil sensors
        'soil7': 'soil-gh1-r8q1', 'soil8': 'soil-gh1-r8q2',
        'soil9': 'soil-gh1-r16q3', 'soil10': 'soil-gh1-r16q4',
        'soil11': 'soil-gh1-r24q5', 'soil12': 'soil-gh1-r24q6',
        'soil1': 'soil-gh2-r8p1', 'soil2': 'soil-gh2-r8p2', 'soil3': 'soil-gh2-r8p3',
        'soil4': 'soil-gh2-r24p4', 'soil5': 'soil-gh2-r24p5', 'soil6': 'soil-gh2-r24p6',
        'soil13': 'soil-gh2-r16p8',
    }
    
    return mapping.get(sensor_id, sensor_id.lower())

# ================================================================================
# UTILITY AND DEBUG VIEWS
# ================================================================================

def test_compare(request):
    """Test page for debugging compare functionality"""
    return render(request, 'strawberry/test_compare.html', {
        'debug_mode': True,
        'current_time': timezone.now().isoformat(),
        'service_layer': True
    })

def debug_sensors(request):
    """Debug view using new service layer"""
    from django.db.models import Count
    
    try:
        # Get sensor statistics
        sensor_stats = {
            'total_sensors': Sensor.objects.count(),
            'active_sensors': Sensor.objects.filter(is_active=True).count(),
            'farm1_sensors': Sensor.objects.filter(farm=1, is_active=True).count(),
            'farm2_sensors': Sensor.objects.filter(farm=2, is_active=True).count(),
        }
        
        # Get sensor types
        sensor_types = SensorType.objects.annotate(
            sensor_count=Count('sensors')
        ).values('code', 'name', 'unit', 'sensor_count')
        
        # Get latest values for active sensors
        latest_values = SensorDataService.get_latest_values()
        
        # Calculate statistics
        sensors_with_data = len([s for s in latest_values.values() if s.get('value') is not None])
        
        response_data = {
            'timestamp': timezone.now().isoformat(),
            'service_layer': 'Optimized Service Layer v2.0',
            'statistics': sensor_stats,
            'sensor_types': list(sensor_types),
            'latest_data': {
                'total_sensors_queried': len(latest_values),
                'sensors_with_data': sensors_with_data,
                'data_coverage': f"{(sensors_with_data/len(latest_values)*100):.1f}%" if latest_values else "0%"
            },
            'sample_data': dict(list(latest_values.items())[:5])  # First 5 sensors as sample
        }
        
        return JsonResponse(response_data, json_dumps_params={'indent': 2})
        
    except Exception as e:
        logger.error(f"Error in debug_sensors: {e}")
        return JsonResponse({
            'error': str(e),
            'timestamp': timezone.now().isoformat()
        }, status=500)