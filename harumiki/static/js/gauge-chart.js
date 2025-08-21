/* static/css/gauge-chart.js */
/**
 * Gauge Chart JavaScript for Harumiki Smart Farm
 * Creates and manages gauge charts using Canvas API
 * Fixed to include all required soil moisture gauges
 */

// ========== Gauge Chart Class ==========
class GaugeChart {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            if (window.harumikiUtils && window.harumikiUtils.logger) {
                window.harumikiUtils.logger.error(`Canvas element with id "${canvasId}" not found`);
            }
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.options = {
            min: options.min || 0,
            max: options.max || 100,
            value: options.value || 0,
            title: options.title || '',
            unit: options.unit || '%',
            thresholds: options.thresholds || {
                good: 80,
                warning: 60
            },
            colors: options.colors || {
                good: '#3cd278',
                warning: '#ffb74c',
                danger: '#ff4c61'
            },
            size: options.size || 200
        };
        
        this.init();
    }
    
    init() {
        // Set canvas size
        this.canvas.width = this.options.size;
        this.canvas.height = this.options.size / 2 + 20;
        
        // Draw the gauge
        this.draw();
    }
    
    draw() {
        const ctx = this.ctx;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height - 20;
        const radius = Math.min(centerX, centerY) - 10;
        
        // Clear canvas
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background arc
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, Math.PI, 2 * Math.PI, false);
        ctx.lineWidth = 20;
        ctx.strokeStyle = '#e0e0e0';
        ctx.stroke();
        
        // Calculate value percentage
        const percentage = (this.options.value - this.options.min) / (this.options.max - this.options.min);
        const endAngle = Math.PI + (Math.PI * percentage);
        
        // Determine color based on thresholds
        let color = this.options.colors.danger;
        if (percentage >= this.options.thresholds.good / 100) {
            color = this.options.colors.good;
        } else if (percentage >= this.options.thresholds.warning / 100) {
            color = this.options.colors.warning;
        }
        
        // Draw value arc
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, Math.PI, endAngle, false);
        ctx.lineWidth = 20;
        ctx.strokeStyle = color;
        ctx.stroke();
        
        // Draw center circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - 30, 0, 2 * Math.PI, false);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        
        // Draw value text
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Format number with comma
        const formattedValue = this.options.value.toLocaleString('en-US', {
            minimumFractionDigits: this.options.unit === '%' ? 1 : 2,
            maximumFractionDigits: this.options.unit === '%' ? 1 : 2
        });
        ctx.fillText(formattedValue + this.options.unit, centerX, centerY - 10);
        
        // Draw title
        ctx.font = '14px Arial';
        ctx.fillStyle = '#666';
        ctx.fillText(this.options.title, centerX, centerY + 15);
    }
    
    updateValue(newValue) {
        this.options.value = newValue;
        this.draw();
    }
}

