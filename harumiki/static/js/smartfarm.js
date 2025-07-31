/* Smart Farm Dashboard - Professional Fixed Position JavaScript - FINAL VERSION */

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
    // Base dimensions for scaling calculations
    baseDimensions: {
        width: 1400,
        height: 900
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
    },
    boundaries: {
        minLeft: 60,
        minTop: 40,
        maxRightOffset: 180,
        maxBottomOffset: 100
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
    sensorHistory: {},
    currentScale: 1,
    isMobile: false
};

// ===========================
// 3. Simple Responsive System
// ===========================
function initializeResponsiveSystem() {
    // Much simpler - CSS handles responsiveness!
    const backgroundImage = document.querySelector('.background-image');
    if (!backgroundImage) return;
    
    // Simple mobile check
    function checkMobileLayout() {
        state.isMobile = window.innerWidth < 768;
        
        if (state.isMobile) {
            reorganizeSensorsForMobile();
        }
    }
    
    // Check on load and resize
    checkMobileLayout();
    
    // Simple debounced resize handler
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(checkMobileLayout, 150);
    });
    
    // Orientation change
    window.addEventListener('orientationchange', () => {
        setTimeout(checkMobileLayout, 200);
    });
}

// No complex scaling needed - CSS handles it!
// This function is now much simpler
function updateResponsiveElements() {
    const container = document.querySelector('.smartfarm-container');
    if (!container) return;
    
    // Simple mobile check
    state.isMobile = window.innerWidth < 768;
    state.currentScale = 1; // Always 1 - CSS handles scaling
    
    if (state.isMobile) {
        reorganizeSensorsForMobile();
    }
}

// Font sizes are now handled by CSS clamp() - no JS needed!
// This function is no longer necessary but kept for compatibility
function updateSensorFontSizes() {
    // CSS clamp() handles responsive font sizes automatically
    // No JavaScript needed!
    return;
}

// ===========================
// 4. Core Functions
// ===========================
function updateLastUpdateTime() {
    const now = new Date();
    
    // Format วันที่เป็น DD/MM/YYYY
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear() + 543;
    const dateString = `${day}/${month}/${year}`;
    
    // Format เวลาเป็น HH:MM:SS
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}:${seconds}`;

    const dateElement = document.getElementById('current-date');
    const clockElement = document.getElementById('current-clock');
    
    if (dateElement && clockElement) {
        // รวมวันที่และเวลาไว้ใน clockElement
        dateElement.style.display = 'none'; // ซ่อน date element
        clockElement.textContent = `${dateString} ${timeString}`;
        clockElement.style.fontSize = '1.2rem'; // ปรับขนาดตามต้องการ
    }
}

// Keep old function name for compatibility but show last update time
function updateCurrentTimeAndDate() {
    updateLastUpdateTime();
}

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

function detectSensorType(sensor) {
    const text = sensor.textContent.toLowerCase();
    if (text.includes('ความชื้น') || text.includes('moisture')) return 'moisture';
    if (text.includes('temp') || text.includes('อุณหภูมิ')) return 'temperature';
    if (text.includes('co2') || text.includes('co₂')) return 'co2';
    if (text.includes('pm2.5') || text.includes('pm')) return 'pm25';
    if (text.includes('hum') && !text.includes('ความชื้น')) return 'humidity';
    if (text.includes('npk')) return 'npk';
    return 'default';
}

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

function showNotification(message, type = 'info') {
    if (state.notifications.includes(message)) return;
    
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
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            notification.remove();
            state.notifications = state.notifications.filter(n => n !== message);
        }, 300);
    }, 5000);
}

function refreshSensorData() {
    if (!state.isAutoRefresh) return;
    
    // Update last refresh time before showing overlay
    updateLastUpdateTime();
    
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
    
    setTimeout(() => {
        location.reload();
    }, 1000);
}

// ===========================
// 5. Mobile Layout Handler
// ===========================
function reorganizeSensorsForMobile() {
    const backgroundImage = document.querySelector('.background-image');
    const sensors = document.querySelectorAll('.sensor-value');
    
    // Create mobile container if not exists
    let mobileContainer = backgroundImage.querySelector('.mobile-sensor-grid');
    if (!mobileContainer) {
        mobileContainer = document.createElement('div');
        mobileContainer.className = 'mobile-sensor-grid';
        mobileContainer.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            padding: 20px 10px;
            justify-content: center;
        `;
        backgroundImage.appendChild(mobileContainer);
    }
    
    // Group sensors by type
    const groups = {
        environmental: { title: '🌡️ อุณหภูมิและความชื้น', sensors: [] },
        moisture: { title: '💧 ความชื้นในดิน', sensors: [] },
        npk: { title: '🌱 ธาตุอาหาร NPK', sensors: [] },
        light: { title: '☀️ แสง', sensors: [] },
        air: { title: '💨 คุณภาพอากาศ', sensors: [] }
    };
    
    sensors.forEach(sensor => {
        const text = sensor.textContent.toLowerCase();
        
        if (text.includes('sht') || text.includes('temp')) {
            groups.environmental.sensors.push(sensor);
        } else if (text.includes('ความชื้น')) {
            groups.moisture.sensors.push(sensor);
        } else if (text.includes('npk')) {
            groups.npk.sensors.push(sensor);
        } else if (text.includes('ppfd') || text.includes('light')) {
            groups.light.sensors.push(sensor);
        } else {
            groups.air.sensors.push(sensor);
        }
    });
    
    // Clear and rebuild mobile container
    mobileContainer.innerHTML = '';
    
    Object.entries(groups).forEach(([category, group]) => {
        if (group.sensors.length > 0) {
            // Add category header
            const header = document.createElement('div');
            header.className = 'sensor-category-header';
            header.style.cssText = `
                width: 100%;
                padding: 10px;
                margin: 10px 0 5px 0;
                background: rgba(16, 185, 129, 0.1);
                border-radius: 8px;
                font-weight: 600;
                color: #10b981;
                text-align: center;
            `;
            header.textContent = group.title;
            mobileContainer.appendChild(header);
            
            // Add sensors
            group.sensors.forEach(sensor => {
                mobileContainer.appendChild(sensor);
            });
        }
    });
}

