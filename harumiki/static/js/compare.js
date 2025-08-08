/* static/css/compare.js */
/* static/js/compare.js */
/**
 * Compare Page JavaScript
 * Handles all chart rendering for GH1 vs GH2 comparison
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
            display: false
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
            },
            callbacks: {
                title: function(context) {
                    // Show full datetime in tooltip
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
            grid: {
                display: true,
                color: colors.grid
            },
            ticks: {
                color: colors.text,
                maxTicksLimit: 15,
                callback: function(value, index, values) {
                    const label = this.getLabelForValue(value);
                    
                    if (!label || !label.includes(' ')) return '';
                    
                    // Extract date from datetime string (YYYY-MM-DD HH:MM:SS)
                    const datePart = label.split(' ')[0]; // Get YYYY-MM-DD
                    
                    if (!datePart) return '';
                    
                    try {
                        // Convert to readable date format
                        const dateObj = new Date(datePart);
                        const day = dateObj.getDate();
                        const month = dateObj.getMonth() + 1; // Months are 0-indexed
                        
                        // Define target days to show (every 3 days: 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31)
                        const targetDays = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31];
                        
                        // Always show first data point
                        if (index === 0) {
                            return `${day}/${month}`;
                        }
                        
                        // Always show last data point
                        if (index === values.length - 1) {
                            return `${day}/${month}`;
                        }
                        
                        // Show only if the day matches our target days (1, 4, 7, 10, etc.)
                        if (targetDays.includes(day)) {
                            // Check if we haven't shown this date already
                            let alreadyShown = false;
                            for (let i = 0; i < index; i++) {
                                const prevLabel = this.getLabelForValue(i);
                                if (prevLabel && prevLabel.includes(' ')) {
                                    const prevDatePart = prevLabel.split(' ')[0];
                                    const prevDateObj = new Date(prevDatePart);
                                    const prevDay = prevDateObj.getDate();
                                    const prevMonth = prevDateObj.getMonth() + 1;
                                    
                                    // If we already showed this exact date, don't show again
                                    if (prevDay === day && prevMonth === month) {
                                        alreadyShown = true;
                                        break;
                                    }
                                }
                            }
                            
                            if (!alreadyShown) {
                                return `${day}/${month}`;
                            }
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

// ========== Security and Data Validation ==========

// Secure data cache
const dataCache = new Map();
const MAX_CACHE_SIZE = 50;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Sanitize and validate data key
function sanitizeDataKey(key) {
    if (typeof key !== 'string') return null;
    // Only allow alphanumeric, hyphens, and underscores
    return key.replace(/[^a-zA-Z0-9-_]/g, '');
}

// Validate JSON data
function validateChartData(data) {
    if (!Array.isArray(data)) return false;
    
    // Check for reasonable data size (prevent DoS)
    if (data.length > 50000) {  // Increased limit for sensor data
        if (window.harumikiUtils && window.harumikiUtils.logger) {
            window.harumikiUtils.logger.warn('Data size exceeds maximum limit');
        }
        return false;
    }
    
    // Validate data types
    return data.every(item => {
        return typeof item === 'number' || 
               typeof item === 'string' || 
               (typeof item === 'object' && item !== null);
    });
}

// Secure helper function to get data
function getChartData(dataKey) {
    const sanitizedKey = sanitizeDataKey(dataKey);
    if (!sanitizedKey) {
        if (window.harumikiUtils && window.harumikiUtils.logger) {
            window.harumikiUtils.logger.error('Invalid data key:', dataKey);
        }
        return [];
    }
    
    // Check cache first
    const cacheKey = `data-${sanitizedKey}`;
    if (dataCache.has(cacheKey)) {
        const cached = dataCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }
        dataCache.delete(cacheKey);
    }
    
    const element = document.getElementById('chart-data');
    if (!element) {
        if (window.harumikiUtils && window.harumikiUtils.logger) {
            window.harumikiUtils.logger.error('Chart data element not found');
        }
        return [];
    }
    
    const data = element.getAttribute(`data-${sanitizedKey}`);
    
    if (!data || data === 'None' || data === '') return [];
    
    try {
        // Handle Django template escaping and parse data
        let cleanedData = data;
        
        // Handle Django's escapejs filter output
        cleanedData = cleanedData.replace(/\\u0027/g, "'");  // Replace \u0027 with '
        cleanedData = cleanedData.replace(/\\u002D/g, "-");  // Replace \u002D with -
        cleanedData = cleanedData.replace(/'/g, '"');        // Replace ' with "
        
        const parsedData = JSON.parse(cleanedData);
        
        if (!validateChartData(parsedData)) {
            if (window.harumikiUtils && window.harumikiUtils.logger) {
                window.harumikiUtils.logger.error('Invalid chart data format:', sanitizedKey);
            }
            return [];
        }
        
        // Cache the data
        if (dataCache.size >= MAX_CACHE_SIZE) {
            const firstKey = dataCache.keys().next().value;
            dataCache.delete(firstKey);
        }
        
        dataCache.set(cacheKey, {
            data: parsedData,
            timestamp: Date.now()
        });
        
        return parsedData;
        
    } catch (e) {
        if (window.harumikiUtils && window.harumikiUtils.logger) {
            window.harumikiUtils.logger.error(`Error parsing ${sanitizedKey}:`, e);
        }
        return [];
    }
}

// Form validation and CSRF protection
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
    
    // Add input validation
    const yearInput = form.querySelector('input[name="year"]');
    if (yearInput) {
        yearInput.addEventListener('input', function() {
            const year = parseInt(this.value);
            const currentYear = new Date().getFullYear();
            
            if (year < 2020 || year > currentYear + 1) {
                this.setCustomValidity(`Year must be between 2020 and ${currentYear + 1}`);
            } else {
                this.setCustomValidity('');
            }
        });
    }
}

// Validate form inputs
function validateFormInputs(monthSelect, yearInput) {
    if (!monthSelect || !yearInput) return false;
    
    const month = parseInt(monthSelect.value);
    const year = parseInt(yearInput.value);
    const currentYear = new Date().getFullYear();
    
    // Validate month
    if (isNaN(month) || month < 0 || month > 11) {
        return false;
    }
    
    // Validate year
    if (isNaN(year) || year < 2020 || year > currentYear + 1) {
        return false;
    }
    
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
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
}

// Align data for multiple datasets with potentially different timestamps
function alignDatasets(timestamps1, values1, timestamps2, values2) {
    // Create maps for quick lookup
    const data1Map = new Map();
    const data2Map = new Map();
    
    // Populate maps (treating -999 as missing data)
    timestamps1.forEach((ts, idx) => {
        if (ts && values1[idx] !== undefined && values1[idx] !== -999) {
            data1Map.set(ts, values1[idx]);
        }
    });
    
    timestamps2.forEach((ts, idx) => {
        if (ts && values2[idx] !== undefined && values2[idx] !== -999) {
            data2Map.set(ts, values2[idx]);
        }
    });
    
    // Get all unique timestamps and sort them
    const allTimestamps = [...new Set([...timestamps1, ...timestamps2])].filter(ts => ts).sort();
    
    // Create aligned datasets
    const alignedValues1 = [];
    const alignedValues2 = [];
    
    allTimestamps.forEach(ts => {
        // Use null for missing data points to create gaps in the line
        const val1 = data1Map.has(ts) ? data1Map.get(ts) : null;
        const val2 = data2Map.has(ts) ? data2Map.get(ts) : null;
        
        // Convert -999 to null for proper gap handling
        alignedValues1.push(val1 === -999 ? null : val1);
        alignedValues2.push(val2 === -999 ? null : val2);
    });
    
    return {
        timestamps: allTimestamps,
        values1: alignedValues1,
        values2: alignedValues2
    };
}

// ========== Performance Optimization ==========

// Chart loading queue with priority levels
const chartQueue = [
    // Critical charts (load first)
    { id: 'pmChart', init: initializePMChart, loaded: false, priority: 1 },
    { id: 'co2Chart', init: initializeCO2Chart, loaded: false, priority: 1 },
    { id: 'ecChart', init: initializeECChart, loaded: false, priority: 1 },
    
    // Important charts (load second)
    { id: 'tempAirWaterChart', init: initializeTempAirWaterChart, loaded: false, priority: 2 },
    { id: 'humidityChart', init: initializeHumidityChart, loaded: false, priority: 2 },
    { id: 'luxUvChart', init: initializeLuxUvChart, loaded: false, priority: 2 },
    
    // Standard charts (load third)
    { id: 'ppfdChart', init: initializePPFDChart, loaded: false, priority: 3 },
    { id: 'nitrogenChart', init: initializeNitrogenChart, loaded: false, priority: 3 },
    { id: 'phosphorusChart', init: initializePhosphorusChart, loaded: false, priority: 3 },
    { id: 'potassiumChart', init: initializePotassiumChart, loaded: false, priority: 3 },
    { id: 'tempSoilChart', init: initializeTempSoilChart, loaded: false, priority: 3 },
    
    // Complex charts (load last)
    { id: 'moistureChart', init: initializeMoistureChart, loaded: false, priority: 4 }
];

// Progressive loading state
let currentLoadingPriority = 1;
let isLoadingActive = false;

// Intersection Observer with progressive loading
const chartObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const chartData = chartQueue.find(chart => chart.id === entry.target.id);
            if (chartData && !chartData.loaded) {
                queueChartLoad(chartData);
                chartObserver.unobserve(entry.target);
            }
        }
    });
}, {
    rootMargin: '100px', // Increased for earlier loading
    threshold: 0.05    // Lower threshold for earlier trigger
});

// Progressive chart loading queue
const loadingQueue = [];

// Queue chart for progressive loading
function queueChartLoad(chartData) {
    if (chartData.loaded || loadingQueue.includes(chartData)) return;
    
    loadingQueue.push(chartData);
    loadingQueue.sort((a, b) => a.priority - b.priority);
    
    processLoadingQueue();
}

// Process loading queue with throttling
function processLoadingQueue() {
    if (isLoadingActive || loadingQueue.length === 0) return;
    
    isLoadingActive = true;
    
    const chartData = loadingQueue.shift();
    if (chartData && !chartData.loaded) {
        loadChartWithDelay(chartData);
    }
    
    // Throttle loading to prevent browser blocking
    setTimeout(() => {
        isLoadingActive = false;
        processLoadingQueue();
    }, 150); // 150ms delay between chart loads
}

// Load chart with performance optimization
function loadChartWithDelay(chartData) {
    if (chartData.loaded) return;
    
    const container = document.getElementById(chartData.id)?.closest('.chart-container');
    if (container) {
        addLoadingState(container);
    }
    
    // Use requestIdleCallback if available, fallback to requestAnimationFrame
    const scheduleWork = window.requestIdleCallback || requestAnimationFrame;
    
    scheduleWork(() => {
        try {
            const startTime = performance.now();
            
            // Check if data is available
            const hasData = checkChartDataAvailable(chartData.id);
            if (!hasData) {
                if (window.harumikiUtils && window.harumikiUtils.logger) {
                    window.harumikiUtils.logger.warn(`No data available for chart: ${chartData.id}`);
                }
                if (container) {
                    showNoDataMessage(container);
                }
                return;
            }
            
            // Load chart with optimized settings
            chartData.init();
            chartData.loaded = true;
            
            if (container) {
                removeLoadingState(container);
                container.classList.add('loaded');
                
                // Update chart body loading state
                const chartBody = container.querySelector('.chart-body');
                if (chartBody) {
                    chartBody.setAttribute('data-chart-loaded', 'true');
                }
            }
            
            // Track performance
            trackChartPerformance(chartData.id, startTime);
            
            if (window.harumikiUtils && window.harumikiUtils.logger) {
                window.harumikiUtils.logger.log(`Chart loaded: ${chartData.id} (Priority: ${chartData.priority})`);
            }
        } catch (error) {
            if (window.harumikiUtils && window.harumikiUtils.logger) {
                window.harumikiUtils.logger.error(`Failed to load chart: ${chartData.id}`, error);
            }
            if (container) {
                showChartError(container);
            }
        }
    });
}

// Add loading state
function addLoadingState(container) {
    const chartBody = container.querySelector('.chart-body');
    if (chartBody && !chartBody.querySelector('.chart-loading')) {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'chart-loading d-flex justify-content-center align-items-center';
        loadingDiv.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading chart...</span></div>';
        chartBody.appendChild(loadingDiv);
    }
}

// Remove loading state
function removeLoadingState(container) {
    const loading = container.querySelector('.chart-loading');
    if (loading) {
        loading.remove();
    }
}

// Show chart error
function showChartError(container) {
    const chartBody = container.querySelector('.chart-body');
    if (chartBody) {
        chartBody.innerHTML = `
            <div class="chart-error">
                <i class="bi bi-exclamation-triangle"></i>
                <div>Chart failed to load</div>
                <button class="retry-btn" onclick="retryChartLoad('${container.querySelector('canvas')?.id}')">
                    Retry
                </button>
            </div>
        `;
    }
}

// Show no data message
function showNoDataMessage(container) {
    const chartBody = container.querySelector('.chart-body');
    if (chartBody) {
        chartBody.innerHTML = `
            <div class="chart-error">
                <i class="bi bi-info-circle"></i>
                <div>No data available for the selected period</div>
                <small>Try selecting a different month or year</small>
            </div>
        `;
    }
}

// Check if chart data is available
function checkChartDataAvailable(chartId) {
    // Map chart IDs to their data sources
    const dataMapping = {
        'pmChart': ['pm-gh1', 'pm-gh2', 'pm-outside'],
        'co2Chart': ['co2-farm1', 'co2-farm2'],
        'luxUvChart': ['uv-farm1', 'lux-farm1', 'uv-farm2', 'lux-farm2'],
        'ppfdChart': ['ppfd-gh1-r8', 'ppfd-gh1-r24', 'ppfd-gh2-r16', 'ppfd-gh2-r24'],
        'nitrogenChart': ['nitrogen-gh1-r8', 'nitrogen-gh1-r16', 'nitrogen-gh1-r24', 'nitrogen-gh2-r8', 'nitrogen-gh2-r16', 'nitrogen-gh2-r24'],
        'phosphorusChart': ['phosphorus-gh1-r8', 'phosphorus-gh1-r16', 'phosphorus-gh1-r24', 'phosphorus-gh2-r8', 'phosphorus-gh2-r16', 'phosphorus-gh2-r24'],
        'potassiumChart': ['potassium-gh1-r8', 'potassium-gh1-r16', 'potassium-gh1-r24', 'potassium-gh2-r8', 'potassium-gh2-r16', 'potassium-gh2-r24'],
        'tempSoilChart': ['temp-npk-gh1-r8', 'temp-npk-gh1-r16', 'temp-npk-gh1-r24', 'temp-npk-gh2-r8', 'temp-npk-gh2-r16', 'temp-npk-gh2-r24'],
        'tempAirWaterChart': ['air-temp-gh1-r8', 'air-temp-gh1-r16', 'air-temp-gh1-r24', 'air-temp-gh2-r8', 'air-temp-gh2-r16', 'air-temp-gh2-r24', 'temp-wm', 'temp-wp'],
        'humidityChart': ['air-hum-gh1-r8', 'air-hum-gh1-r16', 'air-hum-gh1-r24', 'air-hum-gh2-r8', 'air-hum-gh2-r16', 'air-hum-gh2-r24'],
        'moistureChart': ['soil-gh1-r8q1', 'soil-gh1-r8q2', 'soil-gh1-r16q3', 'soil-gh1-r16q4', 'soil-gh1-r24q5', 'soil-gh1-r24q6', 'soil-gh2-r8p1', 'soil-gh2-r8p2', 'soil-gh2-r8p3', 'soil-gh2-r24p4', 'soil-gh2-r24p5', 'soil-gh2-r24p6', 'soil-gh2-r16p8'],
        'ecChart': ['ecwm', 'ecwp']
    };
    
    const dataKeys = dataMapping[chartId];
    if (!dataKeys) return true; // Unknown chart, assume data is available
    
    // Check if at least one data source has data
    for (const key of dataKeys) {
        const data = getChartData(key);
        if (data && data.length > 0) {
            return true;
        }
    }
    
    return false;
}

// Retry chart loading
function retryChartLoad(chartId) {
    const chartData = chartQueue.find(chart => chart.id === chartId);
    if (chartData) {
        chartData.loaded = false;
        loadChartWithDelay(chartData);
    }
}

// Initialize lazy loading when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Ensure Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded! Compare charts will not work.');
        return;
    }
    
    console.log('Chart.js is available, initializing compare charts...');
    
    // Setup intersection observer for all chart canvases with priority data
    chartQueue.forEach(chart => {
        const canvas = document.getElementById(chart.id);
        if (canvas) {
            // Add priority data to canvas for CSS optimization
            const container = canvas.closest('.chart-container');
            if (container && !container.hasAttribute('data-priority')) {
                container.setAttribute('data-priority', chart.priority);
            }
            chartObserver.observe(canvas);
        } else {
            console.warn(`Canvas element not found: ${chart.id}`);
        }
    });
    
    // Setup form validation
    setupFormValidation();
    
    // Load visible charts immediately
    loadVisibleCharts();
    
    // Debug data availability
    if (window.harumikiUtils && window.harumikiUtils.logger) {
        window.harumikiUtils.logger.log('Compare page initialized');
        debugChartData();
    }
});

// Load critical charts that are immediately visible
function loadVisibleCharts() {
    // Load only priority 1 charts that are visible
    const criticalCharts = chartQueue.filter(chart => chart.priority === 1);
    
    criticalCharts.forEach(chart => {
        const canvas = document.getElementById(chart.id);
        if (canvas && isElementInViewport(canvas)) {
            queueChartLoad(chart);
        }
    });
    
    // Auto-load remaining priority 1 charts after a short delay
    setTimeout(() => {
        criticalCharts.forEach(chart => {
            if (!chart.loaded) {
                queueChartLoad(chart);
            }
        });
    }, 500);
}

// Check if element is in viewport
function isElementInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// 1. PM2.5 Chart
function initializePMChart() {
    const ctx = document.getElementById('pmChart').getContext('2d');
    const timeLabels = getChartData('pm-gh1-times');
    
    new Chart(ctx, {
        type: 'line',  // เปลี่ยนจาก 'scatter' เป็น 'line'
        data: {
            labels: timeLabels,
            datasets: [
                {
                    label: 'PM2.5 GH1',
                    data: getChartData('pm-gh1'),
                    borderColor: colors.gh1,
                    backgroundColor: colors.gh1 + '20',
                    borderWidth: 2,
                    tension: 0.1
                },
                {
                    label: 'PM Outside',
                    data: getChartData('pm-outside'),
                    borderColor: colors.outside,
                    backgroundColor: colors.outside + '20',
                    borderWidth: 2,
                    tension: 0.1
                },
                {
                    label: 'PM2.5 GH2',
                    data: getChartData('pm-gh2'),
                    borderColor: colors.gh2,
                    backgroundColor: colors.gh2 + '20',
                    borderWidth: 2,
                    tension: 0.1
                }
            ]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    max: 35
                }
            }
        }
    });
}

// 2. CO2 Chart
function initializeCO2Chart() {
    const ctx = document.getElementById('co2Chart').getContext('2d');
    
    // Get timestamps and values for both farms
    const co2Farm1Times = getChartData('co2-farm1-times');
    const co2Farm1Values = getChartData('co2-farm1');
    const co2Farm2Times = getChartData('co2-farm2-times');
    const co2Farm2Values = getChartData('co2-farm2');
    
    // Align datasets to handle missing data
    const aligned = alignDatasets(co2Farm1Times, co2Farm1Values, co2Farm2Times, co2Farm2Values);
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: aligned.timestamps,
            datasets: [
                {
                    label: 'CO2_Farm1',
                    data: aligned.values1,
                    borderColor: colors.farm1,
                    backgroundColor: colors.farm1 + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: false // Don't connect lines across null values
                },
                {
                    label: 'CO2_Farm2',
                    data: aligned.values2,
                    borderColor: colors.farm2,
                    backgroundColor: colors.farm2 + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    spanGaps: false // Don't connect lines across null values
                }
            ]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    ...commonOptions.plugins.tooltip,
                    filter: function(tooltipItem) {
                        // Hide tooltip for null values
                        return tooltipItem.raw !== null;
                    }
                },
                annotation: {
                    annotations: {
                        line1: {
                            type: 'line',
                            yMin: 1000,
                            yMax: 1000,
                            borderColor: colors.warning || '#FFC107',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                content: 'High CO2 Level',
                                enabled: true,
                                position: 'end'
                            }
                        }
                    }
                }
            },
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    min: 400,
                    max: 1100
                }
            }
        }
    });
}

// 3. LUX & UV Chart
function initializeLuxUvChart() {
    const ctx = document.getElementById('luxUvChart').getContext('2d');
    const timeLabels = getChartData('uv-farm1-times');
    
    new Chart(ctx, {
        type: 'line',  // เปลี่ยนจาก 'scatter' เป็น 'line'
        data: {
            labels: timeLabels,
            datasets: [
                {
                    label: 'UV_FARM1',
                    data: getChartData('uv-farm1'),
                    borderColor: '#00BCD4',
                    backgroundColor: '#00BCD4' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    yAxisID: 'y-uv'
                },
                {
                    label: 'LUX_FARM1',
                    data: getChartData('lux-farm1'),
                    borderColor: '#E91E63',
                    backgroundColor: '#E91E63' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    yAxisID: 'y-lux'
                },
                {
                    label: 'UV_FARM2',
                    data: getChartData('uv-farm2'),
                    borderColor: '#FFC107',
                    backgroundColor: '#FFC107' + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    yAxisID: 'y-uv'
                },
                {
                    label: 'LUX_FARM2',
                    data: getChartData('lux-farm2'),
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
            plugins: {
                ...commonOptions.plugins,
                legend: {
                    display: true,
                    position: 'top'
                }
            },
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
    });
}

// 4. PPFD Chart
function initializePPFDChart() {
    const ctx = document.getElementById('ppfdChart').getContext('2d');
    const timeLabels = getChartData('ppfd-gh1-r8-times');
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                {
                    label: 'PPFD GH1 R8',
                    data: getChartData('ppfd-gh1-r8'),
                    borderColor: '#2196F3',
                    backgroundColor: '#2196F3' + '20',
                    borderWidth: 2,
                    tension: 0.1
                },
                {
                    label: 'PPFD GH1 R24',
                    data: getChartData('ppfd-gh1-r24'),
                    borderColor: '#00BCD4',
                    backgroundColor: '#00BCD4' + '20',
                    borderWidth: 2,
                    tension: 0.1
                },
                {
                    label: 'PPFD GH2 R16',
                    data: getChartData('ppfd-gh2-r16'),
                    borderColor: '#FFC107',
                    backgroundColor: '#FFC107' + '20',
                    borderWidth: 2,
                    tension: 0.1
                },
                {
                    label: 'PPFD GH2 R24',
                    data: getChartData('ppfd-gh2-r24'),
                    borderColor: '#FF9800',
                    backgroundColor: '#FF9800' + '20',
                    borderWidth: 2,
                    tension: 0.1
                }
            ]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
}

// 5. Nitrogen Chart
function initializeNitrogenChart() {
    const ctx = document.getElementById('nitrogenChart').getContext('2d');
    const timeLabels = getChartData('nitrogen-gh1-r8-times');
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                // GH1
                {
                    label: 'N GH1 R8',
                    data: getChartData('nitrogen-gh1-r8'),
                    borderColor: '#4CAF50',
                    backgroundColor: '#4CAF50' + '20',
                    borderWidth: 2,
                    tension: 0.1
                },
                {
                    label: 'N GH1 R16',
                    data: getChartData('nitrogen-gh1-r16'),
                    borderColor: '#8BC34A',
                    backgroundColor: '#8BC34A' + '20',
                    borderWidth: 2,
                    tension: 0.1
                },
                {
                    label: 'N GH1 R24',
                    data: getChartData('nitrogen-gh1-r24'),
                    borderColor: '#CDDC39',
                    backgroundColor: '#CDDC39' + '20',
                    borderWidth: 2,
                    tension: 0.1
                },
                // GH2
                {
                    label: 'N GH2 R8',
                    data: getChartData('nitrogen-gh2-r8'),
                    borderColor: '#009688',
                    backgroundColor: '#009688' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1
                },
                {
                    label: 'N GH2 R16',
                    data: getChartData('nitrogen-gh2-r16'),
                    borderColor: '#00BCD4',
                    backgroundColor: '#00BCD4' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1
                },
                {
                    label: 'N GH2 R24',
                    data: getChartData('nitrogen-gh2-r24'),
                    borderColor: '#03A9F4',
                    backgroundColor: '#03A9F4' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1
                }
            ]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
}

// 6. Phosphorus Chart
function initializePhosphorusChart() {
    const ctx = document.getElementById('phosphorusChart').getContext('2d');
    const timeLabels = getChartData('nitrogen-gh1-r8-times');
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                // GH1
                {
                    label: 'P GH1 R8',
                    data: getChartData('phosphorus-gh1-r8'),
                    borderColor: '#FF5722',
                    backgroundColor: '#FF5722' + '20',
                    borderWidth: 2,
                    tension: 0.1
                },
                {
                    label: 'P GH1 R16',
                    data: getChartData('phosphorus-gh1-r16'),
                    borderColor: '#FF7043',
                    backgroundColor: '#FF7043' + '20',
                    borderWidth: 2,
                    tension: 0.1
                },
                {
                    label: 'P GH1 R24',
                    data: getChartData('phosphorus-gh1-r24'),
                    borderColor: '#FF8A65',
                    backgroundColor: '#FF8A65' + '20',
                    borderWidth: 2,
                    tension: 0.1
                },
                // GH2
                {
                    label: 'P GH2 R8',
                    data: getChartData('phosphorus-gh2-r8'),
                    borderColor: '#795548',
                    backgroundColor: '#795548' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1
                },
                {
                    label: 'P GH2 R16',
                    data: getChartData('phosphorus-gh2-r16'),
                    borderColor: '#8D6E63',
                    backgroundColor: '#8D6E63' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1
                },
                {
                    label: 'P GH2 R24',
                    data: getChartData('phosphorus-gh2-r24'),
                    borderColor: '#A1887F',
                    backgroundColor: '#A1887F' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1
                }
            ]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
}

// 7. Potassium Chart
function initializePotassiumChart() {
    const ctx = document.getElementById('potassiumChart').getContext('2d');
    const timeLabels = getChartData('nitrogen-gh1-r8-times');
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                // GH1
                {
                    label: 'K GH1 R8',
                    data: getChartData('potassium-gh1-r8'),
                    borderColor: '#9C27B0',
                    backgroundColor: '#9C27B0' + '20',
                    borderWidth: 2,
                    tension: 0.1
                },
                {
                    label: 'K GH1 R16',
                    data: getChartData('potassium-gh1-r16'),
                    borderColor: '#AB47BC',
                    backgroundColor: '#AB47BC' + '20',
                    borderWidth: 2,
                    tension: 0.1
                },
                {
                    label: 'K GH1 R24',
                    data: getChartData('potassium-gh1-r24'),
                    borderColor: '#BA68C8',
                    backgroundColor: '#BA68C8' + '20',
                    borderWidth: 2,
                    tension: 0.1
                },
                // GH2
                {
                    label: 'K GH2 R8',
                    data: getChartData('potassium-gh2-r8'),
                    borderColor: '#673AB7',
                    backgroundColor: '#673AB7' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1
                },
                {
                    label: 'K GH2 R16',
                    data: getChartData('potassium-gh2-r16'),
                    borderColor: '#7E57C2',
                    backgroundColor: '#7E57C2' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1
                },
                {
                    label: 'K GH2 R24',
                    data: getChartData('potassium-gh2-r24'),
                    borderColor: '#9575CD',
                    backgroundColor: '#9575CD' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1
                }
            ]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
}

// 8. Temperature Soil Chart
function initializeTempSoilChart() {
    const ctx = document.getElementById('tempSoilChart').getContext('2d');
    const timeLabels = getChartData('temp-npk-gh1-r8-times');
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                // GH1
                {
                    label: 'Soil Temp GH1 R8',
                    data: getChartData('temp-npk-gh1-r8'),
                    borderColor: '#FF5722',
                    backgroundColor: '#FF5722' + '20',
                    borderWidth: 2,
                    tension: 0.1
                },
                {
                    label: 'Soil Temp GH1 R16',
                    data: getChartData('temp-npk-gh1-r16'),
                    borderColor: '#FF7043',
                    backgroundColor: '#FF7043' + '20',
                    borderWidth: 2,
                    tension: 0.1
                },
                {
                    label: 'Soil Temp GH1 R24',
                    data: getChartData('temp-npk-gh1-r24'),
                    borderColor: '#FF8A65',
                    backgroundColor: '#FF8A65' + '20',
                    borderWidth: 2,
                    tension: 0.1
                },
                // GH2
                {
                    label: 'Soil Temp GH2 R8',
                    data: getChartData('temp-npk-gh2-r8'),
                    borderColor: '#3F51B5',
                    backgroundColor: '#3F51B5' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1
                },
                {
                    label: 'Soil Temp GH2 R16',
                    data: getChartData('temp-npk-gh2-r16'),
                    borderColor: '#5C6BC0',
                    backgroundColor: '#5C6BC0' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1
                },
                {
                    label: 'Soil Temp GH2 R24',
                    data: getChartData('temp-npk-gh2-r24'),
                    borderColor: '#7986CB',
                    backgroundColor: '#7986CB' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1
                }
            ]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
}

// 9. Temperature Air & Water Chart
function initializeTempAirWaterChart() {
    const ctx = document.getElementById('tempAirWaterChart').getContext('2d');
    const timeLabels = getChartData('air-temp-gh1-r8-times');
    
    const datasets = [
        // GH1 Air
        {
            label: 'Air Temp GH1 R8',
            data: getChartData('air-temp-gh1-r8'),
            borderColor: '#FF9800',
            backgroundColor: '#FF9800' + '20',
            borderWidth: 2,
            tension: 0.1
        },
        {
            label: 'Air Temp GH1 R16',
            data: getChartData('air-temp-gh1-r16'),
            borderColor: '#FFB300',
            backgroundColor: '#FFB300' + '20',
            borderWidth: 2,
            tension: 0.1
        },
        {
            label: 'Air Temp GH1 R24',
            data: getChartData('air-temp-gh1-r24'),
            borderColor: '#FFC107',
            backgroundColor: '#FFC107' + '20',
            borderWidth: 2,
            tension: 0.1
        },
        // GH2 Air
        {
            label: 'Air Temp GH2 R8',
            data: getChartData('air-temp-gh2-r8'),
            borderColor: '#00BCD4',
            backgroundColor: '#00BCD4' + '20',
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0.1
        },
        {
            label: 'Air Temp GH2 R16',
            data: getChartData('air-temp-gh2-r16'),
            borderColor: '#26C6DA',
            backgroundColor: '#26C6DA' + '20',
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0.1
        },
        {
            label: 'Air Temp GH2 R24',
            data: getChartData('air-temp-gh2-r24'),
            borderColor: '#4DD0E1',
            backgroundColor: '#4DD0E1' + '20',
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0.1
        },
        // Water
        {
            label: 'Water Mix Temp',
            data: getChartData('temp-wm'),
            borderColor: '#E91E63',
            backgroundColor: '#E91E63' + '20',
            borderWidth: 3,
            tension: 0.1
        },
        {
            label: 'Water Pure Temp',
            data: getChartData('temp-wp'),
            borderColor: '#9C27B0',
            backgroundColor: '#9C27B0' + '20',
            borderWidth: 3,
            tension: 0.1
        }
    ];
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: datasets
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        boxWidth: 20,
                        padding: 10,
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

// 10. Humidity Chart
function initializeHumidityChart() {
    const ctx = document.getElementById('humidityChart').getContext('2d');
    const timeLabels = getChartData('air-hum-gh1-r8-times');
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                // GH1
                {
                    label: 'Air Hum GH1 R8',
                    data: getChartData('air-hum-gh1-r8'),
                    borderColor: '#2196F3',
                    backgroundColor: '#2196F3' + '20',
                    borderWidth: 2,
                    tension: 0.1
                },
                {
                    label: 'Air Hum GH1 R16',
                    data: getChartData('air-hum-gh1-r16'),
                    borderColor: '#42A5F5',
                    backgroundColor: '#42A5F5' + '20',
                    borderWidth: 2,
                    tension: 0.1
                },
                {
                    label: 'Air Hum GH1 R24',
                    data: getChartData('air-hum-gh1-r24'),
                    borderColor: '#64B5F6',
                    backgroundColor: '#64B5F6' + '20',
                    borderWidth: 2,
                    tension: 0.1
                },
                // GH2
                {
                    label: 'Air Hum GH2 R8',
                    data: getChartData('air-hum-gh2-r8'),
                    borderColor: '#009688',
                    backgroundColor: '#009688' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1
                },
                {
                    label: 'Air Hum GH2 R16',
                    data: getChartData('air-hum-gh2-r16'),
                    borderColor: '#26A69A',
                    backgroundColor: '#26A69A' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1
                },
                {
                    label: 'Air Hum GH2 R24',
                    data: getChartData('air-hum-gh2-r24'),
                    borderColor: '#4DB6AC',
                    backgroundColor: '#4DB6AC' + '20',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1
                }
            ]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
}

// 11. Moisture Chart
function initializeMoistureChart() {
    const ctx = document.getElementById('moistureChart').getContext('2d');
    const timeLabels = getChartData('soil-gh1-r8q1-times');
    
    const datasets = [
        // GH1 Soils
        {
            label: 'Soil GH1 R8 Q1',
            data: getChartData('soil-gh1-r8q1'),
            borderColor: '#4CAF50',
            backgroundColor: '#4CAF50' + '20',
            borderWidth: 2,
            tension: 0.1
        },
        {
            label: 'Soil GH1 R8 Q2',
            data: getChartData('soil-gh1-r8q2'),
            borderColor: '#66BB6A',
            backgroundColor: '#66BB6A' + '20',
            borderWidth: 2,
            tension: 0.1
        },
        {
            label: 'Soil GH1 R16 Q3',
            data: getChartData('soil-gh1-r16q3'),
            borderColor: '#81C784',
            backgroundColor: '#81C784' + '20',
            borderWidth: 2,
            tension: 0.1
        },
        {
            label: 'Soil GH1 R16 Q4',
            data: getChartData('soil-gh1-r16q4'),
            borderColor: '#A5D6A7',
            backgroundColor: '#A5D6A7' + '20',
            borderWidth: 2,
            tension: 0.1
        },
        {
            label: 'Soil GH1 R24 Q5',
            data: getChartData('soil-gh1-r24q5'),
            borderColor: '#C8E6C9',
            backgroundColor: '#C8E6C9' + '20',
            borderWidth: 2,
            tension: 0.1
        },
        {
            label: 'Soil GH1 R24 Q6',
            data: getChartData('soil-gh1-r24q6'),
            borderColor: '#DCEDC8',
            backgroundColor: '#DCEDC8' + '20',
            borderWidth: 2,
            tension: 0.1
        },
        // GH2 Soils
        {
            label: 'Soil GH2 R8 P1',
            data: getChartData('soil-gh2-r8p1'),
            borderColor: '#FF5722',
            backgroundColor: '#FF5722' + '20',
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0.1
        },
        {
            label: 'Soil GH2 R8 P2',
            data: getChartData('soil-gh2-r8p2'),
            borderColor: '#FF7043',
            backgroundColor: '#FF7043' + '20',
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0.1
        },
        {
            label: 'Soil GH2 R8 P3',
            data: getChartData('soil-gh2-r8p3'),
            borderColor: '#FF8A65',
            backgroundColor: '#FF8A65' + '20',
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0.1
        },
        {
            label: 'Soil GH2 R24 P4',
            data: getChartData('soil-gh2-r24p4'),
            borderColor: '#FFAB91',
            backgroundColor: '#FFAB91' + '20',
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0.1
        },
        {
            label: 'Soil GH2 R24 P5',
            data: getChartData('soil-gh2-r24p5'),
            borderColor: '#FFCCBC',
            backgroundColor: '#FFCCBC' + '20',
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0.1
        },
        {
            label: 'Soil GH2 R24 P6',
            data: getChartData('soil-gh2-r24p6'),
            borderColor: '#FBE9E7',
            backgroundColor: '#FBE9E7' + '20',
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0.1
        },
        {
            label: 'Soil GH2 R16 P8',
            data: getChartData('soil-gh2-r16p8'),
            borderColor: '#BCAAA4',
            backgroundColor: '#BCAAA4' + '20',
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0.1
        }
    ];
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: datasets
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        boxWidth: 20,
                        padding: 8,
                        font: {
                            size: 10
                        }
                    }
                }
            }
        }
    });
}

// 12. EC Chart
function initializeECChart() {
    const ctx = document.getElementById('ecChart').getContext('2d');
    const timeLabels = getChartData('ecwm-times');
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                {
                    label: 'EC Mixed Water',
                    data: getChartData('ecwm'),
                    borderColor: '#2196F3',
                    backgroundColor: '#2196F3' + '20',
                    borderWidth: 3,
                    tension: 0.1,
                    pointRadius: 2,
                    pointHoverRadius: 5
                }
            ]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
}

// Helper function to format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short'
    });
}

// ========== Performance Monitoring ==========

// Track chart loading performance
const performanceMetrics = {
    chartsLoaded: 0,
    totalLoadTime: 0,
    errors: 0
};

// Monitor chart performance
function trackChartPerformance(chartId, startTime) {
    const endTime = performance.now();
    const loadTime = endTime - startTime;
    
    performanceMetrics.chartsLoaded++;
    performanceMetrics.totalLoadTime += loadTime;
    
    if (window.harumikiUtils && window.harumikiUtils.logger) {
        window.harumikiUtils.logger.log(`Chart ${chartId} loaded in ${loadTime.toFixed(2)}ms`);
    }
}

// Memory cleanup
function cleanupCharts() {
    Chart.helpers.each(Chart.instances, function(instance) {
        if (instance.chart) {
            instance.chart.destroy();
        }
    });
    
    dataCache.clear();
    performanceMetrics.chartsLoaded = 0;
    performanceMetrics.totalLoadTime = 0;
    performanceMetrics.errors = 0;
}

// Handle page visibility changes for performance
function handleVisibilityChange() {
    if (document.hidden) {
        // Pause chart animations when page is not visible
        Chart.helpers.each(Chart.instances, function(instance) {
            if (instance.chart && instance.chart.options.animation) {
                instance.chart.options.animation.duration = 0;
            }
        });
    } else {
        // Resume animations when page becomes visible
        Chart.helpers.each(Chart.instances, function(instance) {
            if (instance.chart && instance.chart.options.animation) {
                instance.chart.options.animation.duration = 750;
            }
        });
    }
}

document.addEventListener('visibilitychange', handleVisibilityChange);

// Cleanup on page unload
window.addEventListener('beforeunload', cleanupCharts);

// Debug functions
function debugChartData() {
    if (window.harumikiUtils && window.harumikiUtils.logger) {
        const element = document.getElementById('chart-data');
        if (element) {
            const attributes = Array.from(element.attributes)
                .filter(attr => attr.name.startsWith('data-'))
                .map(attr => ({
                    name: attr.name,
                    hasData: attr.value && attr.value !== 'None' && attr.value !== ''
                }));
            
            window.harumikiUtils.logger.log('Chart data debug:', attributes);
        }
    }
}

// Check all chart data availability
function checkAllChartsData() {
    const results = {};
    chartQueue.forEach(chart => {
        results[chart.id] = {
            hasData: checkChartDataAvailable(chart.id),
            loaded: chart.loaded
        };
    });
    
    if (window.harumikiUtils && window.harumikiUtils.logger) {
        window.harumikiUtils.logger.log('All charts data status:', results);
    }
    
    return results;
}

// Export functions for external use
window.compareCharts = {
    refresh: function() {
        cleanupCharts();
        location.reload();
    },
    getMetrics: function() {
        return {
            ...performanceMetrics,
            averageLoadTime: performanceMetrics.chartsLoaded > 0 
                ? (performanceMetrics.totalLoadTime / performanceMetrics.chartsLoaded).toFixed(2)
                : 0
        };
    },
    cleanup: cleanupCharts,
    debugData: debugChartData,
    checkAllData: checkAllChartsData,
    forceLoadAll: function() {
        chartQueue.forEach(chart => {
            if (!chart.loaded) {
                loadChartWithDelay(chart);
            }
        });
    }
};