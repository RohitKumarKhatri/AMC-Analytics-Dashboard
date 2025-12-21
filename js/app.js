// Main application logic - loads pre-aggregated JSON files

let metadata = null;
let currentData = null;
let currentFilters = {
    period: 'weekly',
    year: null,
    ranges: ['Q4'],
    customer: 'one-albania'
};
let pendingJiraLink = null; // Store link to open after modal

// Save filters to localStorage
function saveFiltersToStorage() {
    try {
        localStorage.setItem('amc-dashboard-filters', JSON.stringify(currentFilters));
    } catch (e) {
        console.warn('Could not save filters to localStorage:', e);
    }
}

// Load filters from localStorage
function loadFiltersFromStorage() {
    try {
        const saved = localStorage.getItem('amc-dashboard-filters');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Validate and merge with defaults
            return {
                period: parsed.period || 'weekly',
                year: parsed.year || null,
                ranges: Array.isArray(parsed.ranges) && parsed.ranges.length > 0 ? parsed.ranges : ['Q4'],
                customer: parsed.customer || 'one-albania'
            };
        }
    } catch (e) {
        console.warn('Could not load filters from localStorage:', e);
    }
    return null;
}

// Get URL parameters or saved filters
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    
    // Check if URL has parameters (takes precedence)
    if (params.toString()) {
        return {
            period: params.get('period') || 'weekly',
            year: params.get('year') ? parseInt(params.get('year')) : null,
            ranges: params.get('ranges') ? params.get('ranges').split(',') : ['Q4'],
            customer: params.get('customer') || 'one-albania'
        };
    }
    
    // Otherwise, try to load from localStorage
    const saved = loadFiltersFromStorage();
    if (saved) {
        return saved;
    }
    
    // Default values
    return {
        period: 'weekly',
        year: null,
        ranges: ['Q4'],
        customer: 'one-albania'
    };
}

// Build URL with current filters
function buildUrl() {
    const params = new URLSearchParams();
    params.set('period', currentFilters.period);
    if (currentFilters.year) {
        params.set('year', currentFilters.year.toString());
    }
    params.set('ranges', currentFilters.ranges.join(','));
    params.set('customer', currentFilters.customer);
    return window.location.pathname + '?' + params.toString();
}

// Initialize application
async function init() {
    try {
        showLoading();
        
        // Load metadata
        const metadataResponse = await fetch('data/metadata.json');
        if (!metadataResponse.ok) {
            throw new Error(`Failed to load metadata: ${metadataResponse.status}`);
        }
        metadata = await metadataResponse.json();
        
        // Load filters from URL or use defaults
        const urlParams = getUrlParams();
        currentFilters.period = urlParams.period;
        currentFilters.year = urlParams.year || (metadata.years && metadata.years.length > 0 ? metadata.years[metadata.years.length - 1] : null);
        currentFilters.ranges = urlParams.ranges;
        currentFilters.customer = urlParams.customer;
        
        // Initialize UI
        initFilters();
        initCharts();
        
        // Set default filters
        if (metadata.years && metadata.years.length > 0 && !currentFilters.year) {
            currentFilters.year = metadata.years[metadata.years.length - 1]; // Last year
        }
        updateYearButtons();
        updateRangeButtons();
        
        // Set default customer dropdown selection
        const customerSelect = document.getElementById('customer-filter');
        if (customerSelect) {
            customerSelect.value = currentFilters.customer;
        }
        
        // Load initial data
        await loadData();
        
        hideLoading();
        
        // Force resize charts after everything is loaded and visible
        setTimeout(() => {
            if (createdResolvedChart) createdResolvedChart.resize();
            if (cumulativeChart) cumulativeChart.resize();
        }, 400);
    } catch (error) {
        console.error('Error initializing application:', error);
        showError();
    }
}

