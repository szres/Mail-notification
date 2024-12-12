import { log } from './utils';

export class NotificationDatabase {
    constructor(db) {
        if (!db) throw new Error('Database connection is required');
        this.db = db;
    }

    async initializeTables() {
        try {
            await this.db.batch([
                this.db.prepare(`
                    CREATE TABLE IF NOT EXISTS subscribers (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        topic TEXT NOT NULL,
                        method TEXT NOT NULL CHECK (method IN ('APNS', 'NTFY')),
                        token TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(topic, method, token)
                    )
                `),
                this.db.prepare(`
                    CREATE INDEX IF NOT EXISTS idx_subscribers_topic 
                    ON subscribers(topic)
                `)
            ]);
            log.info('Database tables initialized');
        } catch (error) {
            log.error('Database initialization error:', error);
            throw error;
        }
    }

    async addSubscriber(topic, method, token) {
        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO subscribers (topic, method, token, updated_at)
                VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
            `);
            return await stmt.bind(topic, method, token).run();
        } catch (error) {
            log.error('Add subscriber error:', error);
            throw error;
        }
    }

    async removeSubscriber(topic, method, token) {
        try {
            const stmt = this.db.prepare(`
                DELETE FROM subscribers 
                WHERE topic = ?1 AND method = ?2 AND token = ?3
            `);
            return await stmt.bind(topic, method, token).run();
        } catch (error) {
            log.error('Remove subscriber error:', error);
            throw error;
        }
    }

    async getSubscribers(topic) {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM subscribers WHERE topic = ?1
            `);
            return await stmt.bind(topic).all();
        } catch (error) {
            log.error('Get subscribers error:', error);
            throw error;
        }
    }
} 