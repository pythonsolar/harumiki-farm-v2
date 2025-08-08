/* static/css/graph-combined.js */
/**
 * graph-combined.js
 * Graph Charts Configuration for Harumiki Smart Farm - Farm 1 & 2
 * Modern Chart.js 3.x implementation with enhanced features
 */

// Detect current farm from URL
const currentFarm = window.location.pathname.includes('graph-2') ? 2 : 1;

// Chart color palette
const chartColors = {
    primary: 'rgb(102, 126, 234)',
    secondary: 'rgb(118, 75, 162)',
    success: 'rgb(60, 210, 120)',
    warning: 'rgb(255, 183, 76)',
    danger: 'rgb(255, 76, 97)',
    info: 'rgb(79, 195, 247)',
    light: 'rgb(248, 249, 250)',
    dark: 'rgb(44, 62, 80)',
    purple: 'rgb(153, 102, 255)',
    orange: 'rgb(255, 159, 64)',
    teal: 'rgb(75, 192, 192)',
    pink: 'rgb(255, 99, 132)',
    lime: 'rgb(205, 220, 57)',
    indigo: 'rgb(75, 0, 130)'
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
            display: true,
            position: 'top',
            labels: {
                usePointStyle: true,
                padding: 15,
                font: {
                    size: 12,
                    family: "'Inter', sans-serif"
                }
            }
        },
        tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleFont: {
                size: 13,
                weight: 'bold'
            },
            bodyFont: {
                size: 12
            },
            padding: 12,
            cornerRadius: 8,
            displayColors: true,
            callbacks: {
                label: function(context) {
                    let label = context.dataset.label || '';
                    if (label) {
                        label += ': ';
                    }
                    if (context.parsed.y !== null) {
                        label += context.parsed.y.toFixed(2);
                    }
                    return label;
                }
            }
        }
    },
    scales: {
        x: {
            type: 'time',
            time: {
                unit: 'hour',
                displayFormats: {
                    hour: 'HH:mm'
                }
            },
            grid: {
                display: true,
                drawBorder: false,
                color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
                maxTicksLimit: 10,
                font: {
                    size: 11
                }
            }
        },
        y: {
            beginAtZero: true,
            grid: {
                display: true,
                drawBorder: false,
                color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
                font: {
                    size: 11
                }
            }
        }
    }
};

// Helper function to get chart data - FIXED VERSION
function getChartData(dataKey) {
    const element = document.getElementById('chart-data');
    const data = element.getAttribute(`data-${dataKey}`);
    
    if (!data || data === 'None' || data === '') return [];
    
    try {
        // Handle Python list format [value1, value2, ...]
        let cleanData = data.replace(/'/g, '"');
        return JSON.parse(cleanData);
    } catch (e) {
        if (window.harumikiUtils && window.harumikiUtils.logger) {
            window.harumikiUtils.logger.error(`Error parsing ${dataKey}:`, e);
            window.harumikiUtils.logger.log(`Raw data for ${dataKey}:`, data);
        }
        return [];
    }
}

// Align data for multiple datasets with potentially different timestamps
function alignDatasets(timestamps1, values1, timestamps2, values2) {
    // Create maps for quick lookup
    const data1Map = new Map();
    const data2Map = new Map();
    
    // Populate maps
    timestamps1.forEach((ts, idx) => {
        if (ts && values1[idx] !== undefined) {
            data1Map.set(ts, values1[idx]);
        }
    });
    
    timestamps2.forEach((ts, idx) => {
        if (ts && values2[idx] !== undefined) {
            data2Map.set(ts, values2[idx]);
        }
    });
    
    // Get all unique timestamps and sort them
    const allTimestamps = [...new Set([...timestamps1, ...timestamps2])].filter(ts => ts).sort();
    
    // Create aligned datasets
    const alignedValues1 = [];
    const alignedValues2 = [];
    
    allTimestamps.forEach(ts => {
        // Use null for missing data points to create gaps in the line
        alignedValues1.push(data1Map.has(ts) ? data1Map.get(ts) : null);
        alignedValues2.push(data2Map.has(ts) ? data2Map.get(ts) : null);
    });
    
    return {
        timestamps: allTimestamps,
        values1: alignedValues1,
        values2: alignedValues2
    };
}


// Initialize all charts when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    
    if (window.harumikiUtils && window.harumikiUtils.logger) {
        window.harumikiUtils.logger.log(`Initializing charts for Farm ${currentFarm}`);
    }
    
    // Check if Chart.js is available
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded!');
        return;
    }
    
    initializePMChart();
    initializeCO2Chart();
    initializeLightCharts();
    initializePPFDChart();
    initializeNPKChart();
    initializeTemperatureChart();
    initializeHumidityChart();
    initializeECChart();
});

