const { spawn } = require('child_process');
const express = require('express');
const helmet = require('helmet');
const logger = require('morgan');
const publicIp = require('public-ip');

require('dotenv').config();

const RateLimiter = require('./utils/rate-limiter');
const { blocker, punisher } = new RateLimiter({
    keyPrefix: 'speak',
    maxTokens: 50,
    seconds: 60 * 60 * 24
});

const basePath = `/${ process.env.BASE_PATH || '' }`.replace(/\/+/g, '/');
const port = process.env.PORT || 3000;
const queue = [];

let serverIp;
(async () => { serverIp = await publicIp.v4(); })();

const router = express.Router();

router.post('/speak', (req, res) => {
    if ((new Date()).getHours() < 10) {
        return res.status(503).json({
            errors: [ 'Shhhh! Right now is quiet hours. Try again after 10am MST.' ]
        });
    }
    const message = req.body.message;
    if (message.length < 1 || message.length > 100) {
        return res.status(422).json({
            errors: [ 'Message must be between 1 and 100 characters.' ]
        });
    }
    if (!/^[a-zA-Z ]+$/.test(message)) {
        return res.status(422).json({
            errors: [ 'Message can only contain letters and spaces.' ]
        });
    }
    if (req.ip !== serverIp) {
        console.log(`${ req.ip }:  ${ message }`);
    }
    queue.push(message);
    return res.status(204).json({});
});

const app = express();
app.set('trust proxy', true);

app.use(helmet());

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(logger('dev'));

app.use(blocker, punisher);
app.use(basePath, router);

app.use((req, res) => {
    return res.status(404).json({ errors: [ 'Not found.' ] });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    return res.status(500).json({ errors: [ 'Internal server error.' ] });
});

app.listen(port, () => console.log(`Server listening on ${ basePath }:${ port }...`));

let blocked = false;
setInterval(() => {
    if (!blocked) {
    const message = queue.shift();
        if (!!message) {
            blocked = true;
            const ps = spawn('sh', [
                '-c',
                `espeak "${ message }" --stdout | aplay ${ process.env.APLAY_ARGS }`
            ]);
            ps.on('exit', () => {
                blocked = false;
            });
        }
    }
}, 100);
