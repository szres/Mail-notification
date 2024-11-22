import { log } from './utils';

export class AgentDatabase {
	constructor(db) {
		if (!db) throw new Error('Database connection is required');
		this.db = db;
	}

	async initializeTables() {
		try {
			await this.db.batch([
				this.db.prepare(`
                    CREATE TABLE IF NOT EXISTS agents (
                        telegram_id INTEGER PRIMARY KEY,
                        agent_name TEXT NOT NULL,
                        faction TEXT NOT NULL,
                        notification_email TEXT UNIQUE,
                        status TEXT DEFAULT 'active',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `),
				this.db.prepare(`
                    CREATE TABLE IF NOT EXISTS registrations (
                        telegram_id INTEGER PRIMARY KEY,
                        step TEXT NOT NULL,
                        data TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `),
				this.db.prepare(`
                    CREATE TABLE IF NOT EXISTS invitations (
                        invitation_code TEXT PRIMARY KEY,
                        created_by INTEGER,
                        used_by INTEGER,
                        expires_at DATETIME,
                        status TEXT DEFAULT 'active',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (created_by) REFERENCES agents(telegram_id),
                        FOREIGN KEY (used_by) REFERENCES agents(telegram_id)
                    )
                `),
			]);
			log.info('Database tables initialized');
		} catch (error) {
			log.error('Database initialization error:', error);
			throw error;
		}
	}

	async createAgent(telegramId, agentName, faction) {
		try {
			const email = `${crypto.randomUUID()}@szres.org`;
			const stmt = this.db.prepare(`
                INSERT INTO agents (telegram_id, agent_name, faction, notification_email)
                VALUES (?1, ?2, ?3, ?4)
            `);
			return await stmt.bind(telegramId, agentName, faction, email).run();
		} catch (error) {
			log.error('Create agent error:', error);
			throw error;
		}
	}

	async getAgent(telegramId) {
		try {
			const stmt = this.db.prepare(`
                SELECT * FROM agents WHERE telegram_id = ?1
            `);
			return await stmt.bind(telegramId).first();
		} catch (error) {
			log.error('Get agent error:', error);
			throw error;
		}
	}

	async getAgentByEmail(email) {
		try {
			const stmt = this.db.prepare(`
                SELECT * FROM agents
                WHERE notification_email = ?1
                AND status = 'active'
            `);
			return await stmt.bind(email).first();
		} catch (error) {
			log.error('Get agent by email error:', error);
			throw error;
		}
	}

	async setRegistrationState(telegramId, step, data = {}) {
		try {
			const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO registrations (telegram_id, step, data)
                VALUES (?1, ?2, ?3)
            `);
			return await stmt.bind(telegramId, step, JSON.stringify(data)).run();
		} catch (error) {
			log.error('Set registration state error:', error);
			throw error;
		}
	}

	async getRegistrationState(telegramId) {
		try {
			const stmt = this.db.prepare(`
                SELECT * FROM registrations WHERE telegram_id = ?1
            `);
			const result = await stmt.bind(telegramId).first();
			return result
				? {
						step: result.step,
						data: JSON.parse(result.data),
					}
				: null;
		} catch (error) {
			log.error('Get registration state error:', error);
			throw error;
		}
	}

	async clearRegistrationState(telegramId) {
		try {
			const stmt = this.db.prepare(`
                DELETE FROM registrations WHERE telegram_id = ?1
            `);
			return await stmt.bind(telegramId).run();
		} catch (error) {
			log.error('Clear registration state error:', error);
			throw error;
		}
	}

	async createInvitation(createdBy) {
		try {
			const invitationCode = crypto.randomUUID();
			const expiresAt = new Date();
			expiresAt.setHours(expiresAt.getHours() + 24);

			const stmt = this.db.prepare(`
                INSERT INTO invitations (invitation_code, created_by, expires_at)
                VALUES (?1, ?2, ?3)
            `);
			await stmt.bind(invitationCode, createdBy, expiresAt.toISOString()).run();

			return invitationCode;
		} catch (error) {
			log.error('Create invitation error:', error);
			throw error;
		}
	}

	async validateInvitation(code) {
		try {
			const stmt = this.db.prepare(`
                SELECT * FROM invitations
                WHERE invitation_code = ?1
                AND status = 'active'
                AND expires_at > datetime('now')
                AND used_by IS NULL
            `);
			const result = await stmt.bind(code).first();
			return !!result;
		} catch (error) {
			log.error('Validate invitation error:', error);
			throw error;
		}
	}

	async markInvitationUsed(code, usedBy) {
		try {
			const stmt = this.db.prepare(`
                UPDATE invitations
                SET status = 'used',
                    used_by = ?2
                WHERE invitation_code = ?1
                AND status = 'active'
                AND expires_at > datetime('now')
                AND used_by IS NULL
            `);
			const result = await stmt.bind(code, usedBy).run();
			return result.changes > 0;
		} catch (error) {
			log.error('Mark invitation used error:', error);
			throw error;
		}
	}
}