// PM2.5 Chart
function initializePMChart() {
    const ctx = document.getElementById('pmChart').getContext('2d');
    
    let pmInTimes, pmInValues, pmOutsideTimes, pmOutsideValues, labelIn;
    
    if (currentFarm === 1) {
        pmInTimes = getChartData('pm-r1-times') || getChartData('pm-outside-times');
        pmInValues = getChartData('pm-r1');
        pmOutsideTimes = getChartData('pm-outside-times');
        pmOutsideValues = getChartData('pm-outside');
        labelIn = 'PM2.5 Inside Farm1';
    } else {
        pmInTimes = getChartData('pm-r2-times');
        pmInValues = getChartData('pm-r2');
        pmOutsideTimes = getChartData('pm-outside-times');
        pmOutsideValues = getChartData('pm-outside');
        labelIn = 'PM2.5 R2';
    }

    // Align datasets to handle missing data
    const aligned = alignDatasets(pmInTimes, pmInValues, pmOutsideTimes, pmOutsideValues);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: aligned.timestamps,
            datasets: [
                {
                    label: labelIn,
                    data: aligned.values1,
                    borderColor: chartColors.teal,
                    backgroundColor: chartColors.teal + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    spanGaps: false, // Don't connect lines across null values
                    pointBackgroundColor: aligned.values1.map(value => 
                        value > 75 ? chartColors.danger : chartColors.teal
                    )
                },
                {
                    label: 'PM2.5 Outside',
                    data: aligned.values2,
                    borderColor: chartColors.danger,
                    backgroundColor: chartColors.danger + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    spanGaps: false, // Don't connect lines across null values
                    pointBackgroundColor: aligned.values2.map(value => 
                        value > 75 ? chartColors.dark : chartColors.danger
                    )
                }
            ]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                tooltip: {
                    ...commonOptions.plugins.tooltip,
                    filter: function(tooltipItem) {
                        // Hide tooltip for null values
                        return tooltipItem.raw !== null;
                    }
                }
            }
        }
    });
}

// CO2 Chart
function initializeCO2Chart() {
    const ctx = document.getElementById('CO2_Chart').getContext('2d');
    
    // Get timestamps and values for both farms
    const co2R1Times = getChartData('co2-r1-times');
    const co2R1Values = getChartData('co2-r1');
    const co2R2Times = getChartData('co2-r2-times');
    const co2R2Values = getChartData('co2-r2');
    
    // Debug logging for CO2 data comparison
    console.log('CO2 Data Debug:');
    console.log(`CO2_R1: ${co2R1Values.length} values, first 5:`, co2R1Values.slice(0, 5));
    console.log(`CO2_R2: ${co2R2Values.length} values, first 5:`, co2R2Values.slice(0, 5));
    console.log(`CO2_R1 times: ${co2R1Times.length}, CO2_R2 times: ${co2R2Times.length}`);
    
    // Align datasets to handle missing data
    const aligned = alignDatasets(co2R1Times, co2R1Values, co2R2Times, co2R2Values);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: aligned.timestamps,
            datasets: [
                {
                    label: 'CO2 Farm 1',
                    data: aligned.values1,
                    borderColor: chartColors.success,
                    backgroundColor: chartColors.success + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    spanGaps: false // Don't connect lines across null values
                },
                {
                    label: 'CO2 Farm 2',
                    data: aligned.values2,
                    borderColor: chartColors.info,
                    backgroundColor: chartColors.info + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    spanGaps: false // Don't connect lines across null values
                }
            ]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                tooltip: {
                    ...commonOptions.plugins.tooltip,
                    filter: function(tooltipItem) {
                        // Hide tooltip for null values
                        return tooltipItem.raw !== null;
                    }
                },
                annotation: {
                    annotations: {
                        line1: {
                            type: 'line',
                            yMin: 1000,
                            yMax: 1000,
                            borderColor: chartColors.warning,
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                content: 'High CO2 Level',
                                enabled: true,
                                position: 'end'
                            }
                        }
                    }
                }
            }
        }
    });
}

