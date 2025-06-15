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

// Country flag emoji mappings
const countryFlags = {
    'Albania': '🇦🇱',
    'Austria': '🇦🇹',
    'Belgium': '🇧🇪',
    'Bosnia and Herzegovina': '🇧🇦',
    'Bulgaria': '🇧🇬',
    'Croatia': '🇭🇷',
    'Czechia': '🇨🇿',
    'Czech Republic': '🇨🇿',
    'France': '🇫🇷',
    'Germany': '🇩🇪',
    'Hungary': '🇭🇺',
    'Italy': '🇮🇹',
    'Montenegro': '🇲🇪',
    'North Macedonia': '🇲🇰',
    'Poland': '🇵🇱',
    'Romania': '🇷🇴',
    'Serbia': '🇷🇸',
    'Slovakia': '🇸🇰',
    'Slovenia': '🇸🇮',
    'Spain': '🇪🇸',
    'Switzerland': '🇨🇭',
    'Ukraine': '🇺🇦',
    'United Kingdom': '🇬🇧',
    'UK': '🇬🇧',
    'United States': '🇺🇸',
    'USA': '🇺🇸',
    'Canada': '🇨🇦',
    'Japan': '🇯🇵',
    'China': '🇨🇳',
    'Australia': '🇦🇺',
    'Egypt': '🇪🇬',
    'Turkey': '🇹🇷',
    'Greece': '🇬🇷',
    'Portugal': '🇵🇹',
    'Netherlands': '🇳🇱',
    'Norway': '🇳🇴',
    'Sweden': '🇸🇪',
    'Denmark': '🇩🇰',
    'Finland': '🇫🇮',
    'Iceland': '🇮🇸',
    'Ireland': '🇮🇪',
    'Luxembourg': '🇱🇺',
    'Malta': '🇲🇹',
    'Cyprus': '🇨🇾',
    'Estonia': '🇪🇪',
    'Latvia': '🇱🇻',
    'Lithuania': '🇱🇹',
    'Belarus': '🇧🇾',
    'Moldova': '🇲🇩',
    'Russia': '🇷🇺',
    'Georgia': '🇬🇪',
    'Armenia': '🇦🇲',
    'Azerbaijan': '🇦🇿',
    'Kazakhstan': '🇰🇿',
    'Uzbekistan': '🇺🇿',
    'Kyrgyzstan': '🇰🇬',
    'Tajikistan': '🇹🇯',
    'Turkmenistan': '🇹🇲',
    'Afghanistan': '🇦🇫',
    'Pakistan': '🇵🇰',
    'India': '🇮🇳',
    'Bangladesh': '🇧🇩',
    'Sri Lanka': '🇱🇰',
    'Nepal': '🇳🇵',
    'Bhutan': '🇧🇹',
    'Myanmar': '🇲🇲',
    'Thailand': '🇹🇭',
    'Laos': '🇱🇦',
    'Cambodia': '🇰🇭',
    'Vietnam': '🇻🇳',
    'Malaysia': '🇲🇾',
    'Singapore': '🇸🇬',
    'Indonesia': '🇮🇩',
    'Philippines': '🇵🇭',
    'Brunei': '🇧🇳',
    'Mongolia': '🇲🇳',
    'South Korea': '🇰🇷',
    'North Korea': '🇰🇵',
    'Taiwan': '🇹🇼',
    'Hong Kong': '🇭🇰',
    'Macau': '🇲🇴'
};

// Get country flag emoji
function getCountryFlag(countryName) {
    // Clean up country name
    const cleanName = countryName.trim();
    
    // Direct lookup
    if (countryFlags[cleanName]) {
        return countryFlags[cleanName];
    }
    
    // Try some common variations
    const variations = [
        cleanName.replace('Republic of ', ''),
        cleanName.replace('Kingdom of ', ''),
        cleanName.replace('United States of America', 'USA'),
        cleanName.replace('United Kingdom of Great Britain and Northern Ireland', 'UK'),
        cleanName.replace('Czech Republic', 'Czechia')
    ];
    
    for (const variation of variations) {
        if (countryFlags[variation]) {
            return countryFlags[variation];
        }
    }
    
    // Return a generic flag emoji if not found
    return '🏳️';
}

// Format countries with flags
function formatCountriesWithFlags(statesString) {
    const countries = statesString.split(',').map(country => country.trim());
    
    return countries.map(country => {
        const flag = getCountryFlag(country);
        return `<span class="country-item">${flag} ${country}</span>`;
    }).join('');
}

