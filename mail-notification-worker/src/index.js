import PostalMime from 'postal-mime';
import { Bot } from 'grammy';
import { EmailMessage } from 'cloudflare:email';

function parseIngressNotification(textContent, htmlContent) {
	try {
		// Parse text content for basic information
		const lines = textContent.split('\n').map((line) => line.trim());

		// Extract agent info from text
		const agentInfo = {
			name: lines
				.find((line) => line.startsWith('Agent Name:'))
				?.split(':')[1]
				?.trim(),
			faction: lines
				.find((line) => line.startsWith('Faction:'))
				?.split(':')[1]
				?.trim(),
			level: lines
				.find((line) => line.startsWith('Current Level:'))
				?.split(':')[1]
				?.trim(),
		};

		// Extract portal info from text
		const portalIndex = lines.findIndex((line) => line === 'DAMAGE REPORT') + 1;
		const portalName = lines[portalIndex + 1]?.trim();
		const portalAddress = lines[portalIndex + 2]?.trim();

		// Parse HTML content for images and attack details
		const portalImageMatch = htmlContent.match(/src="(https:\/\/lh3\.googleusercontent\.com\/[^"]+)"/);
		const portalImage = portalImageMatch ? portalImageMatch[1] : null;

		const mapUrlMatch = htmlContent.match(/src="(http:\/\/maps\.googleapis\.com\/maps\/api\/staticmap[^"]+)"/);
		const mapUrl = mapUrlMatch ? mapUrlMatch[1] : null;

		const coordsMatch = mapUrl ? mapUrl.match(/center=([\d.-]+),([\d.-]+)/) : null;
		const coordinates = coordsMatch
			? {
					lat: coordsMatch[1],
					lng: coordsMatch[2],
				}
			: null;

		// Extract damage info from text
		const damageStart = lines.findIndex((line) => line === 'DAMAGE:');
		const statusStart = lines.findIndex((line) => line === 'STATUS:');

		const damageLines = lines
			.slice(damageStart + 1, statusStart)
			.filter((line) => line)
			.map((line) => line.trim());

		const statusLines = lines
			.slice(statusStart + 1)
			.filter((line) => line)
			.map((line) => line.trim());

		// Extract attacker info
		const attackerMatch = damageLines[0].match(/by (.+) at (\d{2}:\d{2})/);
		const attackerInfo = attackerMatch
			? {
					name: attackerMatch[1],
					time: attackerMatch[2],
				}
			: null;

		return {
			agent: agentInfo,
			portal: {
				name: portalName,
				address: portalAddress,
				image: portalImage,
				coordinates,
			},
			attack: {
				attacker: attackerInfo,
				damage: damageLines,
				status: statusLines,
			},
		};
	} catch (error) {
		console.error('Error parsing notification:', error);
		return null;
	}
}

export default {
	async email(message, env, ctx) {
		const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

		try {
			const parser = new PostalMime();
			const email = await parser.parse(message.raw);

			const ingressData = parseIngressNotification(email.text, email.html);

			if (ingressData) {
				// Create a single formatted message with image preview
				const telegramMessage = `
🚨 *Portal Attack Alert!*

🏛 *Portal Information*
Name: \`${ingressData.portal.name}\`
Address: ${ingressData.portal.address}
[Portal Image](${ingressData.portal.image})

👤 *Attack Details*
Attacker: \`${ingressData.attack.attacker.name}\`
Time: ${ingressData.attack.attacker.time} GMT

💥 *Damage Report*
${ingressData.attack.damage.join('\n')}

📊 *Current Status*
${ingressData.attack.status.join('\n')}

🗺 [View on Intel Map](https://intel.ingress.com/intel?ll=${ingressData.portal.coordinates.lat},${ingressData.portal.coordinates.lng}&z=19)

👮 *Defending Agent*
Agent: ${ingressData.agent.name} (${ingressData.agent.faction} ${ingressData.agent.level})
`;

				// Send single message with everything included
				await bot.api.sendMessage(env.TELEGRAM_CHAT_ID, telegramMessage, {
					parse_mode: 'Markdown',
					disable_web_page_preview: false, // Enable preview for the portal image
				});

				console.log('Notification sent successfully');
			}
		} catch (error) {
			console.error('Error processing email:', error);
			await bot.api.sendMessage(env.TELEGRAM_CHAT_ID, `⚠️ Error processing Ingress notification: ${error.message}`);
		}
	},

	async fetch(request, env, ctx) {
		return new Response('Hello World!');
	},
};
