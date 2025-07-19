/**
 * export.js - Enhanced Export Page JavaScript
 * Harumiki Smart Farm Data Export System
 * Features: Security, Performance, Accessibility, Error Handling
 */

'use strict';

// ========== Configuration and Constants ==========
const EXPORT_CONFIG = {
    maxDateRange: 365, // Maximum days between start and end date
    minDate: '2020-01-01', // Minimum allowed date
    maxSensorsSelection: 50, // Maximum sensors that can be selected at once
    debounceDelay: 300, // ms for debounced operations
    loadingDelay: 100, // ms before showing loading state
};

// Sensor configurations with validation
const FARM_SENSORS = Object.freeze({
    farm1: Object.freeze({
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
    }),
    farm2: Object.freeze({
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
    })
});

// ========== Utility Functions ==========
function sanitizeHTML(str) {
    if (window.harumikiUtils && window.harumikiUtils.sanitizeHTML) {
        return window.harumikiUtils.sanitizeHTML(str);
    }
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

function debounce(func, wait) {
    if (window.harumikiUtils && window.harumikiUtils.debounce) {
        return window.harumikiUtils.debounce(func, wait);
    }
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function logSafely(message, data = null) {
    if (window.harumikiUtils && window.harumikiUtils.logger) {
        window.harumikiUtils.logger.log(message, data);
    }
}

function logError(message, error = null) {
    if (window.harumikiUtils && window.harumikiUtils.logger) {
        window.harumikiUtils.logger.error(message, error);
    }
}

// ========== Validation Functions ==========
function validateDateRange(startDate, endDate) {
    if (!startDate || !endDate) {
        return { valid: false, message: 'Both start and end dates are required' };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    const minAllowedDate = new Date(EXPORT_CONFIG.minDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return { valid: false, message: 'Invalid date format' };
    }

    if (start < minAllowedDate) {
        return { valid: false, message: `Start date cannot be before ${EXPORT_CONFIG.minDate}` };
    }

    if (end > today) {
        return { valid: false, message: 'End date cannot be in the future' };
    }

    if (start > end) {
        return { valid: false, message: 'Start date must be before end date' };
    }

    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (daysDiff > EXPORT_CONFIG.maxDateRange) {
        return { valid: false, message: `Date range cannot exceed ${EXPORT_CONFIG.maxDateRange} days` };
    }

    return { valid: true, message: 'Valid date range' };
}

function validateSensorSelection(selectedSensors) {
    if (!selectedSensors || selectedSensors.length === 0) {
        return { valid: false, message: 'At least one sensor must be selected' };
    }

    if (selectedSensors.length > EXPORT_CONFIG.maxSensorsSelection) {
        return { valid: false, message: `Cannot select more than ${EXPORT_CONFIG.maxSensorsSelection} sensors` };
    }

    return { valid: true, message: 'Valid sensor selection' };
}

// ========== DOM Manipulation Helpers ==========
function createSensorCheckbox(sensorId, sensorLabel) {
    const div = document.createElement('div');
    div.className = 'sensor-checkbox';
    div.setAttribute('role', 'checkbox');
    div.setAttribute('tabindex', '0');
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'sensors[]';
    checkbox.value = sensorId;
    checkbox.className = 'form-check-input';
    checkbox.id = `sensor-${sensorId}`;
    
    const label = document.createElement('label');
    label.className = 'd-flex align-items-center';
    label.htmlFor = `sensor-${sensorId}`;
    
    const span = document.createElement('span');
    span.className = 'ms-2';
    span.textContent = sensorLabel;
    
    label.appendChild(checkbox);
    label.appendChild(span);
    div.appendChild(label);
    
    // Add keyboard navigation
    div.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
        }
    });
    
    // Toggle selection on click
    div.addEventListener('click', function(e) {
        if (e.target.type !== 'checkbox') {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
        }
    });
    
    // Update visual state on change
    checkbox.addEventListener('change', function() {
        div.classList.toggle('selected', this.checked);
        div.setAttribute('aria-checked', this.checked);
    });
    
    return div;
}

function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    field.classList.add('is-invalid');
    field.setAttribute('aria-invalid', 'true');
    
    let errorElement = field.parentNode.querySelector('.invalid-feedback');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'invalid-feedback';
        errorElement.setAttribute('role', 'alert');
        field.parentNode.appendChild(errorElement);
    }
    
    errorElement.textContent = message;
}

function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    field.classList.remove('is-invalid');
    field.setAttribute('aria-invalid', 'false');
    
    const errorElement = field.parentNode.querySelector('.invalid-feedback');
    if (errorElement) {
        errorElement.textContent = '';
    }
}

// ========== Loading State Management ==========
function setButtonLoading(button, loading = true) {
    if (!button) return;
    
    button.disabled = loading;
    const textSpan = button.querySelector('.btn-text');
    const loadingSpan = button.querySelector('.btn-loading');
    
    if (textSpan) textSpan.style.display = loading ? 'none' : 'inline-block';
    if (loadingSpan) loadingSpan.style.display = loading ? 'inline-block' : 'none';
}

