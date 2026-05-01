const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Configuration
const CHICAGO_DATA_URL = 'https://data.cityofchicago.org/resource/htai-wnw4.json';
const OUTPUT_DIR = path.join(__dirname, 'data_output');
const SPREADSHEET_FILENAME = 'Chicago_Elected_Officials.xlsx';

async function fetchChicagoAlderpersons() {
    console.log('Fetching data from Chicago Data Portal...');
    try {
        const response = await fetch(CHICAGO_DATA_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        console.log(`Successfully fetched ${data.length} records.`);
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
        return [];
    }
}

function normalizeData(rawData) {
    console.log('Normalizing data to match elected_officials schema...');
    
    return rawData.map(record => {
        // Clean up name format from "Last, First M." to "First M. Last"
        let normalizedName = record.alderman;
        if (normalizedName && normalizedName.includes(',')) {
            const parts = normalizedName.split(',').map(p => p.trim());
            normalizedName = `${parts[1]} ${parts[0]}`;
        }

        return {
            name: normalizedName || null,
            title: 'Alderperson',
            office: 'Chicago City Council',
            level: 'city',
            state: 'IL',
            district: `Ward ${record.ward}`,
            party: 'Nonpartisan', // Chicago City Council elections are technically nonpartisan
            email: record.email || null,
            phone: record.ward_phone || record.city_hall_phone || null,
            website: record.website ? record.website.url : null,
            photo_url: record.photo_link ? record.photo_link.url : null,
            address: record.address ? `${record.address}, ${record.city}, ${record.state} ${record.zipcode}` : null,
            source: 'chicago.gov',
            source_url: CHICAGO_DATA_URL,
            source_id: `chicago-ward-${record.ward}`
        };
    });
}

function generateSpreadsheet(normalizedData) {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const filePath = path.join(OUTPUT_DIR, SPREADSHEET_FILENAME);
    
    console.log('Generating Excel spreadsheet...');
    
    // Create a new workbook and add a worksheet
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(normalizedData);
    
    // Auto-adjust column widths based on header length and content (basic approach)
    const colWidths = [
        { wch: 25 }, // name
        { wch: 15 }, // title
        { wch: 20 }, // office
        { wch: 10 }, // level
        { wch: 8 },  // state
        { wch: 10 }, // district
        { wch: 15 }, // party
        { wch: 25 }, // email
        { wch: 15 }, // phone
        { wch: 30 }, // website
        { wch: 40 }, // photo_url
        { wch: 40 }, // address
        { wch: 15 }, // source
        { wch: 30 }, // source_url
        { wch: 15 }  // source_id
    ];
    worksheet['!cols'] = colWidths;
    
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Elected Officials');
    
    // Write the file
    xlsx.writeFile(workbook, filePath);
    console.log(`\n✅ Success! Data written to: ${filePath}`);
}

async function runPipeline() {
    console.log('Starting Civic Data Ingestion Pipeline...\n');
    
    const rawData = await fetchChicagoAlderpersons();
    if (rawData.length === 0) {
        console.log('No data retrieved. Exiting.');
        return;
    }
    
    const normalizedData = normalizeData(rawData);
    generateSpreadsheet(normalizedData);
    
    console.log(`\nPipeline completed. Total records processed: ${normalizedData.length}`);
}

runPipeline();
