import { NotificationDatabase } from './db';
import { Notifier } from './notifier';
import { log } from './utils';

export default {
    async fetch(request, env, ctx) {
        try {
            const url = new URL(request.url);
            const db = new NotificationDatabase(env.NOTIFICATION_DB);
            await db.initializeTables();

            if (request.method === 'POST' && url.pathname === '/notify') {
                // 处理通知请求
                const { topic, title, message, data } = await request.json();
                
                if (!topic || !title || !message) {
                    return new Response('Missing required fields', { status: 400 });
                }

                const subscribers = await db.getSubscribers(topic);
                const notifier = new Notifier(env);
                const results = [];

                for (const subscriber of subscribers) {
                    try {
                        const payload = { title, message, data };
                        
                        if (subscriber.method === 'APNS') {
                            await notifier.sendAPNS(subscriber.token, payload);
                        } else if (subscriber.method === 'NTFY') {
                            await notifier.sendNTFY(subscriber.token, payload);
                        }
                        
                        results.push({
                            success: true,
                            subscriber: subscriber.id
                        });
                    } catch (error) {
                        results.push({
                            success: false,
                            subscriber: subscriber.id,
                            error: error.message
                        });
                    }
                }

                return Response.json({
                    success: true,
                    results
                });
            }

            if (request.method === 'POST' && url.pathname === '/subscribe') {
                // 处理订阅请求
                const { topic, method, token } = await request.json();
                
                if (!topic || !method || !token) {
                    return new Response('Missing required fields', { status: 400 });
                }

                if (!['APNS', 'NTFY'].includes(method)) {
                    return new Response('Invalid method', { status: 400 });
                }

                await db.addSubscriber(topic, method, token);
                return Response.json({ success: true });
            }

            if (request.method === 'POST' && url.pathname === '/unsubscribe') {
                // 处理取消订阅请求
                const { topic, method, token } = await request.json();
                
                if (!topic || !method || !token) {
                    return new Response('Missing required fields', { status: 400 });
                }

                await db.removeSubscriber(topic, method, token);
                return Response.json({ success: true });
            }

            return new Response('Not found', { status: 404 });
        } catch (error) {
            log.error('Request handling error:', error);
            return new Response(error.message, { status: 500 });
        }
    }
}; 