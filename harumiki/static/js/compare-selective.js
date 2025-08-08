/**
 * Compare Page Selective Loading System
 * Handles dynamic chart loading for GH1 vs GH2 comparison
 */

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Compare selective loading initialized');
    initializeComparePage();
});

// Global variables
let currentChart = null;
let isLoading = false;

// Chart.js defaults
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 12;

// Color palette
const colors = {
    gh1: '#00BCD4',
    gh2: '#FFC107',
    outside: '#E91E63',
    farm1: '#00BCD4',
    farm2: '#E91E63',
    grid: 'rgba(0,0,0,0.05)',
    text: '#333'
};

// Common chart options
const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
        mode: 'index',
        intersect: false,
    },
    plugins: {
        legend: {
            display: true,
            position: 'top',
            labels: {
                usePointStyle: true,
                padding: 15,
                font: {
                    size: 12
                },
                generateLabels: function(chart) {
                    console.log('🏷️ Generating labels for chart');
                    
                    // Use default label generation
                    const original = Chart.defaults.plugins.legend.labels.generateLabels;
                    const labels = original.call(this, chart);
                    
                    console.log('📋 Generated labels:', labels);
                    
                    return labels.map((label, index) => {
                        const meta = chart.getDatasetMeta(index);
                        const isHidden = (meta.hidden === true);
                        console.log(`🏷️ Label ${index}: ${label.text}, hidden: ${meta.hidden}, isHidden: ${isHidden}`);
                        
                        // Style based on visibility (null/false = visible, true = hidden)
                        if (isHidden) {
                            label.fillStyle = '#ccc';
                            label.strokeStyle = '#ccc';
                        }
                        return label;
                    });
                }
            },
            onClick: null, // Disable Chart.js default onClick - use manual detection instead
            onHover: function(e, legendItem, legend) {
                // Change cursor to pointer on hover
                legend.chart.canvas.style.cursor = 'pointer';
            },
            onLeave: function(e, legendItem, legend) {
                // Reset cursor when leaving
                legend.chart.canvas.style.cursor = 'default';
            }
        },
        tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 12,
            cornerRadius: 8,
            titleFont: {
                size: 13,
                weight: 'bold'
            },
            bodyFont: {
                size: 12
            }
        }
    },
    scales: {
        x: {
            type: 'category',
            grid: {
                display: true,
                color: colors.grid
            },
            ticks: {
                color: colors.text,
                maxTicksLimit: 15,
                callback: function(value, index, values) {
                    const label = this.getLabelForValue(value);
                    if (!label || typeof label !== 'string') return '';
                    
                    // For datetime strings, show only date part
                    if (label.includes(' ')) {
                        const datePart = label.split(' ')[0];
                        try {
                            const date = new Date(datePart);
                            const day = date.getDate();
                            const month = date.getMonth() + 1;
                            
                            // Show only every few days to avoid crowding
                            if (index === 0 || index === values.length - 1 || day % 3 === 1) {
                                return `${day}/${month}`;
                            }
                        } catch (e) {
                            return '';
                        }
                    }
                    return '';
                }
            }
        },
        y: {
            beginAtZero: true,
            grid: {
                display: true,
                color: colors.grid
            },
            ticks: {
                color: colors.text
            }
        }
    }
};

// Initialize the compare page
function initializeComparePage() {
    const chartSelect = document.getElementById('chartSelect');
    const loadChartBtn = document.getElementById('loadChartBtn');
    const refreshChartBtn = document.getElementById('refreshChartBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    
    // Enable/disable load button based on selection
    if (chartSelect) {
        chartSelect.addEventListener('change', function() {
            loadChartBtn.disabled = !this.value;
        });
    }
    
    // Load chart button
    if (loadChartBtn) {
        loadChartBtn.addEventListener('click', function() {
            const chartType = chartSelect.value;
            if (chartType && !isLoading) {
                loadSelectedChart(chartType);
            }
        });
    }
    
    // Refresh chart button
    if (refreshChartBtn) {
        refreshChartBtn.addEventListener('click', function() {
            const chartType = chartSelect.value;
            if (chartType && !isLoading) {
                loadSelectedChart(chartType);
            }
        });
    }
    
    // Fullscreen button
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }
}

