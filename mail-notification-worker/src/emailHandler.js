// emailHandler.js
class EmailParser {
	constructor(email) {
		this.html = email.html || '';
		this.text = email.text || '';
	}

	isIngressNotification() {
		return this.html.includes('Ingress Portal Status') || this.html.includes('DAMAGE REPORT');
	}

	extractPortalInfo() {
		const portalRegex = /<div[^>]*>([^<]+)<\/div>\s*<div><a[^>]+>([^<]+)<\/a><\/div>/;
		const imageRegex = /src="(https:\/\/lh3\.googleusercontent\.com\/[^"]+)"/;
		const coordsRegex = /intel\?ll=([\d.-]+),([\d.-]+)/;

		const portal = this.html.match(portalRegex) || [];
		const image = this.html.match(imageRegex);
		const coords = this.html.match(coordsRegex);

		return {
			name: portal[1]?.trim() || 'Unknown Portal',
			address: portal[2]?.trim() || 'Unknown Location',
			image: image?.[1] || null,
			coordinates: coords ? { lat: coords[1], lng: coords[2] } : null,
		};
	}

	extractAttackInfo() {
		const attackRegex = /color: #428F43[^>]+>([^<]+)<\/span>\s*at\s*(\d{2}:\d{2})/;
		const attack = this.html.match(attackRegex) || [];

		const getDamageSection = (type) => {
			const regex = new RegExp(`${type}:<br>([^<]+(?:<br>[^<]+)*)`, 'i');
			return (
				this.html
					.match(regex)?.[1]
					?.split('<br>')
					.map((line) => line.trim())
					.filter(Boolean) || [`No ${type.toLowerCase()} information`]
			);
		};

		return {
			attacker: {
				name: attack[1] || 'Unknown Attacker',
				time: attack[2] || 'Unknown Time',
			},
			damage: getDamageSection('DAMAGE'),
			status: getDamageSection('STATUS'),
		};
	}
}

export function parseIngressEmail(email) {
	const parser = new EmailParser(email);
	if (!parser.isIngressNotification()) return null;

	return {
		portal: parser.extractPortalInfo(),
		attack: parser.extractAttackInfo(),
	};
}

export function formatTelegramMessage(data) {
	const sections = [
		'🚨 *Portal Attack Alert!*',
		'',
		'🏛 *Portal Information*',
		`Name: \`${data.portal.name}\``,
		`Address: ${data.portal.address}`,
		data.portal.image ? `[Portal Image](${data.portal.image})` : '',
		'',
		'👤 *Attack Details*',
		`Attacker: \`${data.attack.attacker.name}\``,
		`Time: ${data.attack.attacker.time} GMT`,
		'',
		'💥 *Damage Report*',
		data.attack.damage.join('\n'),
		'',
		'📊 *Current Status*',
		data.attack.status.join('\n'),
		'',
		data.portal.coordinates
			? `🗺 [Intel Map](https://intel.ingress.com/intel?ll=${data.portal.coordinates.lat},${data.portal.coordinates.lng}&z=19)`
			: '',
	];

	return sections.filter(Boolean).join('\n').trim();
}