// High-quality image mappings for popular sites
const highQualityImages = {
    // Some examples of better quality images (these would need to be verified)
    '400': 'https://whc.unesco.org/uploads/sites/site_400_gallery.jpg', // Budapest
    '616': 'https://whc.unesco.org/uploads/sites/site_616_gallery.jpg', // Prague
    '29': 'https://whc.unesco.org/uploads/sites/site_29_gallery.jpg',   // Kraków
    '394': 'https://whc.unesco.org/uploads/sites/site_394_gallery.jpg', // Venice
    '95': 'https://whc.unesco.org/uploads/sites/site_95_gallery.jpg',   // Dubrovnik
    '97': 'https://whc.unesco.org/uploads/sites/site_97_gallery.jpg',   // Split
    '98': 'https://whc.unesco.org/uploads/sites/site_98_gallery.jpg',   // Plitvice
};

// Get better image URL with fallbacks based on UNESCO website patterns
function getBetterImageUrl(site) {
    const unescoId = site.unesco_id;
    
    // Start with high-quality mapping if available
    const imageSources = [];
    
    if (highQualityImages[unescoId]) {
        imageSources.push(highQualityImages[unescoId]);
    }
    
    // Based on UNESCO website analysis, try these patterns in order of quality:
    imageSources.push(
        // Gallery images (often higher quality)
        `https://whc.unesco.org/uploads/sites/site_${unescoId}_gallery.jpg`,
        
        // Document images (sometimes higher res)
        `https://whc.unesco.org/uploads/sites/site_${unescoId}_docs.jpg`,
        
        // Numbered gallery images (multiple photos available)
        `https://whc.unesco.org/uploads/sites/site_${unescoId}_0001.jpg`,
        `https://whc.unesco.org/uploads/sites/site_${unescoId}_0002.jpg`,
        `https://whc.unesco.org/uploads/sites/site_${unescoId}_0003.jpg`,
        
        // Large format versions
        `https://whc.unesco.org/uploads/sites/site_${unescoId}_large.jpg`,
        `https://whc.unesco.org/uploads/sites/site_${unescoId}_big.jpg`,
        
        // Alternative directory structure
        `https://whc.unesco.org/uploads/sites/${unescoId}/site_${unescoId}.jpg`,
        `https://whc.unesco.org/uploads/sites/${unescoId}/gallery_${unescoId}.jpg`,
        
        // Media directory
        `https://whc.unesco.org/media/sites/site_${unescoId}.jpg`,
        
        // Images directory
        `https://whc.unesco.org/images/sites/site_${unescoId}.jpg`,
        
        // Alternative extensions
        `https://whc.unesco.org/uploads/sites/site_${unescoId}.jpeg`,
        `https://whc.unesco.org/uploads/sites/site_${unescoId}.png`,
        
        // Original as final fallback
        site.image_url || `https://whc.unesco.org/uploads/sites/site_${unescoId}.jpg`
    );
    
    return imageSources;
}

// Handle image loading errors with fallbacks
function handleImageError(img, imageSources) {
    const sources = typeof imageSources === 'string' ? JSON.parse(imageSources) : imageSources;
    const currentSrc = img.src;
    const currentIndex = sources.indexOf(currentSrc);
    
    // Debug logging to console (can be removed in production)
    console.log(`Image failed: ${currentSrc} (attempt ${currentIndex + 1}/${sources.length})`);
    
    if (currentIndex < sources.length - 1) {
        // Try next image source
        const nextSrc = sources[currentIndex + 1];
        console.log(`Trying next image: ${nextSrc}`);
        img.src = nextSrc;
    } else {
        // All sources failed, show placeholder
        console.log(`All image sources failed for site. Showing placeholder.`);
        img.parentElement.classList.add('image-error');
        img.style.display = 'none';
    }
}

// Log successful image loads (for debugging)
function handleImageSuccess(img) {
    console.log(`Image loaded successfully: ${img.src}`);
}

// Test function to discover working image patterns (for development)
function testImagePatterns(unescoId) {
    console.log(`Testing image patterns for UNESCO site ${unescoId}:`);
    
    const testPatterns = [
        `https://whc.unesco.org/uploads/sites/site_${unescoId}_gallery.jpg`,
        `https://whc.unesco.org/uploads/sites/site_${unescoId}_docs.jpg`,
        `https://whc.unesco.org/uploads/sites/site_${unescoId}_0001.jpg`,
        `https://whc.unesco.org/uploads/sites/site_${unescoId}_large.jpg`,
        `https://whc.unesco.org/uploads/sites/${unescoId}/site_${unescoId}.jpg`,
        `https://whc.unesco.org/media/sites/site_${unescoId}.jpg`,
        `https://whc.unesco.org/images/sites/site_${unescoId}.jpg`,
        `https://whc.unesco.org/uploads/sites/site_${unescoId}.jpg`
    ];
    
    testPatterns.forEach((url, index) => {
        const img = new Image();
        img.onload = () => console.log(`✅ WORKS: ${url} (${img.naturalWidth}x${img.naturalHeight})`);
        img.onerror = () => console.log(`❌ FAILS: ${url}`);
        img.src = url;
    });
}

