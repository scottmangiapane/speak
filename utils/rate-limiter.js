const { redisProxy } = require('./redis');

module.exports = class RateLimiter {
    constructor(params) {
        this.keyPrefix = params.keyPrefix || 'rl';
        this.maxTokens = params.maxTokens || 60;
        this.seconds = params.seconds || 60;
        this.blocker = this.blocker.bind(this);
        this.punisher = this.punisher.bind(this);
    };

    async _currentValue(key) {
        const value = JSON.parse(await redisProxy.get(key));
        if (value) {
            const elapsedTime = Date.now() - value.ts;
            const newTokens = this.maxTokens * elapsedTime / (this.seconds * 1000);
            value.tokens = Math.min(value.tokens + newTokens, this.maxTokens);
            value.tokens = Math.max(value.tokens, 0);
            value.ts = Date.now();
            return value;
        }
        return { tokens: this.maxTokens, ts: Date.now() };
    };

    _key(ip) {
        return (this.keyPrefix) ? `${ this.keyPrefix }:${ ip }` : ip;
    }

    async blocker(req, res, next) {
        const key = this._key(req.ip);
        const value = await this._currentValue(key);
        if (value.tokens === 0) {
            return res.status(429).json({ errors: [ 'Too many requests. Try again later.' ] });
        }
        next();
    };

    async punisher(req, res, next) {
        const key = this._key(req.ip);
        const value = await this._currentValue(key);
        value.tokens--;
        await redisProxy.setex(key, this.seconds, JSON.stringify(value));
        next();
    };
};
