/* static/css/graph-all.js */
/**
 * All Sensors Graph Configuration with Debugging
 * Normalized data visualization for Harumiki Smart Farm
 */

// Complete sensor configuration with normalization values
const SENSOR_CONFIG = {
    // Air Quality
    'pm_R1': { max: 100, unit: 'μg/m³', group: 'air', label: 'PM2.5 R1', color: '#FF6384' },
    'pm_R2': { max: 100, unit: 'μg/m³', group: 'air', label: 'PM2.5 R2', color: '#FF5733' },
    'pm_outside': { max: 100, unit: 'μg/m³', group: 'air', label: 'PM2.5 Outside', color: '#FF9F40' },
    'CO2_R1': { max: 1500, unit: 'ppm', group: 'air', label: 'CO2 Farm 1', color: '#4BC0C0' },
    'CO2_R2': { max: 1500, unit: 'ppm', group: 'air', label: 'CO2 Farm 2', color: '#36A2EB' },
    
    // Light
    'UV_R8': { max: 500, unit: 'nm', group: 'light', label: 'UV R8', color: '#9966FF' },
    'UV_R24': { max: 500, unit: 'nm', group: 'light', label: 'UV R24', color: '#8B4513' },
    'LUX_R8': { max: 45000, unit: 'lux', group: 'light', label: 'LUX R8', color: '#FF9F40' },
    'LUX_R24': { max: 45000, unit: 'lux', group: 'light', label: 'LUX R24', color: '#FFD700' },
    'ppfd3': { max: 1000, unit: 'μmol/m²/s', group: 'light', label: 'PPFD R8 (Farm1)', color: '#4BC0C0' },
    'ppfd4': { max: 1000, unit: 'μmol/m²/s', group: 'light', label: 'PPFD R24 (Farm1)', color: '#36A2EB' },
    'ppfdR16': { max: 1000, unit: 'μmol/m²/s', group: 'light', label: 'PPFD R16 (Farm2)', color: '#32CD32' },
    'ppfdR24': { max: 1000, unit: 'μmol/m²/s', group: 'light', label: 'PPFD R24 (Farm2)', color: '#228B22' },
    
    // NPK Nutrients - Farm 1
    'nitrogen4': { max: 100, unit: 'mg/kg', group: 'npk1', label: 'Nitrogen R8 (F1)', color: '#0000FF' },
    'nitrogen5': { max: 100, unit: 'mg/kg', group: 'npk1', label: 'Nitrogen R16 (F1)', color: '#0000CD' },
    'nitrogen6': { max: 100, unit: 'mg/kg', group: 'npk1', label: 'Nitrogen R24 (F1)', color: '#000080' },
    'phosphorus4': { max: 100, unit: 'mg/kg', group: 'npk1', label: 'Phosphorus R8 (F1)', color: '#FFA500' },
    'phosphorus5': { max: 100, unit: 'mg/kg', group: 'npk1', label: 'Phosphorus R16 (F1)', color: '#FF8C00' },
    'phosphorus6': { max: 100, unit: 'mg/kg', group: 'npk1', label: 'Phosphorus R24 (F1)', color: '#FF7F50' },
    'potassium4': { max: 100, unit: 'mg/kg', group: 'npk1', label: 'Potassium R8 (F1)', color: '#FFC0CB' },
    'potassium5': { max: 100, unit: 'mg/kg', group: 'npk1', label: 'Potassium R16 (F1)', color: '#FFB6C1' },
    'potassium6': { max: 100, unit: 'mg/kg', group: 'npk1', label: 'Potassium R24 (F1)', color: '#FF69B4' },
    
    // NPK Nutrients - Farm 2
    'nitrogenR8': { max: 100, unit: 'mg/kg', group: 'npk2', label: 'Nitrogen R8 (F2)', color: '#1E90FF' },
    'nitrogenR16': { max: 100, unit: 'mg/kg', group: 'npk2', label: 'Nitrogen R16 (F2)', color: '#00BFFF' },
    'nitrogenR24': { max: 100, unit: 'mg/kg', group: 'npk2', label: 'Nitrogen R24 (F2)', color: '#87CEEB' },
    'phosphorusR8': { max: 100, unit: 'mg/kg', group: 'npk2', label: 'Phosphorus R8 (F2)', color: '#FFD700' },
    'phosphorusR16': { max: 100, unit: 'mg/kg', group: 'npk2', label: 'Phosphorus R16 (F2)', color: '#F0E68C' },
    'phosphorusR24': { max: 100, unit: 'mg/kg', group: 'npk2', label: 'Phosphorus R24 (F2)', color: '#EEE8AA' },
    'potassiumR8': { max: 100, unit: 'mg/kg', group: 'npk2', label: 'Potassium R8 (F2)', color: '#DDA0DD' },
    'potassiumR16': { max: 100, unit: 'mg/kg', group: 'npk2', label: 'Potassium R16 (F2)', color: '#DA70D6' },
    'potassiumR24': { max: 100, unit: 'mg/kg', group: 'npk2', label: 'Potassium R24 (F2)', color: '#BA55D3' },
    
    // Temperature - Farm 1
    'airTemp3': { max: 100, unit: '°C', group: 'temp1', label: 'Air Temp R8 (F1)', color: '#FF6384' },
    'airTemp4': { max: 100, unit: '°C', group: 'temp1', label: 'Air Temp R16 (F1)', color: '#36A2EB' },
    'airTemp5': { max: 100, unit: '°C', group: 'temp1', label: 'Air Temp R24 (F1)', color: '#FFCE56' },
    'temp_npk4': { max: 100, unit: '°C', group: 'temp1', label: 'Soil Temp R8 (F1)', color: '#4BC0C0' },
    'temp_npk5': { max: 100, unit: '°C', group: 'temp1', label: 'Soil Temp R16 (F1)', color: '#9966FF' },
    'temp_npk6': { max: 100, unit: '°C', group: 'temp1', label: 'Soil Temp R24 (F1)', color: '#FF9F40' },
    
    // Temperature - Farm 2
    'airTempR8': { max: 100, unit: '°C', group: 'temp2', label: 'Air Temp R8 (F2)', color: '#DC143C' },
    'airTempR24': { max: 100, unit: '°C', group: 'temp2', label: 'Air Temp R24 (F2)', color: '#B22222' },
    'temp_npkR8': { max: 100, unit: '°C', group: 'temp2', label: 'Soil Temp R8 (F2)', color: '#FF4500' },
    'temp_npkR16': { max: 100, unit: '°C', group: 'temp2', label: 'Soil Temp R16 (F2)', color: '#FF6347' },
    'temp_npkR24': { max: 100, unit: '°C', group: 'temp2', label: 'Soil Temp R24 (F2)', color: '#FA8072' },
    'TempWM': { max: 100, unit: '°C', group: 'temp2', label: 'Water Temp', color: '#FF69B4' },
    
    // Humidity & Moisture - Farm 1
    'airHum3': { max: 100, unit: '%', group: 'humidity1', label: 'Air Humidity R8 (F1)', color: '#36A2EB' },
    'airHum4': { max: 100, unit: '%', group: 'humidity1', label: 'Air Humidity R16 (F1)', color: '#4BC0C0' },
    'airHum5': { max: 100, unit: '%', group: 'humidity1', label: 'Air Humidity R24 (F1)', color: '#00CED1' },
    'soil7': { max: 100, unit: '%', group: 'humidity1', label: 'Soil R8 End (F1)', color: '#9966FF' },
    'soil8': { max: 100, unit: '%', group: 'humidity1', label: 'Soil R8 Start (F1)', color: '#8A2BE2' },
    'soil9': { max: 100, unit: '%', group: 'humidity1', label: 'Soil R16 End (F1)', color: '#9400D3' },
    'soil10': { max: 100, unit: '%', group: 'humidity1', label: 'Soil R16 Start (F1)', color: '#8B008B' },
    'soil11': { max: 100, unit: '%', group: 'humidity1', label: 'Soil R24 End (F1)', color: '#800080' },
    'soil12': { max: 100, unit: '%', group: 'humidity1', label: 'Soil R24 Start (F1)', color: '#663399' },
    
    // Humidity & Moisture - Farm 2
    'airHumR8': { max: 100, unit: '%', group: 'humidity2', label: 'Air Humidity R8 (F2)', color: '#5F9EA0' },
    'airHumR24': { max: 100, unit: '%', group: 'humidity2', label: 'Air Humidity R24 (F2)', color: '#4682B4' },
    'soil1': { max: 100, unit: '%', group: 'humidity2', label: 'Soil 1 (F2)', color: '#6495ED' },
    'soil2': { max: 100, unit: '%', group: 'humidity2', label: 'Soil 2 (F2)', color: '#00BFFF' },
    'soil3': { max: 100, unit: '%', group: 'humidity2', label: 'Soil 3 (F2)', color: '#1E90FF' },
    'soil4': { max: 100, unit: '%', group: 'humidity2', label: 'Soil 4 (F2)', color: '#ADD8E6' },
    'soil5': { max: 100, unit: '%', group: 'humidity2', label: 'Soil 5 (F2)', color: '#87CEFA' },
    'soil6': { max: 100, unit: '%', group: 'humidity2', label: 'Soil 6 (F2)', color: '#B0E0E6' },
    'soil13': { max: 100, unit: '%', group: 'humidity2', label: 'Soil 13 (F2)', color: '#AFEEEE' },
    
    // Water Quality
    'ECWM': { max: 1500, unit: 'μS/cm', group: 'water', label: 'EC Mixed Water', color: '#36A2EB' }
};

