/* static/css/export.js */
/**
 * export.js
 * JavaScript functionality for Harumiki Smart Farm Export Page
 */

// ========== Sensor Configurations ==========
const farmSensors = {
    farm1: {
        'PM25_OUTSIDE': 'PM2.5 Outside',
        'PM25_R1': 'PM2.5 Room 1',
        'CO2_R1': 'CO2 Room 1',
        'ppfd3': 'PPFD Row 8',
        'ppfd4': 'PPFD Row 24',
        'LUX1': 'Lux Room 1',
        'UV1': 'UV Room 1',
        'EC': 'EC Mix Water',
        'EC2': 'EC Pure Water',
        'NPK4': 'NPK Row 8',
        'NPK5': 'NPK Row 16',
        'NPK6': 'NPK Row 24',
        'Soil8': 'Soil Row 8 (Start)',
        'Soil7': 'Soil Row 8 (End)',
        'Soil10': 'Soil Row 16 (Start)',
        'Soil9': 'Soil Row 16 (End)',
        'Soil12': 'Soil Row 24 (Start)',
        'Soil11': 'Soil Row 24 (End)',
        'SHT45T3': 'Temp & Humidity Row 8',
        'SHT45T4': 'Temp & Humidity Row 16',
        'SHT45T5': 'Temp & Humidity Row 24'
    },
    farm2: {
        'PM25_OUTSIDE': 'PM2.5 Outside',
        'PM25_R2': 'PM2.5 Room 2',
        'CO2_R2': 'CO2 Room 2',
        'ppfd1': 'PPFD Row 16',
        'ppfd2': 'PPFD Row 24',
        'LUX2': 'Lux Room 2',
        'UV2': 'UV Room 2',
        'EC': 'EC Mix Water',
        'EC2': 'EC Pure Water',
        'NPK1': 'NPK Row 8',
        'NPK2': 'NPK Row 16',
        'NPK3': 'NPK Row 24',
        'soil3': 'Soil R8 (Start)',
        'soil2': 'Soil R8 (Middle)',
        'soil1': 'Soil R8 (End)',
        'Soil13': 'Soil Row 16 (End)',
        'soil6': 'Soil R24 (Start)',
        'soil5': 'Soil R24 (Middle)',
        'soil4': 'Soil R24 (End)',
        'SHT45T1': 'Temp & Humidity Row 8',
        'SHT45T6': 'Temp & Humidity Row 16',
        'SHT45T2': 'Temp & Humidity Row 24'
    }
};

// ========== Initialize on Page Load ==========
document.addEventListener('DOMContentLoaded', function() {
    // Initialize sensor dropdowns
    updateSensors();
    updateMultipleSensors();
    
    // Initialize date synchronization
    syncDateFields();
    
    // Add event listeners for tab changes
    initializeTabs();
    
    // Prevent loading overlay on export forms
    preventLoadingOnExport();
});

// ========== Date Field Synchronization ==========
function syncDateFields() {
    const globalStart = document.getElementById('global-start-date');
    const globalEnd = document.getElementById('global-end-date');
    
    // Set default dates if empty
    if (!globalStart.value) {
        globalStart.value = new Date().toISOString().split('T')[0];
    }
    if (!globalEnd.value) {
        globalEnd.value = new Date().toISOString().split('T')[0];
    }
    
    // Update all hidden date fields
    updateHiddenDates();
    
    // Listen for changes
    globalStart.addEventListener('change', updateHiddenDates);
    globalEnd.addEventListener('change', updateHiddenDates);
}

function updateHiddenDates() {
    const startDate = document.getElementById('global-start-date').value;
    const endDate = document.getElementById('global-end-date').value;
    
    // Update all sync-start-date inputs
    document.querySelectorAll('.sync-start-date').forEach(input => {
        input.value = startDate;
    });
    
    // Update all sync-end-date inputs
    document.querySelectorAll('.sync-end-date').forEach(input => {
        input.value = endDate;
    });
}