// ========== Initialize All Gauges ==========
document.addEventListener('DOMContentLoaded', function() {
    if (window.harumikiUtils && window.harumikiUtils.logger) {
        window.harumikiUtils.logger.log('Initializing gauge charts...');
    }
    
    // Water gauges
    const ecwmValue = parseFloat(document.getElementById('VECWM')?.textContent || 0);
    const tempwmValue = parseFloat(document.getElementById('VTEMPWM')?.textContent || 0);
    
    // Create water quality gauges
    if (document.getElementById('gaugeECWM')) {
        new GaugeChart('gaugeECWM', {
            value: ecwmValue,
            max: 1000,
            title: 'EC WM',
            unit: ' μS/cm',
            thresholds: { good: 84, warning: 80 }
        });
    }
    
    if (document.getElementById('gaugeTEMPWM')) {
        new GaugeChart('gaugeTEMPWM', {
            value: tempwmValue,
            max: 100,
            title: 'TEMP WM',
            unit: ' °C',
            thresholds: { good: 84, warning: 80 }
        });
    }
    
    // Soil moisture gauges - Complete list for both farms
    const soilGauges = [
        // Farm 1 gauges
        { id: 'gaugeR8G1', valueId: 'VR8G1', title: 'Soil R8-1' },
        { id: 'gaugeR8G2', valueId: 'VR8G2', title: 'Soil R8-2' },
        { id: 'gaugeR16G1', valueId: 'VR16G1', title: 'Soil R16-1' },
        { id: 'gaugeR16G2', valueId: 'VR16G2', title: 'Soil R16-2' }, // FIXED: Added missing gauge
        { id: 'gaugeR24G1', valueId: 'VR24G1', title: 'Soil R24-1' },
        { id: 'gaugeR24G2', valueId: 'VR24G2', title: 'Soil R24-2' },
        
        // Farm 2 additional gauges
        { id: 'gaugeR8G3', valueId: 'VR8G3', title: 'Soil R8-3' },
        { id: 'gaugeR24G3', valueId: 'VR24G3', title: 'Soil R24-3' }
    ];
    
    // Create soil moisture gauges
    soilGauges.forEach(gauge => {
        const canvasElement = document.getElementById(gauge.id);
        const valueElement = document.getElementById(gauge.valueId);
        
        if (canvasElement && valueElement) {
            const value = parseFloat(valueElement.textContent || 0);
            if (window.harumikiUtils && window.harumikiUtils.logger) {
                window.harumikiUtils.logger.log(`Creating gauge ${gauge.id} with value ${value}`);
            }
            
            new GaugeChart(gauge.id, {
                value: value,
                max: 100,
                title: gauge.title,
                unit: '%',
                thresholds: { good: 40, warning: 20 }  // Suitable for soil moisture
            });
        } else {
            if (!canvasElement) {
                if (window.harumikiUtils && window.harumikiUtils.logger) {
                    window.harumikiUtils.logger.warn(`Canvas element ${gauge.id} not found`);
                }
            }
            if (!valueElement) {
                if (window.harumikiUtils && window.harumikiUtils.logger) {
                    window.harumikiUtils.logger.warn(`Value element ${gauge.valueId} not found`);
                }
            }
        }
    });
    
    if (window.harumikiUtils && window.harumikiUtils.logger) {
        window.harumikiUtils.logger.log('Gauge initialization completed');
    }
    // Format gauge info values - ย้ายมาไว้ตรงนี้
    setTimeout(() => {
        document.querySelectorAll('.gauge-info .gauge-value').forEach(element => {
            const text = element.textContent;
            const match = text.match(/^([\d.]+)(.*)$/);
            if (match) {
                const value = parseFloat(match[1]);
                const unit = match[2];
                
                let decimals = 2;
                if (unit.includes('°C')) decimals = 1;
                else if (unit.includes('%')) decimals = 1;
                
                const formatted = value.toLocaleString('en-US', {
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals
                });
                
                element.textContent = formatted + unit;
            }
        });
    }, 100); // delay เล็กน้อยให้ gauge render เสร็จก่อน
});

// ========== Alternative Gauge Using Chart.js (if available) ==========
function createChartJsGauge(canvasId, value, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;
    
    const data = {
        datasets: [{
            data: [value, options.max - value],
            backgroundColor: [
                value >= options.thresholds.good ? '#3cd278' : 
                value >= options.thresholds.warning ? '#ffb74c' : '#ff4c61',
                '#e0e0e0'
            ],
            borderWidth: 0
        }]
    };
    
    const config = {
        type: 'doughnut',
        data: data,
        options: {
            rotation: -90,
            circumference: 180,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            cutout: '70%'
        }
    };
    
    new Chart(canvas, config);
}

// ========== Debug Function ==========
function debugGauges() {
    if (window.harumikiUtils && window.harumikiUtils.logger) {
        window.harumikiUtils.logger.log('=== Gauge Debug Info ===');
    }
    
    // Check water gauge values
    const ecwm = document.getElementById('VECWM')?.textContent;
    const tempwm = document.getElementById('VTEMPWM')?.textContent;
    if (window.harumikiUtils && window.harumikiUtils.logger) {
        window.harumikiUtils.logger.log('Water Values:', { ecwm, tempwm });
    }
    
    // Check soil gauge values
    const soilValues = {};
    ['VR8G1', 'VR8G2', 'VR16G1', 'VR16G2', 'VR24G1', 'VR24G2', 'VR8G3', 'VR24G3'].forEach(id => {
        const element = document.getElementById(id);
        soilValues[id] = element ? element.textContent : 'NOT FOUND';
    });
    if (window.harumikiUtils && window.harumikiUtils.logger) {
        window.harumikiUtils.logger.log('Soil Values:', soilValues);
    }
    
    // Check canvas elements
    const canvasElements = {};
    ['gaugeECWM', 'gaugeTEMPWM', 'gaugeR8G1', 'gaugeR8G2', 'gaugeR16G1', 'gaugeR16G2', 'gaugeR24G1', 'gaugeR24G2', 'gaugeR8G3', 'gaugeR24G3'].forEach(id => {
        canvasElements[id] = document.getElementById(id) ? 'EXISTS' : 'NOT FOUND';
    });
    if (window.harumikiUtils && window.harumikiUtils.logger) {
        window.harumikiUtils.logger.log('Canvas Elements:', canvasElements);
    }
}

// ========== Export functions ==========
window.gaugeChartFunctions = {
    GaugeChart,
    createChartJsGauge,
    debugGauges
};

// ========== Make GaugeChart globally available ==========
window.GaugeChart = GaugeChart;
window.debugGauges = debugGauges;