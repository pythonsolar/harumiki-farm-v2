/* Smart Farm Dashboard - Final JavaScript Version */

// ===========================
// 1. Configuration
// ===========================
const CONFIG = {
    refreshInterval: 300000, // 5 minutes
    locale: 'th-TH',
    dateOptions: { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'long'
    },
    timeOptions: { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false 
    },
    animations: {
        enabled: true,
        duration: 400
    },
    thresholds: {
        moisture: { low: 30, high: 70 },
        temperature: { low: 18, high: 30 },
        humidity: { low: 40, high: 80 },
        co2: { low: 400, high: 1000 },
        pm25: { low: 25, high: 50 }
    }
};

// ===========================
// 2. State Management
// ===========================
const state = {
    selectedSensor: null,
    isDarkMode: false,
    isAutoRefresh: true,
    notifications: [],
    sensorHistory: {}
};

// ===========================
// 3. Core Functions
// ===========================
// Update time and date display
function updateCurrentTimeAndDate() {
    const now = new Date();
    
    const dateString = now.toLocaleDateString(CONFIG.locale, CONFIG.dateOptions);
    const timeString = now.toLocaleTimeString(CONFIG.locale, CONFIG.timeOptions);

    const dateElement = document.getElementById('current-date');
    const clockElement = document.getElementById('current-clock');
    
    if (dateElement) {
        dateElement.textContent = dateString;
        dateElement.style.opacity = '0';
        setTimeout(() => {
            dateElement.style.transition = 'opacity 0.3s ease';
            dateElement.style.opacity = '1';
        }, 10);
    }
    
    if (clockElement) {
        clockElement.textContent = timeString;
    }
}

// Format sensor values with thresholds and trends
function formatSensorValues() {
    document.querySelectorAll('.sensor-value').forEach(sensor => {
        const values = sensor.querySelectorAll('.value');
        
        values.forEach(element => {
            const value = parseFloat(element.textContent);
            if (!isNaN(value)) {
                // Store historical data
                const sensorId = sensor.id;
                if (!state.sensorHistory[sensorId]) {
                    state.sensorHistory[sensorId] = [];
                }
                state.sensorHistory[sensorId].push({
                    value: value,
                    timestamp: new Date()
                });
                
                // Keep only last 10 values
                if (state.sensorHistory[sensorId].length > 10) {
                    state.sensorHistory[sensorId].shift();
                }
                
                // Apply color coding based on thresholds
                applyColorCoding(sensor, element, value);
                
                // Add trend indicator
                addTrendIndicator(sensor, element, sensorId);
            }
        });
    });
}

// Apply color coding based on sensor type and thresholds
function applyColorCoding(sensor, element, value) {
    const sensorType = detectSensorType(sensor);
    let color = '#27ae60'; // Default green
    
    switch(sensorType) {
        case 'moisture':
            if (value < CONFIG.thresholds.moisture.low) {
                color = '#e74c3c'; // Red for low
                showNotification(`⚠️ ความชื้นต่ำ: ${value}%`, 'warning');
            } else if (value > CONFIG.thresholds.moisture.high) {
                color = '#3498db'; // Blue for high
            }
            break;
            
        case 'temperature':
            if (value < CONFIG.thresholds.temperature.low) {
                color = '#3498db'; // Blue for cold
            } else if (value > CONFIG.thresholds.temperature.high) {
                color = '#e74c3c'; // Red for hot
                showNotification(`🌡️ อุณหภูมิสูง: ${value}°C`, 'warning');
            }
            break;
            
        case 'co2':
            if (value > CONFIG.thresholds.co2.high) {
                color = '#e74c3c'; // Red for high
                showNotification(`💨 CO₂ สูง: ${value} ppm`, 'warning');
            }
            break;
            
        case 'pm25':
            if (value > CONFIG.thresholds.pm25.high) {
                color = '#e74c3c'; // Red for high
                showNotification(`🌫️ PM2.5 สูง: ${value} µg/m³`, 'danger');
            } else if (value > CONFIG.thresholds.pm25.low) {
                color = '#f39c12'; // Orange for medium
            }
            break;
    }
    
    element.style.background = `linear-gradient(135deg, ${color}, ${adjustColor(color, -20)})`;
    element.style.webkitBackgroundClip = 'text';
    element.style.backgroundClip = 'text';
    element.style.webkitTextFillColor = 'transparent';
    element.style.color = 'transparent';
}

