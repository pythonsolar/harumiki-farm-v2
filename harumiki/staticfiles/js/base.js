/* static/css/base.js */
/**
 * Base JavaScript for Harumiki Smart Farm
 * Handles common functionality across all pages
 */

// ========== Global Variables ==========
let sidebarOpen = false;

// ========== Document Ready ==========
document.addEventListener('DOMContentLoaded', function() {
    initializeSidebar();
    initializeAlerts();
    initializeForms();
    initializeTooltips();
    setActiveNavLink();
});

// ========== Sidebar Functions ==========
function initializeSidebar() {
    // Close sidebar when clicking outside (mobile)
    document.addEventListener('click', function(event) {
        const sidebar = document.getElementById('sidebar');
        const toggle = document.querySelector('.mobile-nav-toggle');
        
        if (window.innerWidth <= 768 && 
            sidebar && toggle &&
            sidebar.classList.contains('show') &&
            !sidebar.contains(event.target) && 
            !toggle.contains(event.target)) {
            sidebar.classList.remove('show');
            sidebarOpen = false;
        }
    });

    // Handle window resize
    window.addEventListener('resize', function() {
        const sidebar = document.getElementById('sidebar');
        if (window.innerWidth > 768 && sidebar) {
            sidebar.classList.remove('show');
            sidebarOpen = false;
        }
    });
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('show');
        sidebarOpen = !sidebarOpen;
    }
}

// ========== Alert Functions ==========
function initializeAlerts() {
    // Auto dismiss alerts after 5 seconds
    setTimeout(function() {
        const alerts = document.querySelectorAll('.alert:not(.alert-permanent)');
        alerts.forEach(function(alert) {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        });
    }, 5000);
}

function showAlert(message, type = 'info') {
    const alertContainer = document.querySelector('.content-container');
    if (!alertContainer) return;

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    alertContainer.insertBefore(alertDiv, alertContainer.firstChild);
    
    // Auto dismiss after 5 seconds
    setTimeout(function() {
        const bsAlert = new bootstrap.Alert(alertDiv);
        bsAlert.close();
    }, 5000);
}

// ========== Loading Functions ==========
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('show');
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.remove('show');
    }
}

// ========== Form Functions ==========
function initializeForms() {
    // Add loading state to forms
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function(e) {
            // Skip if form has 'no-loading' class
            if (!form.classList.contains('no-loading')) {
                showLoading();
            }
        });
    });
}

// ========== Navigation Functions ==========
function setActiveNavLink() {
    // Get current path
    const currentPath = window.location.pathname;
    
    // Remove all active classes
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
        link.classList.remove('active');
        
        // Check if link href matches current path
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
}

// ========== Tooltip Functions ==========
function initializeTooltips() {
    // Initialize Bootstrap tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// ========== AJAX Functions ==========
function sendAjaxRequest(url, method = 'GET', data = null, callback = null) {
    showLoading();
    
    const options = {
        method: method,
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRFToken': getCookie('csrftoken')
        }
    };
    
    if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
        options.headers['Content-Type'] = 'application/json';
    }
    
    fetch(url, options)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            hideLoading();
            if (callback) {
                callback(data);
            }
        })
        .catch(error => {
            hideLoading();
            if (window.harumikiUtils && window.harumikiUtils.logger) {
                window.harumikiUtils.logger.error('Error:', error);
            }
            showAlert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', 'danger');
        });
}

// ========== Utility Functions ==========
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

function formatNumber(num, decimals = 2) {
    return Number(num).toFixed(decimals);
}

function formatDateTime(date) {
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return new Date(date).toLocaleDateString('th-TH', options);
}

// ========== Export Functions ==========
window.toggleSidebar = toggleSidebar;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showAlert = showAlert;
window.sendAjaxRequest = sendAjaxRequest;
window.formatNumber = formatNumber;
window.formatDateTime = formatDateTime;

// ========== Loading Overlay Functions ==========

// Show loading overlay
function showLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
}

// Hide loading overlay
function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

// Auto-hide loading on page load
document.addEventListener('DOMContentLoaded', function() {
    // Hide loading overlay after page loads
    hideLoading();
    
    // For form submissions that trigger page reload
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            // Only show loading for normal form submissions (not AJAX)
            if (!e.defaultPrevented) {
                showLoading();
            }
        });
    });
});

// Hide loading when navigating away
window.addEventListener('beforeunload', function() {
    // This helps when user navigates back
    hideLoading();
});

// Hide loading if still showing after 10 seconds (failsafe)
setTimeout(function() {
    hideLoading();
}, 10000);