import xml.etree.ElementTree as ET
import json
from math import radians, sin, cos, sqrt, atan2

def calculate_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees)
    """
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    distance = 6371 * c  # Radius of earth in kilometers
    
    return round(distance, 2)

def main():
    # Budapest coordinates
    BUDAPEST_LAT = 47.4979
    BUDAPEST_LON = 19.0402
    
    # Parse XML file
    tree = ET.parse('unesco.xml')
    root = tree.getroot()
    
    # List to store site information
    sites = []
    
    # Process each site
    for row in root.findall('.//row'):
        try:
            # Extract coordinates
            lat_elem = row.find('latitude')
            lon_elem = row.find('longitude')
            
            # Skip if coordinates are missing
            if lat_elem is None or lon_elem is None or not lat_elem.text or not lon_elem.text:
                continue
                
            lat = float(lat_elem.text)
            lon = float(lon_elem.text)
            
            # Calculate distance from Budapest
            distance = calculate_distance(BUDAPEST_LAT, BUDAPEST_LON, lat, lon)
            
            # Create site dictionary
            site = {
                'name': row.find('site').text,
                'category': row.find('category').text,
                'latitude': lat,
                'longitude': lon,
                'distance_from_budapest_km': distance,
                'states': row.find('states').text,
                'date_inscribed': row.find('date_inscribed').text
            }
            
            sites.append(site)
        except (AttributeError, ValueError) as e:
            # Skip entries with missing or invalid coordinates
            continue
    
    # Sort sites by distance from Budapest
    sites.sort(key=lambda x: x['distance_from_budapest_km'])
    
    # Write to JSON file
    with open('unesco_sites_by_distance.json', 'w', encoding='utf-8') as f:
        json.dump(sites, f, ensure_ascii=False, indent=2)
    
    print(f"Processed {len(sites)} UNESCO heritage sites")
    print("Results have been saved to unesco_sites_by_distance.json")

if __name__ == "__main__":
    main() 