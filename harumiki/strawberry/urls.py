# ===== strawberry/urls.py (App URLs) =====
from django.urls import path
from . import views

urlpatterns = [
    path('', views.Farm1, name='farm-1'),
    path('farm-2/', views.Farm2, name='farm-2'),
    path('graph-1/', views.Graph1, name='graph-1'),
    path('graph-2/', views.Graph2, name='graph-2'),
    path('graph-all1/', views.Graph_all1, name='graph-all1'),
    path('graph-all2/', views.Graph_all2, name='graph-all2'),

    path('export/', views.Download_csv, name='export'),
    path('export/process/', views.export, name='export_process'),
    path('export/multiple/', views.export_multiple, name='export_multiple'),
    path('export/by-farm/', views.export_by_farm, name='export_by_farm'),

    path('smartfarm-1/', views.SmartFarmR1, name='smartfarm-1'), 
    path('smartfarm-2/', views.SmartFarmR2, name='smartfarm-2'),

    path('compare/',views.CompareGH1and2,name="GH1and2"),
]