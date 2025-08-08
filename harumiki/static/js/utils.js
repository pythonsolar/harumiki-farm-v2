/**
 * Utility functions for Harumiki Smart Farm
 * Secure logging and helper functions
 */

// Secure logging that only works in development
// ตรวจสอบก่อนประกาศ
if (typeof window.harumikiDebug === 'undefined') {
    window.harumikiDebug = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

const logger = {
    log: (...args) => {
        if (window.harumikiDebug) console.log(...args);
    },
    warn: (...args) => {
        if (window.harumikiDebug) console.warn(...args);
    },
    error: (...args) => {
        if (window.harumikiDebug) console.error(...args);
    }
};

// Format numbers with locale
function formatNumber(value, decimals = 2) {
    if (value === null || value === undefined) return '0';
    return parseFloat(value).toLocaleString('th-TH', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

// Sanitize HTML to prevent XSS
function sanitizeHTML(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

// Debounce function for performance
function debounce(func, wait) {
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

// Export for use in other files
window.harumikiUtils = {
    logger,
    formatNumber,
    sanitizeHTML,
    debounce
};