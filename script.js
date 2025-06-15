// Global variables
let allSites = [];
let filteredSites = [];
let userLocation = null;
let referenceLocation = { lat: 47.4979, lon: 19.0402, name: "Budapest" }; // Default to Budapest

// Preset cities for testing
const presetCities = {
    paris: { lat: 48.8566, lon: 2.3522, name: "Paris" },
    newyork: { lat: 40.7128, lon: -74.0060, name: "New York" },
    london: { lat: 51.5074, lon: -0.1278, name: "London" },
    tokyo: { lat: 35.6762, lon: 139.6503, name: "Tokyo" },
    sydney: { lat: -33.8688, lon: 151.2093, name: "Sydney" },
    cairo: { lat: 30.0444, lon: 31.2357, name: "Cairo" },
    rome: { lat: 41.9028, lon: 12.4964, name: "Rome" },
    beijing: { lat: 39.9042, lon: 116.4074, name: "Beijing" }
};

// DOM elements
const sitesGrid = document.getElementById('sitesGrid');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const locationPrompt = document.getElementById('locationPrompt');
const useLocationOption = document.getElementById('useLocationOption');
const useBudapestOption = document.getElementById('useBudapestOption');
const chooseCityOption = document.getElementById('chooseCityOption');
const backToOptionsBtn = document.getElementById('backToOptionsBtn');
const citySelector = document.getElementById('citySelector');
const locationOptions = document.querySelector('.location-options');
const changeLocationHeaderBtn = document.getElementById('changeLocationHeaderBtn');
const locationNameEl = document.getElementById('locationName');
const headerLocation = document.getElementById('headerLocation');
const locationDisplayHeader = document.getElementById('locationDisplayHeader');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const distanceFilter = document.getElementById('distanceFilter');
const totalSitesEl = document.getElementById('totalSites');
const culturalSitesEl = document.getElementById('culturalSites');
const naturalSitesEl = document.getElementById('naturalSites');
const avgDistanceEl = document.getElementById('avgDistance');

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

// Calculate bearing (direction) between two points
function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    bearing = (bearing + 360) % 360; // Normalize to 0-360
    
    return bearing;
}

// Convert bearing to compass direction
function bearingToCompass(bearing) {
    const directions = [
        { name: 'N', icon: '↑', range: [348.75, 11.25] },
        { name: 'NNE', icon: '↗', range: [11.25, 33.75] },
        { name: 'NE', icon: '↗', range: [33.75, 56.25] },
        { name: 'ENE', icon: '↗', range: [56.25, 78.75] },
        { name: 'E', icon: '→', range: [78.75, 101.25] },
        { name: 'ESE', icon: '↘', range: [101.25, 123.75] },
        { name: 'SE', icon: '↘', range: [123.75, 146.25] },
        { name: 'SSE', icon: '↘', range: [146.25, 168.75] },
        { name: 'S', icon: '↓', range: [168.75, 191.25] },
        { name: 'SSW', icon: '↙', range: [191.25, 213.75] },
        { name: 'SW', icon: '↙', range: [213.75, 236.25] },
        { name: 'WSW', icon: '↙', range: [236.25, 258.75] },
        { name: 'W', icon: '←', range: [258.75, 281.25] },
        { name: 'WNW', icon: '↖', range: [281.25, 303.75] },
        { name: 'NW', icon: '↖', range: [303.75, 326.25] },
        { name: 'NNW', icon: '↖', range: [326.25, 348.75] }
    ];
    
    for (const dir of directions) {
        if (dir.range[0] > dir.range[1]) { // Handle wrap-around for North
            if (bearing >= dir.range[0] || bearing <= dir.range[1]) {
                return dir;
            }
        } else {
            if (bearing >= dir.range[0] && bearing <= dir.range[1]) {
                return dir;
            }
        }
    }
    
    return directions[0]; // Default to North
}

// Get user's location
function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by this browser.'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                
                // Try to get city name using reverse geocoding
                let locationName = "Your Location";
                try {
                    const cityName = await getCityName(lat, lon);
                    if (cityName) {
                        locationName = cityName;
                    }
                } catch (error) {
                    console.log('Could not get city name:', error);
                }
                
                resolve({
                    lat: lat,
                    lon: lon,
                    name: locationName
                });
            },
            (error) => {
                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes
            }
        );
    });
}

// Get city name from coordinates using reverse geocoding
async function getCityName(lat, lon) {
    try {
        // Using OpenStreetMap Nominatim API (free, no API key required)
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'UNESCO Heritage Explorer'
                }
            }
        );
        
        if (!response.ok) {
            throw new Error('Geocoding request failed');
        }
        
        const data = await response.json();
        
        // Extract city name from the response
        const address = data.address;
        if (address) {
            return address.city || 
                   address.town || 
                   address.village || 
                   address.municipality || 
                   address.county || 
                   address.state || 
                   "Your Location";
        }
        
        return "Your Location";
    } catch (error) {
        console.error('Error getting city name:', error);
        return "Your Location";
    }
}