// ===========================
// 6. Interactive Features
// ===========================
function initInteractiveFeatures() {
    const sensors = document.querySelectorAll('.sensor-value');
    
    sensors.forEach((sensor, index) => {
        // Enhanced hover effects
        sensor.addEventListener('mouseenter', function() {
            if (!state.isMobile) {
                this.style.zIndex = '100';
                this.style.boxShadow = `
                    0 20px 40px rgba(31, 38, 135, 0.3),
                    0 0 30px rgba(16, 185, 129, 0.2),
                    inset 0 1px 0 rgba(255, 255, 255, 0.7)
                `;
            }
        });
        
        sensor.addEventListener('mouseleave', function() {
            if (!state.isMobile) {
                this.style.zIndex = '10';
                this.style.boxShadow = '';
            }
        });
        
        // Click to show details
        sensor.addEventListener('click', function() {
            sensors.forEach(s => s.classList.remove('highlighted'));
            this.classList.add('highlighted');
            showSensorDetails(this);
        });
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (!state.isMobile && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
            navigateSensors(e.key === 'ArrowRight' ? 1 : -1);
        }
    });
}

function showSensorDetails(sensor) {
    const sensorId = sensor.id;
    const history = state.sensorHistory[sensorId];
    
    if (!history || history.length < 2) return;
    
    // Remove existing details
    document.querySelectorAll('.sensor-detail').forEach(d => d.remove());
    
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
    
    sensor.appendChild(detail);
    
    // Auto remove after 5 seconds
    setTimeout(() => detail.remove(), 5000);
}

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

// ===========================
// 7. UI Controls
// ===========================
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