// Load selected chart via AJAX
async function loadSelectedChart(chartType) {
    if (isLoading) return;
    
    isLoading = true;
    
    // Update UI
    const loadBtn = document.getElementById('loadChartBtn');
    const refreshBtn = document.getElementById('refreshChartBtn');
    const chartSection = document.getElementById('chartDisplaySection');
    const chartBody = document.getElementById('dynamicChartBody');
    const chartTitle = document.getElementById('chartTitle');
    const chartSelect = document.getElementById('chartSelect');
    
    // Get selected option's title
    const selectedOption = chartSelect.options[chartSelect.selectedIndex];
    const chartDisplayTitle = selectedOption.getAttribute('data-title') || selectedOption.text;
    
    // Show loading state
    loadBtn.querySelector('.btn-text').classList.add('d-none');
    loadBtn.querySelector('.btn-loading').classList.remove('d-none');
    loadBtn.disabled = true;
    refreshBtn.disabled = true;
    
    // Show chart section if hidden
    if (chartSection.style.display === 'none') {
        chartSection.style.display = 'block';
        setTimeout(() => chartSection.classList.add('show'), 10);
    }
    
    // Clear previous chart
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
    
    // Show loading in chart body
    chartBody.innerHTML = `
        <div class="dynamic-loading">
            <div class="spinner-border" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <div class="dynamic-loading-text">Loading ${chartDisplayTitle} data...</div>
        </div>
    `;
    
    // Update title
    chartTitle.textContent = chartDisplayTitle;
    
    try {
        // Get date range from data attributes
        const chartDataEl = document.getElementById('chart-data');
        const dateRange = chartDataEl.getAttribute('data-date-range').split('|');
        const month = parseInt(chartDataEl.getAttribute('data-month')) + 1; // Convert to 1-based
        const year = chartDataEl.getAttribute('data-year');
        
        // Build API URL
        const params = new URLSearchParams({
            chart_type: chartType,
            month: month,
            year: year,
            start_date: dateRange[0],
            end_date: dateRange[1]
        });
        
        const url = `/get-compare-chart-data/?${params.toString()}`;
        
        console.log(`📊 Loading chart: ${chartType} from ${url}`);
        
        // Fetch data
        const response = await fetch(url, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.status === 'success' && result.data) {
            console.log(`✅ Data received for ${chartType}:`, result.meta);
            renderChart(chartType, result.data, chartDisplayTitle);
        } else {
            throw new Error(result.message || 'No data available');
        }
        
    } catch (error) {
        console.error(`❌ Error loading chart:`, error);
        
        // Show error message
        chartBody.innerHTML = `
            <div class="dynamic-error">
                <i class="bi bi-exclamation-triangle"></i>
                <h4>Failed to load chart</h4>
                <p>${error.message}</p>
                <button class="retry-btn" onclick="loadSelectedChart('${chartType}')">
                    <i class="bi bi-arrow-clockwise"></i> Retry
                </button>
            </div>
        `;
    } finally {
        // Reset loading state
        isLoading = false;
        loadBtn.querySelector('.btn-text').classList.remove('d-none');
        loadBtn.querySelector('.btn-loading').classList.add('d-none');
        loadBtn.disabled = false;
        refreshBtn.disabled = false;
    }
}

