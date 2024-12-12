import { log } from './utils';

export class RuleHandler {
    constructor(db) {
        this.db = db;
    }

    async processIngressData(ingressData, email) {
        try {
            // Extract coordinates from portal info
            const { latitude, longitude } = this._extractCoordinates(ingressData.portal);
            
            // Get all rule sets and check for matches
            const ruleSets = await this.db.getAllRuleSets();
            const matchedRuleSets = await this._matchRuleSets(
                ruleSets,
                ingressData,
                latitude,
                longitude
            );

            // Create record with matched rule sets
            const recordData = {
                portal_name: ingressData.portal.name,
                portal_address: ingressData.portal.address,
                latitude,
                longitude,
                agent_name: ingressData.attack.attacker.name,
                timestamp: new Date().toISOString(),
                meet_rule_sets: matchedRuleSets.map(rs => rs.uuid),
                receive_address: email.to
            };

            const recordId = await this.db.createRecord(recordData);
            log.info('Created record with ID:', recordId);

            return {
                recordId,
                matchedRuleSets
            };
        } catch (error) {
            log.error('Error processing Ingress data:', error);
            throw error;
        }
    }

    async _matchRuleSets(ruleSets, ingressData, latitude, longitude) {
        try {
            const matchedRuleSets = [];
            
            if (!Array.isArray(ruleSets)) {
                log.warn('_matchRuleSets: ruleSets is not an array:', typeof ruleSets);
                return [];
            }

            log.info('Matching against rule sets:', ruleSets.length);

            for (const ruleSet of ruleSets) {
                try {
                    if (await this._matchRuleSet(ruleSet, ingressData, latitude, longitude)) {
                        matchedRuleSets.push(ruleSet);
                    }
                } catch (error) {
                    log.error('Error matching rule set:', error, ruleSet);
                    // Continue with next rule set
                    continue;
                }
            }

            log.info('Matched rule sets:', matchedRuleSets.length);
            return matchedRuleSets;
        } catch (error) {
            log.error('Error in _matchRuleSets:', error);
            return [];
        }
    }

    async _matchRuleSet(ruleSet, ingressData, latitude, longitude) {
        try {
            if (!ruleSet || !Array.isArray(ruleSet.rules)) {
                log.warn('Invalid rule set:', ruleSet);
                return false;
            }

            // A rule set matches if any of its rules match
            return ruleSet.rules.some(rule => {
                try {
                    if (!rule || !rule.type) {
                        log.warn('Invalid rule:', rule);
                        return false;
                    }

                    switch (rule.type) {
                        case 'agent':
                            return this._matchAgentRule(rule, ingressData.attack.attacker.name);
                        case 'radius':
                            return this._matchRadiusRule(rule, latitude, longitude);
                        case 'polygon':
                            return this._matchPolygonRule(rule, latitude, longitude);
                        case 'name':
                            return this._matchNameRule(rule, ingressData.portal.name);
                        default:
                            log.warn('Unknown rule type:', rule.type);
                            return false;
                    }
                } catch (error) {
                    log.error('Error matching rule:', error, rule);
                    return false;
                }
            });
        } catch (error) {
            log.error('Error in _matchRuleSet:', error);
            return false;
        }
    }

    _matchAgentRule(rule, agentName) {
        return rule.value.toLowerCase() === agentName.toLowerCase();
    }

    _matchRadiusRule(rule, latitude, longitude) {
        return this.db._calculateDistance(
            latitude,
            longitude,
            rule.center.lat,
            rule.center.lng
        ) <= rule.radius;
    }

    _matchPolygonRule(rule, latitude, longitude) {
        return this.db._isPointInPolygon(
            { lat: latitude, lng: longitude },
            rule.points
        );
    }

    _matchNameRule(rule, portalName) {
        return portalName.toLowerCase().includes(rule.value.toLowerCase());
    }

    _extractCoordinates(portal) {
        if (portal.coordinates) {
            return {
                latitude: parseFloat(portal.coordinates.lat),
                longitude: parseFloat(portal.coordinates.lng)
            };
        }
        return {
            latitude: null,
            longitude: null
        };
    }
} 