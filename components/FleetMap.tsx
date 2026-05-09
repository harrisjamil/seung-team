"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FleetShipRuntime, RestrictedZone } from "@/lib/sim-types";

const BASE_STYLE = "https://tiles.openfreemap.org/styles/liberty";

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
  /** Open-Meteo adverse wind overlay on the map bbox */
  showWeatherOverlay?: boolean;
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
  showWeatherOverlay = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapTick, setMapTick] = useState(0);
  const drawModeRef = useRef(false);
  const onMapClickRef = useRef<Props["onMapClick"] | undefined>(undefined);
  const onPickShipRef = useRef(onPickShip);
  const pulseFrameRef = useRef<number | null>(null);
  const trackHistoryRef = useRef<Map<string, [number, number][]>>(new Map());
  const hoverPopupRef = useRef<maplibregl.Popup | null>(null);

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
      map.addSource("weather-adverse", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "weather-elevated-haze",
        type: "circle",
        source: "weather-adverse",
        filter: ["==", ["get", "level"], 1],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 12, 9, 36, 14, 56],
          "circle-color": "rgba(245, 158, 11, 0.32)",
          "circle-opacity": 0.65,
          "circle-blur": 0.88,
        },
      });
      map.addLayer({
        id: "weather-elevated-core",
        type: "circle",
        source: "weather-adverse",
        filter: ["==", ["get", "level"], 1],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 5, 9, 14, 14, 18],
          "circle-color": "#d97706",
          "circle-opacity": 0.45,
          "circle-stroke-width": 1,
          "circle-stroke-color": "rgba(255,255,255,0.45)",
        },
      });
      map.addLayer({
        id: "weather-poor-haze",
        type: "circle",
        source: "weather-adverse",
        filter: ["==", ["get", "level"], 2],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 10, 9, 32, 14, 52],
          "circle-color": "rgba(220, 38, 38, 0.32)",
          "circle-opacity": 0.72,
          "circle-blur": 0.85,
        },
      });
      map.addLayer({
        id: "weather-poor-core",
        type: "circle",
        source: "weather-adverse",
        filter: ["==", ["get", "level"], 2],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 4, 9, 12, 14, 16],
          "circle-color": "#b91c1c",
          "circle-opacity": 0.52,
          "circle-stroke-width": 1,
          "circle-stroke-color": "rgba(255,255,255,0.5)",
        },
      });

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
          "circle-radius": ["interpolate", ["linear"], ["get", "selected"], 0, 6.5, 1, 8.5],
          "circle-color": [
            "match",
            ["get", "status"],
            "distressed",
            "#ef4444",
            "rerouting",
            "#f59e0b",
            "stranded",
            "#a855f7",
            "insufficient_fuel",
            "#f97316",
            "stopped",
            "#64748b",
            "#0ea5e9",
          ],
          "circle-opacity": 0.95,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": ["interpolate", ["linear"], ["get", "selected"], 0, 1.2, 1, 2],
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
      const queryLayers = ["ships-circles"].filter((layerId) =>
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

    map.on("mousemove", (ev) => {
      const shipLayers = ["ships-circles"].filter((layerId) =>
        map.getLayer(layerId),
      );
      if (shipLayers.length === 0) return;
      const feats = map.queryRenderedFeatures(ev.point, { layers: shipLayers });
      const top = feats[0];
      const props = top?.properties as
        | {
            name?: string;
            status?: string;
            fuelTonnes?: number | string;
            speedKnots?: number | string;
            headingDeg?: number | string;
          }
        | undefined;
      if (!top || !props) {
        map.getCanvas().style.cursor = drawModeRef.current ? "crosshair" : "pointer";
        hoverPopupRef.current?.remove();
        hoverPopupRef.current = null;
        return;
      }

      const coords = (top.geometry as GeoJSON.Point).coordinates as [number, number];
      const fuel =
        typeof props.fuelTonnes === "number"
          ? props.fuelTonnes.toFixed(0)
          : Number(props.fuelTonnes ?? 0).toFixed(0);
      const speed =
        typeof props.speedKnots === "number"
          ? props.speedKnots.toFixed(1)
          : Number(props.speedKnots ?? 0).toFixed(1);
      const heading =
        typeof props.headingDeg === "number"
          ? props.headingDeg.toFixed(0)
          : Number(props.headingDeg ?? 0).toFixed(0);
      const status = (props.status ?? "normal").toString();
      const statusTone =
        status === "distressed"
          ? { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" }
          : status === "underway"
            ? { bg: "#ecfeff", color: "#0e7490", border: "#a5f3fc" }
            : { bg: "#f8fafc", color: "#475569", border: "#e2e8f0" };

      map.getCanvas().style.cursor = "pointer";
      if (!hoverPopupRef.current) {
        hoverPopupRef.current = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          className: "ship-hover-popup",
          offset: 16,
          maxWidth: "none",
        });
      }
      hoverPopupRef.current
        .setLngLat(coords)
        .setHTML(
          `<div style="min-width:210px;border-radius:14px;border:1px solid #dbe4f0;background:#ffffff;padding:12px;box-shadow:0 14px 30px rgba(15,23,42,0.18);font-family:Arial,sans-serif">
             <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
               <div style="font-size:13px;font-weight:700;color:#0f172a;line-height:1.2">${props.name ?? "Vessel"}</div>
               <span style="font-size:10px;font-weight:700;text-transform:capitalize;padding:3px 7px;border-radius:999px;background:${statusTone.bg};color:${statusTone.color};border:1px solid ${statusTone.border}">${status}</span>
             </div>
             <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:6px">
               <div style="border:1px solid #e2e8f0;border-radius:8px;padding:6px 7px">
                 <div style="font-size:10px;color:#64748b">Fuel</div>
                 <div style="font-size:11px;color:#0f172a;font-weight:700">${fuel}t</div>
               </div>
               <div style="border:1px solid #e2e8f0;border-radius:8px;padding:6px 7px">
                 <div style="font-size:10px;color:#64748b">Speed</div>
                 <div style="font-size:11px;color:#0f172a;font-weight:700">${speed} kn</div>
               </div>
               <div style="grid-column:1 / -1;border:1px solid #e2e8f0;border-radius:8px;padding:6px 7px">
                 <div style="font-size:10px;color:#64748b">Heading</div>
                 <div style="font-size:11px;color:#0f172a;font-weight:700">${heading}°</div>
               </div>
             </div>
           </div>`,
        )
        .addTo(map);
    });

    return () => {
      if (pulseFrameRef.current != null) {
        cancelAnimationFrame(pulseFrameRef.current);
        pulseFrameRef.current = null;
      }
      if (hoverPopupRef.current) {
        hoverPopupRef.current.remove();
        hoverPopupRef.current = null;
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
    const wSrc = m.getSource("weather-adverse") as maplibregl.GeoJSONSource | undefined;
    if (!showWeatherOverlay) {
      wSrc?.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    if (!bbox || !wSrc) return;

    const ac = new AbortController();
    const run = async () => {
      try {
        const u = new URL("/api/weather/grid", window.location.origin);
        u.searchParams.set("south", String(bbox.south));
        u.searchParams.set("west", String(bbox.west));
        u.searchParams.set("north", String(bbox.north));
        u.searchParams.set("east", String(bbox.east));
        u.searchParams.set("cols", "8");
        u.searchParams.set("rows", "8");
        const res = await fetch(u.toString(), { signal: ac.signal, cache: "no-store" });
        const j = (await res.json()) as {
          ok?: boolean;
          geojson?: GeoJSON.FeatureCollection;
        };
        if (!j.ok || !j.geojson || !mapRef.current?.getSource("weather-adverse")) return;
        (mapRef.current.getSource("weather-adverse") as maplibregl.GeoJSONSource).setData(
          j.geojson,
        );
      } catch {
        /* abort or network */
      }
    };
    void run();
    const iv = window.setInterval(run, 3 * 60 * 1000);
    return () => {
      ac.abort();
      window.clearInterval(iv);
    };
  }, [bbox, mapTick, showWeatherOverlay]);

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
          fuelTonnes: s.fuelTonnes,
          speedKnots: s.speedKnots,
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
    <div className="relative h-full min-h-[420px] w-full">
      <div
        ref={containerRef}
        className="h-full min-h-[420px] w-full rounded-2xl border border-slate-200 bg-white shadow-sm"
        style={{ cursor: drawMode ? "crosshair" : "pointer" }}
      />
      {showWeatherOverlay ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[240px] rounded-lg border border-rose-200 bg-white/95 px-2.5 py-2 text-[10px] leading-snug text-slate-700 shadow-md backdrop-blur-sm">
          <span className="font-semibold text-rose-800">Weather</span>
          <span className="text-slate-600">
            {" "}
            — Amber: wind ≥8 m/s or gusts ≥12 m/s. Red: wind ≥12 m/s or gusts ≥18 m/s (Open-Meteo,
            8×8 grid).
          </span>
        </div>
      ) : null}
    </div>
  );
}
