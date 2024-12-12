import { log } from './utils';

export class Notifier {
    constructor(env) {
        this.env = env;
    }

    async sendAPNS(token, payload) {
        try {
            // 实现 APNS 发送逻辑
            const apnsPayload = {
                aps: {
                    alert: {
                        title: payload.title,
                        body: payload.message
                    },
                    sound: "default"
                },
                ...payload.data
            };

            // TODO: 实现 APNS 发送
            log.info('Sending APNS notification:', { token, payload: apnsPayload });
        } catch (error) {
            log.error('APNS send error:', error);
            throw error;
        }
    }

    async sendNTFY(token, payload) {
        try {
            const response = await fetch(`https://ntfy.sh/${token}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    topic: token,
                    title: payload.title,
                    message: payload.message,
                    priority: payload.priority || 3,
                    tags: payload.tags || []
                })
            });

            if (!response.ok) {
                throw new Error(`NTFY send failed: ${response.statusText}`);
            }

            log.info('NTFY notification sent successfully');
        } catch (error) {
            log.error('NTFY send error:', error);
            throw error;
        }
    }
} 