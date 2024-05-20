require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const routes = require('./routes');

const app = express();
const port = process.env.PORT || 5000;

app.get('/api', (req, res) => {
    res.json("Base page Reached");
});

// middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use('/api', routes);

// Database connection
mongoose.connect(process.env.DB_URI, {}).then(() => {console.log(`connected to the database ${process.env.DB_URI.split('/').at(-1)}!`);})
.catch((err) => console.error(err));

app.listen(port, () => {console.log(`Server listening at PORT ${port}`);} );


module.exports = express;

