const express = require('express');
const router = express.Router();
const db = require('../database');
const { getUserId } = require('../authMiddleware');

// Register user (called after Google login)
router.post('/register', async (req, res) => {
    try {
        const userId = getUserId(req);
        const { email, name } = req.user || {};

        if (!userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // Check if user exists
        const existingUser = db.getUserById(userId);

        if (existingUser) {
            // Update last login
            db.updateUserLastLogin(userId);
            return res.json({ success: true, user: existingUser, isNew: false });
        }

        // Create new user
        db.insertUser(userId, email, name);
        const user = db.getUserById(userId);

        res.json({ success: true, user, isNew: true });
    } catch (error) {
        console.error('User registration error:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

// Get current user info
router.get('/me', (req, res) => {
    const userId = getUserId(req);

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = db.getUserById(userId);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user });
});

// Logout (just for logging purposes, actual logout is client-side)
router.post('/logout', (req, res) => {
    const userId = getUserId(req);
    console.log(`User ${userId} logged out`);
    res.json({ success: true });
});

module.exports = router;
