interface PortalInfo {
	name: string;
	address: string;
	image: string | null;
	coordinates: {
		lat: string;
		lng: string;
	} | null;
}

interface AgentInfo {
	name: string;
	faction: string;
	level: string;
}

interface AttackInfo {
	attacker: {
		name: string;
		time: string;
	};
	damage: string[];
	status: string[];
}

interface IngressNotification {
	agent: AgentInfo;
	portal: PortalInfo;
	attack: AttackInfo;
}