// Light Charts (LUX & UV)
function initializeLightCharts() {
    const ctx = document.getElementById('SunChart').getContext('2d');
    
    let luxTimes, luxValues, uvTimes, uvValues, uvLabel, luxLabel;
    
    if (currentFarm === 1) {
        uvTimes = getChartData('uv-r8-times');
        luxTimes = getChartData('lux-r8-times') || uvTimes; // Fallback to UV times if LUX times not available
        luxValues = getChartData('lux-r8');
        uvValues = getChartData('uv-r8');
        uvLabel = 'UV R8';
        luxLabel = 'LUX R8';
    } else {
        uvTimes = getChartData('uv-r24-times');
        luxTimes = getChartData('lux-r24-times') || uvTimes; // Fallback to UV times if LUX times not available
        luxValues = getChartData('lux-r24');
        uvValues = getChartData('uv-r24');
        uvLabel = 'UV R24';
        luxLabel = 'LUX R24';
    }

    // Align datasets to handle missing data
    const aligned = alignDatasets(luxTimes, luxValues, uvTimes, uvValues);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: aligned.timestamps,
            datasets: [
                {
                    label: uvLabel,
                    data: aligned.values2,
                    borderColor: chartColors.purple,
                    backgroundColor: chartColors.purple + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    yAxisID: 'y-uv',
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    spanGaps: false
                },
                {
                    label: luxLabel,
                    data: aligned.values1,
                    borderColor: currentFarm === 1 ? chartColors.orange : chartColors.warning,
                    backgroundColor: currentFarm === 1 ? chartColors.orange + '20' : chartColors.warning + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    yAxisID: 'y-lux',
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    spanGaps: false
                }
            ]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                tooltip: {
                    ...commonOptions.plugins.tooltip,
                    filter: function(tooltipItem) {
                        // Hide tooltip for null values
                        return tooltipItem.raw !== null;
                    }
                }
            },
            scales: {
                ...commonOptions.scales,
                'y-uv': {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'UV (nm)',
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                },
                'y-lux': {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'LUX',
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

// PPFD Chart
function initializePPFDChart() {
    const ctx = document.getElementById('ppfd_Chart').getContext('2d');
    
    let ppfd1Times, ppfd1Values, ppfd2Times, ppfd2Values, label1, label2;
    
    if (currentFarm === 1) {
        ppfd1Times = getChartData('ppfd3-times');
        ppfd2Times = getChartData('ppfd4-times') || ppfd1Times; // Fallback to ppfd3 times if ppfd4 times not available
        ppfd1Values = getChartData('ppfd3');
        ppfd2Values = getChartData('ppfd4');
        label1 = 'PPFD R8';
        label2 = 'PPFD R24';
    } else {
        ppfd1Times = getChartData('ppfd-r16-times');
        ppfd2Times = getChartData('ppfd-r24-times') || ppfd1Times; // Fallback to r16 times if r24 times not available
        ppfd1Values = getChartData('ppfd-r16');
        ppfd2Values = getChartData('ppfd-r24');
        label1 = 'PPFD R16';
        label2 = 'PPFD R24';
    }

    // Align datasets to handle missing data
    const aligned = alignDatasets(ppfd1Times, ppfd1Values, ppfd2Times, ppfd2Values);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: aligned.timestamps,
            datasets: [
                {
                    label: label1,
                    data: aligned.values1,
                    borderColor: currentFarm === 1 ? chartColors.success : chartColors.teal,
                    backgroundColor: currentFarm === 1 ? chartColors.success + '20' : chartColors.teal + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    spanGaps: false,
                    pointBackgroundColor: currentFarm === 2 ? aligned.values1.map(value => 
                        value !== null && value < 400 ? chartColors.danger : chartColors.teal
                    ) : undefined
                },
                {
                    label: label2,
                    data: aligned.values2,
                    borderColor: currentFarm === 1 ? chartColors.info : chartColors.pink,
                    backgroundColor: currentFarm === 1 ? chartColors.info + '20' : chartColors.pink + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    spanGaps: false,
                    pointBackgroundColor: currentFarm === 2 ? aligned.values2.map(value => 
                        value !== null && value < 400 ? chartColors.danger : chartColors.pink
                    ) : undefined
                }
            ]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                tooltip: {
                    ...commonOptions.plugins.tooltip,
                    filter: function(tooltipItem) {
                        // Hide tooltip for null values
                        return tooltipItem.raw !== null;
                    }
                },
                annotation: currentFarm === 2 ? {
                    annotations: {
                        line1: {
                            type: 'line',
                            yMin: 400,
                            yMax: 400,
                            borderColor: chartColors.danger,
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                content: 'Minimum PPFD (<400)',
                                enabled: true,
                                position: 'start',
                                backgroundColor: chartColors.danger,
                                color: 'white',
                                font: {
                                    size: 11
                                }
                            }
                        }
                    }
                } : undefined
            },
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    title: {
                        display: currentFarm === 1,
                        text: 'PPFD (μmol/m²/s)'
                    }
                }
            }
        }
    });
}

