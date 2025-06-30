const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// MySQL connection config
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'inch123',
    database: 'nammametro',
};

// GET route to load tracker page with station dropdown
router.get('/', async(req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [stationsRows] = await connection.execute('SELECT station_name FROM metro_stations ORDER BY station_name');
        await connection.end();

        const stations = stationsRows.map(row => row.station_name);

        res.render('tracker', { stations, routeInfoObj: null, origin: '', destination: '' });
    } catch (error) {
        console.error('Error loading tracker page:', error);
        res.status(500).send('Internal server error');
    }
});

// POST route to handle form submission and render page with route info
router.post('/', async(req, res) => {
    let { origin, destination } = req.body;

    if (!origin || !destination) {
        return res.status(400).send('Origin and destination are required.');
    }

    try {
        const connection = await mysql.createConnection(dbConfig);

        // Fetch station details
        const [originStation] = await connection.execute(
            'SELECT * FROM metro_stations WHERE station_name = ?', [origin]
        );
        const [destStation] = await connection.execute(
            'SELECT * FROM metro_stations WHERE station_name = ?', [destination]
        );

        if (!originStation.length || !destStation.length) {
            const [stationsRows] = await connection.execute('SELECT station_name FROM metro_stations ORDER BY station_name');
            const stations = stationsRows.map(row => row.station_name);
            await connection.end();
            return res.render('tracker', { stations, routeInfoObj: { error: 'Invalid station names.' }, origin, destination });
        }

        const routeInfoObj = await getRouteWithStations(connection, originStation[0], destStation[0]);

        // Fetch all stations again for dropdown
        const [stationsRows] = await connection.execute('SELECT station_name FROM metro_stations ORDER BY station_name');
        const stations = stationsRows.map(row => row.station_name);

        await connection.end();

        res.render('tracker', { stations, routeInfoObj, origin, destination });
    } catch (error) {
        console.error('Error in route calculation:', error);
        res.status(500).send('Internal server error');
    }
});

// Helper function: returns structured route info object
async function getRouteWithStations(connection, origin, destination) {
    if (origin.line === destination.line) {
        // Same line, get stations between origin and destination
        const [stations] = await connection.execute(
            'SELECT station_name FROM metro_stations WHERE line = ? ORDER BY station_order', [origin.line]
        );
        const stationNames = stations.map(s => s.station_name);
        const startIndex = stationNames.indexOf(origin.station_name);
        const endIndex = stationNames.indexOf(destination.station_name);

        if (startIndex === -1 || endIndex === -1) {
            return { error: 'Stations not found on the specified line.' };
        }

        const routeStations =
            startIndex < endIndex ?
            stationNames.slice(startIndex, endIndex + 1) :
            stationNames.slice(endIndex, startIndex + 1).reverse();

        return {
            sameLine: true,
            line: origin.line,
            stations: routeStations,
        };
    }

    // Different lines: find interchange stations
    const [interchanges] = await connection.execute(
        `SELECT DISTINCT m1.station_name 
     FROM metro_stations m1
     JOIN metro_stations m2 ON m1.station_name = m2.station_name
     WHERE m1.line = ? AND m2.line = ?`, [origin.line, destination.line]
    );

    if (!interchanges.length) {
        return { error: 'No direct interchange available between these lines.' };
    }

    // Prefer "Majestic" if available
    const preferredInterchange = interchanges.find(i => i.station_name.toLowerCase() === 'majestic');
    const interchange = preferredInterchange ? preferredInterchange.station_name : interchanges[0].station_name;

    // Route to interchange on origin line
    const firstRoute = await getRouteWithStations(connection, origin, { station_name: interchange, line: origin.line });

    if (firstRoute.error) return { error: firstRoute.error };

    // Route from interchange on destination line
    const secondRoute = await getRouteWithStations(connection, { station_name: interchange, line: destination.line }, destination);

    if (secondRoute.error) return { error: secondRoute.error };

    return {
        sameLine: false,
        interchange,
        firstRoute,
        secondRoute,
    };
}

module.exports = router;