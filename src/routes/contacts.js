const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const db = require('../database');
const whatsapp = require('../whatsapp');

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Get all contacts
router.get('/', (req, res) => {
    try {
        const contacts = db.getAllContacts();
        res.json({ success: true, contacts });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Add single contact
router.post('/', (req, res) => {
    try {
        const { phone, name, groupName } = req.body;

        if (!phone) {
            return res.status(400).json({ success: false, error: 'Phone number is required' });
        }

        // Clean phone number
        const cleanPhone = phone.replace(/\D/g, '');

        const result = db.insertContact(cleanPhone, name || cleanPhone, groupName);
        res.json({
            success: true,
            id: result.lastInsertRowid,
            message: 'Contact added successfully'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Import contacts from CSV/TXT
router.post('/import', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const content = req.file.buffer.toString('utf-8');
        const filename = req.file.originalname.toLowerCase();
        let contacts = [];

        if (filename.endsWith('.csv')) {
            // Parse CSV
            const records = parse(content, {
                columns: true,
                skip_empty_lines: true,
                trim: true
            });

            contacts = records.map(record => {
                // Try different column names
                const phone = record.phone || record.telefone || record.numero || record.Phone || record.Telefone || record.Numero || Object.values(record)[0];
                const name = record.name || record.nome || record.Name || record.Nome || Object.values(record)[1] || phone;

                return {
                    phone: String(phone).replace(/\D/g, ''),
                    name: String(name).trim()
                };
            });
        } else {
            // Parse TXT (one phone per line, or phone,name format)
            const lines = content.split('\n').filter(line => line.trim());

            contacts = lines.map(line => {
                const parts = line.split(/[,;\t]/).map(p => p.trim());
                const phone = parts[0].replace(/\D/g, '');
                const name = parts[1] || phone;

                return { phone, name };
            });
        }

        // Filter valid contacts
        contacts = contacts.filter(c => c.phone && c.phone.length >= 8);

        if (contacts.length === 0) {
            return res.status(400).json({ success: false, error: 'No valid contacts found in file' });
        }

        // Insert contacts
        db.insertManyContacts(contacts);

        res.json({
            success: true,
            imported: contacts.length,
            message: `${contacts.length} contacts imported successfully`
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Import contacts from WhatsApp group
router.post('/import-group', async (req, res) => {
    try {
        const { groupId, groupName } = req.body;

        if (!groupId) {
            return res.status(400).json({ success: false, error: 'Group ID is required' });
        }

        const participants = await whatsapp.getGroupParticipants(groupId);

        const contacts = participants.map(p => ({
            phone: p.phone,
            name: p.name,
            groupName: groupName || 'WhatsApp Group'
        }));

        db.insertManyContacts(contacts);

        res.json({
            success: true,
            imported: contacts.length,
            message: `${contacts.length} contacts imported from group`
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get WhatsApp groups
router.get('/groups', async (req, res) => {
    try {
        const groups = await whatsapp.getGroups();
        res.json({ success: true, groups });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Delete contact
router.delete('/:id', (req, res) => {
    try {
        db.deleteContact(req.params.id);
        res.json({ success: true, message: 'Contact deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Clear all contacts
router.delete('/', (req, res) => {
    try {
        db.clearContacts();
        res.json({ success: true, message: 'All contacts deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
