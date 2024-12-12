import PostalMime from 'postal-mime';
import { Bot } from 'grammy';
import { AgentDatabase } from './db';
import { TelegramHandler } from './telegram';
import { parseIngressEmail, formatTelegramMessage } from './emailHandler';
import { log } from './utils';
import { EmailMessage } from 'cloudflare:email';
import { RuleHandler } from './ruleHandler';

const fetch = require('node-fetch');

export default {
	async email(message, env, ctx) {
		try {
			if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
				throw new Error('Missing required environment variables');
			}

			// Early validation of email
			if (!message.to) {
				log.info('No sender email address, ignoring');
				return;
			}

			const db = new AgentDatabase(env.emaildb);

			// Check if email is assigned to an agent
			const agent = await db.getAgentByEmail(message.to);
			if (!agent) {
				log.info('Email not assigned to any agent, ignoring:', message.to);
				return;
			}

			log.info('Processing email from agent:', {
				email: message.from,
				agent: agent.agent_name,
				faction: agent.faction,
			});

			const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
			const parser = new PostalMime();
			const email = await parser.parse(message.raw);
			log.info('Email text', {
				emailtext: email.text || '',
			});
			log.info('Email html', {
				emailhtml: email.html || '',
			});
			// Parse notification
			const ingressData = await parseIngressEmail(email);
			if (!ingressData) {
				await message.forward(env.FALLBACKEMAILL);
				log.info('Not an Ingress notification email, ignoring');
				return;
			}

			// Process rules and create record
			const ruleHandler = new RuleHandler(db);
			const { recordId, matchedRuleSets } = await ruleHandler.processIngressData(ingressData, message);

			log.info('Processed rules and created record:', {
				recordId,
				matchedRuleSets: matchedRuleSets.map(rs => rs.name)
			});

			// Add agent info to the notification data
			const enrichedData = {
				...ingressData,
				agent: {
					name: agent.agent_name,
					faction: agent.faction,
					telegram_id: agent.telegram_id,
				},
				matchedRuleSets: matchedRuleSets
			};

			// Send to Telegram
			const telegramMessage = formatTelegramMessage(enrichedData);

			// Send to the agent's Telegram chat
			await bot.api.sendMessage(agent.telegram_id, telegramMessage, {
				parse_mode: 'Markdown',
				disable_web_page_preview: false,
			});

			// Also send to admin chat if configured
			if (env.TELEGRAM_CHAT_ID && env.TELEGRAM_CHAT_ID !== agent.telegram_id.toString()) {
				await bot.api.sendMessage(env.TELEGRAM_CHAT_ID, telegramMessage, {
					parse_mode: 'Markdown',
					disable_web_page_preview: false,
				});
			}

			log.info('Notification processed and sent successfully', {
				agent: agent.agent_name,
				email: message.from,
			});
		} catch (error) {
			log.error('Email processing error:', error);
			try {
				const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
				await bot.api.sendMessage(
					env.TELEGRAM_CHAT_ID,
					`⚠️ Error processing notification:\n` + `From: ${message.from}\n` + `Error: ${error.message}`,
				);
			} catch (notifyError) {
				log.error('Failed to send error notification:', notifyError);
			}
		}
	},

	async fetch(request, env, ctx) {
		try {
			if (!env.TELEGRAM_BOT_TOKEN || !env.emaildb) {
				throw new Error('Missing required configuration');
			}

			const url = new URL(request.url);
			log.info('Incoming request:', url.pathname);

			const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
			const db = new AgentDatabase(env.emaildb);
			await db.initializeTables();

			const telegramHandler = new TelegramHandler(bot, db, env);

			if (url.pathname === '/webhook') {
				log.info('Processing webhook request');

				const secretToken = env.WEBHOOK_SECRET;
				const telegramToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');

				if (!secretToken || !telegramToken || secretToken !== telegramToken) {
					log.warn('Invalid webhook token');
					return new Response('Unauthorized', { status: 401 });
				}

				const update = await request.json();
				await telegramHandler.handleUpdate(update);
				return new Response('OK');
			}

			if (url.pathname === '/health') {
				return Response.json({
					status: 'healthy',
					database: 'connected',
					time: new Date().toISOString(),
				});
			}

			if (url.pathname === '/rulesets' && request.method === 'GET') {
				try {
					const ruleSets = await db.getAllRuleSetsWithRecords();
					return Response.json({
						success: true,
						data: ruleSets
					});
				} catch (error) {
					log.error('Get rule sets error:', error);
					return Response.json({
						success: false,
						error: error.message
					}, { status: 500 });
				}
			}

			if (url.pathname.startsWith('/ruleset/') && request.method === 'GET') {
				try {
					const uuid = url.pathname.split('/')[2];
					if (!uuid) {
						return Response.json({
							success: false,
							error: 'Rule set UUID is required'
						}, { status: 400 });
					}

					// Parse query parameters
					const params = new URLSearchParams(url.search);
					const options = {
						startDate: params.get('startDate'),
						endDate: params.get('endDate'),
						agentName: params.get('agent'),
						limit: parseInt(params.get('limit') || '100'),
						offset: parseInt(params.get('offset') || '0')
					};

					const records = await db.getRuleSetRecords(uuid, options);
					return Response.json({
						success: true,
						data: records
					});
				} catch (error) {
					log.error('Get rule set records error:', error);
					return Response.json({
						success: false,
						error: error.message
					}, { status: 500 });
				}
			}

			return new Response('Ingress Portal Monitor Bot', {
				headers: { 'Content-Type': 'text/plain' },
			});
		} catch (error) {
			log.error('Request handling error:', error);
			return new Response(
				JSON.stringify({
					error: error.message,
					timestamp: new Date().toISOString(),
				}),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				},
			);
		}
	},
};