// NPK Chart
function initializeNPKChart() {
    const ctx = document.getElementById('NPK_Chart').getContext('2d');
    const xValues = getChartData('nitrogen-r8-times');
    
    const datasets = [
        // Nitrogen
        { label: 'Nitrogen R8', data: getChartData('nitrogen-r8'), color: 'rgb(0, 0, 255)' },
        { label: 'Nitrogen R16', data: getChartData('nitrogen-r16'), color: 'rgb(255, 0, 0)' },
        { label: 'Nitrogen R24', data: getChartData('nitrogen-r24'), color: 'rgb(0, 255, 0)' },
        // Phosphorus
        { label: 'Phosphorus R8', data: getChartData('phosphorus-r8'), color: 'rgb(255, 165, 0)' },
        { label: 'Phosphorus R16', data: getChartData('phosphorus-r16'), color: 'rgb(128, 0, 128)' },
        { label: 'Phosphorus R24', data: getChartData('phosphorus-r24'), color: 'rgb(255, 255, 0)' },
        // Potassium
        { label: 'Potassium R8', data: getChartData('potassium-r8'), color: 'rgb(255, 192, 203)' },
        { label: 'Potassium R16', data: getChartData('potassium-r16'), color: 'rgb(173, 216, 230)' },
        { label: 'Potassium R24', data: getChartData('potassium-r24'), color: 'rgb(144, 238, 144)' }
    ];

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: xValues,
            datasets: datasets.map(dataset => ({
                label: dataset.label,
                data: dataset.data,
                borderColor: dataset.color,
                backgroundColor: dataset.color + '20',
                borderWidth: 2,
                tension: 0.1,
                pointRadius: 2,
                pointHoverRadius: 4,
                spanGaps: false,
                pointBackgroundColor: dataset.data.map(value => 
                    value > 300 ? chartColors.danger : dataset.color
                )
            }))
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                tooltip: {
                    ...commonOptions.plugins.tooltip,
                    filter: function(tooltipItem) {
                        // Hide tooltip for null values
                        return tooltipItem.raw !== null;
                    }
                },
                legend: {
                    ...commonOptions.plugins.legend,
                    labels: {
                        ...commonOptions.plugins.legend.labels,
                        boxWidth: 20,
                        font: {
                            size: 10
                        }
                    }
                },
                annotation: currentFarm === 2 ? {
                    annotations: {
                        line1: {
                            type: 'line',
                            yMin: 300,
                            yMax: 300,
                            borderColor: chartColors.danger,
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                content: 'High Level (>300)',
                                enabled: true,
                                position: 'end',
                                backgroundColor: chartColors.danger,
                                color: 'white',
                                font: {
                                    size: 11
                                }
                            }
                        }
                    }
                } : undefined
            }
        }
    });
}

