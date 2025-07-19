/* static/css/farm.js */
/**
 * Dashboard JavaScript for Harumiki Smart Farm
 * Supports both Farm 1 and Farm 2 with dynamic sensor detection
 */

// ========== Global Variables ==========
let sensorData = {};
let refreshInterval;
let currentFarm = detectCurrentFarm();

// ========== Farm Detection ==========
function detectCurrentFarm() {
    // Check URL or page title to determine current farm
    const url = window.location.href;
    const title = document.title;
    
    if (url.includes('farm-2') || title.includes('Farm 2')) {
        return 'farm2';
    }
    return 'farm1';
}

// ========== Sensor Configuration ==========
const FARM_CONFIGS = {
    farm1: {
        ppfd: ['ppfd3', 'ppfd4'],
        lux: ['luxR8'],
        uv: ['uvR8'],
        dli: ['dli_R8_Q', 'dli_R24_Q'],
        co2: ['co2'],
        temperature: ['temp-value1', 'temp-value2', 'temp-value3'],
        humidity: ['hum-value1', 'hum-value2', 'hum-value3'],
        pm: ['pm-value1', 'pm-value2']
    },
    farm2: {
        ppfd: ['ppfd1', 'ppfd2'],
        lux: ['luxR24'],
        uv: ['uvR24'],
        dli: ['dli1', 'dli2'],
        co2: ['co2'],
        temperature: ['temp-value1', 'temp-value2', 'temp-value3'],
        humidity: ['hum-value1', 'hum-value2', 'hum-value3'],
        pm: ['pm-value1', 'pm-value2']
    }
};

// ========== Initialize Dashboard ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log(`Dashboard initialized for ${currentFarm}`);
    
    // Initialize sensor data
    collectSensorData();
    
    // Update sensor statuses
    updateAllSensorStatuses();
    
    // Set up auto-refresh
    setupAutoRefresh();
    
    // Initialize tooltips if using Bootstrap
    initializeTooltips();
});

// ========== Collect Sensor Data ==========
function collectSensorData() {
    const config = FARM_CONFIGS[currentFarm];
    sensorData = {};
    
    // PPFD sensors
    config.ppfd.forEach((id, index) => {
        const element = document.getElementById(id);
        if (element) {
            sensorData[`ppfd${index + 1}`] = parseFloat(element.textContent || 0);
        }
    });
    
    // LUX sensors
    config.lux.forEach((id, index) => {
        const element = document.getElementById(id);
        if (element) {
            sensorData[`lux${index + 1}`] = parseFloat(element.textContent || 0);
        }
    });
    
    // UV sensors
    config.uv.forEach((id, index) => {
        const element = document.getElementById(id);
        if (element) {
            sensorData[`uv${index + 1}`] = parseFloat(element.textContent || 0);
        }
    });
    
    // DLI sensors
    config.dli.forEach((id, index) => {
        const element = document.getElementById(id);
        if (element) {
            sensorData[`dli${index + 1}`] = parseFloat(element.textContent || 0);
        }
    });
    
    // Environmental sensors
    sensorData.co2 = parseFloat(document.getElementById('co2')?.textContent || 0);
    
    // Temperature sensors
    config.temperature.forEach((id, index) => {
        const element = document.getElementById(id);
        if (element) {
            sensorData[`temp${index + 1}`] = parseFloat(element.textContent || 0);
        }
    });
    
    // Humidity sensors
    config.humidity.forEach((id, index) => {
        const element = document.getElementById(id);
        if (element) {
            sensorData[`hum${index + 1}`] = parseFloat(element.textContent || 0);
        }
    });
    
    // PM2.5 sensors
    config.pm.forEach((id, index) => {
        const element = document.getElementById(id);
        if (element) {
            sensorData[`pm${index + 1}`] = parseFloat(element.textContent || 0);
        }
    });
    
    console.log(`Sensor data collected for ${currentFarm}:`, sensorData);
}

