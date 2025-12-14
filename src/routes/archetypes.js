/**
 * Archetypes API Routes
 * 
 * CRUD operations for agent archetypes (admin only)
 * These endpoints are used to manage the brain library
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const { getUserId } = require('../authMiddleware');

// Get all archetypes
router.get('/', (req, res) => {
    try {
        const archetypes = db.getAllArchetypes(true);
        res.json({ success: true, archetypes });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get all archetypes (including inactive - admin)
router.get('/all', (req, res) => {
    try {
        const archetypes = db.getAllArchetypes(false);
        res.json({ success: true, archetypes });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get archetype by ID
router.get('/:id', (req, res) => {
    try {
        const archetype = db.getArchetypeById(parseInt(req.params.id));
        if (!archetype) {
            return res.status(404).json({ success: false, error: 'Archetype not found' });
        }
        res.json({ success: true, archetype });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Create new archetype
router.post('/', (req, res) => {
    try {
        const { key, niche, subniche, tone, objective, system_prompt, policy } = req.body;

        if (!key || !niche || !tone || !system_prompt) {
            return res.status(400).json({
                success: false,
                error: 'Required fields: key, niche, tone, system_prompt'
            });
        }

        const archetype = db.createArchetype({
            key,
            niche,
            subniche,
            tone,
            objective,
            system_prompt,
            policy: policy || {}
        });

        res.json({ success: true, archetype, message: 'Archetype created!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update archetype
router.put('/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = db.getArchetypeById(id);

        if (!existing) {
            return res.status(404).json({ success: false, error: 'Archetype not found' });
        }

        const archetype = db.updateArchetype(id, req.body);
        res.json({ success: true, archetype, message: 'Archetype updated!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Delete (soft) archetype
router.delete('/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        db.deleteArchetype(id);
        res.json({ success: true, message: 'Archetype deactivated' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Clone archetype
router.post('/:id/clone', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = db.getArchetypeById(id);

        if (!existing) {
            return res.status(404).json({ success: false, error: 'Archetype not found' });
        }

        const newKey = `${existing.key}_copy_${Date.now()}`;
        const archetype = db.createArchetype({
            ...existing,
            key: newKey,
            id: undefined
        });

        res.json({ success: true, archetype, message: 'Archetype cloned!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get archetypes by niche
router.get('/niche/:niche', (req, res) => {
    try {
        const allArchetypes = db.getAllArchetypes(true);
        const filtered = allArchetypes.filter(a =>
            a.niche.toLowerCase() === req.params.niche.toLowerCase()
        );
        res.json({ success: true, archetypes: filtered });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
