import PostalMime from 'postal-mime';
import { EmailMessage } from 'cloudflare:email';

export default {
	async email(message, env, ctx) {
		try {
			// use PostalMime analyze email
			const parser = new PostalMime();
			const email = await parser.parse(message.raw);

			const from = message.from;
			const to = message.to;
			const subject = email.subject.replace(/！$/u, '').trim() || '';

			// Log email details
			console.log('========= Email Received =========');
			console.log('From:', from);
			console.log('To:', to);
			console.log('Subject:', subject);
			console.log('Email Content:', email);
			console.log('Text Content:', email.text);
			console.log('HTML Content:', email.html);
			console.log('================================');

			// Create forward email using MIMEText
			const msg = createMimeMessage();
			msg.setSender({ name: 'Mail Forwarder', addr: message.to });
			msg.setRecipient('digby@65mail.cn');
			msg.setSubject(`Fwd: ${subject}`);

			// Prepare forwarded message content
			const forwardContent = `
                ---------- Forwarded message ----------
                From: ${from}
                Date: ${new Date().toISOString()}
                Subject: ${subject}
                To: ${to}

                ${email.html || email.text}
            `;

			msg.addMessage({
				contentType: 'text/html',
				data: forwardContent,
			});

			// Create and send the email message
			const forwardMessage = new EmailMessage(
				message.to, // from
				'', // to
				msg.asRaw(),
			);

			await env.FORWARD_EMAIL.send(forwardMessage);
			console.log('Email forwarded successfully');
		} catch (error) {
			console.error('Error processing email:', error);
		}
	},

	async fetch(request, env, ctx) {
		return new Response('Hello World!');
	},
};