// ========== Date Management ==========
function initializeDateFields() {
    const globalStart = document.getElementById('global-start-date');
    const globalEnd = document.getElementById('global-end-date');
    
    if (!globalStart || !globalEnd) {
        logError('Date fields not found');
        return;
    }
    
    // Set default dates if empty
    const today = new Date().toISOString().split('T')[0];
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    if (!globalStart.value) globalStart.value = lastWeek;
    if (!globalEnd.value) globalEnd.value = today;
    
    // Set min and max attributes
    globalStart.setAttribute('min', EXPORT_CONFIG.minDate);
    globalStart.setAttribute('max', today);
    globalEnd.setAttribute('min', EXPORT_CONFIG.minDate);
    globalEnd.setAttribute('max', today);
    
    // Initial sync
    updateHiddenDates();
    
    // Add debounced listeners
    const debouncedUpdate = debounce(updateHiddenDates, EXPORT_CONFIG.debounceDelay);
    globalStart.addEventListener('change', debouncedUpdate);
    globalEnd.addEventListener('change', debouncedUpdate);
    
    // Add validation listeners
    globalStart.addEventListener('change', validateDates);
    globalEnd.addEventListener('change', validateDates);
}

function updateHiddenDates() {
    try {
        const startDate = document.getElementById('global-start-date')?.value;
        const endDate = document.getElementById('global-end-date')?.value;
        
        if (!startDate || !endDate) return;
        
        // Update all sync fields
        document.querySelectorAll('.sync-start-date').forEach(input => {
            input.value = startDate;
        });
        
        document.querySelectorAll('.sync-end-date').forEach(input => {
            input.value = endDate;
        });
        
        logSafely('Dates synchronized', { startDate, endDate });
    } catch (error) {
        logError('Error updating hidden dates', error);
    }
}

function validateDates() {
    const startDate = document.getElementById('global-start-date')?.value;
    const endDate = document.getElementById('global-end-date')?.value;
    
    clearFieldError('global-start-date');
    clearFieldError('global-end-date');
    
    const validation = validateDateRange(startDate, endDate);
    
    if (!validation.valid) {
        showFieldError('global-end-date', validation.message);
        return false;
    }
    
    return true;
}

// ========== Sensor Management ==========
function updateSensors() {
    try {
        const farmSelect = document.getElementById('farm-select');
        const sensorSelect = document.getElementById('sensors');
        
        if (!farmSelect || !sensorSelect) {
            logError('Farm or sensor select elements not found');
            return;
        }
        
        const farmValue = farmSelect.value;
        const sensors = FARM_SENSORS[farmValue];
        
        if (!sensors) {
            logError('Invalid farm value', farmValue);
            return;
        }
        
        // Clear and rebuild options
        sensorSelect.innerHTML = '';
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a sensor...';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        sensorSelect.appendChild(defaultOption);
        
        // Add sensor options
        Object.entries(sensors).forEach(([value, label]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = sanitizeHTML(label);
            sensorSelect.appendChild(option);
        });
        
        clearFieldError('sensors');
        logSafely('Sensors updated for farm', farmValue);
    } catch (error) {
        logError('Error updating sensors', error);
        showFieldError('sensors', 'Failed to load sensors');
    }
}

function updateMultipleSensors() {
    try {
        const farmSelect = document.getElementById('farm-select-multiple');
        const container = document.getElementById('sensor-checkboxes');
        
        if (!farmSelect || !container) {
            logError('Multiple sensor elements not found');
            return;
        }
        
        const farmValue = farmSelect.value;
        const sensors = FARM_SENSORS[farmValue];
        
        if (!sensors) {
            logError('Invalid farm value for multiple sensors', farmValue);
            return;
        }
        
        // Clear container
        container.innerHTML = '';
        
        // Create fragment for better performance
        const fragment = document.createDocumentFragment();
        
        // Create checkboxes
        Object.entries(sensors).forEach(([value, label]) => {
            const checkbox = createSensorCheckbox(value, label);
            fragment.appendChild(checkbox);
        });
        
        container.appendChild(fragment);
        clearFieldError('sensor-checkboxes');
        logSafely('Multiple sensors updated for farm', farmValue);
    } catch (error) {
        logError('Error updating multiple sensors', error);
        showFieldError('sensor-checkboxes', 'Failed to load sensors');
    }
}

function selectAllSensors() {
    try {
        const checkboxes = document.querySelectorAll('#sensor-checkboxes input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = true;
            cb.closest('.sensor-checkbox')?.classList.add('selected');
            cb.closest('.sensor-checkbox')?.setAttribute('aria-checked', 'true');
        });
        
        clearFieldError('sensor-checkboxes');
        logSafely('All sensors selected', checkboxes.length);
    } catch (error) {
        logError('Error selecting all sensors', error);
    }
}

