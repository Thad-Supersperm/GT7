// --- 1. SUPABASE SETUP ---
const SUPABASE_URL = 'https://ayxfeividbydjtuohyjv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5eGZlaXZpZGJ5ZGp0dW9oeWp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MTA5MzYsImV4cCI6MjA2NzI4NjkzNn0.zeWkQfOqGXQVq8IzLgUzAMkWi9rvxeD9vvMt4U7Gzu0';

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. DOM ELEMENTS ---
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const userInfo = document.getElementById('user-info');
const userEmail = document.getElementById('user-email');
const carTable = document.getElementById('car-table');
const carTableBody = carTable.querySelector('tbody');
const loadingMessage = document.getElementById('loading-message');

// --- 3. AUTHENTICATION LOGIC ---
loginButton.addEventListener('click', () => {
    _supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
            redirectTo: window.location.origin + window.location.pathname
        }
    });
});
logoutButton.addEventListener('click', () => _supabase.auth.signOut());

_supabase.auth.onAuthStateChange((_event, session) => {
    updateUI(session);
});

function updateUI(session) {
    if (session) {
        loginButton.classList.add('hidden');
        userInfo.classList.remove('hidden');
        userEmail.textContent = `Welcome, ${session.user.email}`;
        loadingMessage.textContent = 'Loading car data...';
        loadAndProcessData(session.user);
    } else {
        loginButton.classList.remove('hidden');
        userInfo.classList.add('hidden');
        carTable.classList.add('hidden');
        loadingMessage.classList.remove('hidden');
        loadingMessage.textContent = 'Please log in to load your garage.';
        carTableBody.innerHTML = '';
    }
}

// --- 4. DATA LOADING AND JOINING ---

function parseCsv(url) {
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download: true,
            header: true,
            skipEmptyLines: true,
            transformHeader: header => header.trim().toLowerCase(),
            complete: (results) => resolve(results.data),
            error: (error) => reject(new Error(`Failed to parse ${url}: ${error.message}`))
        });
    });
}

// Updated helper to fetch and process all price data from both sources
async function loadAllPriceData(manifest) {
    // This map will store both prices: Map<CarID, Map<DateString, {usedPrice: string, legendPrice: string}>>
    const priceMap = new Map();

    const processEntries = (dayData, dateStr, priceType) => {
        // Handle different column names: 'price' for used, 'cr' for legend
        const priceKey = priceType === 'used' ? 'price' : 'cr';
        const mapKey = priceType === 'used' ? 'usedPrice' : 'legendPrice';

        for (const entry of dayData) {
            if (!priceMap.has(entry.id)) {
                priceMap.set(entry.id, new Map());
            }
            if (!priceMap.get(entry.id).has(dateStr)) {
                priceMap.get(entry.id).set(dateStr, {}); // Initialize price object for the day
            }
            // Set the appropriate price type
            priceMap.get(entry.id).get(dateStr)[mapKey] = entry[priceKey];
        }
    };

    const usedPromises = (manifest.used || []).map(file => {
        const dateStr = file.replace('.csv', '');
        return parseCsv(`data/used/${file}`).then(dayData => processEntries(dayData, dateStr, 'used'));
    });

    const legendPromises = (manifest.legend || []).map(file => {
        const dateStr = file.replace('.csv', '');
        return parseCsv(`data/legend/${file}`).then(dayData => processEntries(dayData, dateStr, 'legend'));
    });

    await Promise.all([...usedPromises, ...legendPromises]);
    return priceMap;
}

