const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// When running locally, serve static files. Vercel handles this automatically via vercel.json.
app.use(express.static(path.join(__dirname, '../public')));

app.post('/api/lookup', async (req, res) => {
    try {
        const { address } = req.body;
        if (!address) {
            return res.status(400).json({ error: 'Address is required' });
        }

        console.log(`Looking up address: ${address}`);

        // Step 1: Geocode address via US Census Bureau
        const geocodeUrl = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(address + ', Chicago, IL')}&benchmark=Public_AR_Current&format=json`;
        
        const geoRes = await fetch(geocodeUrl);
        const geoData = await geoRes.json();
        
        const match = geoData.result?.addressMatches?.[0];
        if (!match) {
            return res.status(404).json({ error: 'Address not found in Chicago. Please verify the address.' });
        }

        const { x: lng, y: lat } = match.coordinates;
        console.log(`Coordinates: lat ${lat}, lng ${lng}`);

        // Step 2: Find ward using Chicago Data Portal (ward boundaries)
        const wardUrl = `https://data.cityofchicago.org/resource/k9yb-bpqx.json?$where=intersects(the_geom, 'POINT(${lng} ${lat})')`;
        
        const wardRes = await fetch(wardUrl);
        const wardData = await wardRes.json();

        if (!wardData || wardData.length === 0) {
            return res.status(404).json({ error: 'Address is outside of Chicago ward boundaries.' });
        }

        const wardNumber = wardData[0].ward;
        console.log(`Ward found: ${wardNumber}`);

        // Step 3: Get alderperson data from Chicago Data Portal
        const aldUrl = `https://data.cityofchicago.org/resource/htai-wnw4.json?ward=${wardNumber}`;
        const aldRes = await fetch(aldUrl);
        const aldData = await aldRes.json();

        let alderperson = null;
        if (aldData && aldData.length > 0) {
            const rawAld = aldData[0];
            
            let normalizedName = rawAld.alderman;
            if (normalizedName && normalizedName.includes(',')) {
                const parts = normalizedName.split(',').map(p => p.trim());
                normalizedName = `${parts[1]} ${parts[0]}`;
            }

            alderperson = {
                name: normalizedName,
                title: "Alderperson",
                ward: rawAld.ward,
                phone: rawAld.ward_phone || rawAld.city_hall_phone,
                email: rawAld.email,
                address: rawAld.address ? `${rawAld.address}, ${rawAld.city}, ${rawAld.state} ${rawAld.zipcode}` : null,
                website: rawAld.website ? rawAld.website.url : null,
                photo_url: rawAld.photo_link ? rawAld.photo_link.url : null
            };
        }

        // Step 4: Return combined response
        res.json({
            ward: wardNumber,
            address: match.matchedAddress,
            alderperson: alderperson,
            officials: [
                { name: "Brandon Johnson", title: "Mayor of Chicago", level: "city" },
                { name: "JB Pritzker", title: "Governor of Illinois", level: "state" },
                { name: "Dick Durbin", title: "US Senator", level: "federal" },
                { name: "Tammy Duckworth", title: "US Senator", level: "federal" }
            ],
            events: [
                { title: "Ward Community Meeting", date: "Next Tuesday, 6:30 PM", location: "Ward Office" },
                { title: "Street Sweeping Starting", date: "Upcoming Week", location: "Your Block" }
            ],
            legislation: [
                { id: "O2026-1234", title: "Affordable Housing Bond Resolution", status: "In Committee" },
                { id: "O2026-5678", title: "Traffic Calming Measures Funding", status: "Passed" }
            ]
        });

    } catch (error) {
        console.error('Lookup error:', error);
        res.status(500).json({ error: 'Internal server error processing lookup' });
    }
});

// Fallback for SPA/HTML routing (only locally)
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Export the app for Vercel Serverless
module.exports = app;

// Listen only if running directly (not in Vercel)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Civic Ward Hub server running at http://localhost:${PORT}`);
    });
}