// Complete data mapping for all sensors
const DATA_MAPPING = {
    // Air Quality
    'pm_R1': 'pm-r1',
    'pm_R2': 'pm-r2',
    'pm_outside': 'pm-outside',
    'CO2_R1': 'co2-r1',
    'CO2_R2': 'co2-r2',
    
    // Light
    'UV_R8': 'uv-r8',
    'UV_R24': 'uv-r24',
    'LUX_R8': 'lux-r8',
    'LUX_R24': 'lux-r24',
    'ppfd3': 'ppfd3',
    'ppfd4': 'ppfd4',
    'ppfdR16': 'ppfd-r16',
    'ppfdR24': 'ppfd-r24',
    
    // NPK - Farm 1
    'nitrogen4': 'nitrogen4',
    'nitrogen5': 'nitrogen5',
    'nitrogen6': 'nitrogen6',
    'phosphorus4': 'phosphorus4',
    'phosphorus5': 'phosphorus5',
    'phosphorus6': 'phosphorus6',
    'potassium4': 'potassium4',
    'potassium5': 'potassium5',
    'potassium6': 'potassium6',
    
    // NPK - Farm 2
    'nitrogenR8': 'nitrogen-r8',
    'nitrogenR16': 'nitrogen-r16',
    'nitrogenR24': 'nitrogen-r24',
    'phosphorusR8': 'phosphorus-r8',
    'phosphorusR16': 'phosphorus-r16',
    'phosphorusR24': 'phosphorus-r24',
    'potassiumR8': 'potassium-r8',
    'potassiumR16': 'potassium-r16',
    'potassiumR24': 'potassium-r24',
    
    // Temperature - Farm 1
    'airTemp3': 'air-temp3',
    'airTemp4': 'air-temp4',
    'airTemp5': 'air-temp5',
    'temp_npk4': 'temp-npk4',
    'temp_npk5': 'temp-npk5',
    'temp_npk6': 'temp-npk6',
    
    // Temperature - Farm 2
    'airTempR8': 'air-temp-r8',
    'airTempR24': 'air-temp-r24',
    'temp_npkR8': 'temp-npk-r8',
    'temp_npkR16': 'temp-npk-r16',
    'temp_npkR24': 'temp-npk-r24',
    'TempWM': 'temp-wm',
    
    // Humidity - Farm 1
    'airHum3': 'air-hum3',
    'airHum4': 'air-hum4',
    'airHum5': 'air-hum5',
    'soil7': 'soil7',
    'soil8': 'soil8',
    'soil9': 'soil9',
    'soil10': 'soil10',
    'soil11': 'soil11',
    'soil12': 'soil12',
    
    // Humidity - Farm 2
    'airHumR8': 'air-hum-r8',
    'airHumR24': 'air-hum-r24',
    'soil1': 'soil1',
    'soil2': 'soil2',
    'soil3': 'soil3',
    'soil4': 'soil4',
    'soil5': 'soil5',
    'soil6': 'soil6',
    'soil13': 'soil13',
    
    // Water
    'ECWM': 'ecwm'
};

