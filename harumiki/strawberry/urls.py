"""
Strawberry App URL Configuration
Smart Farm monitoring and data visualization routes
"""
from django.urls import path
from . import views

# Note: app_name removed to maintain compatibility with existing templates
# If adding namespace in future, update all {% url %} tags in templates

urlpatterns = [
    # Dashboard Views
    path('', views.Farm1, name='farm-1'),
    path('farm-2/', views.Farm2, name='farm-2'),
    
    # Graph Views
    path('graph-1/', views.Graph1, name='graph-1'),
    path('graph-2/', views.Graph2, name='graph-2'),
    path('graph-all1/', views.Graph_all1, name='graph-all1'),
    path('graph-all2/', views.Graph_all2, name='graph-all2'),
    
    # Export Views
    path('export/', views.Download_csv, name='export'),
    path('export/process/', views.export, name='export_process'),
    path('export/multiple/', views.export_multiple, name='export_multiple'),
    path('export/by-farm/', views.export_by_farm, name='export_by_farm'),
    
    # Visual Dashboard Views
    path('smartfarm-1/', views.SmartFarmR1, name='smartfarm-1'), 
    path('smartfarm-2/', views.SmartFarmR2, name='smartfarm-2'),
    
    # Comparison View
    path('compare/', views.CompareGH1and2, name='compare'),
    
    # API Endpoints
    path('api/compare-chart-data/', views.get_compare_chart_data, name='api_compare_chart_data'),
    
    # Test Pages (for debugging)
    path('test-compare/', views.test_compare, name='test_compare'),

    # เพิ่มใน urls.py
    path('debug-sensors/', views.debug_sensors, name='debug-sensors'),

    path('get-compare-chart-data/', views.get_compare_chart_data, name='get-compare-chart-data'),

    # API endpoints
    path('api/smartfarm/latest/', views.get_latest_sensors_api, name='api-latest-sensors'),
    path('api/co2-data/', views.get_co2_data_api, name='api-co2-data'),
]