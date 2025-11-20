let map;
let polyline;
let coordinates = [];
let watchId = null;
let isTracking = false;
let totalDistance = 0;

const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const exportButton = document.getElementById('exportButton');
const areaOutput = document.getElementById('areaOutput');
const distanceOutput = document.getElementById('distanceOutput');

// Initialize the map
function initMap() {
    const initialCenter = { lat: 20.5937, lng: 78.9629 }; // Default to center of India
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 5,
        center: initialCenter,
        mapTypeId: 'satellite'
    });

    polyline = new google.maps.Polyline({
        strokeColor: '#0000FF', // Blue line
        strokeOpacity: 1.0,
        strokeWeight: 3,
        map: map
    });

    // Try to get current location to center map
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };
                map.setCenter(userLocation);
                map.setZoom(15);
            },
            () => {
                console.warn('Error: The Geolocation service failed or permission denied.');
                // Keep default center if user location fails
            }
        );
    } else {
        console.warn('Error: Your browser doesn\'t support geolocation.');
    }
}

// Start GPS Tracking
startButton.addEventListener('click', () => {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
    }

    isTracking = true;
    coordinates = [];
    totalDistance = 0;
    polyline.setPath([]); // Clear previous polyline
    if (window.polygon) {
        window.polygon.setMap(null); // Clear previous polygon
    }

    const options = {
        enableHighAccuracy: true,
        timeout: 10000, // 10 seconds
        maximumAge: 0
    };

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const newCoord = new google.maps.LatLng(lat, lng);

            if (coordinates.length > 0) {
                totalDistance += google.maps.geometry.spherical.computeDistanceBetween(
                    coordinates[coordinates.length - 1],
                    newCoord
                );
            }
            coordinates.push(newCoord);
            polyline.getPath().push(newCoord);
            map.setCenter(newCoord);
            updateUI();
        },
        (error) => {
            console.warn(`ERROR(${error.code}): ${error.message}`);
            alert(`Error getting location: ${error.message}. Please ensure location services are enabled and permissions granted.`);
            if (error.code === 1) { // PERMISSION_DENIED
                stopTracking(); // Stop if permission is denied during tracking
            }
        },
        options
    );

    startButton.disabled = true;
    stopButton.disabled = false;
    exportButton.disabled = true;
    areaOutput.textContent = 'N/A';
    distanceOutput.textContent = '0.00 km';
    console.log('Tracking started...');
});

// Stop GPS Tracking
stopButton.addEventListener('click', () => {
    stopTracking();
});

function stopTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    isTracking = false;
    startButton.disabled = false;
    stopButton.disabled = true;
    if (coordinates.length > 0) {
        exportButton.disabled = false;
    }
    calculateAreaAndDrawPolygon();
    updateUI();
    console.log('Tracking stopped.');
}

function calculateAreaAndDrawPolygon() {
    if (coordinates.length < 3) {
        areaOutput.textContent = 'N/A (Need at least 3 points)';
        return;
    }

    // Close the polygon by adding the first point at the end if it's not already closed
    // For area calculation, it doesn't strictly need to be visually closed by adding the point to the array,
    // but for drawing a polygon, it's often done.
    // google.maps.geometry.spherical.computeArea takes an array of LatLngs or an MVCArray<LatLng>
    // For a simple path, it calculates the area of the polygon formed by these points.

    const areaInSquareMeters = google.maps.geometry.spherical.computeArea(coordinates);
    const areaInAcres = areaInSquareMeters * 0.000247105;
    areaOutput.textContent = `${areaInAcres.toFixed(2)} acres`;

    // Draw the polygon
    if (window.polygon) {
        window.polygon.setMap(null); // Clear existing polygon before drawing a new one
    }
    window.polygon = new google.maps.Polygon({
        paths: coordinates,
        strokeColor: '#FF0000', // Red
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#FF0000', // Red
        fillOpacity: 0.35,
        map: map
    });
}

function updateUI() {
    const distanceInKm = totalDistance / 1000;
    distanceOutput.textContent = `${distanceInKm.toFixed(2)} km`;
    // Area is updated in calculateAreaAndDrawPolygon
}

// Export Data
exportButton.addEventListener('click', () => {
    if (coordinates.length === 0) {
        alert('No data to export.');
        return;
    }

    const format = prompt('Export as (CSV or JSON):', 'JSON').toUpperCase();
    if (format === 'CSV') {
        exportToCsv();
    } else if (format === 'JSON') {
        exportToJson();
    } else if (format !== null) {
        alert('Invalid format. Please choose CSV or JSON.');
    }
});

function exportToCsv() {
    let csvContent = "data:text/csv;charset=utf-8,Latitude,Longitude\n";
    coordinates.forEach(coord => {
        csvContent += `${coord.lat()},${coord.lng()}\n`;
    });

    const area = areaOutput.textContent;
    const distance = distanceOutput.textContent;
    csvContent += `\nArea:,${area.replace(' acres', '')},acres\n`;
    csvContent += `Distance:,${distance.replace(' km', '')},km\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `gps_data_${Date.now()}.csv`);
    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
}

function exportToJson() {
    const data = {
        coordinates: coordinates.map(coord => ({ latitude: coord.lat(), longitude: coord.lng() })),
        area: areaOutput.textContent,
        distance: distanceOutput.textContent
    };

    const jsonContent = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonContent);
    link.setAttribute('download', `gps_data_${Date.now()}.json`);
    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
}

// Expose initMap to be callable by Google Maps API script
window.initMap = initMap; 