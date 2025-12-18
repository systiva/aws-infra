/**
 * Sys App Backend Lambda Handler (Placeholder)
 *
 * This is a placeholder Lambda handler for the Sys App Backend.
 * The actual code will be deployed from: https://github.com/tripleh1701-dev/ppp-be
 *
 * Build and deploy using:
 *   ./cicd.sh build --service=sys-app-be
 *   ./cicd.sh deploy --service=sys-app-be --workspace=<workspace>
 */

exports.handler = async (event, context) => {
    console.log('Sys App Backend Lambda invoked');
    console.log('Event:', JSON.stringify(event, null, 2));

    // Extract request details
    const httpMethod =
        event.httpMethod || event.requestContext?.http?.method || 'GET';
    const path = event.path || event.requestContext?.http?.path || '/';

    // CORS headers
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
            'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Tenant-Id',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    };

    // Handle OPTIONS (CORS preflight)
    if (httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: '',
        };
    }

    // Placeholder response
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            message: 'Sys App Backend - Placeholder',
            note: 'Deploy the actual code using: ./cicd.sh build --service=sys-app-be && ./cicd.sh deploy --service=sys-app-be',
            source: 'https://github.com/tripleh1701-dev/ppp-be',
            request: {
                method: httpMethod,
                path: path,
            },
            timestamp: new Date().toISOString(),
        }),
    };
};
