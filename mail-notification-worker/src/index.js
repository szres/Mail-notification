import PostalMime from 'postal-mime';
import { Bot } from 'grammy';
import { EmailMessage } from 'cloudflare:email';
import { parseIngressNotification, formatTelegramMessage } from './emailHandler';

export default {
	async email(message, env, ctx) {
		try {
			// Validate environment variables
			if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
				throw new Error('Missing Telegram configuration');
			}

			const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
			const parser = new PostalMime();
			const email = await parser.parse(message.raw);

			console.log('Parsing email from:', message.from);
			const ingressData = parseIngressNotification(email);

			if (ingressData) {
				const telegramMessage = formatTelegramMessage(ingressData);
				await bot.api.sendMessage(env.TELEGRAM_CHAT_ID, telegramMessage, {
					parse_mode: 'Markdown',
					disable_web_page_preview: false,
				});
				console.log('Notification sent successfully');
			}
		} catch (error) {
			console.error('Processing error:', error);
			const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
			await bot.api.sendMessage(env.TELEGRAM_CHAT_ID, `⚠️ Error processing Ingress notification: ${error.message}`);
		}
	},

	async fetch(request, env, ctx) {
		return new Response('Hello World!');
	},
};
