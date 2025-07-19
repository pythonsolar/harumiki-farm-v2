#!/usr/bin/env python
"""
Debug script for compare page issues
"""
import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'harumiki.settings')
django.setup()

from datetime import datetime, timedelta
from strawberry.views import get_history_val, update_compare_data
import json

def test_api_connection():
    """Test if API is reachable"""
    print("=== Testing API Connection ===")
    
    # Test with a simple sensor
    end_time = datetime.now()
    start_time = end_time - timedelta(days=1)  # Last 24 hours
    
    start_str = start_time.strftime("%Y-%m-%dT%H:%M:%S")
    end_str = end_time.strftime("%Y-%m-%dT%H:%M:%S")
    
    print(f"Testing date range: {start_str} to {end_str}")
    
    # Test PM sensor
    print("\n--- Testing PM25_R1 sensor ---")
    result = get_history_val('PM25_R1', 'atmos', start_str, end_str)
    print(f"Result type: {type(result)}")
    print(f"Result keys: {result.keys() if isinstance(result, dict) else 'Not a dict'}")
    
    if isinstance(result, dict):
        if 'error' in result:
            print(f"ERROR: {result['error']}")
            return False
        elif 'values' in result and 'datetimes' in result:
            values_len = len(result['values']) if result['values'] else 0
            times_len = len(result['datetimes']) if result['datetimes'] else 0
            print(f"Data found: {values_len} values, {times_len} timestamps")
            
            if values_len > 0:
                print(f"First few values: {result['values'][:5]}")
                print(f"First few times: {result['datetimes'][:3]}")
                return True
            else:
                print("No data in response")
                return False
        else:
            print(f"Unexpected response format: {result}")
            return False
    else:
        print(f"Unexpected response type: {type(result)}")
        return False

def test_compare_data():
    """Test update_compare_data function"""
    print("\n=== Testing Compare Data Function ===")
    
    end_time = datetime.now()
    start_time = end_time - timedelta(days=1)
    
    start_str = start_time.strftime("%Y-%m-%dT%H:%M:%S")
    end_str = end_time.strftime("%Y-%m-%dT%H:%M:%S")
    
    print(f"Fetching compare data for: {start_str} to {end_str}")
    
    try:
        context_data = update_compare_data(start_str, end_str)
        print(f"Context data type: {type(context_data)}")
        print(f"Number of datasets: {len(context_data) if context_data else 0}")
        
        if context_data:
            print("\nDataset summary:")
            for key, value in list(context_data.items())[:5]:  # Show first 5
                if isinstance(value, dict) and 'values' in value:
                    val_count = len(value['values']) if value['values'] else 0
                    print(f"  {key}: {val_count} values")
                else:
                    print(f"  {key}: {type(value)} (unexpected format)")
            
            if len(context_data) > 5:
                print(f"  ... and {len(context_data) - 5} more datasets")
                
            return True
        else:
            print("No context data returned")
            return False
            
    except Exception as e:
        print(f"ERROR in update_compare_data: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_template_data():
    """Test data format for template"""
    print("\n=== Testing Template Data Format ===")
    
    # Test required template variables
    required_vars = [
        'pm_GH1', 'pm_GH2', 'pm_outside',
        'CO2_Farm1', 'CO2_Farm2',
        'UV_FARM1', 'LUX_FARM1',
        'ppfd_GH1_R8', 'nitrogen_GH1_R8'
    ]
    
    end_time = datetime.now()
    start_time = end_time - timedelta(days=1)
    
    start_str = start_time.strftime("%Y-%m-%dT%H:%M:%S")
    end_str = end_time.strftime("%Y-%m-%dT%H:%M:%S")
    
    try:
        context_data = update_compare_data(start_str, end_str)
        
        if not context_data:
            print("No context data available")
            return False
            
        print("Checking required template variables:")
        missing_vars = []
        empty_vars = []
        
        for var in required_vars:
            if var in context_data:
                data = context_data[var]
                if isinstance(data, dict) and 'values' in data:
                    val_count = len(data['values']) if data['values'] else 0
                    if val_count > 0:
                        print(f"  [OK] {var}: {val_count} values")
                    else:
                        print(f"  [WARN] {var}: 0 values")
                        empty_vars.append(var)
                else:
                    print(f"  [ERROR] {var}: Invalid format")
                    missing_vars.append(var)
            else:
                print(f"  [ERROR] {var}: Missing")
                missing_vars.append(var)
        
        if missing_vars:
            print(f"\nMissing variables: {missing_vars}")
        if empty_vars:
            print(f"Empty variables: {empty_vars}")
            
        return len(missing_vars) == 0
        
    except Exception as e:
        print(f"ERROR testing template data: {e}")
        return False

if __name__ == "__main__":
    print("Smart Farm Compare Page Debug Tool")
    print("=" * 50)
    
    success_count = 0
    total_tests = 3
    
    if test_api_connection():
        success_count += 1
        
    if test_compare_data():
        success_count += 1
        
    if test_template_data():
        success_count += 1
    
    print("\n" + "=" * 50)
    print(f"Tests completed: {success_count}/{total_tests} passed")
    
    if success_count == total_tests:
        print("[SUCCESS] All tests passed! The compare page should work.")
    else:
        print("[ERROR] Some tests failed. Check the output above for details.")