// Call this in console to test: testImagePatterns('147') or testImagePatterns('400')

// Render sites
function renderSites() {
    if (filteredSites.length === 0) {
        showEmptyState();
        return;
    }

    sitesGrid.innerHTML = filteredSites.map((site, index) => {
        const imageSources = getBetterImageUrl(site);
        
        return `
        <div class="site-card" 
             style="animation-delay: ${index * 0.1}s"
             data-unesco-id="${site.unesco_id}"
             data-lat="${site.latitude}"
             data-lng="${site.longitude}">
            <div class="site-image">
                ${imageSources.length > 0 ? `
                    <img src="${imageSources[0]}" 
                         alt="${site.name}" 
                         loading="lazy" 
                         onerror="handleImageError(this, ${JSON.stringify(imageSources).replace(/"/g, '&quot;')})"
                         onload="handleImageSuccess(this)">
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
                        <div class="distance-info" data-action="directions">
                            <i class="fas fa-route"></i>
                            ${site.distance_from_reference_km} km from ${referenceLocation.name}
                        </div>
                        <div class="navigation-buttons">
                            <button class="nav-btn google-earth-btn" data-action="google-earth" data-lat="${site.latitude}" data-lng="${site.longitude}">
                                🌍
                            </button>
                            <div class="direction-indicator">
                                <span class="direction-arrow">${site.direction.icon}</span>
                                <span class="direction-label">${site.direction.name}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="site-body">
                    <div class="site-info">
                        <div class="info-item">
                            <span class="countries-list">${formatCountriesWithFlags(site.states)}</span>
                        </div>
                        <div class="info-item">
                            <i class="fas fa-calendar"></i>
                            <span>Inscribed ${site.date_inscribed}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    }).join('');
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
    // Check if clicked on Google Earth button
    const googleEarthBtn = e.target.closest('.google-earth-btn[data-action="google-earth"]');
    if (googleEarthBtn) {
        e.stopPropagation(); // Prevent card click
        const lat = googleEarthBtn.dataset.lat;
        const lng = googleEarthBtn.dataset.lng;
        const earthUrl = `https://earth.google.com/web/@${lat},${lng},1000a,1000d,35y,0h,0t,0r`;
        window.open(earthUrl, '_blank');
        return;
    }
    
    // Check if clicked on distance info (for directions)
    const distanceInfo = e.target.closest('.distance-info[data-action="directions"]');
    if (distanceInfo) {
        e.stopPropagation(); // Prevent card click
        const siteCard = distanceInfo.closest('.site-card');
        if (siteCard) {
            const lat = siteCard.dataset.lat;
            const lng = siteCard.dataset.lng;
            
            // Open Google Maps directly (no overlay)
            const directionsUrl = `https://www.google.com/maps/dir/${referenceLocation.lat},${referenceLocation.lon}/${lat},${lng}`;
            window.open(directionsUrl, '_blank');
        }
        return;
    }
    
    // Check if clicked on site card (for UNESCO site)
    const siteCard = e.target.closest('.site-card');
    if (siteCard) {
        const unescoId = siteCard.dataset.unescoId;
        if (unescoId) {
            // Open UNESCO World Heritage Centre page
            const unescoUrl = `https://whc.unesco.org/en/list/${unescoId}`;
            window.open(unescoUrl, '_blank');
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

// Handle sticky controls behavior
function handleStickyControls() {
    const controlsSticky = document.getElementById('controlsSticky');
    const stats = document.querySelector('.stats');
    
    if (!controlsSticky || !stats) return;
    
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Stats are visible, make controls less prominent
                    controlsSticky.classList.remove('enhanced');
                } else {
                    // Stats are not visible, make controls more prominent
                    controlsSticky.classList.add('enhanced');
                }
            });
        },
        {
            threshold: 0.1,
            rootMargin: '-50px 0px 0px 0px'
        }
    );
    
    observer.observe(stats);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    handleStickyControls();
});

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