// Temperature Chart
function initializeTemperatureChart() {
    const ctx = document.getElementById('Temp_env_Chart').getContext('2d');
    const xValues = getChartData('temp-npk-r8-times');
    
    let datasets;
    if (currentFarm === 1) {
        datasets = [
            { label: 'Air Temp R8', data: getChartData('air-temp-r8'), color: chartColors.teal },
            { label: 'Air Temp R16', data: getChartData('air-temp-r16'), color: chartColors.primary },
            { label: 'Air Temp R24', data: getChartData('air-temp-r24'), color: chartColors.pink },
            { label: 'Soil Temp R8', data: getChartData('temp-npk-r8'), color: chartColors.orange },
            { label: 'Soil Temp R16', data: getChartData('temp-npk-r16'), color: chartColors.purple },
            { label: 'Soil Temp R24', data: getChartData('temp-npk-r24'), color: chartColors.lime },
            { label: 'Water Temp', data: getChartData('temp-wm'), color: chartColors.warning }
        ];
    } else {
        datasets = [
            { label: 'Air Temp R8', data: getChartData('air-temp-r8'), color: chartColors.teal },
            { label: 'Air Temp R16', data: getChartData('air-temp-r16'), color: chartColors.primary },
            { label: 'Air Temp R24', data: getChartData('air-temp-r24'), color: chartColors.pink },
            { label: 'Soil Temp R8', data: getChartData('temp-npk-r8'), color: chartColors.orange },
            { label: 'Soil Temp R16', data: getChartData('temp-npk-r16'), color: chartColors.purple },
            { label: 'Soil Temp R24', data: getChartData('temp-npk-r24'), color: chartColors.lime },
            { label: 'Mix Water Temp', data: getChartData('temp-wm'), color: chartColors.warning }
        ];
    }

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: xValues,
            datasets: datasets.map(dataset => ({
                label: dataset.label,
                data: dataset.data,
                borderColor: dataset.color,
                backgroundColor: dataset.color + '20',
                borderWidth: 2,
                tension: 0.1,
                pointRadius: 2,
                pointHoverRadius: 4,
                spanGaps: false,
                pointBackgroundColor: dataset.data.map((value, index) => {
                    const hour = new Date(xValues[index]).getHours();
                    if (hour >= 6 && hour < 18) {
                        return value > 30 ? chartColors.danger : dataset.color;
                    } else {
                        return value > 20 ? chartColors.info : dataset.color;
                    }
                })
            }))
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                tooltip: {
                    ...commonOptions.plugins.tooltip,
                    filter: function(tooltipItem) {
                        // Hide tooltip for null values
                        return tooltipItem.raw !== null;
                    }
                },
                annotation: {
                    annotations: {
                        dayLine: {
                            type: 'line',
                            yMin: 30,
                            yMax: 30,
                            borderColor: chartColors.danger,
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                content: 'Day Limit (>30°C)',
                                enabled: true,
                                position: 'end',
                                backgroundColor: chartColors.danger,
                                color: 'white',
                                font: { size: 11 }
                            }
                        },
                        nightLine: {
                            type: 'line',
                            yMin: 20,
                            yMax: 20,
                            borderColor: chartColors.info,
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                content: 'Night Limit (>20°C)',
                                enabled: true,
                                position: 'start',
                                backgroundColor: chartColors.info,
                                color: 'white',
                                font: { size: 11 }
                            }
                        }
                    }
                }
            }
        }
    });
}

