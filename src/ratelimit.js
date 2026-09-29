const buckets = new Map();

function allow(key, max, windowMs) {
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
        bucket = { count: 0, resetAt: now + windowMs };
        buckets.set(key, bucket);
    }
    bucket.count++;
    return bucket.count <= max;
}

const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
        if (now > bucket.resetAt) buckets.delete(key);
    }
}, 60000);
if (sweeper.unref) sweeper.unref();

module.exports = { allow };