// Initialize filter UI
function initFilters() {
    if (!metadata || !metadata.customers) {
        console.error('Metadata not loaded');
        return;
    }
    
    // Populate customer dropdown
    const customerSelect = document.getElementById('customer-filter');
    
    // Add special options
    const oneAlbaniaOption = document.createElement('option');
    oneAlbaniaOption.value = 'one-albania';
    oneAlbaniaOption.textContent = 'ONE Albania';
    customerSelect.appendChild(oneAlbaniaOption);
    
    const restOfWorldOption = document.createElement('option');
    restOfWorldOption.value = 'rest-of-world';
    restOfWorldOption.textContent = 'Rest of the World';
    customerSelect.appendChild(restOfWorldOption);
    
    // Add individual customers (excluding One Albania variants)
    metadata.customers.forEach(customer => {
        const isOneAlbania = /one\s+albania/i.test(customer);
        if (!isOneAlbania) {
            const option = document.createElement('option');
            option.value = customer;
            option.textContent = customer;
            customerSelect.appendChild(option);
        }
    });
    
    // Set up event listeners
    setupEventListeners();
}

// Update year buttons dynamically
function updateYearButtons() {
    if (!metadata || !metadata.years) {
        return;
    }
    
    const yearButtonsContainer = document.getElementById('year-buttons');
    yearButtonsContainer.innerHTML = '';
    
    metadata.years.forEach(year => {
        const button = document.createElement('button');
        button.className = 'btn-toggle';
        button.textContent = year;
        button.dataset.year = year;
        if (currentFilters.year === year) {
            button.classList.add('active');
        }
        yearButtonsContainer.appendChild(button);
    });
    
    // Re-attach event listeners
    setupYearButtonListeners();
}

// Setup event listeners
function setupEventListeners() {
    // Period buttons
    document.querySelectorAll('#period-buttons .btn-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#period-buttons .btn-toggle').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilters.period = btn.dataset.period;
            saveFiltersToStorage();
            loadData();
        });
    });
    
    // Customer dropdown
    document.getElementById('customer-filter').addEventListener('change', (e) => {
        currentFilters.customer = e.target.value;
        saveFiltersToStorage();
        loadData();
    });
    
    // Range buttons
    setupRangeButtonListeners();
}

// Setup year button listeners
function setupYearButtonListeners() {
    document.querySelectorAll('#year-buttons .btn-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#year-buttons .btn-toggle').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilters.year = parseInt(btn.dataset.year);
            saveFiltersToStorage();
            loadData();
        });
    });
}

// Setup range button listeners
function setupRangeButtonListeners() {
    document.querySelectorAll('#range-buttons .btn-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const range = btn.dataset.range;
            const index = currentFilters.ranges.indexOf(range);
            
            if (index > -1) {
                currentFilters.ranges.splice(index, 1);
                btn.classList.remove('active');
            } else {
                currentFilters.ranges.push(range);
                btn.classList.add('active');
            }
            
            // Handle Annual special case
            if (range === 'Annual') {
                if (currentFilters.ranges.includes('Annual')) {
                    ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
                        const idx = currentFilters.ranges.indexOf(q);
                        if (idx > -1) {
                            currentFilters.ranges.splice(idx, 1);
                        }
                    });
                    updateRangeButtons();
                }
            } else {
                const annualIdx = currentFilters.ranges.indexOf('Annual');
                if (annualIdx > -1) {
                    currentFilters.ranges.splice(annualIdx, 1);
                    const annualBtn = document.querySelector('#range-buttons .btn-toggle[data-range="Annual"]');
                    if (annualBtn) {
                        annualBtn.classList.remove('active');
                    }
                }
            }
            
            if (currentFilters.ranges.length === 0) {
                currentFilters.ranges = ['Q4'];
                updateRangeButtons();
            }
            
            // Save filters to localStorage
            saveFiltersToStorage();
            
            // Recalculate and render with smooth transition
            filterAndRenderData();
        });
    });
}