// Render chart based on type
function renderChart(chartType, data, title) {
    const chartBody = document.getElementById('dynamicChartBody');
    
    // Create canvas
    chartBody.innerHTML = '<canvas id="dynamicChart"></canvas>';
    const ctx = document.getElementById('dynamicChart').getContext('2d');
    
    // Get chart configuration based on type
    const chartConfig = getChartConfig(chartType, data);
    
    if (!chartConfig) {
        chartBody.innerHTML = `
            <div class="dynamic-error">
                <i class="bi bi-info-circle"></i>
                <h4>No data to display</h4>
                <p>No sensor data available for the selected period</p>
            </div>
        `;
        return;
    }
    
    // Create chart
    currentChart = new Chart(ctx, chartConfig);
    console.log('📈 Chart created:', currentChart.config.type, 'with legend:', currentChart.options.plugins.legend);
    
    // Force enable legend interaction for CO2 chart
    if (chartType === 'co2') {
        console.log('🔧 Setting up CO2 legend interaction');
        const legendContainer = currentChart.legend.legendHitBoxes;
        console.log('📍 Legend hit boxes:', legendContainer);
        
        // Check if Farm2 has valid data for CO2 charts
        const farm2Data = data['co2-farm2'] || [];
        const farm2HasData = farm2Data.some(v => v !== null && v !== -999);
        
        // Add warning message if Farm2 has no data
        if (!farm2HasData) {
            // Use plugin system properly
            const customPlugin = {
                id: 'co2NoDataWarning',
                afterDraw: function(chart) {
                    const chartArea = chart.chartArea;
                    if (!chartArea) return;
                    
                    const centerX = (chartArea.left + chartArea.right) / 2;
                    const topY = chartArea.top + 20;
                    
                    const ctx = chart.ctx;
                    ctx.save();
                    ctx.textAlign = 'center';
                    ctx.font = 'italic 14px Arial';
                    ctx.fillStyle = '#ff6384';
                    ctx.fillText('⚠️ Farm2: No valid CO2 data available', centerX, topY);
                    ctx.restore();
                }
            };
            
            // Register plugin
            Chart.register(customPlugin);
        }
        
        // Remove custom click handler - Chart.js handles legend clicks by default
    }
    
    // Mark as loaded
    chartBody.setAttribute('data-chart-loaded', 'true');
    chartBody.parentElement.classList.add('chart-loaded');
    
    // CO2 toggle buttons removed - using universal legend click instead
    
    // Setup universal legend click detection
    setupUniversalLegendClick();
    
    // Show legend interaction tip
    console.log('💡 Tip: Click on legend items to show/hide chart lines!');
}

// Get chart configuration based on type
function getChartConfig(chartType, data) {
    const configs = {
        'pm': () => createPMChart(data),
        'co2': () => createCO2Chart(data),
        'luxuv': () => createLuxUVChart(data),
        'ppfd': () => createPPFDChart(data),
        'nitrogen': () => createNPKChart(data, 'nitrogen', 'Nitrogen Content'),
        'phosphorus': () => createNPKChart(data, 'phosphorus', 'Phosphorus Content'),
        'potassium': () => createNPKChart(data, 'potassium', 'Potassium Content'),
        'tempsoil': () => createTempSoilChart(data),
        'tempairwater': () => createTempAirWaterChart(data),
        'humidity': () => createHumidityChart(data),
        'moisture': () => createMoistureChart(data),
        'ec': () => createECChart(data)
    };
    
    const configFunction = configs[chartType];
    return configFunction ? configFunction() : null;
}

// Individual chart configurations

function createPMChart(data) {
    const timeLabels = data['pm-gh1-times'] || data['pm-outside-times'] || [];
    
    return {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                {
                    label: 'PM2.5 GH1',
                    data: data['pm-gh1'] || [],
                    borderColor: colors.gh1,
                    backgroundColor: colors.gh1 + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'PM2.5 Outside',
                    data: data['pm-outside'] || [],
                    borderColor: colors.outside,
                    backgroundColor: colors.outside + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'PM2.5 GH2',
                    data: data['pm-gh2'] || [],
                    borderColor: colors.gh2,
                    backgroundColor: colors.gh2 + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                }
            ]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    max: 35,
                    title: {
                        display: true,
                        text: 'PM2.5 (μg/m³)'
                    }
                }
            }
        }
    };
}

