"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FleetShipRuntime, RestrictedZone } from "@/lib/sim-types";

const BASE_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const SHIP_ICON_ID = "flaticon-ship-icon";
const SHIP_ICON_URL = "/ship-real-icon.png";

type BBox = { south: number; west: number; north: number; east: number };

type Props = {
  bbox: BBox | null;
  ships: FleetShipRuntime[];
  zones: RestrictedZone[];
  selectedId: string | null;
  onPickShip: (id: string | null) => void;
  drawMode?: boolean;
  draftRing?: [number, number][];
  onMapClick?: (lng: number, lat: number) => void;
  followSelected?: boolean;
};

function projectBehind(
  lng: number,
  lat: number,
  headingDeg: number,
  distanceKm: number,
): [number, number] {
  const bearing = ((headingDeg + 180) * Math.PI) / 180;
  const dLat = (distanceKm * Math.cos(bearing)) / 110.574;
  const dLng = (distanceKm * Math.sin(bearing)) / (111.32 * Math.cos((lat * Math.PI) / 180));
  return [lng + dLng, lat + dLat];
}

async function addShipIconImage(
  map: maplibregl.Map,
  iconId: string,
  iconUrl: string,
): Promise<void> {
  if (map.hasImage(iconId)) return;
  const image = await new Promise<ImageBitmap | HTMLImageElement>((resolve, reject) => {
    map.loadImage(iconUrl, (err, loadedImage) => {
      if (err || !loadedImage) {
        reject(err ?? new Error("Failed to load ship icon"));
        return;
      }
      resolve(loadedImage);
    });
  });
  map.addImage(iconId, image, { pixelRatio: 2 });
}

async function ensureShipMapIcons(map: maplibregl.Map): Promise<void> {
  await addShipIconImage(map, SHIP_ICON_ID, SHIP_ICON_URL);
}