// Update range buttons state
function updateRangeButtons() {
    const rangeButtons = document.querySelectorAll('#range-buttons .btn-toggle');
    rangeButtons.forEach(btn => {
        const range = btn.dataset.range;
        if (currentFilters.ranges.includes(range)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Load data file based on current filters
async function loadData() {
    try {
        showLoading();
        
        const filename = getDataFilename();
        const response = await fetch(`data/${filename}`);
        
        if (!response.ok) {
            throw new Error(`Failed to load ${filename}: ${response.status}`);
        }
        
        const fileData = await response.json();
        currentData = fileData.data;
        
        filterAndRenderData();
        hideLoading();
        
        // Force resize charts after data loads and container is visible
        setTimeout(() => {
            if (createdResolvedChart) createdResolvedChart.resize();
            if (cumulativeChart) cumulativeChart.resize();
        }, 300);
    } catch (error) {
        console.error('Error loading data:', error);
        showError();
    }
}

// Get filename based on current filters
function getDataFilename() {
    const period = currentFilters.period;
    const year = currentFilters.year;
    let customer = currentFilters.customer;
    
    // Map customer filter to filename
    if (customer === 'all') {
        customer = 'all';
    } else if (customer === 'one-albania') {
        customer = 'one-albania';
    } else if (customer === 'rest-of-world') {
        customer = 'rest-of-world';
    } else {
        // Sanitize customer name for filename
        customer = customer.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
    }
    
    return `${period}-${year}-${customer}.json`;
}

// Filter data by range (quarters) and render
function filterAndRenderData() {
    if (!currentData || currentData.length === 0) {
        console.warn('No data to render');
        return;
    }
    
    let filtered = currentData;
    
    // Filter by range (quarters) - only if not Annual
    if (currentFilters.ranges.length > 0 && !currentFilters.ranges.includes('Annual')) {
        const selectedQuarters = new Set();
        currentFilters.ranges.forEach(range => {
            const q = parseInt(range.replace('Q', ''));
            if (q >= 1 && q <= 4) {
                selectedQuarters.add(q);
            }
        });
        
        if (selectedQuarters.size > 0) {
            filtered = currentData.filter(item => {
                // Extract month and year from date string (YYYY-MM-DD or YYYY-MM)
                const dateStr = item.week_start || item.month_start || item.month;
                if (!dateStr) return false;
                
                const parts = dateStr.split('-');
                const year = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                
                // Only include if year matches selected year AND quarter matches
                if (year !== currentFilters.year) {
                    return false;
                }
                
                const quarter = Math.ceil(month / 3);
                return selectedQuarters.has(quarter);
            });
        }
    }
    
    // Sort filtered data by date to ensure correct order
    filtered.sort((a, b) => {
        const dateA = a.week_start || a.month_start || a.month || '';
        const dateB = b.week_start || b.month_start || b.month || '';
        return dateA.localeCompare(dateB);
    });
    
    // Calculate cumulative dynamically (browser-side)
    // Cumulative = running sum of (created - resolved), starting from 0
    let cumulative = 0;
    const dataWithCumulative = filtered.map(item => {
        const netChange = item.created - item.resolved;
        cumulative += netChange;
        return {
            ...item,
            cumulative: cumulative
        };
    });
    
    // Smooth transition: fade out, update, fade in
    if (createdResolvedChart && cumulativeChart) {
        // Fade out charts
        const chartsContainer = document.getElementById('charts-container');
        chartsContainer.style.opacity = '0';
        chartsContainer.style.transition = 'opacity 0.2s ease-out';
        
        setTimeout(() => {
            renderCharts(dataWithCumulative);
            
            // Fade in charts
            setTimeout(() => {
                chartsContainer.style.opacity = '1';
                chartsContainer.style.transition = 'opacity 0.3s ease-in';
            }, 50);
        }, 200);
    } else {
        renderCharts(dataWithCumulative);
    }
}

// Initialize charts
function initCharts() {
    const createdResolvedEl = document.getElementById('created-resolved-chart');
    const cumulativeEl = document.getElementById('cumulative-chart');
    
    if (!createdResolvedEl || !cumulativeEl) {
        console.error('Chart containers not found');
        return;
    }
    
    // Ensure containers have explicit width
    createdResolvedEl.style.width = '100%';
    cumulativeEl.style.width = '100%';
    
    // Initialize charts immediately but ensure proper sizing
    createdResolvedChart = echarts.init(createdResolvedEl);
    cumulativeChart = echarts.init(cumulativeEl);
    
    // Handle window resize
    const resizeHandler = () => {
        if (createdResolvedChart) createdResolvedChart.resize();
        if (cumulativeChart) cumulativeChart.resize();
    };
    window.addEventListener('resize', resizeHandler);
    
    // Force initial resize after a short delay to ensure container is ready
    setTimeout(() => {
        resizeHandler();
    }, 200);
}

// Render charts
function renderCharts(data) {
    if (!data || data.length === 0) {
        console.warn('No data to render');
        return;
    }
    
    const labels = data.map(d => d.label);
    const created = data.map(d => d.created);
    const resolved = data.map(d => d.resolved);
    const cumulative = data.map(d => d.cumulative);
    
    // Created vs Resolved Chart
    const createdResolvedOption = {
        title: {
            text: 'Created vs Resolved Chart',
            left: 'center',
            textStyle: {
                fontSize: 18,
                fontWeight: 'bold'
            }
        },
        tooltip: {
            trigger: 'axis',
            triggerOn: 'mousemove|click',
            axisPointer: { 
                type: 'cross',
                label: {
                    backgroundColor: '#6a7985'
                }
            },
            formatter: function(params) {
                let result = params[0].axisValue + '<br/>';
                params.forEach(param => {
                    result += param.marker + param.seriesName + ': ' + param.value + '<br/>';
                });
                return result;
            }
        },
        legend: {
            data: ['Created', 'Resolved'],
            top: 35
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: labels,
            axisLabel: {
                rotate: 45,
                interval: 'auto'
            }
        },
        yAxis: [
            {
                type: 'value',
                name: 'Tickets',
                min: 0,
                position: 'left'
            },
            {
                type: 'value',
                name: 'Tickets',
                min: 0,
                position: 'right',
                axisLabel: {
                    formatter: '{value}'
                }
            }
        ],
        series: [
            {
                name: 'Created',
                type: 'line',
                data: created,
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(255, 99, 71, 0.3)' },
                            { offset: 1, color: 'rgba(255, 99, 71, 0.05)' }
                        ]
                    }
                },
                lineStyle: { color: '#ff6347', width: 2 },
                itemStyle: { color: '#ff8c69' },
                symbol: 'circle',
                symbolSize: 8,
                symbolKeepAspect: true,
                emphasis: {
                    focus: 'series',
                    itemStyle: {
                        borderWidth: 2,
                        borderColor: '#ff6347',
                        shadowBlur: 8,
                        shadowColor: 'rgba(255, 99, 71, 0.5)'
                    },
                    symbolSize: 12
                }
            },
            {
                name: 'Resolved',
                type: 'line',
                data: resolved,
                lineStyle: { color: '#32cd32', width: 2 },
                itemStyle: { color: '#32cd32' },
                symbol: 'circle',
                symbolSize: 8,
                symbolKeepAspect: true,
                emphasis: {
                    focus: 'series',
                    itemStyle: {
                        borderWidth: 2,
                        borderColor: '#32cd32',
                        shadowBlur: 8,
                        shadowColor: 'rgba(50, 205, 50, 0.5)'
                    },
                    symbolSize: 12
                }
            }
        ]
    };
    
    // Add click handler - prevent multiple opens
    let clickHandled = false;
    createdResolvedChart.off('click');
    createdResolvedChart.on('click', function(params) {
        // Prevent multiple opens from same click event
        if (clickHandled) {
            return;
        }
        
        // Handle clicks on data points
        if (params.componentType === 'series') {
            if (params.dataIndex !== undefined && data[params.dataIndex]) {
                const item = data[params.dataIndex];
                const link = params.seriesName === 'Created' 
                    ? item.jira_links.created 
                    : item.jira_links.resolved;
                if (link && link.indexOf('key = "NONE"') === -1) {
                    clickHandled = true;
                    
                    // Check if user wants to skip the login prompt
                    const skipLoginPrompt = safeGetItem('amc-dashboard-skip-login-prompt') === 'true';
                    
                    if (skipLoginPrompt) {
                        // Open directly if user chose to skip
                        window.open(link, '_blank');
                    } else {
                        // Check if user is logged in to Jira
                        checkJiraLoginStatus(link);
                    }
                    
                    // Reset after delay to allow next click
                    setTimeout(() => {
                        clickHandled = false;
                    }, 300);
                }
            }
        }
    });
    
    if (createdResolvedChart) {
        createdResolvedChart.setOption(createdResolvedOption);
        // Force resize to ensure full width
        setTimeout(() => {
            createdResolvedChart.resize();
        }, 150);
    }
    
    // Cumulative Chart
    const periodLabel = currentFilters.period === 'weekly' ? 'grouped weekly' : 'grouped monthly';
    const cumulativeOption = {
        title: {
            text: `Cumulative Issues (${periodLabel})`,
            left: 'center',
            textStyle: {
                fontSize: 16,
                fontWeight: 'normal'
            }
        },
        tooltip: {
            show: false
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: '12%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: labels,
            axisLabel: {
                rotate: 45,
                interval: 'auto'
            }
        },
        yAxis: [
            {
                type: 'value',
                name: 'Issues',
                min: (() => {
                    // Allow negative values if data goes below zero
                    const minValue = Math.min(...cumulative);
                    return minValue < 0 ? Math.floor(minValue / 10) * 10 : 0;
                })(),
                position: 'left'
            },
            {
                type: 'value',
                name: 'Issues',
                min: (() => {
                    const minValue = Math.min(...cumulative);
                    return minValue < 0 ? Math.floor(minValue / 10) * 10 : 0;
                })(),
                position: 'right',
                axisLabel: {
                    formatter: '{value}'
                }
            }
        ],
        series: [
            {
                name: 'Cumulative Issues',
                type: 'line',
                data: cumulative,
                lineStyle: { color: '#4169e1', width: 2 },
                itemStyle: { color: '#4169e1' },
                areaStyle: {
                    color: (params) => {
                        // Make area fill conditional based on value
                        const value = params.data;
                        if (value <= 0) {
                            // No fill or very subtle for zero/negative values
                            return 'transparent';
                        } else if (value < 5) {
                            // Very light fill for small positive values
                            return {
                                type: 'linear',
                                x: 0, y: 0, x2: 0, y2: 1,
                                colorStops: [
                                    { offset: 0, color: 'rgba(65, 105, 225, 0.1)' },
                                    { offset: 1, color: 'rgba(65, 105, 225, 0.02)' }
                                ]
                            };
                        } else {
                            // Normal fill for larger values
                            return {
                                type: 'linear',
                                x: 0, y: 0, x2: 0, y2: 1,
                                colorStops: [
                                    { offset: 0, color: 'rgba(65, 105, 225, 0.3)' },
                                    { offset: 1, color: 'rgba(65, 105, 225, 0.05)' }
                                ]
                            };
                        }
                    }
                },
                symbol: 'circle',
                symbolSize: 8,
                symbolKeepAspect: true,
                emphasis: {
                    focus: 'series',
                    itemStyle: {
                        borderWidth: 2,
                        borderColor: '#4169e1',
                        shadowBlur: 8,
                        shadowColor: 'rgba(65, 105, 225, 0.5)'
                    },
                    symbolSize: 12
                }
            }
        ]
    };
    
    if (cumulativeChart) {
        cumulativeChart.setOption(cumulativeOption);
        
        // Remove any existing click handlers (cumulative chart is not clickable)
        cumulativeChart.off('click');
        
        // Force resize to ensure full width
        setTimeout(() => {
            cumulativeChart.resize();
        }, 150);
    }
}

// Show/hide loading and error states
function showLoading() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('charts-container').style.display = 'none';
    document.getElementById('error').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('charts-container').style.display = 'block';
}

