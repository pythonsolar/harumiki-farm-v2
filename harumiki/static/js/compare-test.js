/* Test script for compare-selective functionality */
console.log('Testing Compare Selective Functionality...');

// Test chart configurations
if (typeof chartConfigs !== 'undefined') {
    console.log('✅ Chart configurations loaded:', Object.keys(chartConfigs));
} else {
    console.warn('❌ Chart configurations not found');
}

// Test Chart.js availability
if (typeof Chart !== 'undefined') {
    console.log('✅ Chart.js is available');
} else {
    console.warn('❌ Chart.js not loaded');
}

// Test API endpoint (when page loads)
document.addEventListener('DOMContentLoaded', function() {
    // Test dropdown functionality
    const chartSelect = document.getElementById('chartSelect');
    const loadChartBtn = document.getElementById('loadChartBtn');
    
    if (chartSelect && loadChartBtn) {
        console.log('✅ UI elements found');
        
        // Test dropdown change
        chartSelect.addEventListener('change', function() {
            console.log('📊 Chart selected:', this.value);
        });
        
    } else {
        console.warn('❌ Required UI elements not found');
    }
    
    // Test CSRF token
    const csrfToken = getCookie('csrftoken');
    if (csrfToken) {
        console.log('✅ CSRF token available');
    } else {
        console.warn('⚠️ CSRF token not found - may need to refresh page');
    }
});

// Helper function (duplicate from main file for testing)
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