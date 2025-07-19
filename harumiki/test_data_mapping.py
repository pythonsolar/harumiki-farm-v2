#!/usr/bin/env python
"""
Test data mapping between backend and frontend
"""
import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'harumiki.settings')
django.setup()

from datetime import datetime, timedelta
from strawberry.views import update_compare_data
import json

def test_data_mapping():
    """Test if data mapping matches template expectations"""
    print("=== Testing Data Mapping ===")
    
    # Test with recent data
    end_time = datetime.now()
    start_time = end_time - timedelta(hours=6)  # Last 6 hours
    
    start_str = start_time.strftime("%Y-%m-%dT%H:%M:%S")
    end_str = end_time.strftime("%Y-%m-%dT%H:%M:%S")
    
    print(f"Testing date range: {start_str} to {end_str}")
    
    try:
        context_data = update_compare_data(start_str, end_str)
        print(f"Total datasets returned: {len(context_data)}")
        
        # Expected template variables from compare.html
        expected_vars = [
            'pm_GH1', 'pm_GH2', 'pm_outside',
            'CO2_Farm1', 'CO2_Farm2',
            'UV_FARM1', 'LUX_FARM1', 'UV_FARM2', 'LUX_FARM2',
            'ppfd_GH1_R8', 'ppfd_GH1_R24', 'ppfd_GH2_R16', 'ppfd_GH2_R24',
            'nitrogen_GH1_R8', 'nitrogen_GH2_R8',
            'temp_npk_GH1_R8', 'airTemp_GH1_R8', 'airHum_GH1_R8',
            'soil_GH1_R8_Q1', 'ECWM', 'ECWP'
        ]
        
        print("\n=== Checking Template Variables ===")
        missing_vars = []
        available_vars = []
        
        for var in expected_vars:
            if var in context_data:
                data = context_data[var]
                if isinstance(data, dict) and 'values' in data and data['values']:
                    val_count = len(data['values'])
                    time_count = len(data.get('datetimes', []))
                    print(f"[OK] {var}: {val_count} values, {time_count} times")
                    available_vars.append(var)
                else:
                    print(f"[WARN] {var}: No values (structure: {type(data)})")
                    missing_vars.append(var)
            else:
                print(f"[MISSING] {var}: Missing from context")
                missing_vars.append(var)
        
        print(f"\n=== Summary ===")
        print(f"Available variables: {len(available_vars)}")
        print(f"Missing/Empty variables: {len(missing_vars)}")
        
        if missing_vars:
            print(f"Missing: {missing_vars}")
        
        # Test specific problematic variables
        print(f"\n=== Testing Key Variables ===")
        test_vars = ['pm_GH1', 'CO2_Farm1', 'ppfd_GH1_R8']
        for var in test_vars:
            if var in context_data:
                data = context_data[var]
                print(f"{var}:")
                print(f"  Type: {type(data)}")
                if isinstance(data, dict):
                    print(f"  Keys: {list(data.keys())}")
                    if 'values' in data:
                        values = data['values']
                        print(f"  Values count: {len(values) if values else 0}")
                        if values:
                            print(f"  First 3 values: {values[:3]}")
                    if 'datetimes' in data:
                        times = data['datetimes']
                        print(f"  Times count: {len(times) if times else 0}")
                        if times:
                            print(f"  First 3 times: {times[:3]}")
                print()
        
        return len(available_vars) > 0
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("Smart Farm Compare Page Data Mapping Test")
    print("=" * 50)
    
    success = test_data_mapping()
    
    print("=" * 50)
    if success:
        print("[SUCCESS] Data mapping test completed successfully")
    else:
        print("[ERROR] Data mapping test failed")