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
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT,
                name TEXT,
                photo_url TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                phone TEXT NOT NULL,
                name TEXT,
                group_name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, phone)
            );

            CREATE TABLE IF NOT EXISTS templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                name TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS campaigns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
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
                user_id TEXT,
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

            CREATE TABLE IF NOT EXISTS subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                email TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                kirvano_transaction_id TEXT,
                plan_name TEXT DEFAULT 'monthly',
                starts_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id)
            );

            CREATE TABLE IF NOT EXISTS daily_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                usage_date TEXT NOT NULL,
                messages_sent INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, usage_date)
            );
        `);

        // Run migrations for existing databases
        this.runMigrations();

        this.save();
        this.ready = true;
        console.log('Database initialized successfully');
    }

    // Migration to add user_id columns to existing tables
    runMigrations() {
        console.log('Running database migrations...');

        // Check if user_id column exists in contacts
        try {
            const result = this.db.exec("PRAGMA table_info(contacts)");
            if (result.length > 0) {
                const columns = result[0].values.map(row => row[1]);

                if (!columns.includes('user_id')) {
                    console.log('Adding user_id column to contacts...');
                    this.db.run("ALTER TABLE contacts ADD COLUMN user_id TEXT");
                }
            }
        } catch (e) {
            console.log('Migration contacts:', e.message);
        }

        // Check if user_id column exists in templates
        try {
            const result = this.db.exec("PRAGMA table_info(templates)");
            if (result.length > 0) {
                const columns = result[0].values.map(row => row[1]);

                if (!columns.includes('user_id')) {
                    console.log('Adding user_id column to templates...');
                    this.db.run("ALTER TABLE templates ADD COLUMN user_id TEXT");
                }
            }
        } catch (e) {
            console.log('Migration templates:', e.message);
        }

        // Check if user_id column exists in campaigns
        try {
            const result = this.db.exec("PRAGMA table_info(campaigns)");
            if (result.length > 0) {
                const columns = result[0].values.map(row => row[1]);

                if (!columns.includes('user_id')) {
                    console.log('Adding user_id column to campaigns...');
                    this.db.run("ALTER TABLE campaigns ADD COLUMN user_id TEXT");
                }
            }
        } catch (e) {
            console.log('Migration campaigns:', e.message);
        }

        // Check if user_id column exists in message_logs
        try {
            const result = this.db.exec("PRAGMA table_info(message_logs)");
            if (result.length > 0) {
                const columns = result[0].values.map(row => row[1]);

                if (!columns.includes('user_id')) {
                    console.log('Adding user_id column to message_logs...');
                    this.db.run("ALTER TABLE message_logs ADD COLUMN user_id TEXT");
                }
            }
        } catch (e) {
            console.log('Migration message_logs:', e.message);
        }

        console.log('Database migrations completed');
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

    // Users
    getUserById(userId) {
        return this.get('SELECT * FROM users WHERE id = ?', [userId]);
    }

    insertUser(userId, email, name, photoUrl = null) {
        this.run('INSERT OR REPLACE INTO users (id, email, name, photo_url) VALUES (?, ?, ?, ?)',
            [userId, email, name, photoUrl]);
    }

    updateUserLastLogin(userId) {
        this.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
    }

    // Contacts
    getAllContacts(userId = null) {
        if (userId) {
            return this.all('SELECT * FROM contacts WHERE user_id = ? ORDER BY name', [userId]);
        }
        return this.all('SELECT * FROM contacts ORDER BY name');
    }

    getContactById(id, userId = null) {
        if (userId) {
            return this.get('SELECT * FROM contacts WHERE id = ? AND user_id = ?', [id, userId]);
        }
        return this.get('SELECT * FROM contacts WHERE id = ?', [id]);
    }

    getContactByPhone(phone, userId = null) {
        if (userId) {
            return this.get('SELECT * FROM contacts WHERE phone = ? AND user_id = ?', [phone, userId]);
        }
        return this.get('SELECT * FROM contacts WHERE phone = ?', [phone]);
    }

    insertContact(phone, name, groupName = null, userId = null) {
        this.run('INSERT OR REPLACE INTO contacts (user_id, phone, name, group_name) VALUES (?, ?, ?, ?)',
            [userId, phone, name, groupName]);
        return { lastInsertRowid: this.lastInsertRowid() };
    }

    insertManyContacts(contacts, userId = null) {
        for (const contact of contacts) {
            this.run('INSERT OR REPLACE INTO contacts (user_id, phone, name, group_name) VALUES (?, ?, ?, ?)',
                [userId, contact.phone, contact.name, contact.groupName || null]);
        }
    }

    deleteContact(id, userId = null) {
        if (userId) {
            this.run('DELETE FROM contacts WHERE id = ? AND user_id = ?', [id, userId]);
        } else {
            this.run('DELETE FROM contacts WHERE id = ?', [id]);
        }
    }

    clearContacts(userId = null) {
        if (userId) {
            this.run('DELETE FROM contacts WHERE user_id = ?', [userId]);
        } else {
            this.run('DELETE FROM contacts');
        }
    }

    // Templates
    getAllTemplates(userId = null) {
        if (userId) {
            return this.all('SELECT * FROM templates WHERE user_id = ? ORDER BY created_at DESC', [userId]);
        }
        return this.all('SELECT * FROM templates ORDER BY created_at DESC');
    }

    getTemplateById(id, userId = null) {
        if (userId) {
            return this.get('SELECT * FROM templates WHERE id = ? AND user_id = ?', [id, userId]);
        }
        return this.get('SELECT * FROM templates WHERE id = ?', [id]);
    }

    insertTemplate(name, content, userId = null) {
        this.run('INSERT INTO templates (user_id, name, content) VALUES (?, ?, ?)', [userId, name, content]);
        const result = this.get('SELECT MAX(id) as id FROM templates WHERE user_id = ?', [userId]);
        const id = result?.id || 1;
        console.log('insertTemplate - new ID:', id);
        return { lastInsertRowid: id };
    }

    updateTemplate(id, name, content, userId = null) {
        if (userId) {
            this.run('UPDATE templates SET name = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
                [name, content, id, userId]);
        } else {
            this.run('UPDATE templates SET name = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [name, content, id]);
        }
    }

    deleteTemplate(id, userId = null) {
        if (userId) {
            this.run('DELETE FROM templates WHERE id = ? AND user_id = ?', [id, userId]);
        } else {
            this.run('DELETE FROM templates WHERE id = ?', [id]);
        }
    }

    // Campaigns
    getAllCampaigns(userId = null) {
        if (userId) {
            return this.all('SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC', [userId]);
        }
        return this.all('SELECT * FROM campaigns ORDER BY created_at DESC');
    }

    getCampaignById(id, userId = null) {
        if (userId) {
            return this.get('SELECT * FROM campaigns WHERE id = ? AND user_id = ?', [id, userId]);
        }
        return this.get('SELECT * FROM campaigns WHERE id = ?', [id]);
    }

    insertCampaign(name, templateId, delaySeconds, variationLevel, totalContacts, userId = null) {
        this.run(`
            INSERT INTO campaigns (user_id, name, template_id, delay_seconds, variation_level, total_contacts)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [userId, name, templateId, delaySeconds, variationLevel, totalContacts]);
        const result = this.get('SELECT MAX(id) as id FROM campaigns WHERE user_id = ?', [userId]);
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
    getStats(userId = null) {
        let totalContacts, totalCampaigns, sentResult, failedResult;

        if (userId) {
            totalContacts = this.get('SELECT COUNT(*) as count FROM contacts WHERE user_id = ?', [userId])?.count || 0;
            totalCampaigns = this.get('SELECT COUNT(*) as count FROM campaigns WHERE user_id = ?', [userId])?.count || 0;
            sentResult = this.get('SELECT SUM(sent_count) as count FROM campaigns WHERE user_id = ?', [userId]);
            failedResult = this.get('SELECT SUM(failed_count) as count FROM campaigns WHERE user_id = ?', [userId]);
        } else {
            totalContacts = this.get('SELECT COUNT(*) as count FROM contacts')?.count || 0;
            totalCampaigns = this.get('SELECT COUNT(*) as count FROM campaigns')?.count || 0;
            sentResult = this.get('SELECT SUM(sent_count) as count FROM campaigns');
            failedResult = this.get('SELECT SUM(failed_count) as count FROM campaigns');
        }

        return {
            totalContacts,
            totalCampaigns,
            totalSent: sentResult?.count || 0,
            totalFailed: failedResult?.count || 0
        };
    }

    // Subscriptions
    getSubscription(userId) {
        return this.get('SELECT * FROM subscriptions WHERE user_id = ?', [userId]);
    }

    getSubscriptionByEmail(email) {
        return this.get('SELECT * FROM subscriptions WHERE email = ?', [email]);
    }

    activateSubscription(userId, email, transactionId, daysToAdd = 30) {
        const existingSub = this.getSubscription(userId);
        const now = new Date();
        let expiresAt;

        if (existingSub && existingSub.status === 'active' && new Date(existingSub.expires_at) > now) {
            // Extend existing subscription
            expiresAt = new Date(existingSub.expires_at);
            expiresAt.setDate(expiresAt.getDate() + daysToAdd);
        } else {
            // New subscription
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + daysToAdd);
        }

        this.run(`
            INSERT INTO subscriptions (user_id, email, status, kirvano_transaction_id, expires_at, updated_at)
            VALUES (?, ?, 'active', ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                status = 'active',
                kirvano_transaction_id = ?,
                expires_at = ?,
                updated_at = CURRENT_TIMESTAMP
        `, [userId, email, transactionId, expiresAt.toISOString(), transactionId, expiresAt.toISOString()]);

        return this.getSubscription(userId);
    }

    activateSubscriptionByEmail(email, transactionId, daysToAdd = 30) {
        // Find user by email first
        const user = this.get('SELECT id FROM users WHERE email = ?', [email]);
        if (user) {
            return this.activateSubscription(user.id, email, transactionId, daysToAdd);
        }

        // If user doesn't exist yet, create pending subscription
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + daysToAdd);

        this.run(`
            INSERT OR REPLACE INTO subscriptions (user_id, email, status, kirvano_transaction_id, expires_at, updated_at)
            VALUES (?, ?, 'active', ?, ?, CURRENT_TIMESTAMP)
        `, [email, email, transactionId, expiresAt.toISOString()]);

        return this.getSubscriptionByEmail(email);
    }

    cancelSubscription(userId) {
        this.run(`
            UPDATE subscriptions
            SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
        `, [userId]);
    }

    cancelSubscriptionByEmail(email) {
        this.run(`
            UPDATE subscriptions
            SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
            WHERE email = ?
        `, [email]);
    }

    isSubscriptionActive(userId) {
        const sub = this.getSubscription(userId);
        if (!sub) return false;
        if (sub.status !== 'active') return false;
        if (new Date(sub.expires_at) < new Date()) return false;
        return true;
    }

    isSubscriptionActiveByEmail(email) {
        const sub = this.getSubscriptionByEmail(email);
        if (!sub) return false;
        if (sub.status !== 'active') return false;
        if (new Date(sub.expires_at) < new Date()) return false;
        return true;
    }

    // Link subscription to user when they login
    linkSubscriptionToUser(userId, email) {
        const subByEmail = this.getSubscriptionByEmail(email);
        if (subByEmail && subByEmail.user_id === email) {
            // Update subscription to use real user_id
            this.run(`
                UPDATE subscriptions
                SET user_id = ?, updated_at = CURRENT_TIMESTAMP
                WHERE email = ?
            `, [userId, email]);
        }
    }

    // Daily Usage tracking for freemium
    getDailyUsage(userId) {
        const today = new Date().toISOString().split('T')[0];
        return this.get('SELECT * FROM daily_usage WHERE user_id = ? AND usage_date = ?', [userId, today]);
    }

    incrementDailyUsage(userId, count = 1) {
        const today = new Date().toISOString().split('T')[0];
        const existing = this.getDailyUsage(userId);

        if (existing) {
            this.run(`
                UPDATE daily_usage
                SET messages_sent = messages_sent + ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND usage_date = ?
            `, [count, userId, today]);
        } else {
            this.run(`
                INSERT INTO daily_usage (user_id, usage_date, messages_sent)
                VALUES (?, ?, ?)
            `, [userId, today, count]);
        }

        return this.getDailyUsage(userId);
    }

    getMessagesRemaining(userId, dailyLimit = 15) {
        const usage = this.getDailyUsage(userId);
        const sent = usage?.messages_sent || 0;
        return Math.max(0, dailyLimit - sent);
    }

    canSendMessages(userId, count = 1, dailyLimit = 15) {
        // Check if user has active subscription (unlimited)
        if (this.isSubscriptionActive(userId)) {
            return { allowed: true, remaining: Infinity, isPremium: true };
        }

        const remaining = this.getMessagesRemaining(userId, dailyLimit);
        return {
            allowed: remaining >= count,
            remaining: remaining,
            isPremium: false,
            limit: dailyLimit
        };
    }

    // Check if user has premium features (subscription active)
    isPremiumUser(userId) {
        return this.isSubscriptionActive(userId);
    }
}

// Export singleton
const db = new Database();
module.exports = db;
