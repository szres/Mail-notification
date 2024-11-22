// src/telegram.js
import { log } from './utils';

export class TelegramHandler {
	constructor(bot, db, env) {
		this.bot = bot;
		this.db = db;
		this.env = env;
		this.initialized = false;
	}
	async init() {
		if (!this.initialized) {
			await this.bot.init();
			this.initialized = true;
		}
	}

	async handleUpdate(update) {
		try {
			await this.init();
			log.info('Processing update:', update);

			if (update.callback_query) {
				return await this.handleCallback(update.callback_query);
			}

			if (!update.message) return;

			const message = update.message;
			const chatId = message.chat.id;
			const text = message.text;

			const registration = await this.db.getRegistrationState(chatId);
			if (registration) {
				return await this.handleRegistration(message, registration);
			}

			if (text?.startsWith('/')) {
				return await this.handleCommand(message);
			}
		} catch (error) {
			log.error('Update handling error:', error);
			throw error;
		}
	}

	async handleCommand(message) {
		const chatId = message.chat.id;
		const command = message.text.split(' ')[0];

		try {
			switch (command) {
				case '/start':
					return await this.handleStart(message);
				case '/help':
					return await this.sendHelp(chatId);
				case '/invite':
					return await this.handleInvite(message);
				case '/status':
					return await this.handleStatus(message);
				case '/delete':
					return await this.handleDelete(message);
				case '/cancel':
					return await this.handleCancel(chatId);
				default:
					await this.bot.api.sendMessage(chatId, 'Unknown command. Use /help to see available commands.');
			}
		} catch (error) {
			log.error('Command handling error:', error);
			await this.bot.api.sendMessage(chatId, '⚠️ An error occurred processing your command.');
		}
	}

	async handleStart(message) {
		const chatId = message.chat.id;
		const args = message.text.split(' ');

		try {
			// Check if already registered
			const existingAgent = await this.db.getAgent(chatId);
			if (existingAgent) {
				await this.bot.api.sendMessage(chatId, `Welcome back, Agent ${existingAgent.agent_name}!`);
				return;
			}

			if (args.length === 2) {
				const inviteCode = args[1];
				if (await this.db.validateInvitation(inviteCode)) {
					await this.startRegistration(chatId, inviteCode);
					return;
				}
				await this.bot.api.sendMessage(chatId, 'Invalid or expired invitation code.');
				return;
			}

			await this.bot.api.sendMessage(chatId, 'Welcome! Please use an invitation link to register.');
		} catch (error) {
			log.error('Start command error:', error);
			await this.bot.api.sendMessage(chatId, '⚠️ An error occurred. Please try again later.');
		}
	}

	async startRegistration(chatId, inviteCode) {
		try {
			await this.db.setRegistrationState(chatId, 'NAME', { inviteCode });
			await this.bot.api.sendMessage(chatId, 'Please enter your Ingress agent name:');
		} catch (error) {
			log.error('Start registration error:', error);
			throw error;
		}
	}

	async handleRegistration(message, registration) {
		const chatId = message.chat.id;
		const text = message.text;

		try {
			switch (registration.step) {
				case 'NAME':
					if (text.length < 3) {
						await this.bot.api.sendMessage(chatId, 'Name too short. Please try again:');
						return;
					}
					await this.db.setRegistrationState(chatId, 'FACTION', {
						...registration.data,
						agentName: text,
					});
					await this.bot.api.sendMessage(chatId, 'Select your faction:', {
						reply_markup: {
							inline_keyboard: [
								[
									{ text: 'Resistance 🔷', callback_data: 'faction_RES' },
									//{ text: 'Enlightened 💚', callback_data: 'faction_ENL' },
								],
							],
						},
					});
					break;
				default:
					log.warn('Unknown registration step:', registration.step);
			}
		} catch (error) {
			log.error('Registration handling error:', error);
			await this.bot.api.sendMessage(chatId, '⚠️ Registration error. Please try again later.');
			await this.db.clearRegistrationState(chatId);
		}
	}

