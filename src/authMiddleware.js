const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// For production, use environment variable GOOGLE_APPLICATION_CREDENTIALS
// Or set the service account directly
let firebaseInitialized = false;

function initializeFirebase() {
    if (firebaseInitialized) return;

    try {
        // Try to initialize with default credentials (for local development)
        // In production, set GOOGLE_APPLICATION_CREDENTIALS environment variable
        // pointing to your service account JSON file

        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            // Parse service account from environment variable
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            // Use default credentials from file
            admin.initializeApp({
                credential: admin.credential.applicationDefault()
            });
        } else {
            // Development mode - initialize without credentials
            // Token validation will be skipped in development
            console.warn('Firebase credentials not configured. Running in development mode.');
            admin.initializeApp({
                projectId: 'development-mode'
            });
        }

        firebaseInitialized = true;
        console.log('Firebase Admin SDK initialized');
    } catch (error) {
        console.error('Firebase initialization error:', error.message);
    }
}

// Auth middleware
async function authMiddleware(req, res, next) {
    // Skip auth for certain routes
    const publicRoutes = ['/api/auth/register', '/login.html', '/css/', '/js/'];
    if (publicRoutes.some(route => req.path.includes(route))) {
        return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // Check if it's an API request
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({ error: 'No authentication token provided' });
        }
        // For page requests, redirect to login
        return next();
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        // In development mode without credentials, accept any token
        if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            // Development mode - extract user info from token without validation
            // This is for local testing only
            const tokenParts = token.split('.');
            if (tokenParts.length === 3) {
                try {
                    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
                    req.user = {
                        uid: payload.user_id || payload.sub || 'dev-user',
                        email: payload.email || 'dev@example.com',
                        name: payload.name || 'Development User'
                    };
                    return next();
                } catch (e) {
                    // Invalid token format
                }
            }

            // Fallback for development
            req.user = {
                uid: 'dev-user-123',
                email: 'dev@example.com',
                name: 'Development User'
            };
            return next();
        }

        // Production mode - verify token with Firebase
        initializeFirebase();
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name || decodedToken.email
        };
        next();
    } catch (error) {
        console.error('Auth error:', error.message);

        if (req.path.startsWith('/api/')) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        next();
    }
}

// Get user ID from request
function getUserId(req) {
    return req.user?.uid || null;
}

// Admin emails list - emails with admin access
const ADMIN_EMAILS = [
    'alec.almeida201@gmail.com',
];

// Check if user is admin
function isAdmin(req) {
    const email = req.user?.email;
    if (!email) return false;
    return ADMIN_EMAILS.includes(email.toLowerCase());
}

// Require admin middleware
function requireAdmin(req, res, next) {
    if (!isAdmin(req)) {
        return res.status(403).json({
            success: false,
            error: 'Acesso negado',
            message: 'Apenas administradores podem acessar esta área.'
        });
    }
    next();
}

module.exports = { authMiddleware, getUserId, initializeFirebase, isAdmin, requireAdmin };