function checkMissingData() {
    document.querySelectorAll('.sensor-value').forEach(sensor => {
        let hasMissingData = false;
        
        sensor.querySelectorAll('p').forEach(p => {
            const text = p.textContent;
            if (text.includes('None') || text.includes('null') || text.includes('undefined')) {
                p.innerHTML = p.innerHTML.replace(
                    /None|null|undefined/g, 
                    '<span style="color: #e74c3c; font-style: italic;">--</span>'
                );
                hasMissingData = true;
            } else if (text.match(/:\s*0\s*$/)) {
                const valueSpan = p.querySelector('.value');
                if (valueSpan && valueSpan.textContent === '0') {
                    const sensorType = detectSensorType(sensor);
                    if (sensorType !== 'npk' && sensorType !== 'co2' && sensorType !== 'pm25') {
                        valueSpan.style.opacity = '0.5';
                        valueSpan.title = 'ไม่มีข้อมูล';
                    }
                }
            }
        });
        
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
// 8. Utility Functions
// ===========================
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

function getCurrentFarm() {
    const backgroundImage = document.querySelector('.background-image');
    if (backgroundImage) {
        if (backgroundImage.classList.contains('farm1')) return 'farm1';
        if (backgroundImage.classList.contains('farm2')) return 'farm2';
    }
    return null;
}

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
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .notification {
            animation: slideInRight 0.3s ease-out;
        }
        
        /* Professional scaling transitions */
        .scaling-wrapper {
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        /* Prevent layout shift during scaling */
        .sensor-value {
            will-change: transform;
            backface-visibility: hidden;
            -webkit-font-smoothing: antialiased;
        }
    `;
    document.head.appendChild(style);
}

// ===========================
// 9. Simple Boundary Check (Optional)
// ===========================
function checkSensorPositions() {
    // With percentage positioning, boundary issues are rare
    // This function is now much simpler and mainly for debugging
    const sensors = document.querySelectorAll('.sensor-value');
    
    sensors.forEach(sensor => {
        const rect = sensor.getBoundingClientRect();
        const container = document.querySelector('.background-image').getBoundingClientRect();
        
        // Check if sensor is outside container (edge case)
        if (rect.right > container.right || rect.bottom > container.bottom) {
            sensor.classList.add('edge-sensor');
            console.warn(`Sensor ${sensor.id} may be at edge of container`);
        }
    });
}

// ===========================
// 10. Initialization
// ===========================
document.addEventListener('DOMContentLoaded', function() {
    // Auto-inject Font Awesome if not present
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const fontAwesome = document.createElement('link');
        fontAwesome.rel = 'stylesheet';
        fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
        document.head.appendChild(fontAwesome);
    }
    
    // Add animation styles
    addAnimationStyles();
    
    // Initialize simple responsive system
    initializeResponsiveSystem();
    
    // Optional boundary check
    checkSensorPositions();
    
    // Add icons to sensor titles
    setTimeout(() => {
        addSensorIcons();
    }, 500);
    
    // Set last update time (when page loaded)
    updateLastUpdateTime();
    // No need to update every second - this shows when data was last refreshed
    
    // Format sensor values
    formatSensorValues();
    
    // Check for missing data
    checkMissingData();
    
    // Initialize interactive features
    initInteractiveFeatures();
    
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
            z-index: 1000;
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
        refreshBtn.style.cssText = `
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            z-index: 200 !important;
        `;
        refreshBtn.onclick = refreshSensorData;
        document.body.appendChild(refreshBtn);
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
        farmIndicator.style.cssText = `
            position: absolute;
            top: 15px;
            left: 15px;
            background: rgba(255, 255, 255, 0.25);
            backdrop-filter: blur(10px);
            padding: 8px 16px;
            border-radius: 10px;
            font-size: 0.9rem;
            font-weight: 700;
            color: #10b981;
            border: 1px solid rgba(255, 255, 255, 0.3);
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            animation: slideRight 0.6s ease-out;
            z-index: 90;
        `;
        document.querySelector('.background-image').appendChild(farmIndicator);
    }
    
    // Welcome message
    setTimeout(() => {
        showNotification('👋 ยินดีต้อนรับสู่ Smart Farm Dashboard', 'info');
    }, 1000);
});

// ===========================
// 11. Export API
// ===========================
window.smartfarm = {
    refresh: refreshSensorData,
    updateTime: updateCurrentTimeAndDate,
    toggleDarkMode: () => document.querySelector('.dark-mode-toggle').click(),
    showNotification: showNotification,
    getState: () => state,
    getSensorHistory: (sensorId) => state.sensorHistory[sensorId] || [],
    getCurrentScale: () => state.currentScale,
    updateResponsive: () => updateResponsiveElements(),
    // Debug helper to get pixel positions
    getPixelPositions: () => {
        const positions = {};
        document.querySelectorAll('.sensor-value').forEach(sensor => {
            const computedStyle = window.getComputedStyle(sensor);
            positions[sensor.id] = {
                top: computedStyle.top,
                left: computedStyle.left,
                width: sensor.offsetWidth + 'px',
                height: sensor.offsetHeight + 'px'
            };
        });
        console.table(positions);
        return positions;
    },
    // Check boundary violations
    checkBoundaries: () => {
        const violations = [];
        const baseWidth = CONFIG.baseDimensions.width;
        const baseHeight = CONFIG.baseDimensions.height;
        
        document.querySelectorAll('.sensor-value').forEach(sensor => {
            const left = parseInt(window.getComputedStyle(sensor).left);
            const top = parseInt(window.getComputedStyle(sensor).top);
            const width = sensor.offsetWidth;
            const height = sensor.offsetHeight;
            
            if (left < CONFIG.boundaries.minLeft || 
                left + width > baseWidth - CONFIG.boundaries.maxRightOffset ||
                top < CONFIG.boundaries.minTop || 
                top + height > baseHeight - CONFIG.boundaries.maxBottomOffset) {
                violations.push({
                    id: sensor.id,
                    position: { left, top, width, height },
                    issues: []
                });
                
                if (left < CONFIG.boundaries.minLeft) violations[violations.length-1].issues.push('Too far left');
                if (left + width > baseWidth - CONFIG.boundaries.maxRightOffset) violations[violations.length-1].issues.push('Too far right');
                if (top < CONFIG.boundaries.minTop) violations[violations.length-1].issues.push('Too far up');
                if (top + height > baseHeight - CONFIG.boundaries.maxBottomOffset) violations[violations.length-1].issues.push('Too far down');
            }
        });
        
        if (violations.length > 0) {
            console.warn('⚠️ Boundary violations found:', violations);
        } else {
            console.log('✅ All sensors within boundaries');
        }
        
        return violations;
    }
};