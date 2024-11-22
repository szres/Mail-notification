/**
 * Email handler and parser for Ingress notification emails
 * @module emailHandler
 */

/**
 * Cleans text by removing HTML entities and extra whitespace
 */
function cleanText(text) {
	return text
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Extracts plain text from HTML content
 */
function extractTextFromHtml(html) {
	return html
		.replace(/<br>/gi, '\n')
		.replace(/<div[^>]*>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.split('\n')
		.map((line) => cleanText(line))
		.filter((line) => line && line !== ' ')
		.join('\n');
}

/**
 * Extracts damage information from HTML content
 */
function extractDamageInfo(html) {
	const damageMatch = html.match(/DAMAGE:<br>([^<]+(?:<br>[^<]+)*)/);
	if (damageMatch) {
		return damageMatch[1]
			.split('<br>')
			.map((line) => cleanText(line))
			.filter((line) => line);
	}
	return ['No damage information available'];
}

/**
 * Extracts status information from HTML content
 */
function extractStatusInfo(html) {
	const statusMatch = html.match(/STATUS:<br>([^<]+(?:<br>[^<]+)*)/);
	if (statusMatch) {
		return statusMatch[1]
			.split('<br>')
			.map((line) => cleanText(line))
			.filter((line) => line);
	}
	return ['No status information available'];
}

/**
 * Extracts portal information from HTML content
 */
const extractPortalInfo = (html) => {
	try {
		const portalInfoMatch = html.match(/<div>([^<]+)<\/div>\s*<div><a[^>]+>([^<]+)<\/a><\/div>/);
		if (portalInfoMatch) {
			return {
				name: cleanText(portalInfoMatch[1]),
				address: cleanText(portalInfoMatch[2]),
			};
		}

		const divContents = [...html.matchAll(/<div[^>]*>([^<]+)<\/div>/g)]
			.map((match) => cleanText(match[1]))
			.filter((text) => text && !text.includes('DAMAGE REPORT'));

		const damageReportIndex = divContents.findIndex((text) => text.includes('DAMAGE REPORT'));
		if (damageReportIndex !== -1 && divContents[damageReportIndex + 1]) {
			return {
				name: divContents[damageReportIndex + 1],
				address: divContents[damageReportIndex + 2] || 'Unknown Location',
			};
		}

		return { name: 'Unknown Portal', address: 'Unknown Location' };
	} catch (error) {
		console.error('Error extracting portal info:', error);
		return { name: 'Unknown Portal', address: 'Unknown Location' };
	}
};

/**
 * Extracts portal image URL from HTML content
 */
const extractPortalImage = (html) => {
	try {
		const portalImageMatch = html.match(/src="(https:\/\/lh3\.googleusercontent\.com\/[^"]+)"/);
		return portalImageMatch ? portalImageMatch[1] : null;
	} catch (error) {
		console.error('Error extracting portal image:', error);
		return null;
	}
};

/**
 * Extracts coordinates from HTML content
 */
const extractCoordinates = (html) => {
	try {
		const mapUrlMatch = html.match(/center=([\d.-]+),([\d.-]+)/);
		return mapUrlMatch
			? {
					lat: mapUrlMatch[1],
					lng: mapUrlMatch[2],
				}
			: null;
	} catch (error) {
		console.error('Error extracting coordinates:', error);
		return null;
	}
};

/**
 * Extracts attacker information from HTML content
 */
const extractAttackerInfo = (html) => {
	try {
		const attackerMatch = html.match(/color: #428F43;">([^<]+)<\/span> at (\d{2}:\d{2})/);
		return attackerMatch
			? {
					name: attackerMatch[1],
					time: attackerMatch[2],
				}
			: {
					name: 'Unknown',
					time: 'Unknown',
				};
	} catch (error) {
		console.error('Error extracting attacker info:', error);
		return { name: 'Unknown', time: 'Unknown' };
	}
};

/**
 * Extracts agent information from HTML content
 */
const extractAgentInfo = (html) => {
	try {
		const agentMatch = html.match(/color: #3679B9;">([^<]+)<\/span>/);
		const factionMatch = html.match(/Faction:<\/span><span[^>]*>([^<]+)<\/span>/);
		const levelMatch = html.match(/Current Level:<\/span>([^<]+)</);

		return {
			name: agentMatch ? cleanText(agentMatch[1]) : 'Unknown',
			faction: factionMatch ? cleanText(factionMatch[1]) : 'Unknown',
			level: levelMatch ? cleanText(levelMatch[1]) : 'Unknown',
		};
	} catch (error) {
		console.error('Error extracting agent info:', error);
		return { name: 'Unknown', faction: 'Unknown', level: 'Unknown' };
	}
};

/**
 * Parses Ingress notification email content
 */
const parseIngressNotification = (email) => {
	try {
		const htmlContent = email.html || '';

		const portalInfo = extractPortalInfo(htmlContent);
		const portalImage = extractPortalImage(htmlContent);
		const coordinates = extractCoordinates(htmlContent);
		const attackerInfo = extractAttackerInfo(htmlContent);
		const agentInfo = extractAgentInfo(htmlContent);

		return {
			agent: agentInfo,
			portal: {
				...portalInfo,
				image: portalImage,
				coordinates,
			},
			attack: {
				attacker: attackerInfo,
				damage: extractDamageInfo(htmlContent),
				status: extractStatusInfo(htmlContent),
			},
		};
	} catch (error) {
		console.error('Parsing error:', error);
		throw error;
	}
};

/**
 * Formats notification data into a Telegram message
 */
const formatTelegramMessage = (ingressData) => {
	return `
🚨 *Portal Attack Alert!*

🏛 *Portal Information*
Name: \`${ingressData.portal.name}\`
Address: ${ingressData.portal.address}
${ingressData.portal.image ? `[Portal Image](${ingressData.portal.image})` : ''}

👤 *Attack Details*
Attacker: \`${ingressData.attack.attacker.name}\`
Time: ${ingressData.attack.attacker.time} GMT

💥 *Damage Report*
${ingressData.attack.damage.join('\n') || 'No damage information available'}

📊 *Current Status*
${ingressData.attack.status.join('\n') || 'No status information available'}

${ingressData.portal.coordinates ? `🗺 [View on Intel Map](https://intel.ingress.com/intel?ll=${ingressData.portal.coordinates.lat},${ingressData.portal.coordinates.lng}&z=19)` : ''}

👮 *Defending Agent*
Agent: ${ingressData.agent.name} (${ingressData.agent.faction} ${ingressData.agent.level})
`;
};

export { parseIngressNotification, formatTelegramMessage };
