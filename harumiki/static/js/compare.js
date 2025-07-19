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
            }
        }
    },
    scales: {
        x: {
            type: 'time',
            time: {
                unit: 'day',
                displayFormats: {
                    day: 'dd'
                }
            },
            grid: {
                display: true,
                color: colors.grid
            },
            ticks: {
                color: colors.text,
                maxTicksLimit: 15
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

// Helper function to get data
function getChartData(dataKey) {
    const element = document.getElementById('chart-data');
    const data = element.getAttribute(`data-${dataKey}`);
    
    if (!data || data === 'None' || data === '') return [];
    
    try {
        return JSON.parse(data.replace(/'/g, '"'));
    } catch (e) {
        console.error(`Error parsing ${dataKey}:`, e);
        return [];
    }
}

// Initialize all charts when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializePMChart();
    initializeCO2Chart();
    initializeLuxUvChart();
    initializePPFDChart();
    initializeNitrogenChart();
    initializePhosphorusChart();
    initializePotassiumChart();
    initializeTempSoilChart();
    initializeTempAirWaterChart();
    initializeHumidityChart();
    initializeMoistureChart();
    initializeECChart();
});

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
    const timeLabels = getChartData('co2-farm1-times');
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                {
                    label: 'CO2_Farm1',
                    data: getChartData('co2-farm1'),
                    borderColor: colors.farm1,
                    backgroundColor: colors.farm1 + '20',
                    borderWidth: 2,
                    tension: 0.1
                },
                {
                    label: 'CO2_Farm2',
                    data: getChartData('co2-farm2'),
                    borderColor: colors.farm2,
                    backgroundColor: colors.farm2 + '20',
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
                },
                {
                    label: 'EC Pure Water',
                    data: getChartData('ecwp'),
                    borderColor: '#E91E63',
                    backgroundColor: '#E91E63' + '20',
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

// Export functions for external use
window.compareCharts = {
    refresh: function() {
        location.reload();
    }
};