// Detect sensor type from content
function detectSensorType(sensor) {
    const text = sensor.textContent.toLowerCase();
    if (text.includes('ความชื้น') || text.includes('moisture')) return 'moisture';
    if (text.includes('temp') || text.includes('อุณหภูมิ')) return 'temperature';
    if (text.includes('co2') || text.includes('co₂')) return 'co2';
    if (text.includes('pm2.5') || text.includes('pm')) return 'pm25';
    if (text.includes('hum') && !text.includes('ความชื้น')) return 'humidity';
    return 'default';
}

// Add trend indicators
function addTrendIndicator(sensor, element, sensorId) {
    const history = state.sensorHistory[sensorId];
    if (history && history.length > 1) {
        const currentValue = history[history.length - 1].value;
        const previousValue = history[history.length - 2].value;
        const diff = currentValue - previousValue;
        
        // Remove existing trend indicator
        const existingTrend = sensor.querySelector('.trend-indicator');
        if (existingTrend) existingTrend.remove();
        
        if (Math.abs(diff) > 0.1) {
            const trend = document.createElement('span');
            trend.className = 'trend-indicator';
            trend.style.cssText = `
                font-size: 0.7rem;
                margin-left: 4px;
                opacity: 0.7;
                font-weight: 600;
            `;
            
            if (diff > 0) {
                trend.textContent = '↑';
                trend.style.color = '#e74c3c';
            } else {
                trend.textContent = '↓';
                trend.style.color = '#3498db';
            }
            
            element.parentNode.appendChild(trend);
        }
    }
}

// Show notifications
function showNotification(message, type = 'info') {
    if (state.notifications.includes(message)) return; // Avoid duplicates
    
    state.notifications.push(message);
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: white;
        padding: 12px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        z-index: 1001;
        animation: slideInRight 0.3s ease-out;
        display: flex;
        align-items: center;
        gap: 10px;
        max-width: 300px;
        border-left: 4px solid ${type === 'danger' ? '#e74c3c' : type === 'warning' ? '#f39c12' : '#3b82f6'};
    `;
    
    notification.innerHTML = `
        <span style="font-size: 1.2rem;">${message.split(' ')[0]}</span>
        <span style="font-size: 0.9rem; color: #555;">${message.substring(message.indexOf(' ') + 1)}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            notification.remove();
            state.notifications = state.notifications.filter(n => n !== message);
        }, 300);
    }, 5000);
}

// Refresh sensor data
function refreshSensorData() {
    if (!state.isAutoRefresh) return;
    
    // Add loading overlay
    const overlay = document.createElement('div');
    overlay.className = 'refresh-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(5px);
        z-index: 999;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease-out;
    `;
    
    overlay.innerHTML = `
        <div style="
            background: white;
            padding: 20px 40px;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            gap: 15px;
        ">
            <div class="spinner" style="
                width: 30px;
                height: 30px;
                border: 3px solid #f0f0f0;
                border-top-color: #10b981;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            "></div>
            <span style="font-size: 1.1rem; color: #333;">กำลังอัพเดทข้อมูล...</span>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Reload after animation
    setTimeout(() => {
        location.reload();
    }, 1000);
}

// ===========================
// 4. Interactive Features
// ===========================
function initInteractiveFeatures() {
    const sensors = document.querySelectorAll('.sensor-value');
    
    sensors.forEach((sensor, index) => {
        // Enhanced hover effects
        sensor.addEventListener('mouseenter', function() {
            this.style.zIndex = '100';
            // Add glow effect
            this.style.boxShadow = `
                0 20px 40px rgba(31, 38, 135, 0.3),
                0 0 30px rgba(16, 185, 129, 0.2),
                inset 0 1px 0 rgba(255, 255, 255, 0.7)
            `;
        });
        
        sensor.addEventListener('mouseleave', function() {
            this.style.zIndex = '10';
            this.style.boxShadow = '';
        });
        
        // Click to show details
        sensor.addEventListener('click', function() {
            sensors.forEach(s => s.classList.remove('highlighted'));
            this.classList.add('highlighted');
            showSensorDetails(this);
        });
        
        // Add ripple effect on click
        sensor.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            ripple.style.cssText = `
                position: absolute;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.5);
                transform: scale(0);
                animation: ripple-effect 0.6s ease-out;
                pointer-events: none;
            `;
            
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
            ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
            
            this.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            navigateSensors(e.key === 'ArrowRight' ? 1 : -1);
        }
    });
}