function createCO2Chart(data) {
    console.log('🧪 Creating CO2 chart with data:', {
        'co2-farm1': data['co2-farm1']?.length || 0,
        'co2-farm2': data['co2-farm2']?.length || 0,
        'timeLabels': (data['co2-farm1-times'] || data['co2-farm2-times'] || []).length
    });
    
    // Debug raw data
    console.log('🔍 Raw CO2 data:', {
        'co2-farm1-raw': data['co2-farm1']?.slice(0, 10),
        'co2-farm2-raw': data['co2-farm2']?.slice(0, 10),
        'all-keys': Object.keys(data)
    });
    
    const timeLabels = data['co2-farm1-times'] || data['co2-farm2-times'] || [];
    
    // Process data to handle gaps properly - show null for invalid values (creates gaps)
    const processDataWithGaps = (values, label = '') => {
        if (!values || values.length === 0) return [];
        
        // Count different types of values
        let validCount = 0;
        let invalidMarkerCount = 0;
        let outOfRangeCount = 0;
        let nullCount = 0;
        
        const processed = values.map((val, idx) => {
            // Convert special markers, null, undefined to null for proper gap display
            if (val === -1 || val === -999) {
                invalidMarkerCount++;
                return null;
            }
            if (val === null || val === undefined) {
                nullCount++;
                return null;
            }
            // For values outside range, show null (creates gap)
            if (val < 0 || val > 2000) {
                outOfRangeCount++;
                if (idx < 10) console.log(`  ${label} value[${idx}] = ${val} (out of range)`);
                return null;  // Show as gap for negative or >2000
            }
            validCount++;
            return val;
        });
        
        console.log(`🔍 Process ${label}: total=${values.length}, valid=${validCount}, markers=${invalidMarkerCount}, outOfRange=${outOfRangeCount}, null=${nullCount}`);
        console.log(`  Sample raw values:`, values.slice(0, 10));
        console.log(`  Sample processed:`, processed.slice(0, 10));
        return processed;
    };
    
    const farm1Data = processDataWithGaps(data['co2-farm1'] || [], 'Farm1');
    const farm2Data = processDataWithGaps(data['co2-farm2'] || [], 'Farm2');
    
    console.log('📊 Final CO2 chart data:');
    console.log('- Farm1 data points:', farm1Data.length, 'valid:', farm1Data.filter(v => v !== null).length, 'gaps:', farm1Data.filter(v => v === null).length);
    console.log('- Farm2 data points:', farm2Data.length, 'valid:', farm2Data.filter(v => v !== null).length, 'gaps:', farm2Data.filter(v => v === null).length);
    console.log('- Time labels:', timeLabels.length, 'first 3:', timeLabels.slice(0, 3));
    console.log('- Raw Farm1 data (first 10):', data['co2-farm1']?.slice(0, 10));
    console.log('- Raw Farm2 data (first 10):', data['co2-farm2']?.slice(0, 10));
    console.log('- Processed Farm1 data (first 10):', farm1Data.slice(0, 10));
    console.log('- Processed Farm2 data (first 10):', farm2Data.slice(0, 10));
    
    // Check if Farm2 has any valid data
    const farm2HasData = farm2Data.some(v => v !== null);
    
    const datasets = [
        {
            label: 'CO2 Farm1',
            data: farm1Data,
            borderColor: colors.farm1,
            backgroundColor: colors.farm1 + '20',
            borderWidth: 2,
            tension: 0.1,
            spanGaps: true,   // Connect across gaps for continuity
            pointRadius: 2,
            pointHoverRadius: 4
        }
    ];
    
    // Always add Farm2 dataset (it has valid data now)
    datasets.push({
        label: 'CO2 Farm2',
        data: farm2Data,
        borderColor: colors.farm2,
        backgroundColor: colors.farm2 + '20',
        borderWidth: 2,
        tension: 0.1,
        spanGaps: true,   // Connect across gaps for continuity
        pointRadius: 2,
        pointHoverRadius: 4
    });
    
    const chartConfig = {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: datasets
        },
        options: {
            ...commonOptions,
            interaction: {
                ...commonOptions.interaction,
                // Ensure legend clicks are enabled
                mode: 'index',
                intersect: false
            },
            plugins: {
                ...commonOptions.plugins,
                tooltip: {
                    ...commonOptions.plugins.tooltip,
                    callbacks: {
                        ...commonOptions.plugins.tooltip.callbacks,
                        label: function(context) {
                            // Custom label for tooltip
                            const value = context.parsed.y;
                            if (value === null || value === undefined) return null;
                            
                            const label = context.dataset.label || 'CO2';
                            return `${label}: ${value.toFixed(0)} ppm`;
                        }
                    }
                }
            },
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    min: 0,
                    max: 2000,
                    title: {
                        display: true,
                        text: 'CO2 (ppm)'
                    }
                }
            }
        }
    };
    
    console.log('📊 CO2 chart config created with legend:', chartConfig.options.plugins.legend);
    return chartConfig;
}