// Helper function to get chart data with debugging
function getChartData(dataKey) {
    const element = document.getElementById('chart-data');
    const data = element.getAttribute(`data-${dataKey}`);
    
    if (window.harumikiUtils && window.harumikiUtils.logger) {
        window.harumikiUtils.logger.log(`Getting data for ${dataKey}:`, data);
    }
    
    if (!data || data === 'None' || data === '') {
        if (window.harumikiUtils && window.harumikiUtils.logger) {
            window.harumikiUtils.logger.warn(`No data found for ${dataKey}`);
        }
        return [];
    }
    
    try {
        let cleanData = data.replace(/'/g, '"');
        const parsed = JSON.parse(cleanData);
        if (window.harumikiUtils && window.harumikiUtils.logger) {
            window.harumikiUtils.logger.log(`Parsed data for ${dataKey}:`, parsed);
        }
        return parsed;
    } catch (e) {
        if (window.harumikiUtils && window.harumikiUtils.logger) {
            window.harumikiUtils.logger.error(`Error parsing ${dataKey}:`, e);
        }
        return [];
    }
}

// Global chart instance
let allSensorsChart = null;


// Initialize chart when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (window.harumikiUtils && window.harumikiUtils.logger) {
        window.harumikiUtils.logger.log('DOM loaded, initializing chart...');
    }
    
    initializeChart();
    setupEventListeners();
    populateNormalizationTable();
});

