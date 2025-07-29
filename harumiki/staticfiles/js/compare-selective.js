/* static/js/compare-selective.js */
/**
 * Selective Compare Page JavaScript
 * Handles on-demand chart loading to improve performance
 */

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
    farm1Secondary: '#B2EBF2',
    farm2Secondary: '#F8BBD0',
    grid: 'rgba(0,0,0,0.05)',
    text: '#333'
};

// Global variables
let currentChart = null;
let currentChartType = null;
let isLoading = false;

// Chart configurations
const chartConfigs = {
    pm: {
        title: 'PM 2.5 (μg/m³)',
        type: 'line',
        datasets: [
            { key: 'pm-gh1', label: 'PM2.5 GH1', color: colors.gh1 },
            { key: 'pm-gh2', label: 'PM2.5 GH2', color: colors.gh2 },
            { key: 'pm-outside', label: 'PM Outside', color: colors.outside }
        ],
        options: { y: { max: 35 } }
    },
    co2: {
        title: 'Carbon dioxide (ppm)',
        type: 'line',
        datasets: [
            { key: 'co2-farm1', label: 'CO2 Farm1', color: colors.farm1 },
            { key: 'co2-farm2', label: 'CO2 Farm2', color: colors.farm2 }
        ],
        options: { y: { min: 400, max: 1100 } }
    },
    luxuv: {
        title: 'LUX (lux) & UV (nm)',
        type: 'line',
        datasets: [
            { key: 'uv-farm1', label: 'UV_FARM1', color: '#00BCD4', yAxisID: 'y-uv' },
            { key: 'lux-farm1', label: 'LUX_FARM1', color: '#E91E63', yAxisID: 'y-lux' },
            { key: 'uv-farm2', label: 'UV_FARM2', color: '#FFC107', yAxisID: 'y-uv' },
            { key: 'lux-farm2', label: 'LUX_FARM2', color: '#3F51B5', yAxisID: 'y-lux' }
        ],
        options: {
            scales: {
                'y-uv': {
                    type: 'linear',
                    position: 'right',
                    beginAtZero: true,
                    max: 600,
                    title: { display: true, text: 'UV (nm)' },
                    grid: { drawOnChartArea: false }
                },
                'y-lux': {
                    type: 'linear',
                    position: 'left',
                    beginAtZero: true,
                    max: 70000,
                    title: { display: true, text: 'LUX' }
                }
            }
        }
    },
    ppfd: {
        title: 'PPFD (μmol/s.m²)',
        type: 'line',
        datasets: [
            { key: 'ppfd-gh1-r8', label: 'PPFD GH1 R8', color: '#2196F3' },
            { key: 'ppfd-gh1-r24', label: 'PPFD GH1 R24', color: '#00BCD4' },
            { key: 'ppfd-gh2-r16', label: 'PPFD GH2 R16', color: '#FFC107' },
            { key: 'ppfd-gh2-r24', label: 'PPFD GH2 R24', color: '#FF9800' }
        ]
    },
    nitrogen: {
        title: 'Nitrogen in soil',
        type: 'line',
        datasets: [
            { key: 'nitrogen-gh1-r8', label: 'N GH1 R8', color: '#4CAF50' },
            { key: 'nitrogen-gh1-r16', label: 'N GH1 R16', color: '#8BC34A' },
            { key: 'nitrogen-gh1-r24', label: 'N GH1 R24', color: '#CDDC39' },
            { key: 'nitrogen-gh2-r8', label: 'N GH2 R8', color: '#009688', borderDash: [5, 5] },
            { key: 'nitrogen-gh2-r16', label: 'N GH2 R16', color: '#00BCD4', borderDash: [5, 5] },
            { key: 'nitrogen-gh2-r24', label: 'N GH2 R24', color: '#03A9F4', borderDash: [5, 5] }
        ]
    },
    phosphorus: {
        title: 'Phosphorus in soil',
        type: 'line',
        datasets: [
            { key: 'phosphorus-gh1-r8', label: 'P GH1 R8', color: '#FF5722' },
            { key: 'phosphorus-gh1-r16', label: 'P GH1 R16', color: '#FF7043' },
            { key: 'phosphorus-gh1-r24', label: 'P GH1 R24', color: '#FF8A65' },
            { key: 'phosphorus-gh2-r8', label: 'P GH2 R8', color: '#795548', borderDash: [5, 5] },
            { key: 'phosphorus-gh2-r16', label: 'P GH2 R16', color: '#8D6E63', borderDash: [5, 5] },
            { key: 'phosphorus-gh2-r24', label: 'P GH2 R24', color: '#A1887F', borderDash: [5, 5] }
        ]
    },
    potassium: {
        title: 'Potassium in soil',
        type: 'line',
        datasets: [
            { key: 'potassium-gh1-r8', label: 'K GH1 R8', color: '#9C27B0' },
            { key: 'potassium-gh1-r16', label: 'K GH1 R16', color: '#AB47BC' },
            { key: 'potassium-gh1-r24', label: 'K GH1 R24', color: '#BA68C8' },
            { key: 'potassium-gh2-r8', label: 'K GH2 R8', color: '#673AB7', borderDash: [5, 5] },
            { key: 'potassium-gh2-r16', label: 'K GH2 R16', color: '#7E57C2', borderDash: [5, 5] },
            { key: 'potassium-gh2-r24', label: 'K GH2 R24', color: '#9575CD', borderDash: [5, 5] }
        ]
    },
    tempsoil: {
        title: 'Temperature (°C) [Soil]',
        type: 'line',
        datasets: [
            { key: 'temp-npk-gh1-r8', label: 'Soil Temp GH1 R8', color: '#FF5722' },
            { key: 'temp-npk-gh1-r16', label: 'Soil Temp GH1 R16', color: '#FF7043' },
            { key: 'temp-npk-gh1-r24', label: 'Soil Temp GH1 R24', color: '#FF8A65' },
            { key: 'temp-npk-gh2-r8', label: 'Soil Temp GH2 R8', color: '#3F51B5', borderDash: [5, 5] },
            { key: 'temp-npk-gh2-r16', label: 'Soil Temp GH2 R16', color: '#5C6BC0', borderDash: [5, 5] },
            { key: 'temp-npk-gh2-r24', label: 'Soil Temp GH2 R24', color: '#7986CB', borderDash: [5, 5] }
        ]
    },
    tempairwater: {
        title: 'Temperature (°C) [Air & Water]',
        type: 'line',
        datasets: [
            { key: 'air-temp-gh1-r8', label: 'Air Temp GH1 R8', color: '#FF9800' },
            { key: 'air-temp-gh1-r16', label: 'Air Temp GH1 R16', color: '#FFB300' },
            { key: 'air-temp-gh1-r24', label: 'Air Temp GH1 R24', color: '#FFC107' },
            { key: 'air-temp-gh2-r8', label: 'Air Temp GH2 R8', color: '#00BCD4', borderDash: [5, 5] },
            { key: 'air-temp-gh2-r16', label: 'Air Temp GH2 R16', color: '#26C6DA', borderDash: [5, 5] },
            { key: 'air-temp-gh2-r24', label: 'Air Temp GH2 R24', color: '#4DD0E1', borderDash: [5, 5] },
            { key: 'temp-wm', label: 'Water Mix Temp', color: '#E91E63', borderWidth: 3 },
            { key: 'temp-wp', label: 'Water Pure Temp', color: '#9C27B0', borderWidth: 3 }
        ]
    },
    humidity: {
        title: 'Humidity (%) [Air]',
        type: 'line',
        datasets: [
            { key: 'air-hum-gh1-r8', label: 'Air Hum GH1 R8', color: '#2196F3' },
            { key: 'air-hum-gh1-r16', label: 'Air Hum GH1 R16', color: '#42A5F5' },
            { key: 'air-hum-gh1-r24', label: 'Air Hum GH1 R24', color: '#64B5F6' },
            { key: 'air-hum-gh2-r8', label: 'Air Hum GH2 R8', color: '#009688', borderDash: [5, 5] },
            { key: 'air-hum-gh2-r16', label: 'Air Hum GH2 R16', color: '#26A69A', borderDash: [5, 5] },
            { key: 'air-hum-gh2-r24', label: 'Air Hum GH2 R24', color: '#4DB6AC', borderDash: [5, 5] }
        ]
    },
    moisture: {
        title: 'Moisture (%) [Soil]',
        type: 'line',
        datasets: [
            { key: 'soil-gh1-r8q1', label: 'Soil GH1 R8 Q1', color: '#4CAF50' },
            { key: 'soil-gh1-r8q2', label: 'Soil GH1 R8 Q2', color: '#66BB6A' },
            { key: 'soil-gh1-r16q3', label: 'Soil GH1 R16 Q3', color: '#81C784' },
            { key: 'soil-gh1-r16q4', label: 'Soil GH1 R16 Q4', color: '#A5D6A7' },
            { key: 'soil-gh1-r24q5', label: 'Soil GH1 R24 Q5', color: '#C8E6C9' },
            { key: 'soil-gh1-r24q6', label: 'Soil GH1 R24 Q6', color: '#DCEDC8' },
            { key: 'soil-gh2-r8p1', label: 'Soil GH2 R8 P1', color: '#FF5722', borderDash: [5, 5] },
            { key: 'soil-gh2-r8p2', label: 'Soil GH2 R8 P2', color: '#FF7043', borderDash: [5, 5] },
            { key: 'soil-gh2-r8p3', label: 'Soil GH2 R8 P3', color: '#FF8A65', borderDash: [5, 5] },
            { key: 'soil-gh2-r24p4', label: 'Soil GH2 R24 P4', color: '#FFAB91', borderDash: [5, 5] },
            { key: 'soil-gh2-r24p5', label: 'Soil GH2 R24 P5', color: '#FFCCBC', borderDash: [5, 5] },
            { key: 'soil-gh2-r24p6', label: 'Soil GH2 R24 P6', color: '#FBE9E7', borderDash: [5, 5] },
            { key: 'soil-gh2-r16p8', label: 'Soil GH2 R16 P8', color: '#BCAAA4', borderDash: [5, 5] }
        ]
    },
    ec: {
        title: 'Electrical Conductivity (μS/cm)',
        type: 'line',
        datasets: [
            { key: 'ecwm', label: 'EC Mixed Water', color: '#2196F3', borderWidth: 3 },
            { key: 'ecwp', label: 'EC Pure Water', color: '#E91E63', borderWidth: 3 }
        ]
    }
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
                boxWidth: 20,
                padding: 15,
                font: { size: 11 }
            }
        },
        tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 12,
            cornerRadius: 8,
            titleFont: { size: 13, weight: 'bold' },
            bodyFont: { size: 12 },
            callbacks: {
                title: function(context) {
                    const label = context[0].label;
                    if (label && label.includes(' ')) {
                        try {
                            const [datePart, timePart] = label.split(' ');
                            const dateObj = new Date(datePart);
                            const day = dateObj.getDate();
                            const month = dateObj.getMonth() + 1;
                            const year = dateObj.getFullYear();
                            return `${day}/${month}/${year} ${timePart}`;
                        } catch (e) {
                            return label;
                        }
                    }
                    return label;
                }
            }
        }
    },
    scales: {
        x: {
            type: 'category',
            grid: { display: true, color: colors.grid },
            ticks: {
                color: colors.text,
                maxTicksLimit: 15,
                callback: function(value, index, values) {
                    const label = this.getLabelForValue(value);
                    if (!label || !label.includes(' ')) return '';
                    
                    const datePart = label.split(' ')[0];
                    if (!datePart) return '';
                    
                    try {
                        const dateObj = new Date(datePart);
                        const day = dateObj.getDate();
                        const month = dateObj.getMonth() + 1;
                        
                        const targetDays = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31];
                        
                        if (index === 0 || index === values.length - 1) {
                            return `${day}/${month}`;
                        }
                        
                        if (targetDays.includes(day)) {
                            return `${day}/${month}`;
                        }
                        
                        return '';
                    } catch (e) {
                        return '';
                    }
                }
            }
        },
        y: {
            beginAtZero: true,
            grid: { display: true, color: colors.grid },
            ticks: { color: colors.text }
        }
    }
};