function createLuxUVChart(data) {
    const timeLabels = data['uv-farm1-times'] || data['lux-farm1-times'] || [];
    
    return {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                {
                    label: 'UV Farm1',
                    data: data['uv-farm1'] || [],
                    borderColor: '#00BCD4',
                    backgroundColor: '#00BCD4' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    yAxisID: 'y-uv'
                },
                {
                    label: 'LUX Farm1',
                    data: data['lux-farm1'] || [],
                    borderColor: '#E91E63',
                    backgroundColor: '#E91E63' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    yAxisID: 'y-lux'
                },
                {
                    label: 'UV Farm2',
                    data: data['uv-farm2'] || [],
                    borderColor: '#FFC107',
                    backgroundColor: '#FFC107' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    yAxisID: 'y-uv'
                },
                {
                    label: 'LUX Farm2',
                    data: data['lux-farm2'] || [],
                    borderColor: '#3F51B5',
                    backgroundColor: '#3F51B5' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    yAxisID: 'y-lux'
                }
            ]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                'y-uv': {
                    type: 'linear',
                    position: 'right',
                    beginAtZero: true,
                    max: 600,
                    title: {
                        display: true,
                        text: 'UV (nm)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                },
                'y-lux': {
                    type: 'linear',
                    position: 'left',
                    beginAtZero: true,
                    max: 70000,
                    title: {
                        display: true,
                        text: 'LUX'
                    }
                }
            }
        }
    };
}

function createECChart(data) {
    const timeLabels = data['ecwm-times'] || data['ecwp-times'] || [];
    
    return {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                {
                    label: 'EC Mixed Water',
                    data: data['ecwm'] || [],
                    borderColor: '#2196F3',
                    backgroundColor: '#2196F3' + '20',
                    borderWidth: 3,
                    tension: 0.1,
                    spanGaps: true
                }
            ]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    title: {
                        display: true,
                        text: 'EC (μS/cm)'
                    }
                }
            }
        }
    };
}

function createPPFDChart(data) {
    const timeLabels = data['ppfd-gh1-r8-times'] || [];
    
    return {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                {
                    label: 'PPFD GH1 R8',
                    data: data['ppfd-gh1-r8'] || [],
                    borderColor: '#2196F3',
                    backgroundColor: '#2196F3' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'PPFD GH1 R24',
                    data: data['ppfd-gh1-r24'] || [],
                    borderColor: '#00BCD4',
                    backgroundColor: '#00BCD4' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'PPFD GH2 R16',
                    data: data['ppfd-gh2-r16'] || [],
                    borderColor: '#FFC107',
                    backgroundColor: '#FFC107' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'PPFD GH2 R24',
                    data: data['ppfd-gh2-r24'] || [],
                    borderColor: '#FF9800',
                    backgroundColor: '#FF9800' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                }
            ]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    title: {
                        display: true,
                        text: 'PPFD (μmol/s.m²)'
                    }
                }
            }
        }
    };
}