// Show detailed sensor information
function showSensorDetails(sensor) {
    const sensorId = sensor.id;
    const history = state.sensorHistory[sensorId];
    
    if (!history || history.length < 2) return;
    
    // Create mini chart
    const detail = document.createElement('div');
    detail.className = 'sensor-detail';
    detail.style.cssText = `
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-top: 10px;
        background: white;
        padding: 15px;
        border-radius: 10px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        z-index: 200;
        min-width: 200px;
    `;
    
    const values = history.map(h => h.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b) / values.length;
    
    detail.innerHTML = `
        <h4 style="margin: 0 0 10px 0; color: #333; font-size: 0.9rem;">📊 สถิติล่าสุด</h4>
        <div style="font-size: 0.8rem; color: #666;">
            <p style="margin: 3px 0;">สูงสุด: <strong>${max.toFixed(1)}</strong></p>
            <p style="margin: 3px 0;">ต่ำสุด: <strong>${min.toFixed(1)}</strong></p>
            <p style="margin: 3px 0;">เฉลี่ย: <strong>${avg.toFixed(1)}</strong></p>
        </div>
    `;
    
    // Remove existing details
    document.querySelectorAll('.sensor-detail').forEach(d => d.remove());
    
    sensor.appendChild(detail);
    
    // Auto remove after 5 seconds
    setTimeout(() => detail.remove(), 5000);
}