function deselectAllSensors() {
    try {
        const checkboxes = document.querySelectorAll('#sensor-checkboxes input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = false;
            cb.closest('.sensor-checkbox')?.classList.remove('selected');
            cb.closest('.sensor-checkbox')?.setAttribute('aria-checked', 'false');
        });
        
        clearFieldError('sensor-checkboxes');
        logSafely('All sensors deselected');
    } catch (error) {
        logError('Error deselecting all sensors', error);
    }
}

// ========== Form Validation and Submission ==========
function validateExportForm(form) {
    if (!form) return false;
    
    let isValid = true;
    
    // Validate dates
    if (!validateDates()) {
        isValid = false;
    }
    
    // Validate sensor selection for multiple sensors form
    if (form.id === 'multiple-sensors-form') {
        const selectedSensors = Array.from(form.querySelectorAll('input[name="sensors[]"]:checked'));
        const validation = validateSensorSelection(selectedSensors);
        
        if (!validation.valid) {
            showFieldError('sensor-checkboxes', validation.message);
            isValid = false;
        } else {
            clearFieldError('sensor-checkboxes');
        }
    }
    
    // Validate single sensor selection
    if (form.id === 'single-sensor-form') {
        const sensorSelect = form.querySelector('#sensors');
        if (!sensorSelect || !sensorSelect.value) {
            showFieldError('sensors', 'Please select a sensor');
            isValid = false;
        } else {
            clearFieldError('sensors');
        }
    }
    
    return isValid;
}

function handleFormSubmission(form) {
    return new Promise((resolve, reject) => {
        try {
            if (!validateExportForm(form)) {
                reject(new Error('Form validation failed'));
                return;
            }
            
            const submitButton = form.querySelector('button[type="submit"]');
            setButtonLoading(submitButton, true);
            
            // Simulate processing delay
            setTimeout(() => {
                logSafely('Form submitted successfully', form.id);
                resolve();
            }, EXPORT_CONFIG.loadingDelay);
            
        } catch (error) {
            logError('Form submission error', error);
            reject(error);
        }
    });
}

// ========== Event Listeners Setup ==========
function setupFormEventListeners() {
    // Handle all export forms
    document.querySelectorAll('.export-form').forEach(form => {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            try {
                await handleFormSubmission(this);
                // Allow form to submit normally after validation
                this.submit();
            } catch (error) {
                logError('Form submission failed', error);
                const submitButton = this.querySelector('button[type="submit"]');
                setButtonLoading(submitButton, false);
                
                // Show user-friendly error
                alert('Please check your selections and try again.');
            }
        });
    });
}

function setupButtonEventListeners() {
    // Select/Deselect all buttons
    const selectAllBtn = document.getElementById('select-all-btn');
    const deselectAllBtn = document.getElementById('deselect-all-btn');
    
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', selectAllSensors);
    }
    
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', deselectAllSensors);
    }
    
    // Farm selection listeners
    const farmSelect = document.getElementById('farm-select');
    const farmSelectMultiple = document.getElementById('farm-select-multiple');
    
    if (farmSelect) {
        farmSelect.addEventListener('change', updateSensors);
    }
    
    if (farmSelectMultiple) {
        farmSelectMultiple.addEventListener('change', updateMultipleSensors);
    }
}

function setupTabEventListeners() {
    const tabLinks = document.querySelectorAll('.nav-tabs button[data-bs-toggle="tab"]');
    
    tabLinks.forEach(link => {
        link.addEventListener('shown.bs.tab', function(e) {
            logSafely('Tab activated', e.target.getAttribute('data-bs-target'));
            
            // Focus management for accessibility
            const targetPanel = document.querySelector(e.target.getAttribute('data-bs-target'));
            if (targetPanel) {
                const firstInput = targetPanel.querySelector('input, select, button');
                if (firstInput) {
                    firstInput.focus();
                }
            }
        });
    });
}

// ========== Initialization ==========
function initializeExportPage() {
    try {
        logSafely('Initializing export page');
        
        // Initialize date fields
        initializeDateFields();
        
        // Initialize sensor dropdowns
        updateSensors();
        updateMultipleSensors();
        
        // Setup event listeners
        setupFormEventListeners();
        setupButtonEventListeners();
        setupTabEventListeners();
        
        logSafely('Export page initialized successfully');
    } catch (error) {
        logError('Failed to initialize export page', error);
    }
}

// ========== Page Load Handler ==========
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExportPage);
} else {
    initializeExportPage();
}

// ========== Global Exports for Legacy Support ==========
window.updateSensors = updateSensors;
window.updateMultipleSensors = updateMultipleSensors;
window.selectAll = selectAllSensors;
window.deselectAll = deselectAllSensors;

// ========== Export Module for Testing ==========
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validateDateRange,
        validateSensorSelection,
        sanitizeHTML,
        EXPORT_CONFIG,
        FARM_SENSORS
    };
}