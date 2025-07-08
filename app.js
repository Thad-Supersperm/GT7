// --- 1. SUPABASE SETUP (No changes) ---
const SUPABASE_URL = 'https://ayxfeividbydjtuohyjv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5eGZlaXZpZGJ5ZGp0dW9oeWp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MTA5MzYsImV4cCI6MjA2NzI4NjkzNn0.zeWkQfOqGXQVq8IzLgUzAMkWi9rvxeD9vvMt4U7Gzu0';

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. DOM ELEMENTS (No changes) ---
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const userInfo = document.getElementById('user-info');
const userEmail = document.getElementById('user-email');
const carTable = document.getElementById('car-table');
const carTableBody = carTable.querySelector('tbody');
const loadingMessage = document.getElementById('loading-message');

// --- 3. AUTHENTICATION LOGIC (Using the improved version) ---
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

// --- 4. DATA LOADING AND JOINING (Updated) ---

function parseCsv(url) {
    return new Promise(resolve => {
        Papa.parse(url, {
            download: true,
            header: true,
            skipEmptyLines: true,
            transformHeader: header => header.trim().toLowerCase(),
            complete: (results) => resolve(results.data)
        });
    });
}

async function loadAndProcessData(user) {
    loadingMessage.classList.remove('hidden');
    carTable.classList.add('hidden');

    // Fetch all CSV files, including the new colors.csv from the root
    const [cars, makers, countries, perfs, colorsData] = await Promise.all([
        parseCsv('data/db/cars.csv'),
        parseCsv('data/db/maker.csv'),
        parseCsv('data/db/country.csv'),
        parseCsv('data/db/stockperf.csv'),
        parseCsv('colors.csv') // Load the new colors file
    ]);

    // Create a map for colors, grouping them by car ID
    const colorMap = new Map();
    for (const item of colorsData) {
        if (!colorMap.has(item.id)) {
            colorMap.set(item.id, []);
        }
        colorMap.get(item.id).push(item.color);
    }

    const makerMap = new Map(makers.map(m => [m.id, m]));
    const countryMap = new Map(countries.map(c => [c.id, c]));
    const perfMap = new Map(perfs.map(p => [p.id, p]));

    // Join all the data
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
            colors: colorMap.get(car.id) || [] // Get the array of colors for this car
        };
    });

    renderTable(fullCarData, user);
    loadingMessage.classList.add('hidden');
    carTable.classList.remove('hidden');
}

// --- 5. TABLE RENDERING (Updated) ---
function renderTable(carData, user) {
    carTableBody.innerHTML = '';

    for (const car of carData) {
        const row = carTableBody.insertRow();
        
        // Col 1: "Own" Checkbox
        const checkboxCell = row.insertCell(0);
        checkboxCell.className = 'own-checkbox-cell';
        const ownCheckbox = document.createElement('input');
        ownCheckbox.type = 'checkbox';
        ownCheckbox.id = `car-${car.id}`;
        ownCheckbox.dataset.identifier = car.id; // Identifier is just the car ID
        checkboxCell.appendChild(ownCheckbox);

        // Cols 2-4: Car Info
        row.insertCell(1).textContent = car.carname;
        row.insertCell(2).textContent = car.makername;
        row.insertCell(3).textContent = car.countryname;

        // Col 5: Performance
        const perfCell = row.insertCell(4);
        perfCell.innerHTML = `<span class="perf-item">PP: ${car.pp}</span><span class="perf-item">Tyres: ${car.tyre}</span>`;
        
        // Col 6: Available Colors (NEW)
        const colorsCell = row.insertCell(5);
        colorsCell.className = 'colors-cell';

        if (car.colors.length > 0) {
            car.colors.forEach(color => {
                // Create a unique identifier for each car-color combination
                const safeColor = color.replace(/\s+/g, '-'); // e.g., "Championship White" -> "Championship-White"
                const identifier = `${car.id}-${safeColor}`;

                const div = document.createElement('div');
                div.className = 'color-item';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = identifier;
                checkbox.dataset.identifier = identifier; // This unique ID is what we save to Supabase

                const label = document.createElement('label');
                label.htmlFor = identifier;
                label.textContent = color;

                div.appendChild(checkbox);
                div.appendChild(label);
                colorsCell.appendChild(div);
            });
        }
    }
    
    loadUserChecklist(user);
}

// --- 6. SUPABASE DATA INTERACTION (No changes needed - it just works!) ---

// This function now automatically handles BOTH "own" and "color" checkboxes
// because they all have a unique `dataset.identifier`.
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

// This event listener now automatically handles BOTH "own" and "color" checkboxes.
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
        // Insert a row with the unique identifier (e.g., "1001" or "1001-Championship-White")
        const { error } = await _supabase
            .from('user_selections')
            .insert({ user_id: user.id, car_identifier: identifier });
        if (error) console.error('Error saving selection:', error);
    } else {
        // Delete the row with the matching unique identifier
        const { error } = await _supabase
            .from('user_selections')
            .delete()
            .match({ user_id: user.id, car_identifier: identifier });
        if (error) console.error('Error removing selection:', error);
    }
});

// --- INITIALIZATION (No changes) ---
document.addEventListener('DOMContentLoaded', () => {
    _supabase.auth.getSession().then(({ data: { session } }) => {
        updateUI(session);
    });
});