// DOM elements
let chartSelect, loadChartBtn, chartDisplaySection, dynamicChartContainer, chartTitle, dynamicChartBody;

// Initialize the page with enhanced debugging
function initializeSelectiveCompare() {
    console.log('📋 Starting selective compare initialization...');
    
    if (typeof Chart === 'undefined') {
        console.error('❌ Chart.js is not loaded!');
        return false;
    }
    
    console.log('✅ Chart.js is available, version:', Chart.version);
    
    // Get DOM elements
    chartSelect = document.getElementById('chartSelect');
    loadChartBtn = document.getElementById('loadChartBtn');
    chartDisplaySection = document.getElementById('chartDisplaySection');
    dynamicChartContainer = document.getElementById('dynamicChartContainer');
    chartTitle = document.getElementById('chartTitle');
    dynamicChartBody = document.getElementById('dynamicChartBody');
    
    console.log('🔍 DOM Elements check:', {
        chartSelect: !!chartSelect,
        loadChartBtn: !!loadChartBtn,
        chartDisplaySection: !!chartDisplaySection,
        dynamicChartContainer: !!dynamicChartContainer,
        chartTitle: !!chartTitle,
        dynamicChartBody: !!dynamicChartBody
    });
    
    if (!chartSelect || !loadChartBtn) {
        console.error('❌ Required DOM elements not found');
        return false;
    }
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup form validation
    setupFormValidation();
    
    console.log('✅ Selective compare page initialized successfully');
    return true;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('📋 DOM ready, attempting initialization...');
    
    // Try to initialize immediately
    if (!initializeSelectiveCompare()) {
        console.log('⚠️ Initial initialization failed, will retry...');
        
        // Retry after a delay for deferred scripts
        setTimeout(function() {
            console.log('🔄 Retrying initialization...');
            if (!initializeSelectiveCompare()) {
                console.error('❌ Failed to initialize after retry');
                alert('There was an error loading the chart system. Please refresh the page.');
            }
        }, 1000);
    }
});