// Load and initialize data
async function loadData() {
    try {
        loadingText.textContent = 'Loading UNESCO Heritage Sites...';
        const response = await fetch('unesco_sites_by_distance.json');
        const rawSites = await response.json();
        
        // Recalculate distances and directions based on reference location
        allSites = rawSites.map(site => {
            const distance = calculateDistance(
                referenceLocation.lat,
                referenceLocation.lon,
                site.latitude,
                site.longitude
            );
            
            const bearing = calculateBearing(
                referenceLocation.lat,
                referenceLocation.lon,
                site.latitude,
                site.longitude
            );
            
            const direction = bearingToCompass(bearing);
            
            return {
                ...site,
                distance_from_reference_km: distance,
                bearing: bearing,
                direction: direction
            };
        });

        // Sort by new distances
        allSites.sort((a, b) => a.distance_from_reference_km - b.distance_from_reference_km);
        
        filteredSites = [...allSites];
        
        // Update location displays
        updateLocationDisplays();
        
        updateStats();
        renderSites();
        hideLoadingAndShowLocation();
    } catch (error) {
        console.error('Error loading data:', error);
        showError();
    }
}

// Update statistics
function updateStats() {
    const cultural = filteredSites.filter(site => site.category === 'Cultural').length;
    const natural = filteredSites.filter(site => site.category === 'Natural').length;
    const avgDist = filteredSites.length > 0 
        ? Math.round(filteredSites.reduce((sum, site) => sum + site.distance_from_reference_km, 0) / filteredSites.length)
        : 0;

    totalSitesEl.textContent = filteredSites.length;
    culturalSitesEl.textContent = cultural;
    naturalSitesEl.textContent = natural;
    avgDistanceEl.textContent = avgDist;
}

