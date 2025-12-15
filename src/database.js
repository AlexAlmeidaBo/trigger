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

            CREATE TABLE IF NOT EXISTS agent_archetypes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                niche TEXT NOT NULL,
                subniche TEXT,
                tone TEXT NOT NULL,
                objective TEXT,
                system_prompt TEXT NOT NULL,
                policy TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                contact_phone TEXT NOT NULL,
                campaign_id INTEGER,
                archetype_id INTEGER,
                handoff_status TEXT DEFAULT 'NONE',
                agent_messages_in_row INTEGER DEFAULT 0,
                last_sender TEXT,
                tags TEXT,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, contact_phone)
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

        // Add archetype_id column to campaigns
        try {
            const result = this.db.exec("PRAGMA table_info(campaigns)");
            if (result.length > 0) {
                const columns = result[0].values.map(row => row[1]);

                if (!columns.includes('archetype_id')) {
                    console.log('Adding archetype_id column to campaigns...');
                    this.db.run("ALTER TABLE campaigns ADD COLUMN archetype_id INTEGER");
                }
                if (!columns.includes('agent_enabled')) {
                    console.log('Adding agent_enabled column to campaigns...');
                    this.db.run("ALTER TABLE campaigns ADD COLUMN agent_enabled INTEGER DEFAULT 0");
                }
            }
        } catch (e) {
            console.log('Migration campaigns archetype:', e.message);
        }

        // Add persona_name, version, changelog to agent_archetypes
        try {
            const result = this.db.exec("PRAGMA table_info(agent_archetypes)");
            if (result.length > 0) {
                const columns = result[0].values.map(row => row[1]);

                if (!columns.includes('persona_name')) {
                    console.log('Adding persona_name column to agent_archetypes...');
                    this.db.run("ALTER TABLE agent_archetypes ADD COLUMN persona_name TEXT");
                }
                if (!columns.includes('version')) {
                    console.log('Adding version column to agent_archetypes...');
                    this.db.run("ALTER TABLE agent_archetypes ADD COLUMN version TEXT DEFAULT '1.0'");
                }
                if (!columns.includes('changelog')) {
                    console.log('Adding changelog column to agent_archetypes...');
                    this.db.run("ALTER TABLE agent_archetypes ADD COLUMN changelog TEXT");
                }
            }
        } catch (e) {
            console.log('Migration agent_archetypes enhancements:', e.message);
        }

        // Add notes, policy_log to conversations
        try {
            const result = this.db.exec("PRAGMA table_info(conversations)");
            if (result.length > 0) {
                const columns = result[0].values.map(row => row[1]);

                if (!columns.includes('notes')) {
                    console.log('Adding notes column to conversations...');
                    this.db.run("ALTER TABLE conversations ADD COLUMN notes TEXT");
                }
                if (!columns.includes('policy_log')) {
                    console.log('Adding policy_log column to conversations...');
                    this.db.run("ALTER TABLE conversations ADD COLUMN policy_log TEXT");
                }
                if (!columns.includes('contact_name')) {
                    console.log('Adding contact_name column to conversations...');
                    this.db.run("ALTER TABLE conversations ADD COLUMN contact_name TEXT");
                }
            }
        } catch (e) {
            console.log('Migration conversations enhancements:', e.message);
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
        // Admin emails that always have unlimited access
        const ADMIN_EMAILS = ['alexalmeidabo@gmail.com', 'alec.almeida201@gmail.com'];

        // Get user to check email
        const user = this.getUserById(userId);

        // Check if user is an admin (unlimited access)
        if (user && ADMIN_EMAILS.includes(user.email)) {
            console.log(`Admin user detected: ${user.email} - unlimited access`);
            return { allowed: true, remaining: Infinity, isPremium: true, isAdmin: true };
        }

        // Check if user has active subscription by user_id
        if (this.isSubscriptionActive(userId)) {
            console.log(`Premium user by ID: ${userId}`);
            return { allowed: true, remaining: Infinity, isPremium: true };
        }

        // Also check subscription by email (in case subscription was created before login)
        if (user && this.isSubscriptionActiveByEmail(user.email)) {
            console.log(`Premium user by email: ${user.email}`);
            // Link the subscription to the user ID for future checks
            this.linkSubscriptionToUser(userId, user.email);
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
        // Also check admin status
        const ADMIN_EMAILS = ['alexalmeidabo@gmail.com', 'alec.almeida201@gmail.com'];
        const user = this.getUserById(userId);
        if (user && ADMIN_EMAILS.includes(user.email)) {
            return true;
        }

        if (this.isSubscriptionActive(userId)) {
            return true;
        }

        // Also check by email
        if (user && this.isSubscriptionActiveByEmail(user.email)) {
            return true;
        }

        return false;
    }

    // ==========================================
    // AGENT ARCHETYPES METHODS
    // ==========================================

    getAllArchetypes(activeOnly = true) {
        let sql = 'SELECT * FROM agent_archetypes';
        if (activeOnly) {
            sql += ' WHERE is_active = 1';
        }
        sql += ' ORDER BY niche, key';

        const result = this.db.exec(sql);
        if (!result.length) return [];

        return result[0].values.map(row => ({
            id: row[0],
            key: row[1],
            niche: row[2],
            subniche: row[3],
            tone: row[4],
            objective: row[5],
            system_prompt: row[6],
            policy: JSON.parse(row[7] || '{}'),
            is_active: row[8],
            created_at: row[9],
            updated_at: row[10],
            persona_name: row[11] || null,
            version: row[12] || '1.0',
            changelog: row[13] || null
        }));
    }

    getArchetypeById(id) {
        const result = this.db.exec('SELECT * FROM agent_archetypes WHERE id = ?', [id]);
        if (!result.length || !result[0].values.length) return null;

        const row = result[0].values[0];
        return {
            id: row[0],
            key: row[1],
            niche: row[2],
            subniche: row[3],
            tone: row[4],
            objective: row[5],
            system_prompt: row[6],
            policy: JSON.parse(row[7] || '{}'),
            is_active: row[8],
            created_at: row[9],
            updated_at: row[10],
            persona_name: row[11] || null,
            version: row[12] || '1.0',
            changelog: row[13] || null
        };
    }

    getArchetypeByKey(key) {
        const result = this.db.exec('SELECT * FROM agent_archetypes WHERE key = ?', [key]);
        if (!result.length || !result[0].values.length) return null;

        const row = result[0].values[0];
        return {
            id: row[0],
            key: row[1],
            niche: row[2],
            subniche: row[3],
            tone: row[4],
            objective: row[5],
            system_prompt: row[6],
            policy: JSON.parse(row[7] || '{}'),
            is_active: row[8],
            created_at: row[9],
            updated_at: row[10],
            persona_name: row[11] || null,
            version: row[12] || '1.0',
            changelog: row[13] || null
        };
    }

    createArchetype(data) {
        const stmt = this.db.prepare(`
            INSERT INTO agent_archetypes (key, niche, subniche, tone, objective, system_prompt, policy, persona_name, version, changelog)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run([
            data.key,
            data.niche,
            data.subniche || null,
            data.tone,
            data.objective || null,
            data.system_prompt,
            JSON.stringify(data.policy || {}),
            data.persona_name || null,
            data.version || '1.0',
            data.changelog || null
        ]);
        stmt.free();
        this.save();

        // Return the created archetype
        return this.getArchetypeByKey(data.key);
    }

    updateArchetype(id, data) {
        const fields = [];
        const values = [];

        if (data.key !== undefined) { fields.push('key = ?'); values.push(data.key); }
        if (data.niche !== undefined) { fields.push('niche = ?'); values.push(data.niche); }
        if (data.subniche !== undefined) { fields.push('subniche = ?'); values.push(data.subniche); }
        if (data.tone !== undefined) { fields.push('tone = ?'); values.push(data.tone); }
        if (data.objective !== undefined) { fields.push('objective = ?'); values.push(data.objective); }
        if (data.system_prompt !== undefined) { fields.push('system_prompt = ?'); values.push(data.system_prompt); }
        if (data.policy !== undefined) { fields.push('policy = ?'); values.push(JSON.stringify(data.policy)); }
        if (data.is_active !== undefined) { fields.push('is_active = ?'); values.push(data.is_active ? 1 : 0); }
        if (data.persona_name !== undefined) { fields.push('persona_name = ?'); values.push(data.persona_name); }
        if (data.version !== undefined) { fields.push('version = ?'); values.push(data.version); }
        if (data.changelog !== undefined) { fields.push('changelog = ?'); values.push(data.changelog); }

        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        this.db.run(`UPDATE agent_archetypes SET ${fields.join(', ')} WHERE id = ?`, values);
        this.save();

        return this.getArchetypeById(id);
    }

    deleteArchetype(id) {
        // Soft delete by setting is_active = 0
        this.db.run('UPDATE agent_archetypes SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
        this.save();
    }

    // ==========================================
    // CONVERSATIONS METHODS
    // ==========================================

    getOrCreateConversation(userId, contactPhone, archetypeId, campaignId = null) {
        // Try to find existing conversation
        let result = this.db.exec(
            'SELECT * FROM conversations WHERE user_id = ? AND contact_phone = ?',
            [userId, contactPhone]
        );

        if (result.length && result[0].values.length) {
            const row = result[0].values[0];
            return {
                id: row[0],
                user_id: row[1],
                contact_phone: row[2],
                campaign_id: row[3],
                archetype_id: row[4],
                handoff_status: row[5],
                agent_messages_in_row: row[6],
                last_sender: row[7],
                tags: JSON.parse(row[8] || '[]'),
                is_active: row[9],
                created_at: row[10],
                updated_at: row[11]
            };
        }

        // Create new conversation
        const stmt = this.db.prepare(`
            INSERT INTO conversations (user_id, contact_phone, campaign_id, archetype_id)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run([userId, contactPhone, campaignId, archetypeId]);
        stmt.free();
        this.save();

        return this.getOrCreateConversation(userId, contactPhone, archetypeId, campaignId);
    }

    updateConversation(id, data) {
        const fields = [];
        const values = [];

        if (data.handoff_status !== undefined) { fields.push('handoff_status = ?'); values.push(data.handoff_status); }
        if (data.agent_messages_in_row !== undefined) { fields.push('agent_messages_in_row = ?'); values.push(data.agent_messages_in_row); }
        if (data.last_sender !== undefined) { fields.push('last_sender = ?'); values.push(data.last_sender); }
        if (data.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(data.tags)); }
        if (data.is_active !== undefined) { fields.push('is_active = ?'); values.push(data.is_active ? 1 : 0); }

        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        this.db.run(`UPDATE conversations SET ${fields.join(', ')} WHERE id = ?`, values);
        this.save();
    }

    getConversationById(id) {
        const result = this.db.exec('SELECT * FROM conversations WHERE id = ?', [id]);
        if (!result.length || !result[0].values.length) return null;

        const row = result[0].values[0];
        return {
            id: row[0],
            user_id: row[1],
            contact_phone: row[2],
            campaign_id: row[3],
            archetype_id: row[4],
            handoff_status: row[5],
            agent_messages_in_row: row[6],
            last_sender: row[7],
            tags: JSON.parse(row[8] || '[]'),
            is_active: row[9],
            created_at: row[10],
            updated_at: row[11]
        };
    }

    getActiveConversations(userId) {
        const result = this.db.exec(
            'SELECT * FROM conversations WHERE user_id = ? AND is_active = 1 ORDER BY updated_at DESC',
            [userId]
        );
        if (!result.length) return [];

        return result[0].values.map(row => ({
            id: row[0],
            user_id: row[1],
            contact_phone: row[2],
            campaign_id: row[3],
            archetype_id: row[4],
            handoff_status: row[5],
            agent_messages_in_row: row[6],
            last_sender: row[7],
            tags: JSON.parse(row[8] || '[]'),
            is_active: row[9],
            created_at: row[10],
            updated_at: row[11]
        }));
    }

    escalateConversation(id) {
        this.updateConversation(id, {
            handoff_status: 'ESCALATED',
            tags: ['ESCALAR_HUMANO']
        });
    }

    takeOverConversation(id) {
        this.updateConversation(id, { handoff_status: 'HUMAN_TAKEN' });
    }

    returnToAgent(id) {
        this.updateConversation(id, {
            handoff_status: 'NONE',
            agent_messages_in_row: 0
        });
    }
}

// Export singleton
const db = new Database();
module.exports = db;