// Setup event listeners with debug
function setupEventListeners() {
    console.log('🎯 Setting up event listeners...');
    
    // Remove existing listeners to prevent duplicates
    const newChartSelect = chartSelect.cloneNode(true);
    chartSelect.parentNode.replaceChild(newChartSelect, chartSelect);
    chartSelect = newChartSelect;
    
    const newLoadBtn = loadChartBtn.cloneNode(true);
    loadChartBtn.parentNode.replaceChild(newLoadBtn, loadChartBtn);
    loadChartBtn = newLoadBtn;
    
    // Chart selection change
    chartSelect.addEventListener('change', function() {
        const selectedValue = this.value;
        loadChartBtn.disabled = !selectedValue;
        
        console.log('📊 Chart selection changed:', selectedValue);
        
        if (selectedValue) {
            loadChartBtn.querySelector('.btn-text').innerHTML = 
                '<i class="bi bi-play-fill me-1"></i>Load Chart';
        }
    });
    
    // Load chart button
    loadChartBtn.addEventListener('click', function() {
        console.log('🔥 Load Chart button clicked!');
        const selectedChart = chartSelect.value;
        
        console.log('📊 Selected chart:', selectedChart, 'isLoading:', isLoading);
        
        if (selectedChart && !isLoading) {
            console.log('🎯 Starting to load chart:', selectedChart);
            loadSelectedChart(selectedChart);
        } else if (!selectedChart) {
            console.warn('⚠️ No chart selected');
            alert('Please select a chart type first.');
        } else if (isLoading) {
            console.warn('⚠️ Already loading a chart');
            alert('Please wait for the current chart to finish loading.');
        }
    });
    
    // Refresh chart button
    const refreshBtn = document.getElementById('refreshChartBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            if (currentChartType && !isLoading) {
                loadSelectedChart(currentChartType);
            }
        });
    }
    
    // Fullscreen button
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }
    
    // ESC key to exit fullscreen
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && dynamicChartContainer.classList.contains('chart-fullscreen')) {
            toggleFullscreen();
        }
    });
}

