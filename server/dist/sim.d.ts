import type { AlertRecord, Directive, FleetJson, FleetShipRuntime, PlaybackBuffer, RestrictedZone, SimStatePayload } from "./types.js";
export declare class SimEngine {
    fleet: FleetJson;
    ships: FleetShipRuntime[];
    zones: RestrictedZone[];
    directives: Directive[];
    alerts: AlertRecord[];
    playback: PlaybackBuffer;
    proximityActive: Set<string>;
    geofenceActive: Set<string>;
    t0: number;
    readonly tickSeconds: number;
    constructor(tickSeconds?: number);
    reloadFleet(): void;
    private configToRuntime;
    assignRouteFromPosition(shipId: string): void;
    private updateFuelProjection;
    updateHeadingTowardWaypoint(s: FleetShipRuntime): void;
    private refreshWeatherCounter;
    /** Stagger inexpensive weather lookups for each ship (~15 calls per cycle but cached). */
    refreshWeatherForShips(): Promise<void>;
    step(now: number): SimStatePayload;
    private lastPlaybackAt;
    private snapshotPlaybackThrottled;
    private raiseArrival;
    private raiseAlert;
    addZone(z: Omit<RestrictedZone, "createdAt">): void;
    updateZone(id: string, ring: [number, number][], name?: string): void;
    deleteZone(id: string): void;
    private pathCrossesZone;
    issueDirective(d: Omit<Directive, "id" | "issuedAt">): Directive;
    respondDirective(id: string, response: "ACCEPT" | "ESCALATE_DISTRESS", message?: string): Promise<void>;
    ackAlert(alertId: string): void;
    resolveAlert(alertId: string): void;
}
