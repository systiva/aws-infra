const contentTypes = {
    html: 'text/html',
    js: 'application/javascript',
    css: 'text/css',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
};

function getContentType(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    return contentTypes[ext] || 'application/octet-stream';
}

module.exports = getContentType;