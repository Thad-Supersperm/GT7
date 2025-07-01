const carsPath = 'data/db/cars.csv';
const makersPath = 'data/db/maker.csv';
const countriesPath = 'data/db/country.csv';

async function loadCSV(path) {
  const response = await fetch(path);
  const text = await response.text();
  return Papa.parse(text, { header: true }).data;
}

async function buildTable() {
  const [cars, makers, countries] = await Promise.all([
    loadCSV(carsPath),
    loadCSV(makersPath),
    loadCSV(countriesPath),
  ]);

  const makerMap = {};
  const countryMap = {};

  makers.forEach(({ "maker id": id, name, "country id": countryId }) => {
    makerMap[id] = { name, countryId };
  });

  countries.forEach(({ "country id": id, name, "country code": code }) => {
    countryMap[id] = { name, code };
  });

  const tbody = document.querySelector("#carTable tbody");

  cars.forEach(({ name: carName, "maker id": makerId }) => {
    const maker = makerMap[makerId];
    const country = countryMap[maker.countryId];

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${carName}</td>
      <td>${maker.name}</td>
      <td>${country.name}</td>
      <td>${country.code}</td>
    `;
    tbody.appendChild(row);
  });
}

buildTable();
