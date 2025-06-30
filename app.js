const express = require('express');
const mysql = require('mysql');
const path = require('path');
const bcrypt = require('bcrypt');
const { askMetroBot } = require('./chatbot'); // Ollama version

const app = express();

// MySQL connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'inch123',
    database: 'nammametro',
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL: ' + err.stack);
        process.exit(1);
    }
    console.log('Connected to MySQL as id ' + connection.threadId);
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.locals.connection = connection;

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routers
const trackerRouter = require('./tracker');
const timetableRouter = require('./timetable');
const mapRouter = require('./map');

app.use('/tracker', trackerRouter);
app.use('/timetable', timetableRouter);
app.use('/map', mapRouter);

// 🟢 Ollama-powered Chatbot route
app.post('/chat', async(req, res) => {
    const { question } = req.body;
    console.log("Received question:", question);

    if (!question || question.trim() === '') {
        return res.status(400).json({ error: 'Question is required' });
    }

    try {
        const answer = await askMetroBot(question);
        res.json({ reply: answer });
    } catch (error) {
        console.error("Error from askMetroBot:", error);
        res.status(500).json({ reply: error.toString() });
    }
});

// Other routes
app.get('/', (req, res) => res.render('main'));
app.get('/signup', (req, res) => res.render('signup'));
app.get('/login', (req, res) => res.render('login'));
app.get('/dashboard', (req, res) => res.render('dashboard'));
app.get('/test', (req, res) => res.send('Test route works'));
app.get('/help', (req, res) => res.render('chatbot'));

// User Signup
app.post('/signup', (req, res) => {
    const { phone_number, email, password } = req.body;

    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            console.error('Error hashing password:', err);
            return res.send('Error while signing up');
        }

        const query = 'INSERT INTO users (phone_number, email, password, created_at) VALUES (?, ?, ?, NOW())';
        connection.query(query, [phone_number, email, hashedPassword], (err) => {
            if (err) {
                console.error('Error during signup:', err);
                return res.send(`Error while signing up: ${err.message}`);
            }
            res.redirect('/login');
        });
    });
});

// User Login
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    const query = 'SELECT * FROM users WHERE email = ?';
    connection.query(query, [email], (err, results) => {
        if (err) {
            console.error('Error during login:', err);
            return res.send('Error while logging in');
        }

        if (results.length === 0) {
            return res.send('Invalid email or password');
        }

        const user = results[0];

        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                console.error('Error comparing passwords:', err);
                return res.send('Error while logging in');
            }

            if (isMatch) {
                res.redirect('/dashboard');
            } else {
                res.send('Invalid email or password');
            }
        });
    });
});

// 404 Handler
app.use((req, res) => res.status(404).send('Page Not Found'));

// Start server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});