// Humidity & Moisture Chart
function initializeHumidityChart() {
    const ctx = document.getElementById('hum_mois_env_Chart').getContext('2d');
    const xValues = getChartData('air-hum-r8-times');
    
    let datasets;
    if (currentFarm === 1) {
        datasets = [
            // Air Humidity
            { label: 'Air Humidity R8', data: getChartData('air-hum-r8'), color: chartColors.teal, type: 'air' },
            { label: 'Air Humidity R16', data: getChartData('air-hum-r16'), color: chartColors.primary, type: 'air' },
            { label: 'Air Humidity R24', data: getChartData('air-hum-r24'), color: chartColors.pink, type: 'air' },
            // Soil Moisture
            { label: 'Soil R8-End', data: getChartData('soil7'), color: chartColors.purple, type: 'soil' },
            { label: 'Soil R8-Start', data: getChartData('soil8'), color: chartColors.orange, type: 'soil' },
            { label: 'Soil R16-End', data: getChartData('soil9'), color: chartColors.lime, type: 'soil' },
            { label: 'Soil R16-Start', data: getChartData('soil10'), color: chartColors.info, type: 'soil' },
            { label: 'Soil R24-End', data: getChartData('soil11'), color: chartColors.secondary, type: 'soil' },
            { label: 'Soil R24-Start', data: getChartData('soil12'), color: chartColors.warning, type: 'soil' }
        ];
    } else {
        datasets = [
            // Air Humidity
            { label: 'Air Hum R8', data: getChartData('air-hum-r8'), color: chartColors.teal, type: 'air' },
            { label: 'Air Hum R16', data: getChartData('air-hum-r16'), color: chartColors.primary, type: 'air' },
            { label: 'Air Hum R24', data: getChartData('air-hum-r24'), color: chartColors.pink, type: 'air' },
            // Soil Moisture
            { label: 'Soil R8 ท้าย', data: getChartData('soil1'), color: chartColors.purple, type: 'soil' },
            { label: 'Soil R8 กลาง', data: getChartData('soil2'), color: chartColors.orange, type: 'soil' },
            { label: 'Soil R8 หัว', data: getChartData('soil3'), color: chartColors.lime, type: 'soil' },
            { label: 'Soil R24 ท้าย', data: getChartData('soil4'), color: chartColors.indigo, type: 'soil' },
            { label: 'Soil R24 กลาง', data: getChartData('soil5'), color: chartColors.secondary, type: 'soil' },
            { label: 'Soil R24 หัว', data: getChartData('soil6'), color: chartColors.warning, type: 'soil' },
            { label: 'Soil R16 ท้าย', data: getChartData('soil13'), color: chartColors.success, type: 'soil' }
        ];
    }

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: xValues,
            datasets: datasets.map(dataset => ({
                label: dataset.label,
                data: dataset.data,
                borderColor: dataset.color,
                backgroundColor: dataset.color + '20',
                borderWidth: 2,
                tension: 0.1,
                pointRadius: 2,
                pointHoverRadius: 4,
                spanGaps: false,
                pointBackgroundColor: dataset.data.map((value, index) => {
                    const hour = new Date(xValues[index]).getHours();
                    if (dataset.type === 'air') {
                        if (hour >= 6 && hour < 18) {
                            return value < 40 ? chartColors.danger : dataset.color;
                        } else {
                            return value < 60 ? chartColors.info : dataset.color;
                        }
                    } else {
                        return value < 80 ? chartColors.danger : dataset.color;
                    }
                })
            }))
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                tooltip: {
                    ...commonOptions.plugins.tooltip,
                    filter: function(tooltipItem) {
                        // Hide tooltip for null values
                        return tooltipItem.raw !== null;
                    }
                },
                legend: {
                    ...commonOptions.plugins.legend,
                    labels: {
                        ...commonOptions.plugins.legend.labels,
                        boxWidth: 20,
                        font: {
                            size: 10
                        }
                    }
                },
                annotation: {
                    annotations: {
                        airDay: {
                            type: 'line',
                            yMin: 40,
                            yMax: 40,
                            borderColor: chartColors.danger,
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                content: 'Air Day (<40%)',
                                enabled: true,
                                position: 'end',
                                backgroundColor: chartColors.danger,
                                color: 'white',
                                font: { size: 10 }
                            }
                        },
                        airNight: {
                            type: 'line',
                            yMin: 60,
                            yMax: 60,
                            borderColor: chartColors.info,
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                content: 'Air Night (<60%)',
                                enabled: true,
                                position: 'center',
                                backgroundColor: chartColors.info,
                                color: 'white',
                                font: { size: 10 }
                            }
                        },
                        soil: {
                            type: 'line',
                            yMin: 80,
                            yMax: 80,
                            borderColor: chartColors.dark,
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                content: 'Soil Moisture (<80%)',
                                enabled: true,
                                position: 'start',
                                backgroundColor: chartColors.dark,
                                color: 'white',
                                font: { size: 10 }
                            }
                        }
                    }
                }
            }
        }
    });
}