// Generic NPK Chart Creator (for Nitrogen, Phosphorus, Potassium)
function createNPKChart(data, nutrient, title) {
    const timeLabels = data[`${nutrient}-gh1-r8-times`] || [];
    const colorSets = {
        'nitrogen': {
            gh1: ['#4CAF50', '#8BC34A', '#CDDC39'],
            gh2: ['#009688', '#00BCD4', '#03A9F4']
        },
        'phosphorus': {
            gh1: ['#FF5722', '#FF7043', '#FF8A65'],
            gh2: ['#795548', '#8D6E63', '#A1887F']
        },
        'potassium': {
            gh1: ['#9C27B0', '#AB47BC', '#BA68C8'],
            gh2: ['#673AB7', '#7E57C2', '#9575CD']
        }
    };
    
    const colors = colorSets[nutrient];
    const capitalizedNutrient = nutrient.charAt(0).toUpperCase();
    
    return {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                // GH1
                {
                    label: `${capitalizedNutrient} GH1 R8`,
                    data: data[`${nutrient}-gh1-r8`] || [],
                    borderColor: colors.gh1[0],
                    backgroundColor: colors.gh1[0] + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: `${capitalizedNutrient} GH1 R16`,
                    data: data[`${nutrient}-gh1-r16`] || [],
                    borderColor: colors.gh1[1],
                    backgroundColor: colors.gh1[1] + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: `${capitalizedNutrient} GH1 R24`,
                    data: data[`${nutrient}-gh1-r24`] || [],
                    borderColor: colors.gh1[2],
                    backgroundColor: colors.gh1[2] + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                },
                // GH2
                {
                    label: `${capitalizedNutrient} GH2 R8`,
                    data: data[`${nutrient}-gh2-r8`] || [],
                    borderColor: colors.gh2[0],
                    backgroundColor: colors.gh2[0] + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: `${capitalizedNutrient} GH2 R16`,
                    data: data[`${nutrient}-gh2-r16`] || [],
                    borderColor: colors.gh2[1],
                    backgroundColor: colors.gh2[1] + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: `${capitalizedNutrient} GH2 R24`,
                    data: data[`${nutrient}-gh2-r24`] || [],
                    borderColor: colors.gh2[2],
                    backgroundColor: colors.gh2[2] + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1,
                    spanGaps: true
                }
            ]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    title: {
                        display: true,
                        text: title
                    }
                }
            }
        }
    };
}

// Temperature Soil Chart
function createTempSoilChart(data) {
    const timeLabels = data['temp-npk-gh1-r8-times'] || [];
    
    return {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                // GH1
                {
                    label: 'Soil Temp GH1 R8',
                    data: data['temp-npk-gh1-r8'] || [],
                    borderColor: '#FF5722',
                    backgroundColor: '#FF5722' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Soil Temp GH1 R16',
                    data: data['temp-npk-gh1-r16'] || [],
                    borderColor: '#FF7043',
                    backgroundColor: '#FF7043' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Soil Temp GH1 R24',
                    data: data['temp-npk-gh1-r24'] || [],
                    borderColor: '#FF8A65',
                    backgroundColor: '#FF8A65' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                },
                // GH2
                {
                    label: 'Soil Temp GH2 R8',
                    data: data['temp-npk-gh2-r8'] || [],
                    borderColor: '#3F51B5',
                    backgroundColor: '#3F51B5' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Soil Temp GH2 R16',
                    data: data['temp-npk-gh2-r16'] || [],
                    borderColor: '#5C6BC0',
                    backgroundColor: '#5C6BC0' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Soil Temp GH2 R24',
                    data: data['temp-npk-gh2-r24'] || [],
                    borderColor: '#7986CB',
                    backgroundColor: '#7986CB' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1,
                    spanGaps: true
                }
            ]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                }
            }
        }
    };
}

// Temperature Air & Water Chart
function createTempAirWaterChart(data) {
    const timeLabels = data['air-temp-gh1-r8-times'] || [];
    
    return {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                // GH1 Air
                {
                    label: 'Air Temp GH1 R8',
                    data: data['air-temp-gh1-r8'] || [],
                    borderColor: '#FF9800',
                    backgroundColor: '#FF9800' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Air Temp GH1 R16',
                    data: data['air-temp-gh1-r16'] || [],
                    borderColor: '#FFB300',
                    backgroundColor: '#FFB300' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Air Temp GH1 R24',
                    data: data['air-temp-gh1-r24'] || [],
                    borderColor: '#FFC107',
                    backgroundColor: '#FFC107' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                },
                // GH2 Air
                {
                    label: 'Air Temp GH2 R8',
                    data: data['air-temp-gh2-r8'] || [],
                    borderColor: '#00BCD4',
                    backgroundColor: '#00BCD4' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Air Temp GH2 R16',
                    data: data['air-temp-gh2-r16'] || [],
                    borderColor: '#26C6DA',
                    backgroundColor: '#26C6DA' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Air Temp GH2 R24',
                    data: data['air-temp-gh2-r24'] || [],
                    borderColor: '#4DD0E1',
                    backgroundColor: '#4DD0E1' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1,
                    spanGaps: true
                },
                // Water
                {
                    label: 'Water Mix Temp',
                    data: data['temp-wm'] || [],
                    borderColor: '#E91E63',
                    backgroundColor: '#E91E63' + '20',
                    borderWidth: 3,
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Water Pure Temp',
                    data: data['temp-wp'] || [],
                    borderColor: '#9C27B0',
                    backgroundColor: '#9C27B0' + '20',
                    borderWidth: 3,
                    tension: 0.1,
                    spanGaps: true
                }
            ]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                }
            }
        }
    };
}