// Load selected chart with enhanced debugging
async function loadSelectedChart(chartType) {
    console.log('🎯 loadSelectedChart called with:', chartType, 'isLoading:', isLoading);
    
    if (isLoading) {
        console.warn('⚠️ Already loading, ignoring request');
        return;
    }
    
    isLoading = true;
    currentChartType = chartType;
    
    console.log('📋 Starting chart load process...');
    
    // Update UI
    showLoadingState();
    
    // Get chart configuration
    const config = chartConfigs[chartType];
    if (!config) {
        console.error('❌ Chart configuration not found for:', chartType);
        showError('Chart configuration not found');
        isLoading = false;
        return;
    }
    
    console.log('✅ Chart configuration found:', config.title);
    
    try {
        console.log('🌐 Fetching chart data...');
        
        // Fetch chart data via AJAX
        const chartData = await fetchChartData(chartType);
        
        console.log('📊 Chart data received:', Object.keys(chartData || {}));
        
        if (!chartData || Object.keys(chartData).length === 0) {
            console.error('❌ No data available for chart');
            showError('No data available for the selected chart');
            isLoading = false;
            return;
        }
        
        console.log('🗾 Creating chart...');
        
        // Create chart
        createChart(chartType, chartData, config);
        
        console.log('✅ Chart created successfully');
        
        // Update UI
        showChart(config.title);
        
        console.log('✅ Chart display updated');
        
    } catch (error) {
        console.error('❌ Error loading chart:', error);
        showError('Failed to load chart data: ' + error.message);
    } finally {
        isLoading = false;
        console.log('🏁 Chart loading process finished');
    }
}