// EC Chart
function initializeECChart() {
    const ctx = document.getElementById('EC_Chart').getContext('2d');
    
    // Get data for all EC sensors
    const ecwmTimes = getChartData('ecwm-times');
    const ecwmValues = getChartData('ecwm');
    const ecwpTimes = getChartData('ecwp-times');
    const ecwpValues = getChartData('ecwp');
    
    // Align datasets to handle missing data
    const aligned = alignDatasets(ecwmTimes, ecwmValues, ecwpTimes, ecwpValues);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: aligned.timestamps,
            datasets: [
                {
                    label: 'EC - Mixed Water',
                    data: aligned.values1,
                    borderColor: chartColors.primary,
                    backgroundColor: chartColors.primary + '20',
                    borderWidth: 3,
                    tension: 0.1,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    spanGaps: false,
                    pointBackgroundColor: aligned.values1.map(value => 
                        value > 1000 ? chartColors.danger : 
                        value < 700 ? chartColors.info : 
                        chartColors.primary
                    )
                },
                {
                    label: 'EC - Pure Water',
                    data: aligned.values2,
                    borderColor: chartColors.teal,
                    backgroundColor: chartColors.teal + '20',
                    borderWidth: 3,
                    tension: 0.1,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    spanGaps: false,
                    pointBackgroundColor: aligned.values2.map(value => 
                        value > 1000 ? chartColors.danger : 
                        value < 700 ? chartColors.info : 
                        chartColors.teal
                    )
                }
            ]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                tooltip: {
                    ...commonOptions.plugins.tooltip,
                    filter: function(tooltipItem) {
                        // Hide tooltip for null values
                        return tooltipItem.raw !== null;
                    }
                },
                annotation: {
                    annotations: {
                        upperLimit: {
                            type: 'line',
                            yMin: 1000,
                            yMax: 1000,
                            borderColor: chartColors.danger,
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                content: 'Upper Limit (>1000)',
                                enabled: true,
                                position: 'end',
                                backgroundColor: chartColors.danger,
                                color: 'white',
                                font: { size: 11 }
                            }
                        },
                        lowerLimit: {
                            type: 'line',
                            yMin: 700,
                            yMax: 700,
                            borderColor: chartColors.info,
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                content: 'Lower Limit (<700)',
                                enabled: true,
                                position: 'start',
                                backgroundColor: chartColors.info,
                                color: 'white',
                                font: { size: 11 }
                            }
                        }
                    }
                }
            }
        }
    });
}