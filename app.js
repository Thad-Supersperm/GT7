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
loginButton.addEventListener('click', () => _supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: window.location.origin + window.location.pathname }}));
logoutButton.addEventListener('click', () => _supabase.auth.signOut());
_supabase.auth.onAuthStateChange((_event, session) => updateUI(session));
function updateUI(session) { if (session) { loginButton.classList.add('hidden'); userInfo.classList.remove('hidden'); userEmail.textContent = `Welcome, ${session.user.email}`; loadingMessage.textContent = 'Loading car data...'; loadAndProcessData(session.user); } else { loginButton.classList.remove('hidden'); userInfo.classList.add('hidden'); carTable.classList.add('hidden'); loadingMessage.classList.remove('hidden'); loadingMessage.textContent = 'Please log in to load your garage.'; carTableBody.innerHTML = ''; } }

// --- 4. DATA LOADING ---
function parseCsv(url) { return new Promise((resolve, reject) => { Papa.parse(url, { download: true, header: true, skipEmptyLines: true, transformHeader: h => h.trim().toLowerCase(), complete: (res) => resolve(res.data), error: (err) => reject(err) }); }); }
async function loadAndProcessData(user) {
    loadingMessage.classList.remove('hidden');
    carTable.classList.add('hidden');
    const [ prebuiltData, cars, makers, countries, perfs, colorsData ] = await Promise.all([ fetch('data/prebuilt_prices.json').then(res => res.json()), parseCsv('data/db/cars.csv'), parseCsv('data/db/maker.csv'), parseCsv('data/db/country.csv'), parseCsv('data/db/stockperf.csv'), parseCsv('colors.csv') ]);
    const colorMap = new Map(); colorsData.forEach(item => { if (!colorMap.has(item.id)) colorMap.set(item.id, []); colorMap.get(item.id).push(item.color); });
    const makerMap = new Map(makers.map(m => [m.id, m])); const countryMap = new Map(countries.map(c => [c.id, c])); const perfMap = new Map(perfs.map(p => [p.id, p]));
    const fullCarData = cars.map(car => { const maker = makerMap.get(car.maker); const country = maker ? countryMap.get(maker.country) : null; const perf = perfMap.get(car.id); return { id: car.id, carname: car.shortname, makername: maker ? maker.name : 'N/A', countryname: country ? country.name : 'N/A', pp: perf ? perf.pp : 'N/A', tyre: perf ? perf.tyre : 'N/A', colors: colorMap.get(car.id) || [] }; });
    renderTable(fullCarData, prebuiltData.priceData, prebuiltData.headerDates, user);
    loadingMessage.classList.add('hidden');
    carTable.classList.remove('hidden');
}