// Main chart initialization
function initializeChart() {
    const ctx = document.getElementById('allSensorsChart').getContext('2d');
    
    // Try different time label sources for Farm 2
    let timeLabels = getChartData('pm-r2-times') || 
                     getChartData('pm-r1-times') || 
                     getChartData('co2-r1-times') ||
                     getChartData('nitrogen-r8-times') ||
                     getChartData('air-temp-r8-times');
    
    if (!timeLabels || timeLabels.length === 0) {
        if (window.harumikiUtils && window.harumikiUtils.logger) {
            window.harumikiUtils.logger.error('No time labels found!');
        }
        // Try to find any datetime attribute
        const element = document.getElementById('chart-data');
        const attributes = element.attributes;
        for (let i = 0; i < attributes.length; i++) {
            if (attributes[i].name.includes('times')) {
                if (window.harumikiUtils && window.harumikiUtils.logger) {
                    window.harumikiUtils.logger.log(`Found time attribute: ${attributes[i].name}`);
                }
                timeLabels = getChartData(attributes[i].name.replace('data-', ''));
                if (timeLabels && timeLabels.length > 0) break;
            }
        }
    }
    
    if (window.harumikiUtils && window.harumikiUtils.logger) {
        window.harumikiUtils.logger.log('Time labels:', timeLabels);
    }
    
    // Prepare datasets
    const datasets = [];
    let dataFound = false;
    
    // Create datasets for each sensor
    Object.entries(SENSOR_CONFIG).forEach(([key, config]) => {
        const dataKey = DATA_MAPPING[key];
        const rawData = getChartData(dataKey);
        
        if (rawData && rawData.length > 0) {
            dataFound = true;
            if (window.harumikiUtils && window.harumikiUtils.logger) {
                window.harumikiUtils.logger.log(`Adding dataset for ${key} (${config.label}) with ${rawData.length} points`);
            }
            
            datasets.push({
                label: config.label,
                data: rawData,
                borderColor: config.color,
                backgroundColor: config.color + '20',
                borderWidth: 2,
                tension: 0.1,
                pointRadius: 0,
                pointHoverRadius: 5,
                hidden: false,
                group: config.group
            });
        } else {
            if (window.harumikiUtils && window.harumikiUtils.logger) {
                window.harumikiUtils.logger.warn(`No data for ${key} (${dataKey})`);
            }
        }
    });
    
    if (!dataFound) {
        if (window.harumikiUtils && window.harumikiUtils.logger) {
            window.harumikiUtils.logger.error('No sensor data found!');
        }
    }
    
    if (window.harumikiUtils && window.harumikiUtils.logger) {
        window.harumikiUtils.logger.log(`Total datasets: ${datasets.length}`);
    }
    
    // Chart configuration
    const chartConfig = {
        type: 'line',
        data: {
            labels: timeLabels || [],
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        padding: 8,
                        font: {
                            size: 10
                        },
                        generateLabels: function(chart) {
                            const original = Chart.defaults.plugins.legend.labels.generateLabels;
                            const labels = original.call(this, chart);
                            
                            // Group labels by sensor group
                            const groups = {};
                            labels.forEach(label => {
                                const dataset = chart.data.datasets[label.datasetIndex];
                                const group = dataset.group || 'other';
                                if (!groups[group]) groups[group] = [];
                                groups[group].push(label);
                            });
                            
                            // Flatten grouped labels
                            const groupedLabels = [];
                            Object.entries(groups).forEach(([group, items]) => {
                                items.forEach(item => {
                                    groupedLabels.push(item);
                                });
                            });
                            
                            return groupedLabels;
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: {
                        size: 13,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 11
                    },
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y;
                            const sensorKey = Object.keys(SENSOR_CONFIG).find(key => 
                                SENSOR_CONFIG[key].label === label
                            );
                            
                            if (sensorKey && SENSOR_CONFIG[sensorKey]) {
                                const config = SENSOR_CONFIG[sensorKey];
                                const originalValue = (value / 100) * config.max;
                                return `${label}: ${value.toFixed(1)}% (${originalValue.toFixed(1)} ${config.unit})`;
                            }
                            
                            return `${label}: ${value.toFixed(1)}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'hour',
                        displayFormats: {
                            hour: 'HH:mm'
                        }
                    },
                    grid: {
                        display: true,
                        drawBorder: false,
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        maxTicksLimit: 12,
                        font: {
                            size: 11
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Normalized Value (%)',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        display: true,
                        drawBorder: false,
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    };
    
    // Create chart instance
    allSensorsChart = new Chart(ctx, chartConfig);
}

// Setup event listeners
function setupEventListeners() {
    // Toggle group buttons
    document.querySelectorAll('.toggle-group').forEach(button => {
        button.addEventListener('click', function() {
            const group = this.dataset.group;
            const isActive = this.classList.contains('active');
            
            // Toggle button state
            this.classList.toggle('active');
            
            // Toggle datasets visibility
            allSensorsChart.data.datasets.forEach((dataset, index) => {
                if (dataset.group === group) {
                    const meta = allSensorsChart.getDatasetMeta(index);
                    meta.hidden = isActive;
                }
            });
            
            allSensorsChart.update();
        });
    });
    
    // Show all button
    document.getElementById('show-all').addEventListener('click', function() {
        allSensorsChart.data.datasets.forEach((dataset, index) => {
            const meta = allSensorsChart.getDatasetMeta(index);
            meta.hidden = false;
        });
        
        document.querySelectorAll('.toggle-group').forEach(btn => {
            btn.classList.add('active');
        });
        
        allSensorsChart.update();
    });
    
    // Hide all button
    document.getElementById('hide-all').addEventListener('click', function() {
        allSensorsChart.data.datasets.forEach((dataset, index) => {
            const meta = allSensorsChart.getDatasetMeta(index);
            meta.hidden = true;
        });
        
        document.querySelectorAll('.toggle-group').forEach(btn => {
            btn.classList.remove('active');
        });
        
        allSensorsChart.update();
    });
    
    // Set all groups active by default
    document.querySelectorAll('.toggle-group').forEach(btn => {
        btn.classList.add('active');
    });
}

// Populate normalization reference table
function populateNormalizationTable() {
    const tbody = document.getElementById('normalization-info');
    if (!tbody) return;
    
    // Group sensors by type
    const groupedSensors = {};
    Object.entries(SENSOR_CONFIG).forEach(([key, config]) => {
        if (!groupedSensors[config.group]) {
            groupedSensors[config.group] = [];
        }
        groupedSensors[config.group].push({ key, ...config });
    });
    
    // Create table rows
    let html = '';
    const groupNames = {
        'air': 'Air Quality',
        'light': 'Light',
        'npk1': 'NPK Farm 1',
        'npk2': 'NPK Farm 2',
        'temp1': 'Temperature Farm 1',
        'temp2': 'Temperature Farm 2',
        'humidity1': 'Humidity Farm 1',
        'humidity2': 'Humidity Farm 2',
        'water': 'Water Quality'
    };
    
    Object.entries(groupedSensors).forEach(([group, sensors]) => {
        sensors.forEach(sensor => {
            const groupName = groupNames[group] || group.charAt(0).toUpperCase() + group.slice(1);
            html += `
                <tr class="sensor-group-${group}">
                    <td><span style="color: ${sensor.color};">●</span> ${sensor.label}</td>
                    <td>${sensor.max}</td>
                    <td>${sensor.unit}</td>
                    <td>${groupName}</td>
                </tr>
            `;
        });
    });
    
    tbody.innerHTML = html;
}

// Utility function to format datetime
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}