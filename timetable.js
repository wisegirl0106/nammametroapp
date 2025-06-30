// timetable.js
const express = require("express");
const router = express.Router();
const mysql = require("mysql2/promise");

// MySQL connection config (using mysql2/promise)
const dbConfig = {
    host: "localhost",
    user: "root",
    password: "inch123",
    database: "nammametro",
};

// Fetching all timetable entries
router.get("/", async(req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [results] = await connection.execute("SELECT * FROM timetable");
        await connection.end();
        res.render("timetable", { timetable: results });
    } catch (err) {
        console.error("Error fetching timetable:", err);
        res.status(500).send("Error fetching timetable data");
    }
});

// Searching timetable by station
router.post("/search", async(req, res) => {
    const { station } = req.body;
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [results] = await connection.execute(
            "SELECT * FROM timetable WHERE station LIKE ?", [`%${station}%`]
        );
        await connection.end();
        res.render("timetable", { timetable: results, search: station });
    } catch (err) {
        console.error("Error searching timetable:", err);
        res.status(500).send("Error searching timetable data");
    }
});

module.exports = router;