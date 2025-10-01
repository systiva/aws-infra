const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const getContentType = require('./utils/contentTypes');

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    // Health check endpoint
    if (event.pathParameters?.proxy === 'health') {
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
        let path = event.pathParameters?.proxy || 'index.html';
        
        console.log('Original path:', path);
        
        // Handle root path
        if (path === '' || path === '/') {
            path = 'index.html';
        }
        
        // Remove leading slash if present
        if (path.startsWith('/')) {
            path = path.substring(1);
        }
        
        // If no file extension and not a static asset, serve index.html for React Router
        if (!path.includes('.') && !path.startsWith('static/')) {
            path = 'index.html';
        }
        
        console.log(`Final path to serve: ${path}`);
        console.log(`S3 Bucket: ${process.env.S3_BUCKET_NAME}`);

        // Check if bucket name is set
        if (!process.env.S3_BUCKET_NAME) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
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

        // For text files (HTML, CSS, JS), return as string
        const contentType = getContentType(path);
        const isTextFile = contentType.startsWith('text/') || 
                          contentType.includes('javascript') || 
                          contentType.includes('json');

        return {
            statusCode: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': path === 'index.html' ? 'no-cache' : 'max-age=86400'
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
            requestedPath: path
        });
        
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
                        'Cache-Control': 'no-cache'
                    },
                    body: indexObject.Body.toString(),
                    isBase64Encoded: false
                };
            } catch (indexError) {
                return { statusCode: 404, body: 'Not Found' };
            }
        }
        
        console.error('Error:', error);
        return { statusCode: 500, body: 'Internal Server Error' };
    }
};