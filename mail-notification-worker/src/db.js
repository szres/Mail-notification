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
				this.db.prepare(`
                    CREATE TABLE IF NOT EXISTS records (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        portal_name TEXT NOT NULL,
                        portal_address TEXT,
                        latitude REAL,
                        longitude REAL,
                        agent_name TEXT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        meet_rule_sets TEXT, -- JSON array of matched rule set UUIDs
                        receive_address TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `),
				this.db.prepare(`
                    CREATE TABLE IF NOT EXISTS rule_sets (
                        uuid TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        description TEXT,
                        rules TEXT NOT NULL, -- JSON array of rules
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `)
			]);
			log.info('Database tables initialized');
		} catch (error) {
			log.error('Database initialization error:', error);
			throw error;
		}
	}

	async createAgent(telegramId, agentName, faction, email) {
		try {
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

	async deleteAgent(telegramId) {
		try {
			// First verify agent exists
			const agent = await this.getAgent(telegramId);
			if (!agent) {
				throw new Error('Agent not found');
			}

			// Delete in correct order to handle foreign key constraints
			const results = await this.db.batch([
				// 1. Delete registrations (no foreign key constraints)
				this.db
					.prepare(
						`
						DELETE FROM registrations
						WHERE telegram_id = ?1
						`,
					)
					.bind(telegramId),

				// 2. Clear invitation references before deleting agent
				this.db
					.prepare(
						`
						UPDATE invitations
						SET created_by = NULL,
							used_by = NULL,
							status = 'revoked'
						WHERE created_by = ?1 OR used_by = ?1
						`,
					)
					.bind(telegramId),

				// 3. Finally delete the agent
				this.db
					.prepare(
						`
						DELETE FROM agents
						WHERE telegram_id = ?1
						`,
					)
					.bind(telegramId),
			]);

			log.info('Agent deleted successfully:', telegramId);
			return true;
		} catch (error) {
			log.error('Delete agent error:', error);
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
			// First check if the agent exists
			const agent = await this.getAgent(createdBy);
			if (!agent) {
				throw new Error('Agent not found');
			}

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
			if (result.changes === 0) {
				throw new Error('Invalid or expired invitation code');
			}
			return true;
		} catch (error) {
			log.error('Mark invitation used error:', error);
			throw error;
		}
	}

	async resetDatabase() {
		try {
			await this.db.batch([
				this.db.prepare('DELETE FROM registrations'),
				this.db.prepare('DELETE FROM invitations'),
				this.db.prepare('DELETE FROM agents'),
			]);
			return true;
		} catch (error) {
			log.error('Reset database error:', error);
			throw error;
		}
	}

	async createRecord(recordData) {
		try {
			const stmt = this.db.prepare(`
				INSERT INTO records (
					portal_name,
					portal_address,
					latitude,
					longitude,
					agent_name,
					timestamp,
					meet_rule_sets,
					receive_address
				)
				VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
				RETURNING id
			`);
			
			const result = await stmt.bind(
				recordData.portal_name,
				recordData.portal_address,
				recordData.latitude,
				recordData.longitude,
				recordData.agent_name,
				recordData.timestamp || new Date().toISOString(),
				JSON.stringify(recordData.meet_rule_sets || []),
				recordData.receive_address
			).first();
			
			return result.id;
		} catch (error) {
			log.error('Create record error:', error);
			throw error;
		}
	}

	async getRecord(id) {
		try {
			const stmt = this.db.prepare(`
				SELECT * FROM records WHERE id = ?1
			`);
			const result = await stmt.bind(id).first();
			if (result) {
				result.meet_rule_sets = JSON.parse(result.meet_rule_sets || '[]');
			}
			return result;
		} catch (error) {
			log.error('Get record error:', error);
			throw error;
		}
	}

	async getRecords(options = {}) {
		try {
			let query = `SELECT * FROM records WHERE 1=1`;
			const params = [];
			let paramIndex = 1;

			if (options.startDate) {
				query += ` AND timestamp >= ?${paramIndex++}`;
				params.push(options.startDate);
			}

			if (options.endDate) {
				query += ` AND timestamp <= ?${paramIndex++}`;
				params.push(options.endDate);
			}

			if (options.agentName) {
				query += ` AND agent_name = ?${paramIndex++}`;
				params.push(options.agentName);
			}

			if (options.portalName) {
				query += ` AND portal_name LIKE ?${paramIndex++}`;
				params.push(`%${options.portalName}%`);
			}

			// Add pagination
			const limit = options.limit || 100;
			const offset = options.offset || 0;
			query += ` ORDER BY timestamp DESC LIMIT ${limit} OFFSET ${offset}`;

			const stmt = this.db.prepare(query);
			const results = await stmt.bind(...params).all();
			
			return results.map(record => ({
				...record,
				meet_rule_sets: JSON.parse(record.meet_rule_sets || '[]')
			}));
		} catch (error) {
			log.error('Get records error:', error);
			throw error;
		}
	}

	async getAllRuleSets() {
		try {
			const stmt = this.db.prepare(`
				SELECT * FROM rule_sets 
				ORDER BY created_at DESC
			`);
			const results = await stmt.all();
			if (!Array.isArray(results)) {
				log.warn('getAllRuleSets: results is not an array, converting...', typeof results);
				return results?.results?.map(result => ({
					...result,
					rules: JSON.parse(result.rules)
				})) || [];
			}
			return results.map(result => ({
				...result,
				rules: JSON.parse(result.rules)
			}));
		} catch (error) {
			log.error('Get all rule sets error:', error);
			return [];
		}
	}

	async getRuleSetsByLocation(latitude, longitude) {
		try {
			const ruleSets = await this.getAllRuleSets();
			return ruleSets.filter(ruleSet => {
				return ruleSet.rules.some(rule => {
					if (rule.type === 'radius') {
						const distance = this._calculateDistance(
							latitude,
							longitude,
							rule.center.lat,
							rule.center.lng
						);
						return distance <= rule.radius;
					}
					if (rule.type === 'polygon') {
						return this._isPointInPolygon(
							{ lat: latitude, lng: longitude },
							rule.points
						);
					}
					return false;
				});
			});
		} catch (error) {
			log.error('Get rule sets by location error:', error);
			throw error;
		}
	}

	// Helper methods for location calculations
	_calculateDistance(lat1, lon1, lat2, lon2) {
		const R = 6371e3; // Earth's radius in meters
		const φ1 = lat1 * Math.PI/180;
		const φ2 = lat2 * Math.PI/180;
		const Δφ = (lat2-lat1) * Math.PI/180;
		const Δλ = (lon2-lon1) * Math.PI/180;

		const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
				Math.cos(φ1) * Math.cos(φ2) *
				Math.sin(Δλ/2) * Math.sin(Δλ/2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

		return R * c; // in meters
	}

	_isPointInPolygon(point, polygon) {
		let inside = false;
		for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
			const xi = polygon[i].lat, yi = polygon[i].lng;
			const xj = polygon[j].lat, yj = polygon[j].lng;
			
			const intersect = ((yi > point.lng) !== (yj > point.lng))
				&& (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi);
			if (intersect) inside = !inside;
		}
		return inside;
	}


	async getAllRuleSetsWithRecords() {
		try {
			const stmt = this.db.prepare(`
				SELECT r.*, 
					   COUNT(rec.id) as record_count,
					   MAX(rec.created_at) as last_record_at
				FROM rule_sets r
				LEFT JOIN records rec ON JSON_EXTRACT(rec.meet_rule_sets, '$') LIKE '%' || r.uuid || '%'
				GROUP BY r.uuid
				ORDER BY r.created_at DESC
			`);
			const response = await stmt.all();
			
			// 处理 D1 返回的结果格式
			const results = response?.results || [];
			
			return results.map(result => ({
				...result,
				rules: JSON.parse(result.rules || '[]'),
				record_count: parseInt(result.record_count || '0'),
				last_record_at: result.last_record_at || null
			}));
		} catch (error) {
			log.error('Get all rule sets with records error:', error);
			return []; // 出错时返回空数组而不是抛出错误
		}
	}

	async getRuleSetRecords(uuid, options = {}) {
		try {
			let query = `
				SELECT rec.*
				FROM records rec
				WHERE JSON_EXTRACT(rec.meet_rule_sets, '$') LIKE '%' || ?1 || '%'
			`;
			const params = [uuid];
			let paramIndex = 2;

			if (options.startDate) {
				query += ` AND rec.created_at >= ?${paramIndex++}`;
				params.push(options.startDate);
			}

			if (options.endDate) {
				query += ` AND rec.created_at <= ?${paramIndex++}`;
				params.push(options.endDate);
			}

			if (options.agentName) {
				query += ` AND rec.agent_name LIKE ?${paramIndex++}`;
				params.push(`%${options.agentName}%`);
			}

			// Add sorting and pagination
			query += ` ORDER BY rec.created_at DESC`;
			
			if (options.limit) {
				query += ` LIMIT ?${paramIndex++}`;
				params.push(options.limit);
			}

			if (options.offset) {
				query += ` OFFSET ?${paramIndex++}`;
				params.push(options.offset);
			}

			const stmt = this.db.prepare(query);
			const response = await stmt.bind(...params).all();
			
			// 处理 D1 返回的结果格式
			const results = response?.results || [];
			
			return results.map(record => ({
				...record,
				meet_rule_sets: JSON.parse(record.meet_rule_sets || '[]')
			}));
		} catch (error) {
			log.error('Get rule set records error:', error);
			return []; // 出错时返回空数组而不是抛出错误
		}
	}
}