// Navigate between sensors with keyboard
function navigateSensors(direction) {
    const sensors = Array.from(document.querySelectorAll('.sensor-value'));
    const current = sensors.findIndex(s => s.classList.contains('highlighted'));
    
    let next = current + direction;
    if (next < 0) next = sensors.length - 1;
    if (next >= sensors.length) next = 0;
    
    sensors.forEach(s => s.classList.remove('highlighted'));
    sensors[next].classList.add('highlighted');
    sensors[next].scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Check for missing data
function checkMissingData() {
    document.querySelectorAll('.sensor-value').forEach(sensor => {
        let hasMissingData = false;
        
        sensor.querySelectorAll('p').forEach(p => {
            const text = p.textContent;
            // Be more careful with 0 values
            if (text.includes('None') || text.includes('null') || text.includes('undefined')) {
                p.innerHTML = p.innerHTML.replace(
                    /None|null|undefined/g, 
                    '<span style="color: #e74c3c; font-style: italic;">--</span>'
                );
                hasMissingData = true;
            } else if (text.match(/:\s*0\s*$/)) {
                // Only mark plain "0" without units as potentially missing
                const valueSpan = p.querySelector('.value');
                if (valueSpan && valueSpan.textContent === '0') {
                    // Check sensor type - some sensors can legitimately be 0
                    const sensorType = detectSensorType(sensor);
                    if (sensorType !== 'npk' && sensorType !== 'co2' && sensorType !== 'pm25') {
                        valueSpan.style.opacity = '0.5';
                        valueSpan.title = 'ไม่มีข้อมูล';
                    }
                }
            }
        });
        
        // Add warning indicator for missing data
        if (hasMissingData && !sensor.querySelector('.warning-indicator')) {
            const warning = document.createElement('span');
            warning.className = 'warning-indicator';
            warning.style.cssText = `
                position: absolute;
                top: 5px;
                right: 5px;
                width: 16px;
                height: 16px;
                background: #f39c12;
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                font-weight: bold;
                cursor: help;
                animation: pulse 2s infinite;
            `;
            warning.textContent = '!';
            warning.title = 'ไม่พบข้อมูลจากเซ็นเซอร์';
            sensor.appendChild(warning);
        }
    });
}

// ===========================
// 5. UI Controls
// ===========================
// Initialize dark mode
function initDarkMode() {
    const darkModeBtn = document.createElement('button');
    darkModeBtn.innerHTML = '🌙';
    darkModeBtn.className = 'dark-mode-toggle';
    darkModeBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: white;
        border: none;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        font-size: 1.5rem;
        cursor: pointer;
        transition: all 0.3s ease;
        z-index: 1000;
    `;
    
    darkModeBtn.addEventListener('click', function() {
        state.isDarkMode = !state.isDarkMode;
        document.body.classList.toggle('dark-mode');
        this.innerHTML = state.isDarkMode ? '☀️' : '🌙';
        localStorage.setItem('darkMode', state.isDarkMode);
    });
    
    document.body.appendChild(darkModeBtn);
    
    // Check saved preference
    if (localStorage.getItem('darkMode') === 'true') {
        darkModeBtn.click();
    }
}

// Add sensor icons
function addSensorIcons() {
    document.querySelectorAll('.sensor-value h2').forEach(heading => {
        const text = heading.textContent.toLowerCase();
        let icon = '';
        
        if (text.includes('ความชื้น') || text.includes('moisture')) {
            icon = '<i class="fas fa-tint" style="margin-right: 6px; color: #3b82f6;"></i>';
        } else if (text.includes('npk')) {
            icon = '<i class="fas fa-seedling" style="margin-right: 6px; color: #10b981;"></i>';
        } else if (text.includes('co2') || text.includes('co₂')) {
            icon = '<i class="fas fa-wind" style="margin-right: 6px; color: #6366f1;"></i>';
        } else if (text.includes('ppfd') || text.includes('light')) {
            icon = '<i class="fas fa-sun" style="margin-right: 6px; color: #f59e0b;"></i>';
        } else if (text.includes('pm2.5') || text.includes('pm')) {
            icon = '<i class="fas fa-smog" style="margin-right: 6px; color: #6b7280;"></i>';
        } else if (text.includes('sht') || text.includes('temp')) {
            icon = '<i class="fas fa-thermometer-half" style="margin-right: 6px; color: #ef4444;"></i>';
        }
        
        if (icon && !heading.querySelector('i')) {
            heading.innerHTML = icon + heading.innerHTML;
        }
    });
}

// Add page loader
function addPageLoader() {
    // Check if already loaded
    if (sessionStorage.getItem('pageLoaded')) return;
    
    const loader = document.createElement('div');
    loader.className = 'page-preloader';
    loader.innerHTML = `
        <div class="preloader-content">
            <div class="preloader-spinner"></div>
            <h4 style="color: #333; font-weight: 600;">กำลังโหลด Smart Farm Dashboard...</h4>
            <p style="color: #666; font-size: 0.9rem; margin-top: 10px;">กรุณารอสักครู่</p>
        </div>
    `;
    
    document.body.appendChild(loader);
    
    // Remove loader after page loads
    window.addEventListener('load', function() {
        setTimeout(() => {
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.remove();
                sessionStorage.setItem('pageLoaded', 'true');
            }, 300);
        }, 800);
    });
}

// ===========================
// 6. Responsive Handler
// ===========================
function initResponsiveHandler() {
    const container = document.querySelector('.background-image');
    const sensors = document.querySelectorAll('.sensor-value');
    
    // Store original positions
    const originalPositions = new Map();
    
    function storeOriginalPositions() {
        sensors.forEach(sensor => {
            const computedStyle = window.getComputedStyle(sensor);
            originalPositions.set(sensor.id, {
                top: computedStyle.top,
                left: computedStyle.left
            });
        });
    }
    
    // Mobile layout handler
    function checkMobileLayout() {
        const isMobile = window.innerWidth < 768;
        
        if (isMobile) {
            container.classList.add('mobile-layout');
            reorganizeSensorsForMobile();
        } else {
            container.classList.remove('mobile-layout');
            restoreOriginalPositions();
        }
    }
    
    // Organize sensors by category for mobile
    function reorganizeSensorsForMobile() {
        // Create mobile container if not exists
        let mobileContainer = container.querySelector('.mobile-sensor-grid');
        if (!mobileContainer) {
            mobileContainer = document.createElement('div');
            mobileContainer.className = 'mobile-sensor-grid';
            container.appendChild(mobileContainer);
        }
        
        // Group sensors by type
        const groups = {
            environmental: [],
            moisture: [],
            npk: [],
            light: [],
            air: []
        };
        
        sensors.forEach(sensor => {
            const text = sensor.textContent.toLowerCase();
            
            // Move sensor to mobile container
            mobileContainer.appendChild(sensor);
            
            // Categorize
            if (text.includes('sht') || text.includes('temp')) {
                groups.environmental.push(sensor);
            } else if (text.includes('ความชื้น')) {
                groups.moisture.push(sensor);
            } else if (text.includes('npk')) {
                groups.npk.push(sensor);
            } else if (text.includes('ppfd') || text.includes('light')) {
                groups.light.push(sensor);
            } else {
                groups.air.push(sensor);
            }
        });
        
        // Add category headers
        Object.entries(groups).forEach(([category, sensorList]) => {
            if (sensorList.length > 0) {
                const header = document.createElement('div');
                header.className = 'sensor-category-header';
                
                const titles = {
                    environmental: '🌡️ อุณหภูมิและความชื้น',
                    moisture: '💧 ความชื้นในดิน',
                    npk: '🌱 ธาตุอาหาร NPK',
                    light: '☀️ แสง',
                    air: '💨 คุณภาพอากาศ'
                };
                
                header.textContent = titles[category] || category;
                
                // Insert header before first sensor of this category
                mobileContainer.insertBefore(header, sensorList[0]);
            }
        });
    }
    
    // Restore desktop layout
    function restoreOriginalPositions() {
        const mobileContainer = container.querySelector('.mobile-sensor-grid');
        
        if (mobileContainer) {
            // Move sensors back to main container
            sensors.forEach(sensor => {
                container.appendChild(sensor);
                const original = originalPositions.get(sensor.id);
                if (original) {
                    sensor.style.top = original.top;
                    sensor.style.left = original.left;
                }
            });
            
            // Remove mobile container and headers
            container.querySelectorAll('.sensor-category-header').forEach(h => h.remove());
            mobileContainer.remove();
        }
    }
    
    // Font size adjuster based on container size
    function adjustFontSizes() {
        const containerWidth = container.offsetWidth;
        const scaleFactor = containerWidth / 1400;
        
        // Only scale down, not up
        const scale = Math.min(1, scaleFactor);
        
        // Update CSS custom property for dynamic sizing
        container.style.setProperty('--scale-factor', scale);
    }
    
    // Initialize
    storeOriginalPositions();
    checkMobileLayout();
    adjustFontSizes();
    
    // Handle resize with debounce
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            checkMobileLayout();
            adjustFontSizes();
        }, 100);
    });
    
    // Add orientation change handler
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            checkMobileLayout();
            adjustFontSizes();
        }, 100);
    });
}

// ===========================
// 7. Utility Functions
// ===========================
// Color adjustment helper
function adjustColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255))
        .toString(16).slice(1);
}

// Detect current farm
function getCurrentFarm() {
    const backgroundImage = document.querySelector('.background-image');
    if (backgroundImage) {
        if (backgroundImage.classList.contains('farm1')) return 'farm1';
        if (backgroundImage.classList.contains('farm2')) return 'farm2';
    }
    return null;
}

// Add CSS for animations
function addAnimationStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes ripple-effect {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
        
        .notification {
            animation: slideInRight 0.3s ease-out;
        }
        
        .notification-danger {
            border-left-color: #ef4444 !important;
        }
        
        .notification-warning {
            border-left-color: #f59e0b !important;
        }
        
        .notification-info {
            border-left-color: #3b82f6 !important;
        }
        
        /* Smooth transitions for layout changes */
        .background-image:not(.mobile-layout) .sensor-value {
            transition: transform 0.3s ease, font-size 0.3s ease;
        }
        
        /* Mobile grid animation */
        .mobile-sensor-grid .sensor-value {
            animation: fadeInUp 0.4s ease-out;
            animation-fill-mode: both;
        }
        
        .mobile-sensor-grid .sensor-value:nth-child(odd) {
            animation-delay: 0.1s;
        }
        
        .mobile-sensor-grid .sensor-value:nth-child(even) {
            animation-delay: 0.2s;
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
}

// ===========================
// 8. Initialization
// ===========================
document.addEventListener('DOMContentLoaded', function() {
    // Auto-inject Font Awesome if not present
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const fontAwesome = document.createElement('link');
        fontAwesome.rel = 'stylesheet';
        fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
        document.head.appendChild(fontAwesome);
    }
    
    // Auto-inject viewport meta if not present
    if (!document.querySelector('meta[name="viewport"]')) {
        const viewport = document.createElement('meta');
        viewport.name = 'viewport';
        viewport.content = 'width=device-width, initial-scale=1.0';
        document.head.appendChild(viewport);
    }
    
    // Add icons to sensor titles
    setTimeout(() => {
        addSensorIcons();
    }, 500); // Wait for Font Awesome to load
    
    // Add animation styles
    addAnimationStyles();
    
    // Add page loader
    addPageLoader();
    
    // Start clock
    updateCurrentTimeAndDate();
    setInterval(updateCurrentTimeAndDate, 1000);
    
    // Format sensor values
    formatSensorValues();
    
    // Check for missing data
    checkMissingData();
    
    // Initialize interactive features
    initInteractiveFeatures();
    
    // Initialize responsive handler
    initResponsiveHandler();
    
    // Initialize dark mode
    initDarkMode();
    
    // Auto refresh with user control
    if (CONFIG.refreshInterval > 0) {
        setInterval(() => {
            if (state.isAutoRefresh) {
                refreshSensorData();
            }
        }, CONFIG.refreshInterval);
        
        // Add auto-refresh toggle
        const autoRefreshBtn = document.createElement('button');
        autoRefreshBtn.innerHTML = '🔄 Auto';
        autoRefreshBtn.className = 'auto-refresh-toggle';
        autoRefreshBtn.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            padding: 8px 16px;
            border-radius: 20px;
            background: ${state.isAutoRefresh ? '#10b981' : '#6b7280'};
            color: white;
            border: none;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        `;
        
        autoRefreshBtn.addEventListener('click', function() {
            state.isAutoRefresh = !state.isAutoRefresh;
            this.style.background = state.isAutoRefresh ? '#10b981' : '#6b7280';
            showNotification(
                state.isAutoRefresh ? '✅ เปิดการอัพเดทอัตโนมัติ' : '⏸️ ปิดการอัพเดทอัตโนมัติ',
                'info'
            );
        });
        
        document.body.appendChild(autoRefreshBtn);
    }
    
    // Add manual refresh button
    const container = document.querySelector('.smartfarm-container');
    if (container && !document.querySelector('.refresh-btn')) {
        const refreshBtn = document.createElement('button');
        refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> รีเฟรช';
        refreshBtn.className = 'btn btn-sm btn-primary refresh-btn';
        refreshBtn.onclick = refreshSensorData;
        container.appendChild(refreshBtn);
    }
    
    // Add farm indicator
    const farmIndicator = document.createElement('div');
    const currentFarm = getCurrentFarm();
    if (currentFarm) {
        farmIndicator.className = 'farm-indicator';
        farmIndicator.innerHTML = `
            <i class="bi bi-geo-alt-fill"></i> 
            <span>${currentFarm.toUpperCase()}</span>
            <span style="font-size: 0.7rem; opacity: 0.7; margin-left: 5px;">
                (${currentFarm === 'farm1' ? '16 เซ็นเซอร์' : '11 เซ็นเซอร์'})
            </span>
        `;
        document.querySelector('.background-image').appendChild(farmIndicator);
    }
    
    // Welcome message
    setTimeout(() => {
        showNotification('👋 ยินดีต้อนรับสู่ Smart Farm Dashboard', 'info');
    }, 1000);
});