// ========== Single Sensor Functions ==========
function updateSensors() {
    const farmSelect = document.getElementById('farm-select');
    const sensorSelect = document.getElementById('sensors');
    
    if (!farmSelect || !sensorSelect) return;
    
    const sensors = farmSensors[farmSelect.value];
    
    // Clear existing options
    sensorSelect.innerHTML = '';
    
    // Add new options
    Object.entries(sensors).forEach(([value, label]) => {
        const option = new Option(label, value);
        sensorSelect.appendChild(option);
    });
}

// ========== Multiple Sensor Functions ==========
function updateMultipleSensors() {
    const farmSelect = document.getElementById('farm-select-multiple');
    const container = document.getElementById('sensor-checkboxes');
    
    if (!farmSelect || !container) return;
    
    const sensors = farmSensors[farmSelect.value];
    
    // Clear existing checkboxes
    container.innerHTML = '';
    
    // Create checkboxes
    Object.entries(sensors).forEach(([value, label]) => {
        const div = document.createElement('div');
        div.className = 'sensor-checkbox';
        div.innerHTML = `
            <label class="d-flex align-items-center">
                <input type="checkbox" name="sensors[]" value="${value}" class="form-check-input">
                <span class="ms-2">${label}</span>
            </label>
        `;
        
        // Toggle selection on click
        div.addEventListener('click', function(e) {
            if (e.target.type !== 'checkbox') {
                const checkbox = this.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
            }
            this.classList.toggle('selected', this.querySelector('input[type="checkbox"]').checked);
        });
        
        container.appendChild(div);
    });
}

// Select all sensors
function selectAll() {
    document.querySelectorAll('#sensor-checkboxes input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
        cb.closest('.sensor-checkbox').classList.add('selected');
    });
}

// Deselect all sensors
function deselectAll() {
    document.querySelectorAll('#sensor-checkboxes input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
        cb.closest('.sensor-checkbox').classList.remove('selected');
    });
}

// ========== Tab Management ==========
function initializeTabs() {
    // Bootstrap tabs should work automatically, but we can add custom behavior if needed
    const tabLinks = document.querySelectorAll('.nav-tabs .nav-link');
    
    tabLinks.forEach(link => {
        link.addEventListener('shown.bs.tab', function(e) {
            // Custom behavior when tab is shown
            console.log('Tab activated:', e.target.getAttribute('href'));
        });
    });
}

// ========== Form Validation ==========
function validateExportForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return false;
    
    // Check if dates are valid
    const startDate = form.querySelector('.sync-start-date').value;
    const endDate = form.querySelector('.sync-end-date').value;
    
    if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        return false;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
        alert('Start date must be before end date');
        return false;
    }
    
    return true;
}

// ========== Export Progress (Optional) ==========
function showExportProgress() {
    // You can add a loading overlay or progress bar here
    const overlay = document.createElement('div');
    overlay.className = 'export-progress-overlay';
    overlay.innerHTML = `
        <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Exporting...</span>
        </div>
        <p class="mt-3">Preparing your export...</p>
    `;
    document.body.appendChild(overlay);
}

function hideExportProgress() {
    const overlay = document.querySelector('.export-progress-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// ========== Export Functions (Make them global) ==========
window.updateSensors = updateSensors;
window.updateMultipleSensors = updateMultipleSensors;
window.selectAll = selectAll;
window.deselectAll = deselectAll;

// ========== Prevent Loading on Export ==========
function preventLoadingOnExport() {
    // Get all export forms
    const exportForms = document.querySelectorAll('form[action*="export"]');
    
    exportForms.forEach(form => {
        form.addEventListener('submit', function(e) {
            // Prevent the default loading overlay
            e.stopPropagation();
            
            // Hide loading immediately if it shows
            setTimeout(() => {
                if (typeof hideLoading === 'function') {
                    hideLoading();
                }
            }, 100);
        });
    });
    
    // Also handle export buttons directly
    const exportButtons = document.querySelectorAll('.btn-export, .btn-farm1, .btn-farm2');
    exportButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Hide loading after a short delay
            setTimeout(() => {
                if (typeof hideLoading === 'function') {
                    hideLoading();
                }
            }, 500);
        });
    });
}