require('dotenv').config();
require('express-async-errors');
const { check, validationResult } = require('express-validator');

const express = require('express');
const helmet = require('helmet');
const logger = require('morgan');

const RateLimiter = require('./utils/rate-limiter');
const { blocker, punisher } = new RateLimiter({
    prefix: 'rl_espeak',
    maxTokens: 10,
    seconds: 60 * 60 * 24
});

const basePath = `/${ process.env.BASE_PATH || '' }`.replace(/\/+/g, '/');
const port = process.env.PORT || 3000;

const app = express();
const router = express.Router();

app.use(helmet());

app.set('trust proxy', true);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(logger('dev'));

router.use(blocker, punisher);

router.post('/speak', [
    check('message', 'Message must be between 1 and 40 characters').isLength({ min: 1, max: 40 }),
], (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    return next();
}, (req, res) => {
    return res.json({ status: 'sucess' });
});

app.use(basePath, router);

app.use((req, res) => {
    return res.status(404).json({ errors: [{ msg: 'Not found' }] });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    return res.status(500).json({ errors: [{ msg: 'Internal server error' }] });
});

app.listen(port, () => console.log(`Server listening on ${ basePath }:${ port }...`));