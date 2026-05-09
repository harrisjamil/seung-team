/**
 * Port catalog from fleet.json — used when the WebSocket simulator has not sent
 * `ports` yet (e.g. Vercel without NEXT_PUBLIC_WS_URL).
 */
export const FLEET_DEFAULT_PORTS: Record<
  string,
  { name: string; lat: number; lng: number }
> = {
  jebel_ali: { name: "Jebel Ali", lat: 24.9833, lng: 55.0833 },
  bandar_abbas: { name: "Bandar Abbas", lat: 27.1832, lng: 56.2666 },
  muscat: { name: "Muscat", lat: 23.6139, lng: 58.5933 },
  sohar: { name: "Sohar", lat: 24.3475, lng: 56.7099 },
  fujairah: { name: "Fujairah Port", lat: 25.1289, lng: 56.352 },
  khasab: { name: "Khasab", lat: 26.1579, lng: 56.247 },
  doha: { name: "Doha", lat: 25.2854, lng: 51.531 },
};