// ===========================
// 9. Export API
// ===========================
window.smartfarm = {
    refresh: refreshSensorData,
    updateTime: updateCurrentTimeAndDate,
    toggleDarkMode: () => document.querySelector('.dark-mode-toggle').click(),
    showNotification: showNotification,
    getState: () => state,
    getSensorHistory: (sensorId) => state.sensorHistory[sensorId] || [],
    addWeatherWidget: (temperature, condition = 'sunny') => {
        const widget = document.createElement('div');
        widget.className = 'weather-widget';
        widget.style.cssText = `
            position: absolute;
            top: 10px;
            right: 200px;
            z-index: 90;
        `;
        
        const icons = {
            sunny: 'fa-sun',
            cloudy: 'fa-cloud',
            rainy: 'fa-cloud-rain',
            partly: 'fa-cloud-sun'
        };
        
        widget.innerHTML = `
            <div style="
                background: rgba(255, 255, 255, 0.25);
                backdrop-filter: blur(10px);
                padding: 8px 16px;
                border-radius: 10px;
                border: 1px solid rgba(255, 255, 255, 0.3);
                font-size: 0.85rem;
                display: flex;
                align-items: center;
                gap: 10px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                transition: all 0.3s ease;
            ">
                <i class="fas ${icons[condition] || icons.sunny}" style="font-size: 1.2rem; color: #f59e0b;"></i>
                <span>อุณหภูมิภายนอก: <strong>${temperature}°C</strong></span>
            </div>
        `;
        
        document.querySelector('.background-image').appendChild(widget);
    },
    // Get computed positions for debugging
    getPositions: () => {
        const positions = {};
        document.querySelectorAll('.sensor-value').forEach(sensor => {
            const rect = sensor.getBoundingClientRect();
            const containerRect = document.querySelector('.background-image').getBoundingClientRect();
            
            positions[sensor.id] = {
                topPercent: ((rect.top - containerRect.top) / containerRect.height * 100).toFixed(2),
                leftPercent: ((rect.left - containerRect.left) / containerRect.width * 100).toFixed(2)
            };
        });
        
        console.log('Current positions:', positions);
        return positions;
    }
};