async function loadAndProcessData(user) {
    loadingMessage.classList.remove('hidden');
    carTable.classList.add('hidden');

    // Step 1: Fetch the new, structured manifest
    const manifestResponse = await fetch('data/manifest.json');
    const manifest = await manifestResponse.json();
    
    // Combine date lists and get unique, sorted dates. Newest first.
    const allDateFiles = [...new Set([...(manifest.used || []), ...(manifest.legend || [])])];
    allDateFiles.sort().reverse();
    const orderedDates = allDateFiles.map(p => p.replace('.csv', ''));

    // Step 2: Load ALL data in parallel
    const [
        priceMap,
        cars,
        makers,
        countries,
        perfs,
        colorsData
    ] = await Promise.all([
        loadAllPriceData(manifest),
        parseCsv('data/db/cars.csv'),
        parseCsv('data/db/maker.csv'),
        parseCsv('data/db/country.csv'),
        parseCsv('data/db/stockperf.csv'),
        parseCsv('colors.csv')
    ]);

    // Step 3: Process and join static car data
    const colorMap = new Map();
    colorsData.forEach(item => {
        if (!colorMap.has(item.id)) colorMap.set(item.id, []);
        colorMap.get(item.id).push(item.color);
    });
    const makerMap = new Map(makers.map(m => [m.id, m]));
    const countryMap = new Map(countries.map(c => [c.id, c]));
    const perfMap = new Map(perfs.map(p => [p.id, p]));

    const fullCarData = cars.map(car => {
        const maker = makerMap.get(car.maker);
        const country = maker ? countryMap.get(maker.country) : null;
        const perf = perfMap.get(car.id);
        return {
            id: car.id,
            carname: car.shortname,
            makername: maker ? maker.name : 'N/A',
            countryname: country ? country.name : 'N/A',
            pp: perf ? perf.pp : 'N/A',
            tyre: perf ? perf.tyre : 'N/A',
            colors: colorMap.get(car.id) || []
        };
    });

    // Step 4: Render the table with all the data
    renderTable(fullCarData, priceMap, orderedDates, user);
    loadingMessage.classList.add('hidden');
    carTable.classList.remove('hidden');
}


// --- 5. TABLE RENDERING ---

function generatePriceHeaders(orderedDates) {
    const monthHeaderRow = document.createElement('tr');
    const dayHeaderRow = document.createElement('tr');

    // Add empty cells to align with static columns
    for (let i = 0; i < 6; i++) {
        monthHeaderRow.appendChild(document.createElement('th'));
        dayHeaderRow.appendChild(document.createElement('th'));
    }
    
    if (orderedDates.length === 0) return { monthHeaderRow, dayHeaderRow };

    // Note: The date format "YY-MM-DD" is assumed.
    let currentMonth = orderedDates[0].substring(0, 5);
    let monthColspan = 0;

    for (const dateStr of orderedDates) {
        const [year, month, day] = dateStr.split('-');
        const monthIdentifier = `${year}-${month}`;

        if (monthIdentifier !== currentMonth) {
            const th = document.createElement('th');
            th.className = 'price-header-month';
            th.colSpan = monthColspan;
            th.innerHTML = `<b>20${currentMonth.replace('-', '/')}</b>`;
            monthHeaderRow.appendChild(th);

            currentMonth = monthIdentifier;
            monthColspan = 0;
        }
        monthColspan++;

        const dayTh = document.createElement('th');
        dayTh.className = 'price-header-day';
        dayTh.textContent = day;
        dayHeaderRow.appendChild(dayTh);
    }
    
    // Append the last month group
    const th = document.createElement('th');
    th.className = 'price-header-month';
    th.colSpan = monthColspan;
    th.innerHTML = `<b>20${currentMonth.replace('-', '/')}</b>`;
    monthHeaderRow.appendChild(th);

    return { monthHeaderRow, dayHeaderRow };
}

