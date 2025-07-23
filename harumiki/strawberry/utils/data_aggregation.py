"""
Data aggregation utilities for optimizing large sensor datasets
"""
import pandas as pd
import numpy as np
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

def determine_aggregation_interval(data_points, date_range_days):
    """
    Determine optimal aggregation interval based on data size and date range
    
    Args:
        data_points (int): Number of data points
        date_range_days (int): Number of days in the date range
    
    Returns:
        int: Aggregation interval in minutes
    """
    # For very short ranges (< 3 days), show more detail
    if date_range_days <= 3:
        if data_points > 2000:
            return 15  # 15 minutes
        else:
            return 5   # 5 minutes
    
    # For weekly view
    elif date_range_days <= 7:
        if data_points > 5000:
            return 30  # 30 minutes
        else:
            return 15  # 15 minutes
    
    # For monthly view (typical case)
    elif date_range_days <= 31:
        if data_points > 10000:
            return 60  # 1 hour
        elif data_points > 5000:
            return 30  # 30 minutes
        else:
            return 15  # 15 minutes
    
    # For longer ranges
    else:
        if data_points > 10000:
            return 120  # 2 hours
        else:
            return 60   # 1 hour

def aggregate_sensor_data(data, interval_minutes=None, date_range_days=None):
    """
    Aggregate sensor data to reduce data points while preserving trends
    
    Args:
        data (dict): Raw sensor data with 'datetimes' and 'values'
        interval_minutes (int): Optional specific aggregation interval
        date_range_days (int): Optional date range to help determine interval
    
    Returns:
        dict: Aggregated data
    """
    if not data or 'values' not in data or 'datetimes' not in data:
        return data
    
    if len(data['values']) == 0:
        return data
    
    # Auto-determine interval if not specified
    if interval_minutes is None:
        if date_range_days is None:
            # Calculate date range from data
            try:
                first_date = pd.to_datetime(data['datetimes'][0])
                last_date = pd.to_datetime(data['datetimes'][-1])
                date_range_days = (last_date - first_date).days + 1
            except:
                date_range_days = 30  # Default to monthly
        
        interval_minutes = determine_aggregation_interval(
            len(data['values']), 
            date_range_days
        )
    
    # Skip aggregation if data is already small
    if len(data['values']) < 500:
        logger.info(f"Skipping aggregation for {len(data['values'])} points")
        return data
    
    try:
        # Create DataFrame
        df = pd.DataFrame({
            'datetime': pd.to_datetime(data['datetimes']),
            'value': data['values']
        })
        
        # Remove duplicates (keep last value for each timestamp)
        df = df.drop_duplicates(subset=['datetime'], keep='last')
        
        # Set datetime as index
        df.set_index('datetime', inplace=True)
        
        # Sort by datetime
        df.sort_index(inplace=True)
        
        # Handle -1 values (missing data) by converting to NaN
        df.loc[df['value'] == -1, 'value'] = np.nan
        
        # Resample data
        resampled = df.resample(f'{interval_minutes}min').agg({
            'value': 'mean'
        })
        
        # Round values to 2 decimal places
        resampled['value'] = resampled['value'].round(2)
        
        # Fill NaN with -1 for consistency
        resampled.fillna(-1, inplace=True)
        
        # Convert back to lists
        aggregated_times = resampled.index.strftime('%Y-%m-%d %H:%M:%S').tolist()
        aggregated_values = resampled['value'].tolist()
        
        logger.info(
            f"Aggregated data from {len(data['values'])} to {len(aggregated_values)} points "
            f"(interval: {interval_minutes} minutes)"
        )
        
        return {
            'datetimes': aggregated_times,
            'values': aggregated_values
        }
        
    except Exception as e:
        logger.error(f"Error aggregating data: {e}")
        # Return original data if aggregation fails
        return data

def calculate_date_range_days(start_datetime, end_datetime):
    """
    Calculate the number of days between two datetime strings
    
    Args:
        start_datetime (str): Start datetime in ISO format
        end_datetime (str): End datetime in ISO format
    
    Returns:
        int: Number of days
    """
    try:
        start = datetime.fromisoformat(start_datetime.replace('T', ' '))
        end = datetime.fromisoformat(end_datetime.replace('T', ' '))
        return (end - start).days + 1
    except:
        return 30  # Default to monthly if parsing fails