/**
 * Archetypes API Routes
 * 
 * CRUD operations for agent archetypes (admin only)
 * All archetypes MUST inherit from BASE_ARCHETYPE_TEMPLATE
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const { getUserId } = require('../authMiddleware');
const ArchetypeValidator = require('../archetype-validator');

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

// Get publish checklist
router.get('/publish-checklist', (req, res) => {
    res.json({ success: true, checklist: ArchetypeValidator.getPublishChecklist() });
});

// Get base template info
router.get('/base-template', (req, res) => {
    try {
        const baseTemplate = require('../BASE_ARCHETYPE_TEMPLATE.json');
        res.json({
            success: true,
            template: {
                version: baseTemplate._version,
                immutableFields: Object.keys(baseTemplate.IMMUTABLE_FIELDS.policy),
                editableFields: Object.keys(baseTemplate.EDITABLE_FIELDS),
                nicheExclusions: baseTemplate.NICHE_EXCLUSIONS
            }
        });
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

// Create new archetype (WITH validation)
router.post('/', (req, res) => {
    try {
        const data = req.body;

        // Validate required fields
        const validation = ArchetypeValidator.validate(data);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: 'Validação falhou',
                errors: validation.errors
            });
        }

        // Merge with base template (applies immutable safety fields)
        const mergedArchetype = ArchetypeValidator.mergeWithBase(data);

        // Create in database
        const archetype = db.createArchetype(mergedArchetype);

        res.json({
            success: true,
            archetype,
            message: 'Cérebro criado com regras de segurança aplicadas!'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update archetype (WITH validation - keeps immutable fields)
router.put('/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = db.getArchetypeById(id);

        if (!existing) {
            return res.status(404).json({ success: false, error: 'Archetype not found' });
        }

        // Merge update data with existing
        const updateData = {
            ...existing,
            ...req.body,
            id: undefined // Remove id from merge
        };

        // Re-validate
        const validation = ArchetypeValidator.validate(updateData);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: 'Validação falhou',
                errors: validation.errors
            });
        }

        // Re-apply immutable fields
        const mergedArchetype = ArchetypeValidator.mergeWithBase(updateData);

        const archetype = db.updateArchetype(id, mergedArchetype);
        res.json({
            success: true,
            archetype,
            message: 'Cérebro atualizado com regras de segurança mantidas!'
        });
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

// Clone archetype (inherits safety fields)
router.post('/:id/clone', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = db.getArchetypeById(id);

        if (!existing) {
            return res.status(404).json({ success: false, error: 'Archetype not found' });
        }

        const newKey = `${existing.key}_copy_${Date.now()}`;

        // Clone and re-apply base template
        const cloneData = {
            ...existing,
            key: newKey,
            id: undefined,
            persona_name: `${existing.persona_name} (Cópia)`
        };

        const mergedClone = ArchetypeValidator.mergeWithBase(cloneData);
        const archetype = db.createArchetype(mergedClone);

        res.json({ success: true, archetype, message: 'Cérebro clonado!' });
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

// Validate archetype without saving
router.post('/validate', (req, res) => {
    const validation = ArchetypeValidator.validate(req.body);
    res.json({
        success: validation.valid,
        valid: validation.valid,
        errors: validation.errors
    });
});

module.exports = router;