async function emailtest() {
	try {
		if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
			throw new Error('Missing required environment variables');
		}

		// Early validation of email
		if (!message.to) {
			log.info('No sender email address, ignoring');
			return;
		}

		const db = new AgentDatabase(env.emaildb);

		// Check if email is assigned to an agent
		const agent = await db.getAgentByEmail(message.to);
		if (!agent) {
			log.info('Email not assigned to any agent, ignoring:', message.to);
			return;
		}

		log.info('Processing email from agent:', {
			email: message.from,
			agent: agent.agent_name,
			faction: agent.faction,
		});

		const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
		const parser = new PostalMime();
		const email = await parser.parse(message.raw);
		log.info('Email text', {
			emailtext: email.text || '',
		});
		log.info('Email html', {
			emailhtml: email.html || '',
		});
		// Parse notification
		const ingressData = parseIngressEmail(email);
		if (!ingressData) {
			await message.forward(env.FALLBACKEMAILL);
			log.info('Not an Ingress notification email, ignoring');
			return;
		}

		// Add agent info to the notification data
		const enrichedData = {
			...ingressData,
			agent: {
				name: agent.agent_name,
				faction: agent.faction,
				telegram_id: agent.telegram_id,
			},
		};

		// Send to Telegram
		const telegramMessage = formatTelegramMessage(enrichedData);

		// Send to the agent's Telegram chat
		await bot.api.sendMessage(agent.telegram_id, telegramMessage, {
			parse_mode: 'Markdown',
			disable_web_page_preview: false,
		});

		// Also send to admin chat if configured
		if (env.TELEGRAM_CHAT_ID && env.TELEGRAM_CHAT_ID !== agent.telegram_id.toString()) {
			await bot.api.sendMessage(env.TELEGRAM_CHAT_ID, telegramMessage, {
				parse_mode: 'Markdown',
				disable_web_page_preview: false,
			});
		}

		log.info('Notification processed and sent successfully', {
			agent: agent.agent_name,
			email: message.from,
		});
	} catch (error) {
		log.error('Email processing error:', error);
		try {
			const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
			await bot.api.sendMessage(
				env.TELEGRAM_CHAT_ID,
				`⚠️ Error processing notification:\n` + `From: ${message.from}\n` + `Error: ${error.message}`,
			);
		} catch (notifyError) {
			log.error('Failed to send error notification:', notifyError);
		}
	}
}