// Humidity Chart
function createHumidityChart(data) {
    const timeLabels = data['air-hum-gh1-r8-times'] || [];
    
    return {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                // GH1
                {
                    label: 'Air Hum GH1 R8',
                    data: data['air-hum-gh1-r8'] || [],
                    borderColor: '#2196F3',
                    backgroundColor: '#2196F3' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Air Hum GH1 R16',
                    data: data['air-hum-gh1-r16'] || [],
                    borderColor: '#42A5F5',
                    backgroundColor: '#42A5F5' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Air Hum GH1 R24',
                    data: data['air-hum-gh1-r24'] || [],
                    borderColor: '#64B5F6',
                    backgroundColor: '#64B5F6' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                },
                // GH2
                {
                    label: 'Air Hum GH2 R8',
                    data: data['air-hum-gh2-r8'] || [],
                    borderColor: '#009688',
                    backgroundColor: '#009688' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Air Hum GH2 R16',
                    data: data['air-hum-gh2-r16'] || [],
                    borderColor: '#26A69A',
                    backgroundColor: '#26A69A' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Air Hum GH2 R24',
                    data: data['air-hum-gh2-r24'] || [],
                    borderColor: '#4DB6AC',
                    backgroundColor: '#4DB6AC' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1,
                    spanGaps: true
                }
            ]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    title: {
                        display: true,
                        text: 'Humidity (%)'
                    }
                }
            }
        }
    };
}

// Moisture Chart
function createMoistureChart(data) {
    const timeLabels = data['soil-gh1-r8q1-times'] || [];
    
    return {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                // GH1 Soils
                {
                    label: 'Soil GH1 R8 Q1',
                    data: data['soil-gh1-r8q1'] || [],
                    borderColor: '#4CAF50',
                    backgroundColor: '#4CAF50' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Soil GH1 R8 Q2',
                    data: data['soil-gh1-r8q2'] || [],
                    borderColor: '#66BB6A',
                    backgroundColor: '#66BB6A' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Soil GH1 R16 Q3',
                    data: data['soil-gh1-r16q3'] || [],
                    borderColor: '#81C784',
                    backgroundColor: '#81C784' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Soil GH1 R16 Q4',
                    data: data['soil-gh1-r16q4'] || [],
                    borderColor: '#A5D6A7',
                    backgroundColor: '#A5D6A7' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Soil GH1 R24 Q5',
                    data: data['soil-gh1-r24q5'] || [],
                    borderColor: '#C8E6C9',
                    backgroundColor: '#C8E6C9' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Soil GH1 R24 Q6',
                    data: data['soil-gh1-r24q6'] || [],
                    borderColor: '#DCEDC8',
                    backgroundColor: '#DCEDC8' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: true
                },
                // GH2 Soils
                {
                    label: 'Soil GH2 R8 P1',
                    data: data['soil-gh2-r8p1'] || [],
                    borderColor: '#FF5722',
                    backgroundColor: '#FF5722' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Soil GH2 R8 P2',
                    data: data['soil-gh2-r8p2'] || [],
                    borderColor: '#FF7043',
                    backgroundColor: '#FF7043' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Soil GH2 R8 P3',
                    data: data['soil-gh2-r8p3'] || [],
                    borderColor: '#FF8A65',
                    backgroundColor: '#FF8A65' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Soil GH2 R24 P4',
                    data: data['soil-gh2-r24p4'] || [],
                    borderColor: '#FFAB91',
                    backgroundColor: '#FFAB91' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Soil GH2 R24 P5',
                    data: data['soil-gh2-r24p5'] || [],
                    borderColor: '#FFCCBC',
                    backgroundColor: '#FFCCBC' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Soil GH2 R24 P6',
                    data: data['soil-gh2-r24p6'] || [],
                    borderColor: '#FBE9E7',
                    backgroundColor: '#FBE9E7' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Soil GH2 R16 P8',
                    data: data['soil-gh2-r16p8'] || [],
                    borderColor: '#BCAAA4',
                    backgroundColor: '#BCAAA4' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1,
                    spanGaps: true
                }
            ]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    title: {
                        display: true,
                        text: 'Moisture (%)'
                    }
                }
            }
        }
    };
}