// Fetch chart data via AJAX with enhanced debugging
async function fetchChartData(chartType) {
    console.log('🌐 fetchChartData called for:', chartType);
    
    const dataElement = document.getElementById('chart-data');
    if (!dataElement) {
        console.error('❌ chart-data element not found');
        throw new Error('Chart data element not found');
    }
    
    const dateRange = dataElement.getAttribute('data-date-range');
    const month = dataElement.getAttribute('data-month');
    const year = dataElement.getAttribute('data-year');
    
    console.log('📅 Date info:', { dateRange, month, year });
    
    if (!dateRange) {
        console.error('❌ Date range not found in data element');
        throw new Error('Date range not found');
    }
    
    const [startDate, endDate] = dateRange.split('|');
    
    const params = new URLSearchParams({
        chart_type: chartType,
        month: month,
        year: year,
        start_date: startDate,
        end_date: endDate
    });
    
    const url = `/api/compare-chart-data/?${params}`;
    console.log('📡 API Request URL:', url);
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': getCookie('csrftoken')
            }
        });
        
        console.log('📨 Response status:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ HTTP Error Response:', errorText);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText.slice(0, 100)}`);
        }
        
        const data = await response.json();
        console.log('📊 Response data status:', data.status);
        
        if (data.status !== 'success') {
            console.error('❌ API Error:', data.message);
            throw new Error(data.message || 'Failed to fetch chart data');
        }
        
        console.log('✅ Chart data fetched successfully, keys:', Object.keys(data.data || {}));
        return data.data;
        
    } catch (fetchError) {
        console.error('❌ Fetch error:', fetchError);
        throw fetchError;
    }
}

// Create chart
function createChart(chartType, chartData, config) {
    // Destroy existing chart
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
    
    // Clear chart body and create canvas
    dynamicChartBody.innerHTML = '<canvas id="dynamicChart"></canvas>';
    const canvas = document.getElementById('dynamicChart');
    const ctx = canvas.getContext('2d');
    
    // Get first available time labels
    let timeLabels = [];
    for (const dataset of config.datasets) {
        if (chartData[dataset.key + '-times'] && chartData[dataset.key + '-times'].length > 0) {
            timeLabels = chartData[dataset.key + '-times'];
            break;
        }
    }
    
    // Build datasets
    const datasets = [];
    for (const datasetConfig of config.datasets) {
        const values = chartData[datasetConfig.key] || [];
        
        if (values.length > 0) {
            const dataset = {
                label: datasetConfig.label,
                data: values,
                borderColor: datasetConfig.color,
                backgroundColor: datasetConfig.color + '20',
                borderWidth: datasetConfig.borderWidth || 2,
                tension: 0.1,
                pointRadius: 1,
                pointHoverRadius: 4
            };
            
            if (datasetConfig.borderDash) {
                dataset.borderDash = datasetConfig.borderDash;
            }
            
            if (datasetConfig.yAxisID) {
                dataset.yAxisID = datasetConfig.yAxisID;
            }
            
            datasets.push(dataset);
        }
    }
    
    // Merge options
    const options = { ...commonOptions };
    if (config.options) {
        Object.assign(options, config.options);
    }
    
    // Create chart
    currentChart = new Chart(ctx, {
        type: config.type,
        data: {
            labels: timeLabels,
            datasets: datasets
        },
        options: options
    });
    
    // Mark as loaded
    dynamicChartBody.setAttribute('data-chart-loaded', 'true');
}

// Show loading state
function showLoadingState() {
    chartTitle.textContent = 'Loading Chart...';
    
    dynamicChartBody.innerHTML = `
        <div class="dynamic-loading">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading chart...</span>
            </div>
            <div class="dynamic-loading-text">
                Fetching chart data...<br>
                <small>This may take a few moments</small>
            </div>
        </div>
    `;
    
    loadChartBtn.querySelector('.btn-text').style.display = 'none';
    loadChartBtn.querySelector('.btn-loading').classList.remove('d-none');
    loadChartBtn.disabled = true;
}

// Show chart
function showChart(title) {
    chartTitle.textContent = title;
    chartDisplaySection.style.display = 'block';
    chartDisplaySection.classList.add('show');
    
    // Add loading animation
    dynamicChartContainer.classList.add('chart-loaded');
    
    // Reset button
    loadChartBtn.querySelector('.btn-text').style.display = 'inline';
    loadChartBtn.querySelector('.btn-loading').classList.add('d-none');
    loadChartBtn.disabled = false;
    
    // Scroll to chart
    chartDisplaySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Show error
function showError(message) {
    chartTitle.textContent = 'Error Loading Chart';
    
    dynamicChartBody.innerHTML = `
        <div class="dynamic-error">
            <i class="bi bi-exclamation-triangle"></i>
            <h4>Chart Loading Failed</h4>
            <p>${message}</p>
            <button class="retry-btn" onclick="retryLoadChart()">
                <i class="bi bi-arrow-clockwise me-1"></i>
                Retry
            </button>
        </div>
    `;
    
    chartDisplaySection.style.display = 'block';
    chartDisplaySection.classList.add('show');
    
    // Reset button
    loadChartBtn.querySelector('.btn-text').style.display = 'inline';
    loadChartBtn.querySelector('.btn-loading').classList.add('d-none');
    loadChartBtn.disabled = false;
}

// Retry loading chart
function retryLoadChart() {
    if (currentChartType && !isLoading) {
        loadSelectedChart(currentChartType);
    }
}

// Toggle fullscreen
function toggleFullscreen() {
    if (dynamicChartContainer.classList.contains('chart-fullscreen')) {
        // Exit fullscreen
        dynamicChartContainer.classList.remove('chart-fullscreen');
        document.body.style.overflow = '';
        
        // Update icon
        const icon = document.querySelector('#fullscreenBtn i');
        if (icon) {
            icon.className = 'bi bi-arrows-fullscreen';
        }
    } else {
        // Enter fullscreen
        dynamicChartContainer.classList.add('chart-fullscreen');
        document.body.style.overflow = 'hidden';
        
        // Update icon
        const icon = document.querySelector('#fullscreenBtn i');
        if (icon) {
            icon.className = 'bi bi-fullscreen-exit';
        }
    }
    
    // Resize chart if it exists
    if (currentChart) {
        setTimeout(() => {
            currentChart.resize();
        }, 100);
    }
}

// Form validation
function setupFormValidation() {
    const form = document.querySelector('form[method="GET"]');
    if (!form) return;
    
    form.addEventListener('submit', function(e) {
        const monthSelect = this.querySelector('#monthSelect');
        const yearInput = this.querySelector('input[name="year"]');
        
        if (!validateFormInputs(monthSelect, yearInput)) {
            e.preventDefault();
            showValidationError('Please check your date selection');
        }
    });
}

// Validate form inputs
function validateFormInputs(monthSelect, yearInput) {
    if (!monthSelect || !yearInput) return false;
    
    const month = parseInt(monthSelect.value);
    const year = parseInt(yearInput.value);
    const currentYear = new Date().getFullYear();
    
    if (isNaN(month) || month < 0 || month > 11) return false;
    if (isNaN(year) || year < 2020 || year > currentYear + 1) return false;
    
    return true;
}

// Show validation error
function showValidationError(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-warning alert-dismissible fade show';
    alertDiv.innerHTML = `
        <i class="bi bi-exclamation-triangle"></i> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const container = document.querySelector('.compare-container');
    if (container) {
        container.insertBefore(alertDiv, container.firstChild);
        
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
});

// Utility function to get CSRF token
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Export for external use
window.selectiveCompare = {
    loadChart: loadSelectedChart,
    getCurrentChart: () => currentChart,
    getCurrentType: () => currentChartType,
    toggleFullscreen: toggleFullscreen,
    refresh: () => {
        if (currentChartType) {
            loadSelectedChart(currentChartType);
        }
    }
};