// Render sites
function renderSites() {
    if (filteredSites.length === 0) {
        showEmptyState();
        return;
    }

    sitesGrid.innerHTML = filteredSites.map((site, index) => `
        <div class="site-card" style="animation-delay: ${index * 0.1}s">
            <div class="site-image">
                ${site.image_url ? `
                    <img src="${site.image_url}" alt="${site.name}" loading="lazy" onerror="this.parentElement.classList.add('image-error')">
                    <div class="image-overlay">
                        <div class="site-category ${site.category.toLowerCase()}">${site.category}</div>
                    </div>
                ` : `
                    <div class="image-placeholder">
                        <i class="fas fa-${site.category === 'Cultural' ? 'monument' : 'tree'}"></i>
                        <div class="site-category ${site.category.toLowerCase()}">${site.category}</div>
                    </div>
                `}
            </div>
            <div class="site-content">
                <div class="site-header">
                    <h3 class="site-name">${site.name}</h3>
                    <div class="site-distance">
                        <div class="distance-info">
                            <i class="fas fa-map-marker-alt"></i>
                            ${site.distance_from_reference_km} km from ${referenceLocation.name}
                        </div>
                        <div class="direction-indicator" title="Direction: ${site.direction.name}">
                            <span class="direction-arrow">${site.direction.icon}</span>
                            <span class="direction-label">${site.direction.name}</span>
                        </div>
                    </div>
                </div>
                <div class="site-body">
                    <div class="site-info">
                        <div class="info-item">
                            <i class="fas fa-flag"></i>
                            <span>${site.states}</span>
                        </div>
                        <div class="info-item">
                            <i class="fas fa-calendar"></i>
                            <span>Inscribed ${site.date_inscribed}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Show empty state
function showEmptyState() {
    sitesGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
            <i class="fas fa-search"></i>
            <h3>No sites found</h3>
            <p>Try adjusting your search criteria</p>
        </div>
    `;
}

// Show error state
function showError() {
    loading.classList.add('hidden');
    headerLocation.classList.add('hidden');
    sitesGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error loading data</h3>
            <p>Please check your internet connection and try again</p>
        </div>
    `;
}

// Hide loading
function hideLoading() {
    loading.classList.add('hidden');
}

// Filter sites
function filterSites() {
    const searchTerm = searchInput.value.toLowerCase();
    const categoryValue = categoryFilter.value;
    const distanceValue = distanceFilter.value;

    filteredSites = allSites.filter(site => {
        // Search filter
        const matchesSearch = site.name.toLowerCase().includes(searchTerm) ||
                            site.states.toLowerCase().includes(searchTerm);

        // Category filter
        const matchesCategory = categoryValue === 'all' || site.category === categoryValue;

        // Distance filter
        let matchesDistance = true;
        if (distanceValue !== 'all') {
            const distance = site.distance_from_reference_km;
            switch (distanceValue) {
                case '0-100':
                    matchesDistance = distance <= 100;
                    break;
                case '100-500':
                    matchesDistance = distance > 100 && distance <= 500;
                    break;
                case '500-1000':
                    matchesDistance = distance > 500 && distance <= 1000;
                    break;
                case '1000+':
                    matchesDistance = distance > 1000;
                    break;
            }
        }

        return matchesSearch && matchesCategory && matchesDistance;
    });

    updateStats();
    renderSites();
}

// Debounce function for search
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

// Initialize location and data loading
async function initializeApp() {
    try {
        // Check if user has previously chosen to use their location
        const useUserLocation = localStorage.getItem('useUserLocation');
        const selectedCity = localStorage.getItem('selectedCity');
        
        if (useUserLocation === 'true') {
            await requestUserLocation();
        } else if (useUserLocation === 'false') {
            // Check if they selected a preset city
            if (selectedCity && selectedCity !== 'budapest' && presetCities[selectedCity]) {
                referenceLocation = presetCities[selectedCity];
            } else {
                referenceLocation = { lat: 47.4979, lon: 19.0402, name: "Budapest" };
            }
            await loadData();
        } else {
            // Show location prompt for first-time users
            showLocationPrompt();
        }
    } catch (error) {
        console.error('Error initializing app:', error);
        // Fallback to Budapest
        await loadData();
    }
}

// Show location prompt
function showLocationPrompt() {
    loading.classList.add('hidden');
    headerLocation.classList.add('hidden');
    // Reset to main options view
    hideCitySelector();
    locationPrompt.classList.add('show');
}

// Hide location prompt
function hideLocationPrompt() {
    locationPrompt.classList.remove('show');
}

// Request user location
async function requestUserLocation() {
    try {
        showLoading();
        loadingText.textContent = 'Getting your location...';
        
        userLocation = await getUserLocation();
        referenceLocation = userLocation;
        
        // Save user preference
        localStorage.setItem('useUserLocation', 'true');
        
        await loadData();
    } catch (error) {
        console.error('Error getting location:', error);
        
        // Show error and fallback to Budapest
        loadingText.textContent = 'Location access denied. Using Budapest instead...';
        setTimeout(async () => {
            referenceLocation = { lat: 47.4979, lon: 19.0402, name: "Budapest" };
            localStorage.setItem('useUserLocation', 'false');
            await loadData();
        }, 2000);
    }
}

// Use Budapest as reference
async function useBudapest() {
    hideLocationPrompt();
    showLoading();
    
    referenceLocation = { lat: 47.4979, lon: 19.0402, name: "Budapest" };
    localStorage.setItem('useUserLocation', 'false');
    localStorage.setItem('selectedCity', 'budapest');
    
    await loadData();
}

// Use preset city as reference
async function usePresetCity(cityKey) {
    hideLocationPrompt();
    showLoading();
    
    referenceLocation = presetCities[cityKey];
    localStorage.setItem('useUserLocation', 'false');
    localStorage.setItem('selectedCity', cityKey);
    
    await loadData();
}

// Show city selector
function showCitySelector() {
    locationOptions.style.display = 'none';
    citySelector.style.display = 'block';
}

// Hide city selector
function hideCitySelector() {
    citySelector.style.display = 'none';
    locationOptions.style.display = 'grid';
}

// Show loading
function showLoading() {
    loading.classList.remove('hidden');
    headerLocation.classList.add('hidden');
}

// Hide loading and show location info
function hideLoadingAndShowLocation() {
    loading.classList.add('hidden');
    headerLocation.classList.remove('hidden');
}

// Update all location displays
function updateLocationDisplays() {
    // Update subtitle
    locationNameEl.textContent = referenceLocation.name;
    
    // Update header location display
    locationDisplayHeader.textContent = referenceLocation.name;
}

// Show location settings (reopen the prompt)
function showLocationSettings() {
    showLocationPrompt();
}

// Event listeners
useLocationOption.addEventListener('click', () => {
    hideLocationPrompt();
    requestUserLocation();
});

useBudapestOption.addEventListener('click', useBudapest);

chooseCityOption.addEventListener('click', showCitySelector);

backToOptionsBtn.addEventListener('click', hideCitySelector);

// Add event listeners for city buttons
document.querySelectorAll('.city-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const cityKey = e.currentTarget.getAttribute('data-city');
        usePresetCity(cityKey);
    });
});

changeLocationHeaderBtn.addEventListener('click', showLocationSettings);

searchInput.addEventListener('input', debounce(filterSites, 300));
categoryFilter.addEventListener('change', filterSites);
distanceFilter.addEventListener('change', filterSites);

// Add click handlers for site cards
document.addEventListener('click', (e) => {
    const siteCard = e.target.closest('.site-card');
    if (siteCard) {
        // Extract coordinates from the card
        const coordText = siteCard.querySelector('.site-coordinates').textContent;
        const coords = coordText.match(/([-\d.]+)°, ([-\d.]+)°/);
        if (coords) {
            const lat = coords[1];
            const lng = coords[2];
            // Open in Google Maps
            window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
        }
    }
});

// Add keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === '/' && e.target !== searchInput) {
        e.preventDefault();
        searchInput.focus();
    }
});

// Initialize the application
document.addEventListener('DOMContentLoaded', initializeApp);

// Add smooth scrolling for better UX
document.documentElement.style.scrollBehavior = 'smooth';

// Add intersection observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe site cards when they're created
const observeCards = () => {
    document.querySelectorAll('.site-card').forEach(card => {
        observer.observe(card);
    });
};

// Call observeCards after rendering
const originalRenderSites = renderSites;
renderSites = function() {
    originalRenderSites.call(this);
    setTimeout(observeCards, 100);
};