function renderTable(carData, priceMap, orderedDates, user) {
    const tableHeader = carTable.querySelector('thead');
    tableHeader.innerHTML = '';
    carTableBody.innerHTML = '';

    // Generate and append dynamic price headers
    const { monthHeaderRow, dayHeaderRow } = generatePriceHeaders(orderedDates);
    tableHeader.appendChild(monthHeaderRow);
    tableHeader.appendChild(dayHeaderRow);

    // Render each car row
    for (const car of carData) {
        const row = carTableBody.insertRow();
        
        // --- Static car info cells ---
        // Col 1: "Own" Checkbox
        const ownCell = row.insertCell();
        ownCell.className = 'own-checkbox-cell';
        const ownCheckbox = document.createElement('input');
        ownCheckbox.type = 'checkbox';
        ownCheckbox.id = `car-${car.id}`;
        ownCheckbox.dataset.identifier = car.id;
        ownCell.appendChild(ownCheckbox);

        // Cols 2-5: Car Info
        row.insertCell().textContent = car.carname;
        row.insertCell().textContent = car.makername;
        row.insertCell().textContent = car.countryname;
        const perfCell = row.insertCell();
        perfCell.innerHTML = `<span class="perf-item">PP: ${car.pp}</span><span class="perf-item">Tyres: ${car.tyre}</span>`;
        
        // Col 6: Colors
        const colorsCell = row.insertCell();
        colorsCell.className = 'colors-cell';
        if (car.colors.length > 0) {
            car.colors.forEach(color => {
                const safeColor = color.replace(/\s+/g, '-');
                const identifier = `${car.id}-${safeColor}`;
                const div = document.createElement('div');
                div.className = 'color-item';
                div.innerHTML = `<input type="checkbox" id="${identifier}" data-identifier="${identifier}"><label for="${identifier}">${color}</label>`;
                colorsCell.appendChild(div);
            });
        }
        
        // --- Dynamic Price Cells with Merging ---
        let priceCellsHtml = '';
        if (orderedDates.length > 0) {
            let lastUsedPrice = 'initial';
            let lastLegendPrice = 'initial';
            let colspan = 0;

            const appendCell = () => {
                let cellContent = '';
                if (lastUsedPrice) {
                    cellContent += `<div class='price-used'>U: ${parseInt(lastUsedPrice).toLocaleString()}</div>`;
                }
                if (lastLegendPrice) {
                    cellContent += `<div class='price-legend'>L: ${parseInt(lastLegendPrice).toLocaleString()}</div>`;
                }
                priceCellsHtml += `<td class="price-cell" colspan="${colspan}">${cellContent}</td>`;
            };

            for (const dateStr of orderedDates) {
                const prices = priceMap.get(car.id)?.get(dateStr) || {};
                const currentUsed = prices.usedPrice || null;
                const currentLegend = prices.legendPrice || null;

                if (currentUsed === lastUsedPrice && currentLegend === lastLegendPrice) {
                    colspan++;
                } else {
                    if (colspan > 0) {
                        appendCell();
                    }
                    lastUsedPrice = currentUsed;
                    lastLegendPrice = currentLegend;
                    colspan = 1;
                }
            }
            // Append the last group of cells
            if (colspan > 0) {
                appendCell();
            }
        }
        row.innerHTML += priceCellsHtml;
    }

    loadUserChecklist(user);
}


// --- 6. SUPABASE DATA INTERACTION ---

async function loadUserChecklist(user) {
    const { data, error } = await _supabase
        .from('user_selections')
        .select('car_identifier')
        .eq('user_id', user.id);

    if (error) {
        console.error('Error fetching checklist:', error.message);
        return;
    }

    data.forEach(item => {
        const checkbox = document.getElementById(item.car_identifier);
        if (checkbox) {
            checkbox.checked = true;
        }
    });
}

carTableBody.addEventListener('change', async (event) => {
    if (event.target.type !== 'checkbox') return;

    const checkbox = event.target;
    const identifier = checkbox.dataset.identifier;
    const { data: { user } } = await _supabase.auth.getUser();

    if (!user) {
        alert('You must be logged in to save your checklist.');
        checkbox.checked = !checkbox.checked;
        return;
    }

    if (checkbox.checked) {
        const { error } = await _supabase
            .from('user_selections')
            .insert({ user_id: user.id, car_identifier: identifier });
        if (error) console.error('Error saving selection:', error);
    } else {
        const { error } = await _supabase
            .from('user_selections')
            .delete()
            .match({ user_id: user.id, car_identifier: identifier });
        if (error) console.error('Error removing selection:', error);
    }
});


// --- 7. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    _supabase.auth.getSession().then(({ data: { session } }) => {
        updateUI(session);
    });
});
