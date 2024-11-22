import PostalMime from 'postal-mime';
import { Bot } from 'grammy';
import { AgentDatabase } from './db';
import { TelegramHandler } from './telegram';
import { parseIngressEmail, formatTelegramMessage } from './emailHandler';
import { log } from './utils';

export default {
	async email(message, env, ctx) {
		try {
			if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
				throw new Error('Missing required environment variables');
			}

			const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

			log.info('Processing email from:', message.from);
			const parser = new PostalMime();
			const email = await parser.parse(message.raw);

			const db = new AgentDatabase(env.emaildb);

			// Parse notification
			const ingressData = parseIngressEmail(email);
			if (!ingressData) {
				log.info('Not an Ingress notification email');
				return;
			}

			// Send to Telegram
			const telegramMessage = formatTelegramMessage(ingressData);
			await bot.api.sendMessage(env.TELEGRAM_CHAT_ID, telegramMessage, {
				parse_mode: 'Markdown',
				disable_web_page_preview: false,
			});

			log.info('Notification sent successfully');
		} catch (error) {
			log.error('Email processing error:', error);
			try {
				const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
				await bot.api.sendMessage(env.TELEGRAM_CHAT_ID, `⚠️ Error processing notification:\n${error.message}`);
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

			const telegramHandler = new TelegramHandler(bot, db);

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