function showError() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('charts-container').style.display = 'none';
    document.getElementById('error').style.display = 'block';
}

// Safe localStorage helper functions
function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        // localStorage may be disabled in incognito mode or throw errors
        console.warn('Could not save to localStorage:', e);
    }
}

function safeGetItem(key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        console.warn('Could not read from localStorage:', e);
        return null;
    }
}

// Check if user is logged into Jira
async function checkJiraLoginStatus(jiraLink) {
    // First check cached login status (if checked recently)
    const cachedLoginStatus = safeGetItem('amc-dashboard-jira-logged-in');
    const cacheTime = safeGetItem('amc-dashboard-jira-login-check-time');
    const now = Date.now();
    
    // Use cached status if less than 5 minutes old
    if (cachedLoginStatus && cacheTime && (now - parseInt(cacheTime)) < 5 * 60 * 1000) {
        if (cachedLoginStatus === 'true') {
            // User was logged in recently, open directly
            window.open(jiraLink, '_blank');
            return;
        } else {
            // User was not logged in recently, show modal
            pendingJiraLink = jiraLink;
            showLoginModal();
            return;
        }
    }
    
    // No cache or expired - try to check login status
    try {
        // Try to fetch user info from Jira API
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const response = await fetch('https://psskyvera.atlassian.net/rest/api/2/myself', {
            method: 'GET',
            credentials: 'include',
            signal: controller.signal,
            headers: {
                'Accept': 'application/json'
            },
            mode: 'cors'
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok && response.status === 200) {
            // User is logged in - cache the status and open link
            safeSetItem('amc-dashboard-jira-logged-in', 'true');
            safeSetItem('amc-dashboard-jira-login-check-time', Date.now().toString());
            window.open(jiraLink, '_blank');
        } else {
            // Not logged in - cache status and show modal
            safeSetItem('amc-dashboard-jira-logged-in', 'false');
            safeSetItem('amc-dashboard-jira-login-check-time', Date.now().toString());
            pendingJiraLink = jiraLink;
            showLoginModal();
        }
    } catch (error) {
        // Fetch failed - likely CORS error (user not logged in or cross-origin issue)
        // In this case, show modal to be safe
        safeSetItem('amc-dashboard-jira-logged-in', 'false');
        safeSetItem('amc-dashboard-jira-login-check-time', Date.now().toString());
        pendingJiraLink = jiraLink;
        showLoginModal();
    }
}

// Modal functions
function showLoginModal() {
    const modal = document.getElementById('jira-login-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('show');
    }
}

function hideLoginModal() {
    const modal = document.getElementById('jira-login-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
    }
    pendingJiraLink = null;
}

function proceedToJira() {
    if (pendingJiraLink) {
        // Cache that user attempted to proceed (might be logged in)
        safeSetItem('amc-dashboard-jira-logged-in', 'true');
        safeSetItem('amc-dashboard-jira-login-check-time', Date.now().toString());
        
        window.open(pendingJiraLink, '_blank');
        hideLoginModal();
    }
}

// Setup modal event listeners
function setupModalListeners() {
    // Close button
    const closeBtn = document.getElementById('modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', hideLoginModal);
    }
    
    // Proceed button
    const proceedBtn = document.getElementById('btn-proceed');
    if (proceedBtn) {
        proceedBtn.addEventListener('click', proceedToJira);
    }
    
    // Don't show again checkbox
    const dontShowCheckbox = document.getElementById('dont-show-again');
    if (dontShowCheckbox) {
        dontShowCheckbox.addEventListener('change', function(e) {
            if (e.target.checked) {
                safeSetItem('amc-dashboard-skip-login-prompt', 'true');
            } else {
                try {
                    localStorage.removeItem('amc-dashboard-skip-login-prompt');
                } catch (e) {
                    console.warn('Could not remove from localStorage:', e);
                }
            }
        });
    }
    
    // Close modal when clicking outside
    const modal = document.getElementById('jira-login-modal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                hideLoginModal();
            }
        });
    }
    
    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideLoginModal();
        }
    });
    
    // Login link button - when clicked, mark as potentially logged in after delay
    const loginBtn = document.querySelector('.btn-login');
    if (loginBtn) {
        loginBtn.addEventListener('click', function() {
            // After clicking login, assume user might be logged in after a delay
            // Give them time to login, then cache the status
            setTimeout(() => {
                safeSetItem('amc-dashboard-jira-logged-in', 'true');
                safeSetItem('amc-dashboard-jira-login-check-time', Date.now().toString());
            }, 3000); // 3 second delay to allow login
        });
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setupModalListeners();
        init();
    });
} else {
    setupModalListeners();
    init();
}

