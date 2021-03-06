require('dotenv').config();
require('express-async-errors');

const { spawn } = require('child_process');
const express = require('express');
const helmet = require('helmet');
const logger = require('morgan');
const publicIp = require('public-ip');

const RateLimiter = require('./utils/rate-limiter');
const { blocker, punisher } = new RateLimiter({
	keyPrefix: 'speak',
	maxTokens: 50,
	seconds: 60 * 60 * 24
});

const basePath = `/${ process.env.BASE_PATH || '' }`.replace(/\/+/g, '/');
const port = process.env.PORT || 3000;
const queue = [];

const addresses = [];
(async () => {
	const ipv4 = await publicIp.v4();
	const ipv6 = await publicIp.v6();
	if (!!ipv4) {
		addresses.push(ipv4);
	}
	if (!!ipv6) {
		addresses.push(ipv6);
	}
})();
const isExternal = (req) => addresses.includes(req.ip);

const app = express();
app.set('trust proxy', true);

app.use(helmet());

app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(logger('dev'));

app.use(blocker, punisher);

app.post('/api', (req, res) => {
	const message = req.body.message;
	if (!message || message.length < 1 || message.length > 100) {
		return res.status(422).json({
			errors: [ 'Message must be between 1 and 100 characters.' ]
		});
	}
	if (!/^[a-zA-Z ]+$/.test(message)) {
		return res.status(422).json({
			errors: [ 'Message can only contain letters and spaces.' ]
		});
	}
	if (isExternal(req)) {
		if ((new Date()).getHours() < 10) {
			return res.status(503).json({
				errors: [ 'Shhhh! Right now is quiet hours. Try again after 10am MST.' ]
			});
		}
		console.log(`${ (new Date()).toTimeString() } | ${ req.ip } | ${ message }`);
	}
	queue.push(message);
	return res.status(204).json({});
});

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
				`pico2wave -w ./stdout.wav "${ message }" | aplay ${ process.env.APLAY_ARGS }`
			]);
			ps.on('exit', () => {
				blocked = false;
			});
		}
	}
}, 100);