// Toggle fullscreen
function toggleFullscreen() {
    const container = document.getElementById('dynamicChartContainer');
    const icon = document.querySelector('#fullscreenBtn i');
    
    if (container.classList.contains('chart-fullscreen')) {
        container.classList.remove('chart-fullscreen');
        icon.classList.remove('bi-arrows-angle-contract');
        icon.classList.add('bi-arrows-fullscreen');
    } else {
        container.classList.add('chart-fullscreen');
        icon.classList.remove('bi-arrows-fullscreen');
        icon.classList.add('bi-arrows-angle-contract');
    }
    
    // Resize chart
    if (currentChart) {
        currentChart.resize();
    }
}


// Universal Legend Click Detection
let universalLegendHandler = null;

function setupUniversalLegendClick() {
    // Remove existing handler if any
    if (universalLegendHandler) {
        document.removeEventListener('click', universalLegendHandler);
        console.log('🗑️ Removed previous universal legend handler');
    }
    
    // Create new universal handler
    universalLegendHandler = function(e) {
        console.log('🌐 Universal click detected at:', e.clientX, e.clientY);
        
        // Check if we have a current chart and legend
        if (!currentChart || !currentChart.legend || !currentChart.legend.legendHitBoxes) {
            console.log('❌ No current chart or legend available');
            return;
        }
        
        // Get canvas position
        const canvas = currentChart.canvas;
        if (!canvas) {
            console.log('❌ No canvas found');
            return;
        }
        
        const rect = canvas.getBoundingClientRect();
        
        // Convert global coordinates to canvas-relative coordinates
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        
        console.log(`🎯 Canvas coords: ${canvasX}, ${canvasY}`);
        console.log('🏷️ Checking legend hit boxes:', currentChart.legend.legendHitBoxes.length, 'items');
        
        // Check legend hit boxes
        for (let i = 0; i < currentChart.legend.legendHitBoxes.length; i++) {
            const hitBox = currentChart.legend.legendHitBoxes[i];
            console.log(`📦 HitBox ${i}: left=${hitBox.left}, top=${hitBox.top}, width=${hitBox.width}, height=${hitBox.height}`);
            
            if (canvasX >= hitBox.left && canvasX <= hitBox.left + hitBox.width &&
                canvasY >= hitBox.top && canvasY <= hitBox.top + hitBox.height) {
                
                console.log(`✅ Legend item ${i} clicked: ${currentChart.data.datasets[i].label}`);
                
                // Toggle the dataset
                const meta = currentChart.getDatasetMeta(i);
                const wasVisible = (meta.hidden === null || meta.hidden === false);
                meta.hidden = wasVisible;
                
                console.log(`🔄 Dataset ${i} ${wasVisible ? 'hidden' : 'shown'}`);
                currentChart.update('none');
                
                e.preventDefault();
                e.stopPropagation();
                break;
            }
        }
    };
    
    // Add to document
    document.addEventListener('click', universalLegendHandler);
    console.log('📌 Universal legend click handler added to document');
}

// Export for debugging
window.compareCharts = {
    loadChart: loadSelectedChart,
    getCurrentChart: () => currentChart,
    toggleFullscreen: toggleFullscreen,
    setupUniversalLegendClick: setupUniversalLegendClick
};