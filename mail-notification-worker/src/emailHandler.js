// emailHandler.js

class EmailParser {
	constructor(email) {
		this.email = email;
		this.html = email.html.replace(/\n/g, '') || '';
		this.text = email.text || '';
	}

	isIngressNotification() {
		// More robust checking for Ingress-specific emails
		const ingressKeywords = ['Ingress Portal Status', 'DAMAGE REPORT', 'Niantic Project Operations', 'ingress-support@nianticlabs.com'];

		// Check both HTML and text content
		return ingressKeywords.some((keyword) => this.html.includes(keyword) || this.text.includes(keyword));
	}

	async extractPortalInfo() {
		const result = await this._extractIngressReportInfo();
		return {
			name: result.portal || 'Unknown Portal',
			address: result.address || 'Unknown Location',
			image: await this._extractPortalImage(),
			coordinates: this._extractCoordinates(result.address),
		};
	}

	async _extractIngressReportInfo() {
		try {
			const result = await this._ingressReportExtract(this.html);
			return result;
		} catch (error) {
			console.error('Error extracting Ingress report info:', error);
			return {
				portal: 'Unknown Portal',
				address: 'Unknown Location',
				attacker: 'Unknown Attacker',
				status: '',
				owner: '',
			};
		}
	}

	async _extractPortalImage() {
		const imageMatch = this.html.match(/<img[^>]*alt="Portal - [^"]*"[^>]*src="([^"]+)"/);
		return imageMatch ? imageMatch[1] : null;
	}

	_extractCoordinates(address) {
		const coordsMatch = this.html.match(/ll=([\d.-]+),([\d.-]+)/);
		return coordsMatch ? { lat: coordsMatch[1], lng: coordsMatch[2] } : null;
	}

	async extractAttackInfo() {
		try {
			const result = await this._extractIngressReportInfo();

			return {
				attacker: {
					name: result.attacker || 'Unknown Attacker',
					time: this._extractAttackTime(),
				},
				damage: this._extractDamageDetails(),
				status: [`Level: ${result.status || 'Unknown'}`, `Owner: ${result.owner || 'Unknown'}`],
			};
		} catch (error) {
			console.error('Error extracting attack info:', error);
			return this._getDefaultAttackInfo();
		}
	}

	_extractAttackTime() {
		const timeMatch = this.html.match(/at (\d+:\d+) hrs GMT/);
		return timeMatch ? timeMatch[1] : 'Unknown Time';
	}

	_extractDamageDetails() {
		const damageMatches = this.html.match(/(\d+ (?:Link|Resonator)[^<]+)/g) || [];
		return damageMatches.map((match) => match.trim());
	}

	_getDefaultAttackInfo() {
		return {
			attacker: {
				name: 'Unknown Attacker',
				time: 'Unknown Time',
			},
			damage: [],
			status: [],
		};
	}

	async _ingressReportExtract(html) {
		const result = {
			attacker: '',
			portal: '',
			address: '',
			status: '',
			owner: '',
		};

		const htmlResponse = new Response(html);

		let parseStep = 0;
		let txtCache = '';

		const textParser = () => {
			if (txtCache.length > 0) {
				parseStep++;
				switch (parseStep) {
					case 1:
						// REPORT HEAD
						break;
					case 2:
						result.portal = txtCache.replace(/\s\s+/g, ' ').replace(/\s+$/g, '');
						break;
					case 3:
						result.address = txtCache.replace(/\s\s+/g, ' ').replace(/\s+$/g, '');
						break;
					default:
						const re = /\s*(DAMAGE|STATUS)\:(.*)/.exec(txtCache);
						if (re) {
							switch (re[1]) {
								case 'DAMAGE':
									const reDamage = /by\s+(\S+)/.exec(re[2]);
									if (reDamage) {
										result.attacker = reDamage[1];
									}
									break;
								case 'STATUS':
									const reStatus = /Level\s+(\d)\s+Health\:\s*(\d+%)\s+Owner\:\s*(\S+)/.exec(re[2]);
									if (reStatus) {
										result.status = 'L' + reStatus[1] + ' ' + reStatus[2];
										result.owner = reStatus[3];
									}
									break;
							}
						}
						break;
				}
			}
			txtCache = '';
		};
		const rewriter = new HTMLRewriter()
			.on('tr>td>div', {
				element(element) {
					textParser();
				},
				text(text) {
					txtCache += text.text + ' ';
				},
			})
			.on('tr>td>table>td>div', {
				element(element) {
					textParser();
				},
				text(text) {
					txtCache += text.text + ' ';
				},
			});

		await rewriter.transform(htmlResponse).text();
		textParser();
		return result;
	}
}

export async function parseIngressEmail(email) {
	try {
		const parser = new EmailParser(email);
		if (!parser.isIngressNotification()) return null;

		const portalInfo = await parser.extractPortalInfo();
		const attackInfo = await parser.extractAttackInfo();
		return {
			portal: portalInfo,
			attack: attackInfo,
		};
	} catch (error) {
		console.error('Error parsing Ingress email:', error);
		return null;
	}
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

// End of file
