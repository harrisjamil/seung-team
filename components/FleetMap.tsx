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
};

export function FleetMap({
  bbox,
  ships,
  zones,
  selectedId,
  onPickShip,
  drawMode,
  draftRing,
  onMapClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapTick, setMapTick] = useState(0);
  const drawModeRef = useRef(false);
  const onMapClickRef = useRef<Props["onMapClick"] | undefined>(undefined);
  const onPickShipRef = useRef(onPickShip);

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
      map.addLayer({
        id: "ships-circles",
        type: "circle",
        source: "ships",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "selected"], 0, 7, 1, 12],
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
            "#0ea5e9",
          ],
          "circle-stroke-color": "#0f172a",
          "circle-stroke-width": 2,
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
      const feats = map.queryRenderedFeatures(ev.point, { layers: ["ships-circles"] });
      const id = (feats[0]?.properties as { id?: string } | undefined)?.id;
      onPickShipRef.current(typeof id === "string" ? id : null);
    });

    return () => {
      map.remove();
      mapRef.current = null;
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
    const zonesSrc = m.getSource("zones") as maplibregl.GeoJSONSource | undefined;
    const draftSrc = m.getSource("zones-draft") as maplibregl.GeoJSONSource | undefined;
    const routeSrc = m.getSource("route-sl") as maplibregl.GeoJSONSource | undefined;
    if (!shipsSrc || !zonesSrc || !draftSrc || !routeSrc) return;

    shipsSrc.setData({
      type: "FeatureCollection",
      features: ships.map((s) => ({
        type: "Feature" as const,
        properties: {
          id: s.id,
          name: s.name,
          status: s.status,
          selected: s.id === selectedId ? 1 : 0,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [s.position.lng, s.position.lat],
        },
      })),
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

  return (
    <div
      ref={containerRef}
      className="h-full min-h-[420px] w-full rounded-xl border border-slate-800 bg-slate-950"
      style={{ cursor: drawMode ? "crosshair" : "pointer" }}
    />
  );
}