export function FleetMap({
  bbox,
  ships,
  zones,
  selectedId,
  onPickShip,
  drawMode,
  draftRing,
  onMapClick,
  followSelected = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapTick, setMapTick] = useState(0);
  const drawModeRef = useRef(false);
  const onMapClickRef = useRef<Props["onMapClick"] | undefined>(undefined);
  const onPickShipRef = useRef(onPickShip);
  const pulseFrameRef = useRef<number | null>(null);
  const trackHistoryRef = useRef<Map<string, [number, number][]>>(new Map());

  useEffect(() => {
    drawModeRef.current = !!drawMode;
    onMapClickRef.current = onMapClick;
    onPickShipRef.current = onPickShip;
  }, [drawMode, onMapClick, onPickShip]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    /** Initial view; `bbox` from the server refines via fitBounds below */
    const center: [number, number] = [56.1, 25.4];
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_STYLE,
      center,
      zoom: 6.8,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("ships", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource("ships-wake", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource("ships-tracks", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "ships-tracks",
        type: "line",
        source: "ships-tracks",
        paint: {
          "line-color": "#0ea5e9",
          "line-opacity": 0.5,
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1, 9, 2.2],
        },
      });
      map.addLayer({
        id: "ships-wake",
        type: "line",
        source: "ships-wake",
        paint: {
          "line-color": "#94a3b8",
          "line-opacity": 0.42,
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.8, 8, 1.6],
        },
      });
      map.addLayer({
        id: "ships-glow",
        type: "circle",
        source: "ships",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "selected"], 0, 11, 1, 16],
          "circle-color": [
            "match",
            ["get", "status"],
            "distressed",
            "#ef4444",
            "rerouting",
            "#fbbf24",
            "stranded",
            "#a855f7",
            "insufficient_fuel",
            "#f97316",
            "stopped",
            "#64748b",
            "#38bdf8",
          ],
          "circle-opacity": 0.18,
          "circle-blur": 0.6,
        },
      });
      map.addLayer({
        id: "ships-circles",
        type: "circle",
        source: "ships",
        paint: {
          /** Tiny neutral fallback marker if icon cannot load */
          "circle-radius": ["interpolate", ["linear"], ["get", "selected"], 0, 2, 1, 2.8],
          "circle-color": "#334155",
          "circle-opacity": 0.25,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 0.8,
        },
      });
      map.addLayer({
        id: "ships-distress-pulse",
        type: "circle",
        source: "ships",
        filter: ["==", ["get", "status"], "distressed"],
        paint: {
          "circle-radius": 12,
          "circle-color": "#ef4444",
          "circle-opacity": 0.3,
          "circle-stroke-color": "#fca5a5",
          "circle-stroke-width": 1.2,
        },
      });
      void ensureShipMapIcons(map)
        .then(() => {
          if (map.getLayer("ships-icon")) return;
          map.addLayer({
            id: "ships-icon",
            type: "symbol",
            source: "ships",
            layout: {
              "icon-image": SHIP_ICON_ID,
              "icon-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                5,
                ["case", ["==", ["get", "selected"], 1], 0.52, 0.42],
                7,
                ["case", ["==", ["get", "selected"], 1], 0.66, 0.56],
                9,
                ["case", ["==", ["get", "selected"], 1], 0.84, 0.72],
              ],
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
              "icon-rotate": ["get", "headingDeg"],
              "icon-rotation-alignment": "map",
              "icon-anchor": "center",
            },
            paint: { "icon-opacity": 0.98 },
          });
        })
        .catch(() => undefined);
      map.addLayer({
        id: "ships-labels",
        type: "symbol",
        source: "ships",
        minzoom: 6.2,
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-offset": [0, 1.75],
          "text-anchor": "top",
        },
        paint: {
          "text-color": "#0f172a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.4,
        },
      });

      map.addSource("zones", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "zones-fill",
        type: "fill",
        source: "zones",
        paint: { "fill-color": "#dc2626", "fill-opacity": 0.16 },
      });
      map.addLayer({
        id: "zones-line",
        type: "line",
        source: "zones",
        paint: { "line-color": "#b91c1c", "line-width": 2 },
      });

      map.addSource("zones-draft", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "zones-draft-line",
        type: "line",
        source: "zones-draft",
        paint: { "line-dasharray": [2, 2], "line-color": "#facc15", "line-width": 2 },
      });

      map.addSource("route-sl", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route-sl",
        paint: { "line-color": "#22d3ee", "line-width": 2 },
      });
      setMapTick((x) => x + 1);
    });

    map.on("click", (ev) => {
      if (drawModeRef.current && onMapClickRef.current) {
        onMapClickRef.current(ev.lngLat.lng, ev.lngLat.lat);
        return;
      }
      const queryLayers = ["ships-icon", "ships-circles"].filter((layerId) =>
        map.getLayer(layerId),
      );
      if (queryLayers.length === 0) {
        onPickShipRef.current(null);
        return;
      }
      const feats = map.queryRenderedFeatures(ev.point, {
        layers: queryLayers,
      });
      const id = (feats[0]?.properties as { id?: string } | undefined)?.id;
      onPickShipRef.current(typeof id === "string" ? id : null);
    });

    return () => {
      if (pulseFrameRef.current != null) {
        cancelAnimationFrame(pulseFrameRef.current);
        pulseFrameRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const animate = () => {
      const m = mapRef.current;
      if (m?.isStyleLoaded() && m.getLayer("ships-distress-pulse")) {
        const t = Date.now() / 1000;
        const wave = (Math.sin(t * 3.8) + 1) / 2;
        m.setPaintProperty("ships-distress-pulse", "circle-radius", 10 + wave * 8);
        m.setPaintProperty("ships-distress-pulse", "circle-opacity", 0.18 + wave * 0.24);
      }
      pulseFrameRef.current = requestAnimationFrame(animate);
    };
    pulseFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (pulseFrameRef.current != null) {
        cancelAnimationFrame(pulseFrameRef.current);
        pulseFrameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const m = mapRef.current;
    if (!m?.isStyleLoaded()) return;
    const b = bbox;
    if (b) {
      m.fitBounds(
        [
          [b.west, b.south],
          [b.east, b.north],
        ],
        { padding: 48, duration: 900, maxZoom: 8.8 },
      );
    }
  }, [bbox]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m?.isStyleLoaded()) return;
    const shipsSrc = m.getSource("ships") as maplibregl.GeoJSONSource | undefined;
    const wakeSrc = m.getSource("ships-wake") as maplibregl.GeoJSONSource | undefined;
    const tracksSrc = m.getSource("ships-tracks") as maplibregl.GeoJSONSource | undefined;
    const zonesSrc = m.getSource("zones") as maplibregl.GeoJSONSource | undefined;
    const draftSrc = m.getSource("zones-draft") as maplibregl.GeoJSONSource | undefined;
    const routeSrc = m.getSource("route-sl") as maplibregl.GeoJSONSource | undefined;
    if (!shipsSrc || !wakeSrc || !tracksSrc || !zonesSrc || !draftSrc || !routeSrc) return;

    shipsSrc.setData({
      type: "FeatureCollection",
      features: ships.map((s) => ({
        type: "Feature" as const,
        properties: {
          id: s.id,
          name: s.name,
          status: s.status,
          headingDeg: s.headingDeg,
          selected: s.id === selectedId ? 1 : 0,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [s.position.lng, s.position.lat],
        },
      })),
    });
    wakeSrc.setData({
      type: "FeatureCollection",
      features: ships.map((s) => {
        const tail = projectBehind(s.position.lng, s.position.lat, s.headingDeg, 0.45);
        return {
          type: "Feature" as const,
          properties: { id: s.id, selected: s.id === selectedId ? 1 : 0 },
          geometry: {
            type: "LineString" as const,
            coordinates: [
              [s.position.lng, s.position.lat],
              tail,
            ],
          },
        };
      }),
    });
    tracksSrc.setData({
      type: "FeatureCollection",
      features: ships
        .map((s) => {
          const history = trackHistoryRef.current.get(s.id) ?? [];
          const nextPt: [number, number] = [s.position.lng, s.position.lat];
          if (
            history.length === 0 ||
            history[history.length - 1][0] !== nextPt[0] ||
            history[history.length - 1][1] !== nextPt[1]
          ) {
            history.push(nextPt);
            if (history.length > 14) history.shift();
            trackHistoryRef.current.set(s.id, history);
          }
          if (history.length < 2) return null;
          return {
            type: "Feature" as const,
            properties: { id: s.id },
            geometry: {
              type: "LineString" as const,
              coordinates: history,
            },
          };
        })
        .filter((x): x is NonNullable<typeof x> => x != null),
    });

    zonesSrc.setData({
      type: "FeatureCollection",
      features: zones.map((z) => ({
        type: "Feature" as const,
        properties: { id: z.id, name: z.name },
        geometry: { type: "Polygon" as const, coordinates: [z.ring] },
      })),
    });

    if (draftRing && draftRing.length >= 2) {
      const closed =
        draftRing.length > 2
          ? [...draftRing, draftRing[0]]
          : draftRing;
      draftSrc.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: closed },
          },
        ],
      });
    } else {
      draftSrc.setData({ type: "FeatureCollection", features: [] });
    }

    const sel = ships.find((x) => x.id === selectedId);
    if (sel && sel.route?.length) {
      const coords: [number, number][] = [
        [sel.position.lng, sel.position.lat],
        ...sel.route.map((p) => [p.lng, p.lat] as [number, number]),
      ];
      routeSrc.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: coords },
          },
        ],
      });
    } else {
      routeSrc.setData({ type: "FeatureCollection", features: [] });
    }
  }, [mapTick, ships, zones, draftRing, selectedId]);

  useEffect(() => {
    if (!followSelected || !selectedId) return;
    const m = mapRef.current;
    if (!m?.isStyleLoaded()) return;
    const s = ships.find((x) => x.id === selectedId);
    if (!s) return;
    const currentZoom = m.getZoom();
    m.easeTo({
      center: [s.position.lng, s.position.lat],
      zoom: Math.max(currentZoom, 9.8),
      duration: 600,
      essential: true,
    });
  }, [followSelected, selectedId, ships]);

  return (
    <div
      ref={containerRef}
      className="h-full min-h-[420px] w-full rounded-2xl border border-slate-200 bg-white shadow-sm"
      style={{ cursor: drawMode ? "crosshair" : "pointer" }}
    />
  );
}