// ========== Update Sensor Statuses ==========
function updateAllSensorStatuses() {
    const currentHour = new Date().getHours();
    const isDaytime = currentHour >= 6 && currentHour <= 18;
    const config = FARM_CONFIGS[currentFarm];
    
    // Update PPFD sensors
    config.ppfd.forEach((id, index) => {
        const value = sensorData[`ppfd${index + 1}`];
        if (value !== undefined) {
            updateSensorStatus(id, value, {good: 500, warning: 400});
        }
    });
    
    // Update DLI sensors
    config.dli.forEach((id, index) => {
        const value = sensorData[`dli${index + 1}`];
        if (value !== undefined) {
            updateSensorStatus(id, value, {good: 16, warning: 12});
        }
    });
    
    // Update CO2
    updateSensorStatus('co2', sensorData.co2, {good: 600, warning: 400});
    
    // Update PM2.5
    config.pm.forEach((id, index) => {
        const value = sensorData[`pm${index + 1}`];
        if (value !== undefined) {
            updateSensorStatus(id, value, {good: 20, warning: 50}, true);
        }
    });
    
    // Update Temperature based on time
    const tempThresholds = isDaytime ? 
        {good: 26, warning: 30} : 
        {good: 15, warning: 17};
    
    config.temperature.forEach((id, index) => {
        const value = sensorData[`temp${index + 1}`];
        if (value !== undefined) {
            updateSensorStatus(id, value, tempThresholds, true);
        }
    });
    
    // Update Humidity based on time
    const humThresholds = isDaytime ? 
        {good: 60, warning: 40} : 
        {good: 80, warning: 60};
    
    config.humidity.forEach((id, index) => {
        const value = sensorData[`hum${index + 1}`];
        if (value !== undefined) {
            updateSensorStatus(id, value, humThresholds);
        }
    });
}

// ========== Update Individual Sensor Status ==========
function updateSensorStatus(elementId, value, thresholds, inverse = false) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.warn(`Element with ID '${elementId}' not found`);
        return;
    }
    
    const card = element.closest('.sensor-card');
    const statusIndicator = card?.querySelector('.status-indicator');
    const valueElement = card?.querySelector('.value');
    
    if (!statusIndicator || !valueElement) {
        console.warn(`Required elements not found for sensor ${elementId}`);
        return;
    }
    
    let status = 'good';
    
    if (inverse) {
        // For sensors where lower is better (like PM2.5, temperature)
        if (value > thresholds.warning) {
            status = 'danger';
        } else if (value > thresholds.good) {
            status = 'warning';
        }
    } else {
        // For sensors where higher is better (like PPFD, DLI)
        if (value < thresholds.warning) {
            status = 'danger';
        } else if (value < thresholds.good) {
            status = 'warning';
        }
    }
    
    // Update status indicator
    statusIndicator.classList.remove('warning', 'danger');
    if (status === 'warning') {
        statusIndicator.classList.add('warning');
    } else if (status === 'danger') {
        statusIndicator.classList.add('danger');
    }
    
    // Update value color
    valueElement.classList.remove('text-success', 'text-warning', 'text-danger');
    if (status === 'good') {
        valueElement.classList.add('text-success');
    } else if (status === 'warning') {
        valueElement.classList.add('text-warning');
    } else if (status === 'danger') {
        valueElement.classList.add('text-danger');
    }
    
    // Add animation
    animateValueUpdate(valueElement);
}

// ========== Animation Helper ==========
function animateValueUpdate(element) {
    element.style.animation = 'none';
    setTimeout(() => {
        element.style.animation = 'fadeIn 0.5s ease-out';
    }, 10);
}

// ========== Auto Refresh ==========
function setupAutoRefresh() {
    // Clear any existing interval
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    // Set up new interval (every 2.5 minutes)
    refreshInterval = setInterval(() => {
        console.log(`Auto-refreshing ${currentFarm} dashboard...`);
        location.reload();
    }, 150000); // 2.5 minutes in milliseconds
}

// ========== Initialize Tooltips ==========
function initializeTooltips() {
    if (typeof bootstrap !== 'undefined') {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
}

// ========== Utility Functions ==========
function formatNumber(num, decimals = 1) {
    if (num === null || num === undefined || isNaN(num)) {
        return '0';
    }
    return Number(num).toFixed(decimals);
}

function getTimeBasedThresholds() {
    const currentHour = new Date().getHours();
    const isDaytime = currentHour >= 6 && currentHour <= 18;
    
    return {
        isDaytime,
        temperature: {
            good: isDaytime ? 26 : 15,
            warning: isDaytime ? 30 : 17
        },
        humidity: {
            good: isDaytime ? 60 : 80,
            warning: isDaytime ? 40 : 60
        }
    };
}

// ========== Debug Functions ==========
function debugSensorData() {
    console.log('Current Farm:', currentFarm);
    console.log('Sensor Data:', sensorData);
    console.log('Farm Config:', FARM_CONFIGS[currentFarm]);
}

// ========== Export functions for external use ==========
window.dashboardFunctions = {
    collectSensorData,
    updateAllSensorStatuses,
    updateSensorStatus,
    formatNumber,
    getTimeBasedThresholds,
    debugSensorData,
    currentFarm
};