const AWS = require('aws-sdk');
const s3 = new AWS.S3();

// Content type mapping
const contentTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'font/otf',
    '.map': 'application/json',
    '.txt': 'text/plain',
    '.xml': 'application/xml',
    '.pdf': 'application/pdf'
};

function getContentType(filename) {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    return contentTypes[ext] || 'application/octet-stream';
}

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));

    // Health check endpoint
    if (event.path === '/health' || event.pathParameters?.proxy === 'health') {
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'ok',
                bucket: process.env.S3_BUCKET_NAME || 'NOT_SET',
                timestamp: new Date().toISOString(),
                awsRegion: process.env.AWS_REGION || 'NOT_SET'
            })
        };
    }

    try {
        // Use event.path for the full path (includes /images/, /fonts/, /ui/, etc.)
        // This handles both /{proxy+} and /images/{proxy+} routes correctly
        let path = event.path || '/';

        console.log('Original event.path:', path);
        console.log('Proxy parameter:', event.pathParameters?.proxy);

        // Remove leading slash
        if (path.startsWith('/')) {
            path = path.substring(1);
        }

        // Handle root path
        if (path === '' || path === '/') {
            path = 'index.html';
        }

        // Remove /ui/ prefix if present (for /ui/{proxy+} route)
        if (path.startsWith('ui/')) {
            path = path.substring(3);
        }

        // Handle root ui path
        if (path === 'ui' || path === '') {
            path = 'index.html';
        }

        // If no file extension and not a static asset path, serve index.html for React Router
        const isStaticAsset = path.startsWith('static/') ||
                              path.startsWith('images/') ||
                              path.startsWith('fonts/') ||
                              path.startsWith('_next/');

        if (!path.includes('.') && !isStaticAsset) {
            path = 'index.html';
        }

        console.log(`Final path to serve: ${path}`);
        console.log(`S3 Bucket: ${process.env.S3_BUCKET_NAME}`);

        // Check if bucket name is set
        if (!process.env.S3_BUCKET_NAME) {
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    error: 'S3_BUCKET_NAME environment variable not set',
                    path: path
                })
            };
        }

        const params = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: path
        };

        console.log('S3 params:', params);

        const object = await s3.getObject(params).promise();

        // Determine content type and if it's a text file
        const contentType = getContentType(path);
        const isTextFile = contentType.startsWith('text/') ||
                          contentType.includes('javascript') ||
                          contentType.includes('json') ||
                          contentType.includes('xml');

        return {
            statusCode: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': path === 'index.html' ? 'no-cache, no-store, must-revalidate' : 'public, max-age=31536000',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'GET,OPTIONS'
            },
            body: isTextFile ? object.Body.toString() : object.Body.toString('base64'),
            isBase64Encoded: !isTextFile
        };

    } catch (error) {
        console.error('S3 Error Details:', {
            code: error.code,
            message: error.message,
            statusCode: error.statusCode,
            bucket: process.env.S3_BUCKET_NAME,
            requestedPath: event.path
        });

        // For file not found, try serving index.html (SPA fallback)
        if (error.code === 'NoSuchKey') {
            try {
                const indexObject = await s3.getObject({
                    Bucket: process.env.S3_BUCKET_NAME,
                    Key: 'index.html'
                }).promise();

                return {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'text/html',
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: indexObject.Body.toString(),
                    isBase64Encoded: false
                };
            } catch (indexError) {
                console.error('Failed to serve index.html fallback:', indexError);
                return {
                    statusCode: 404,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ error: 'Not Found', path: event.path })
                };
            }
        }

        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Internal Server Error', message: error.message })
        };
    }
};
