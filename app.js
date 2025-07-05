// --- 1. SUPABASE SETUP (Your details have been added) ---
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

// --- 3. AUTHENTICATION LOGIC (No changes needed) ---
loginButton.addEventListener('click', () => _supabase.auth.signInWithOAuth({ provider: 'github' }));
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

// Helper to fetch and parse a CSV file, returns a Promise
function parseCsv(url) {
    return new Promise(resolve => {
        Papa.parse(url, {
            download: true,
            header: true,
            skipEmptyLines: true,
            // Normalizes headers to lowercase and no spaces (e.g., "ShortName" -> "shortname")
            transformHeader: header => header.trim().toLowerCase(), 
            complete: (results) => {
                resolve(results.data);
            }
        });
    });
}

// Main function to load all data, join it, and render the table
async function loadAndProcessData(user) {
    loadingMessage.classList.remove('hidden');
    carTable.classList.add('hidden');

    const [cars, makers, countries, perfs] = await Promise.all([
        parseCsv('data/db/cars.csv'),
        parseCsv('data/db/maker.csv'),
        parseCsv('data/db/country.csv'),
        parseCsv('data/db/stockperf.csv')
    ]);

    // Create maps for efficient lookups (much faster than searching arrays)
    const makerMap = new Map(makers.map(m => [m.id, m]));
    const countryMap = new Map(countries.map(c => [c.id, c]));
    const perfMap = new Map(perfs.map(p => [p.id, p]));

    // Join the data
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
            tyre: perf ? perf.tyre : 'N/A'
        };
    });

    renderTable(fullCarData, user);
    loadingMessage.classList.add('hidden');
    carTable.classList.remove('hidden');
}

// --- 5. TABLE RENDERING ---
function renderTable(carData, user) {
    carTableBody.innerHTML = ''; // Clear previous data

    for (const car of carData) {
        const row = carTableBody.insertRow();
        
        // Column 1: "Own" Checkbox
        const checkboxCell = row.insertCell(0);
        checkboxCell.className = 'own-checkbox-cell';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `car-${car.id}`;
        checkbox.dataset.identifier = car.id; // The unique car ID is our identifier
        checkboxCell.appendChild(checkbox);

        // Other columns
        row.insertCell(1).textContent = car.carname;
        row.insertCell(2).textContent = car.makername;
        row.insertCell(3).textContent = car.countryname;

        // Column 5: Stock Performance (multi-line)
        const perfCell = row.insertCell(4);
        perfCell.innerHTML = `
            <span class="perf-item">PP: ${car.pp}</span>
            <span class="perf-item">Tyres: ${car.tyre}</span>
        `;
    }
    
    // After rendering the table structure, load the user's checklist
    loadUserChecklist(user);
}


// --- 6. SUPABASE DATA INTERACTION ---

// Fetches the user's saved selections and checks the boxes
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
        // The identifier is just the car ID
        const checkbox = document.getElementById(`car-${item.car_identifier}`);
        if (checkbox) {
            checkbox.checked = true;
        }
    });
}

// Event listener for all checkbox clicks in the table body
carTableBody.addEventListener('change', async (event) => {
    if (event.target.type !== 'checkbox') return;

    const checkbox = event.target;
    const carId = checkbox.dataset.identifier;
    const { data: { user } } = await _supabase.auth.getUser();

    if (!user) {
        alert('You must be logged in to save your checklist.');
        checkbox.checked = !checkbox.checked; // Revert the change
        return;
    }

    if (checkbox.checked) {
        // Add record to Supabase
        const { error } = await _supabase
            .from('user_selections')
            .insert({ user_id: user.id, car_identifier: carId });
        if (error) console.error('Error saving selection:', error.message);
    } else {
        // Remove record from Supabase
        const { error } = await _supabase
            .from('user_selections')
            .delete()
            .match({ user_id: user.id, car_identifier: carId });
        if (error) console.error('Error removing selection:', error.message);
    }
});

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Check if a user session exists on page load
    _supabase.auth.getSession().then(({ data: { session } }) => {
        updateUI(session);
    });
});