// --- 5. TABLE RENDERING ---
function generatePriceHeaders(orderedDates) { const monthHeaderRow = document.createElement('tr'); const dayHeaderRow = document.createElement('tr'); for (let i = 0; i < 6; i++) { monthHeaderRow.appendChild(document.createElement('th')); dayHeaderRow.appendChild(document.createElement('th')); } if (!orderedDates || orderedDates.length === 0) return { monthHeaderRow, dayHeaderRow }; let currentMonth = orderedDates[0].substring(0, 5); let monthColspan = 0; for (const dateStr of orderedDates) { const [year, month, day] = dateStr.split('-'); const monthIdentifier = `${year}-${month}`; if (monthIdentifier !== currentMonth) { const th = document.createElement('th'); th.className = 'price-header-month'; th.colSpan = monthColspan; th.innerHTML = `<b>20${currentMonth.replace('-', '/')}</b>`; monthHeaderRow.appendChild(th); currentMonth = monthIdentifier; monthColspan = 0; } monthColspan++; const dayTh = document.createElement('th'); dayTh.className = 'price-header-day'; dayTh.textContent = day; dayHeaderRow.appendChild(dayTh); } if (monthColspan > 0) { const th = document.createElement('th'); th.className = 'price-header-month'; th.colSpan = monthColspan; th.innerHTML = `<b>20${currentMonth.replace('-', '/')}</b>`; monthHeaderRow.appendChild(th); } return { monthHeaderRow, dayHeaderRow }; }
function renderTable(carData, priceData, orderedDates, user) {
    const tableHeader = carTable.querySelector('thead'); tableHeader.innerHTML = ''; carTableBody.innerHTML = '';
    const staticHeaderRow = document.createElement('tr'); staticHeaderRow.innerHTML = `<th class="own-header">Own</th><th>Car Name</th><th>Maker</th><th>Country</th><th>Stock Performance</th><th>Available Colors</th>`;
    orderedDates.forEach(() => staticHeaderRow.appendChild(document.createElement('th')));
    const { monthHeaderRow, dayHeaderRow } = generatePriceHeaders(orderedDates);
    tableHeader.appendChild(staticHeaderRow); tableHeader.appendChild(monthHeaderRow); tableHeader.appendChild(dayHeaderRow);
    for (const car of carData) {
        const row = carTableBody.insertRow();
        const ownCell = row.insertCell(); ownCell.className = 'own-checkbox-cell'; const ownCheckbox = document.createElement('input'); ownCheckbox.type = 'checkbox'; ownCheckbox.id = `car-${car.id}`; ownCheckbox.dataset.identifier = car.id; ownCell.appendChild(ownCheckbox);
        row.insertCell().textContent = car.carname; row.insertCell().textContent = car.makername; row.insertCell().textContent = car.countryname;
        const perfCell = row.insertCell(); perfCell.innerHTML = `<span class="perf-item">PP: ${car.pp}</span><span class="perf-item">Tyres: ${car.tyre}</span>`;
        const colorsCell = row.insertCell(); colorsCell.className = 'colors-cell'; if (car.colors.length > 0) { car.colors.forEach(color => { const safeColor = color.replace(/\s+/g, '-'); const identifier = `${car.id}-${safeColor}`; const div = document.createElement('div'); div.className = 'color-item'; div.innerHTML = `<input type="checkbox" id="${identifier}" data-identifier="${identifier}"><label for="${identifier}">${color}</label>`; colorsCell.appendChild(div); }); }
        const carPriceTimeline = priceData[car.id] || []; let priceCellsHtml = '';
        for (const cell of carPriceTimeline) { let cellContent = ''; if (cell.used) { const usedPrice = parseInt(cell.used, 10); if (!isNaN(usedPrice)) { cellContent += `<div class='price-used'>U: ${usedPrice.toLocaleString()}</div>`; } } if (cell.legend) { const legendPrice = parseInt(cell.legend, 10); if (!isNaN(legendPrice)) { cellContent += `<div class='price-legend'>L: ${legendPrice.toLocaleString()}</div>`; } } priceCellsHtml += `<td class="price-cell" colspan="${cell.colspan}">${cellContent}</td>`; }
        row.insertAdjacentHTML('beforeend', priceCellsHtml);
    }
    loadUserChecklist(user);
}

// --- 6. SUPABASE DATA INTERACTION ---
async function loadUserChecklist(user) { const { data, error } = await _supabase.from('user_selections').select('car_identifier').eq('user_id', user.id); if (error) { console.error('Error fetching checklist:', error.message); return; } data.forEach(item => { const checkbox = document.getElementById(item.car_identifier); if (checkbox) { checkbox.checked = true; } }); }
carTableBody.addEventListener('change', async (event) => { if (event.target.type !== 'checkbox') return; const checkbox = event.target; const identifier = checkbox.dataset.identifier; const { data: { user } } = await _supabase.auth.getUser(); if (!user) { alert('You must be logged in to save your checklist.'); checkbox.checked = !checkbox.checked; return; } if (checkbox.checked) { const { error } = await _supabase.from('user_selections').insert({ user_id: user.id, car_identifier: identifier }); if (error) console.error('Error saving selection:', error); } else { const { error } = await _supabase.from('user_selections').delete().match({ user_id: user.id, car_identifier: identifier }); if (error) console.error('Error removing selection:', error); } });

// --- 7. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => { _supabase.auth.getSession().then(({ data: { session } }) => { updateUI(session); }); });
