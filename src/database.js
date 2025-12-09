const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

// Database wrapper for sql.js (async SQLite in JavaScript)
class Database {
    constructor() {
        this.db = null;
        this.dbPath = path.join(__dirname, '..', 'data', 'database.sqlite');
        this.ready = false;
    }

    async init() {
        // Ensure data directory exists
        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // Initialize SQL.js
        const SQL = await initSqlJs();

        // Try to load existing database
        if (fs.existsSync(this.dbPath)) {
            const buffer = fs.readFileSync(this.dbPath);
            this.db = new SQL.Database(buffer);
        } else {
            this.db = new SQL.Database();
        }

        // Create tables
        this.db.run(`
            CREATE TABLE IF NOT EXISTS contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT NOT NULL UNIQUE,
                name TEXT,
                group_name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS campaigns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                template_id INTEGER,
                status TEXT DEFAULT 'pending',
                delay_seconds INTEGER DEFAULT 5,
                variation_level TEXT DEFAULT 'none',
                total_contacts INTEGER DEFAULT 0,
                sent_count INTEGER DEFAULT 0,
                failed_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                started_at DATETIME,
                completed_at DATETIME
            );

            CREATE TABLE IF NOT EXISTS message_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER,
                contact_id INTEGER,
                message_content TEXT,
                status TEXT DEFAULT 'pending',
                error_message TEXT,
                sent_at DATETIME
            );

            CREATE TABLE IF NOT EXISTS variations_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                original_text TEXT NOT NULL,
                variation_level TEXT NOT NULL,
                variations TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        this.save();
        this.ready = true;
        console.log('Database initialized successfully');
    }

    save() {
        if (this.db) {
            const data = this.db.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(this.dbPath, buffer);
        }
    }

    // Helper to run queries and save - returns lastInsertRowid for inserts
    run(sql, params = []) {
        this.db.run(sql, params);
        this.save();

        // Store last insert id after each insert
        if (sql.trim().toUpperCase().startsWith('INSERT')) {
            try {
                const result = this.db.exec("SELECT last_insert_rowid()");
                if (result && result.length > 0 && result[0].values && result[0].values.length > 0) {
                    this._lastId = result[0].values[0][0];
                }
            } catch (e) {
                console.log('Could not get last insert id:', e.message);
            }
        }
    }

    // Helper to get all results
    all(sql, params = []) {
        const stmt = this.db.prepare(sql);
        if (params.length) stmt.bind(params);

        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    }

    // Helper to get one result
    get(sql, params = []) {
        const results = this.all(sql, params);
        return results[0] || null;
    }

    // Get last insert ID
    lastInsertRowid() {
        // First try the cached value
        if (this._lastId) {
            console.log('lastInsertRowid (cached):', this._lastId);
            return this._lastId;
        }

        // Try to get from database
        try {
            const result = this.db.exec("SELECT last_insert_rowid()");
            if (result && result.length > 0 && result[0].values && result[0].values.length > 0) {
                const id = result[0].values[0][0];
                console.log('lastInsertRowid (query):', id);
                return id;
            }
        } catch (err) {
            console.error('lastInsertRowid error:', err.message);
        }

        console.log('lastInsertRowid: falling back to count');
        return null;
    }

    // Contacts
    getAllContacts() {
        return this.all('SELECT * FROM contacts ORDER BY name');
    }

    getContactById(id) {
        return this.get('SELECT * FROM contacts WHERE id = ?', [id]);
    }

    getContactByPhone(phone) {
        return this.get('SELECT * FROM contacts WHERE phone = ?', [phone]);
    }

    insertContact(phone, name, groupName = null) {
        this.run('INSERT OR REPLACE INTO contacts (phone, name, group_name) VALUES (?, ?, ?)',
            [phone, name, groupName]);
        return { lastInsertRowid: this.lastInsertRowid() };
    }

    insertManyContacts(contacts) {
        for (const contact of contacts) {
            this.run('INSERT OR REPLACE INTO contacts (phone, name, group_name) VALUES (?, ?, ?)',
                [contact.phone, contact.name, contact.groupName || null]);
        }
    }

    deleteContact(id) {
        this.run('DELETE FROM contacts WHERE id = ?', [id]);
    }

    clearContacts() {
        this.run('DELETE FROM contacts');
    }

    // Templates
    getAllTemplates() {
        return this.all('SELECT * FROM templates ORDER BY created_at DESC');
    }

    getTemplateById(id) {
        return this.get('SELECT * FROM templates WHERE id = ?', [id]);
    }

    insertTemplate(name, content) {
        this.run('INSERT INTO templates (name, content) VALUES (?, ?)', [name, content]);
        const result = this.get('SELECT MAX(id) as id FROM templates');
        const id = result?.id || 1;
        console.log('insertTemplate - new ID:', id);
        return { lastInsertRowid: id };
    }

    updateTemplate(id, name, content) {
        this.run('UPDATE templates SET name = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [name, content, id]);
    }

    deleteTemplate(id) {
        this.run('DELETE FROM templates WHERE id = ?', [id]);
    }

    // Campaigns
    getAllCampaigns() {
        return this.all('SELECT * FROM campaigns ORDER BY created_at DESC');
    }

    getCampaignById(id) {
        return this.get('SELECT * FROM campaigns WHERE id = ?', [id]);
    }

    insertCampaign(name, templateId, delaySeconds, variationLevel, totalContacts) {
        this.run(`
            INSERT INTO campaigns (name, template_id, delay_seconds, variation_level, total_contacts)
            VALUES (?, ?, ?, ?, ?)
        `, [name, templateId, delaySeconds, variationLevel, totalContacts]);
        const result = this.get('SELECT MAX(id) as id FROM campaigns');
        const id = result?.id || 1;
        console.log('insertCampaign - new ID:', id);
        return { lastInsertRowid: id };
    }

    updateCampaignStatus(id, status, sentCount = null, failedCount = null) {
        console.log(`Updating campaign ${id}: status=${status}, sent=${sentCount}, failed=${failedCount}`);

        let sql = 'UPDATE campaigns SET status = ?';
        const params = [status];

        if (sentCount !== null) {
            sql += ', sent_count = ?';
            params.push(sentCount);
        }
        if (failedCount !== null) {
            sql += ', failed_count = ?';
            params.push(failedCount);
        }
        if (status === 'running') {
            sql += ', started_at = CURRENT_TIMESTAMP';
        }
        if (status === 'completed' || status === 'failed' || status === 'stopped') {
            sql += ', completed_at = CURRENT_TIMESTAMP';
        }

        sql += ' WHERE id = ?';
        params.push(id);

        console.log('SQL:', sql, 'Params:', params);
        this.run(sql, params);
    }

    // Message logs
    getLogsByCampaign(campaignId) {
        return this.all(`
            SELECT ml.*, c.name as contact_name, c.phone as contact_phone
            FROM message_logs ml
            LEFT JOIN contacts c ON ml.contact_id = c.id
            WHERE ml.campaign_id = ?
            ORDER BY ml.sent_at DESC
        `, [campaignId]);
    }

    insertMessageLog(campaignId, contactId, messageContent) {
        this.run(`
            INSERT INTO message_logs (campaign_id, contact_id, message_content)
            VALUES (?, ?, ?)
        `, [campaignId, contactId, messageContent]);
        const result = this.get('SELECT MAX(id) as id FROM message_logs');
        return { lastInsertRowid: result?.id || 1 };
    }

    updateMessageLog(id, status, errorMessage = null) {
        this.run(`
            UPDATE message_logs
            SET status = ?, error_message = ?, sent_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [status, errorMessage, id]);
    }

    // Variations cache
    getCachedVariations(originalText, variationLevel) {
        return this.get(`
            SELECT variations FROM variations_cache
            WHERE original_text = ? AND variation_level = ?
        `, [originalText, variationLevel]);
    }

    cacheVariations(originalText, variationLevel, variations) {
        this.run(`
            INSERT INTO variations_cache (original_text, variation_level, variations)
            VALUES (?, ?, ?)
        `, [originalText, variationLevel, JSON.stringify(variations)]);
    }

    // Stats
    getStats() {
        const totalContacts = this.get('SELECT COUNT(*) as count FROM contacts')?.count || 0;
        const totalCampaigns = this.get('SELECT COUNT(*) as count FROM campaigns')?.count || 0;
        const sentResult = this.get('SELECT SUM(sent_count) as count FROM campaigns');
        const failedResult = this.get('SELECT SUM(failed_count) as count FROM campaigns');

        return {
            totalContacts,
            totalCampaigns,
            totalSent: sentResult?.count || 0,
            totalFailed: failedResult?.count || 0
        };
    }
}

// Export singleton
const db = new Database();
module.exports = db;