	async handleCallback(callback) {
		const chatId = callback.message.chat.id;

		try {
			if (callback.data === 'delete_confirm') {
				await this.db.deleteAgent(chatId);
				await this.bot.api.sendMessage(chatId, '✅ Your account has been deleted.\n' + 'You can register again using an invitation link.');
				return;
			}

			if (callback.data.startsWith('faction_')) {
				const faction = callback.data.split('_')[1];
				const registration = await this.db.getRegistrationState(chatId);

				if (!registration) {
					await this.bot.api.sendMessage(chatId, '⚠️ Registration session expired.');
					return;
				}
				const email = `${crypto.randomUUID()}@${this.env.EMAILSUFFIX}`;
				// Create agent and get result
				const agent = await this.db.createAgent(chatId, registration.data.agentName, faction, email);

				// Mark invitation as used
				await this.db.markInvitationUsed(registration.data.inviteCode, chatId);

				// Clear registration state
				await this.db.clearRegistrationState(chatId);

				// Send welcome message with email
				await this.bot.api.sendMessage(
					chatId,
					`✅ Registration complete!\nWelcome agent ${registration.data.agentName}!\nYour forwarding address is:\n\`${email}\``,
					{
						parse_mode: 'Markdown',
					},
				);
			}
		} catch (error) {
			log.error('Callback handling error:', error);
			await this.bot.api.sendMessage(chatId, '⚠️ An error occurred. Please try again later.');
		}
	}
	async handleInvite(message) {
		const chatId = message.chat.id;

		try {
			await this.init(); // Make sure bot is initialized

			const agent = await this.db.getAgent(chatId);
			if (!agent) {
				await this.bot.api.sendMessage(chatId, 'You need to register first!');
				return;
			}

			const code = await this.db.createInvitation(chatId);
			const botUsername = this.bot.botInfo.username;

			await this.bot.api.sendMessage(chatId, `Share this link to invite others:\nhttps://t.me/${botUsername}?start=${code}`);
		} catch (error) {
			log.error('Invite handling error:', error);
			await this.bot.api.sendMessage(chatId, '⚠️ Failed to create invitation.');
		}
	}

	async handleDelete(message) {
		const chatId = message.chat.id;

		try {
			const agent = await this.db.getAgent(chatId);
			if (!agent) {
				await this.bot.api.sendMessage(chatId, 'You are not registered.');
				return;
			}

			await this.bot.api.sendMessage(
				chatId,
				`⚠️ Are you sure you want to delete your account?\n` +
					`This will:\n` +
					`- Delete your agent profile\n` +
					`- Revoke all your invitations\n` +
					`- Stop email notifications\n\n` +
					`To confirm, click the button below:`,
				{
					reply_markup: {
						inline_keyboard: [
							[
								{
									text: '🗑️ Yes, delete my account',
									callback_data: 'delete_confirm',
								},
							],
						],
					},
				},
			);
		} catch (error) {
			log.error('Delete handling error:', error);
			await this.bot.api.sendMessage(chatId, '⚠️ Failed to process deletion request.');
		}
	}

	async handleStatus(message) {
		const chatId = message.chat.id;

		try {
			const agent = await this.db.getAgent(chatId);
			if (!agent) {
				await this.bot.api.sendMessage(chatId, 'You need to register first!');
				return;
			}

			await this.bot.api.sendMessage(
				chatId,
				`Agent: ${agent.agent_name}\n` + `Faction: ${agent.faction}\n` + `Assing email address: \`${agent.notification_email}\``,
				{
					parse_mode: 'Markdown',
				},
			);
		} catch (error) {
			log.error('Status handling error:', error);
			await this.bot.api.sendMessage(chatId, '⚠️ Failed to get status.');
		}
	}

	async handleCancel(chatId) {
		try {
			await this.db.clearRegistrationState(chatId);
			await this.bot.api.sendMessage(chatId, '❌ Operation cancelled.');
		} catch (error) {
			log.error('Cancel handling error:', error);
			await this.bot.api.sendMessage(chatId, '⚠️ Failed to cancel operation.');
		}
	}

	async sendHelp(chatId) {
		try {
			await this.bot.api.sendMessage(
				chatId,
				'/start - Start registration\n' +
					'/invite - Generate invitation\n' +
					'/status - Check your status\n' +
					'/help - Show this help\n' +
					'/cancel - Cancel current operation',
			);
		} catch (error) {
			log.error('Help message error:', error);
			throw error;
		}
	}
}
