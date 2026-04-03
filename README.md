# PEMEX Oil Spill — Geospatial Data Visualization Platform

**A data science project focused on geospatial data visualization, combining satellite imagery, vessel telemetry, and environmental monitoring to reconstruct the 2026 Gulf of Mexico hydrocarbon incident through interactive visual storytelling.**

---

## Problem Statement

On February 6, 2026, Synthetic Aperture Radar (SAR) imagery detected an anomalous hydrocarbon signature in the Sonda de Campeche — Mexico's most critical offshore production zone. Despite official denials, independent satellite monitoring revealed a sustained oil discharge reaching ~50 km² at peak extent, with coastal landfall confirmed by March 2.

This platform was built to answer a single question: **What happened, and who is responsible?**

---

## Geographic Information Systems (GIS) Focus

This project is fundamentally a Geographic Information Systems (GIS) application, leveraging advanced spatial analysis and geodata integration to reconstruct and visualize the 2026 Gulf of Mexico oil spill. The platform demonstrates the power of GIS in environmental forensics, combining multiple spatial data sources and temporal layers to provide actionable insight and transparent evidence.

### Key GIS Capabilities

- **Spatial Data Integration:** Merging satellite imagery (SAR, optical), vector infrastructure (pipelines, platforms), vessel telemetry (AIS), and environmental boundaries (protected areas) into a unified geospatial framework.
- **Coordinate Reference Systems:** Accurate handling and transformation of WGS-84 geodetic coordinates for all data layers, ensuring spatial alignment and precision.
- **Geoprocessing & Analysis:** Buffering, intersection, and spatial joins to correlate vessel positions, pipeline routes, and oil slick extents.
- **Temporal GIS:** Synchronizing spatial events across time, enabling spatio-temporal animation and incident chronology reconstruction.
- **Remote Sensing:** Processing and interpreting radar (Sentinel-1 SAR) and optical (Sentinel-2) satellite data for environmental monitoring and change detection.
- **Cartographic Visualization:** Designing effective map symbology, color encoding, and interactive controls for clear communication of complex spatial phenomena.
- **Open Geospatial Standards:** Utilizing OGC-compliant APIs (WMS, WFS, OGC Features) for data access and interoperability.

### GIS Specifications and Requirements

- **Spatial data formats:** All geospatial layers are managed in open formats such as GeoJSON for vector data and raster tiles for imagery.
- **Web mapping stack:** Interactive visualization is delivered via MapLibre GL, supporting dynamic rendering and user-driven layer toggling.
- **Satellite remote sensing:** The platform processes and visualizes both radar (Sentinel-1 SAR) and optical (Sentinel-2) satellite data for environmental monitoring and change detection.
- **Geospatial analysis:** Core operations include spatial joins, buffering, intersection, and temporal filtering to correlate vessel tracks, pipeline routes, and oil slick extents.
- **Coordinate reference system:** All data is projected and aligned using the WGS-84 geodetic datum to ensure spatial accuracy across sources.
- **Cartographic design:** The map employs clear symbology, color encoding, and legend elements to communicate spatial relationships and incident chronology.
- **Open geospatial standards:** Data access and interoperability are achieved through OGC-compliant APIs (WMS, WFS, OGC Features).

---

## Data Sources

| Data Source | Type | Role in Analysis |
|---|---|---|
| Sentinel-1 SAR | Radar imagery | Oil slick detection and extent measurement |
| Sentinel-2 L2A | Optical imagery | Visual confirmation and coastal impact assessment |
| SkyTruth Cerulean | Vectorized SAR detections | Temporal slick polygon tracking |
| Global Fishing Watch | AIS telemetry & events | Vessel trajectory reconstruction and behavior analysis |
| NASA GIBS MODIS | Daily composites | Broad-area environmental context |
| ESRI World Imagery | Satellite base layer | High-resolution geographic reference |
| WDPA | Protected area polygons | Environmental impact zone identification |

---

## Data Visualization Approach

This project applies core data science visualization principles to make complex, multi-dimensional geospatial data accessible and interpretable:

### Spatio-Temporal Visualization

- **Animated timeline playback** with sub-hourly resolution (125ms tick rate) — transforms static satellite snapshots into a continuous narrative of the incident unfolding over time
- **Multi-layer map composition** — 10+ independently toggleable data layers allow the viewer to isolate variables, compare patterns, and build causal understanding
- **Temporal interpolation** of vessel positions between sparse AIS waypoints for smooth, continuous trajectory animation

### Satellite Imagery Rendering

- **Sentinel-1 SAR** (radar) — cloud-penetrating imagery processed with polarimetric band math (`VV×3.5, VH×5.0, VV×0.6`) to visualize surface dampening caused by hydrocarbon films
- **Sentinel-2 L2A** (optical) — true-color RGB composition (B04/B03/B02) for visual confirmation
- **NASA MODIS** daily composites — broad-area atmospheric and surface context at 250m/px
- **ESRI World Imagery** — high-resolution base layer for geographic reference

### Vector Data Overlays

- **Oil slick polygons** from SkyTruth Cerulean — SAR-derived slick boundaries rendered as semi-transparent fills with date filtering to show slick evolution
- **Vessel trajectories** — 760+ ships reconstructed from AIS event data (loitering, port visits, encounters), rendered as animated directional arrows with computed bearings
- **Infrastructure mapping** — pipeline routes, platforms, and terminals positioned from PEMEX operational data
- **Protected area boundaries** — Marine Protected Areas (WDPA) overlaid to assess environmental impact

### Visual Encoding & Interaction Design

| Visual Element | Encoding | Purpose |
|---|---|---|
| Arrow direction & rotation | Vessel bearing (heading) | Show movement direction at a glance |
| Arrow color | Fleet affiliation | Distinguish PEMEX, dark vessels, Árbol Grande |
| Pulsating aura | Animation emphasis | Draw attention to the key vessel under investigation |
| Slick fill opacity | Detection confidence | Convey SAR detection strength |
| Dashed vs. solid lines | Pipeline status | Differentiate active infrastructure from incident site |
| Layer toggle panel | User-driven filtering | Enable hypothesis testing by isolating variables |

## GFW Data Extraction Pipeline

The backbone of the vessel analysis is a multi-phase data extraction pipeline built against the [Global Fishing Watch API v3](https://globalfishingwatch.org/our-apis/). GFW provides the world's largest open-access AIS dataset, but extracting a coherent fleet picture from it required careful orchestration:

### Phase 1 — Fleet Discovery

- Queried the **4Wings vessel presence API** with a bounding box covering the Sonda de Campeche AOI (`-97.5,18.0 to -91.3,21.5`) for the incident window (January–March 2026)
- Identified **760+ unique vessels** (by SSVID/MMSI) that transited the area during the period
- Cross-referenced each SSVID against the **GFW vessel registry** (`/vessels/search`) to resolve IMO numbers, flag states, vessel types, and operator names
- Classified vessels into PEMEX-affiliated (24), foreign-flag (700+), and unidentified (dark vessels)

### Phase 2 — Behavioral Event Extraction

- For each vessel, queried **four event datasets** in batched groups of 20 SSVIDs across weekly time windows to stay within API rate limits:
  - **Loitering events** — stationary positions exceeding duration thresholds (hours anchored, distance from shore)
  - **Port visit events** — arrival/departure timestamps and port identifiers
  - **Encounter events** — vessel-to-vessel meetings at sea (potential transfers)
  - **AIS gap events** — periods where transponders were disabled (dark activity)
- Extracted **461 PEMEX loitering events**, **4,509 non-PEMEX loitering events**, and **6 dark vessel track segments**

### Phase 3 — Data Normalization

- Parsed heterogeneous GFW response formats (loitering vs. port visit vs. gap events have different schemas) into a unified `{timestamp, lat, lon, vessel_id}` structure
- Deduplicated overlapping events for the same vessel (a single anchorage can generate multiple loitering records)
- Resolved vessel identity conflicts (same physical ship with different MMSI numbers over time)
- Downsampled high-frequency AIS positions to hourly intervals for manageable dataset size

### Phase 4 — Track Reconstruction

- Fused event positions chronologically per vessel to reconstruct **continuous movement trajectories**
- Generated `pemex-tracks.json` (24 vessels, 2,239 track points), `other-tracks.json` (736 vessels, 19,586 points), and `dark-vessels-tracks.json` (2 vessels, 6 points)
- For **Arbol Grande** specifically, downloaded the full AIS track via the GFW vessel track endpoint (108 high-resolution waypoints) to enable precise interpolation over its 200+ hour anchoring period

## Data Analysis & Narrative Construction

The extracted data was analyzed to build a comprehensive, evidence-based narrative of the incident. Each finding links directly to observable patterns in the visualization:

### Timeline Reconstruction

By synchronizing vessel positions, SAR slick detections, and satellite imagery across the same temporal axis, the platform reveals a clear sequence of events:

1. **Jan 31 – Feb 5**: Arbol Grande departs its home port and transits to the Sonda de Campeche, arriving at coordinates directly above the Old AK-C submarine pipeline
2. **Feb 6**: First SAR detection of hydrocarbon discharge — the slick appears centered on the Arbol Grande's anchoring position
3. **Feb 6 – Feb 17**: Arbol Grande remains stationary for **200+ consecutive hours** while the slick grows from initial detection to ~50 km² peak extent
4. **Feb 9 – Feb 14**: Peak discharge period — daily SAR passes show the slick expanding radially from the pipeline rupture point
5. **Feb 17**: Arbol Grande departs the site; slick persistence continues from residual seepage
6. **Mar 2**: Satellite-confirmed coastal landfall across Veracruz shoreline

### Vessel Behavior Analysis

- **Anchoring anomaly**: Arbol Grande's 200+ hour stationary period directly over a known pipeline is statistically exceptional — no other PEMEX vessel exhibited comparable behavior at that location during the study period
- **Dark vessel correlation**: Two vessels disabled AIS transponders in the immediate vicinity during the peak discharge window, suggesting coordinated activity to avoid monitoring
- **Fleet response pattern**: PEMEX fleet movements show no emergency mobilization consistent with an official spill response, contradicting the scale of the observed discharge

### Spatial Correlation

- The SAR-detected slick origin point, the Arbol Grande anchoring position, and the Old AK-C pipeline route converge within a **< 1 km radius** — establishing a direct spatial link between the vessel, the infrastructure, and the discharge
- Cerulean slick polygons, when filtered by date, show directional spreading consistent with prevailing Gulf currents originating from this convergence point

## Key Findings

- **24 PEMEX-affiliated vessels** identified operating in the AOI during the incident window
- **2 dark vessels** detected with AIS transponders disabled in the spill epicenter
- **Arbol Grande** (IMO 9264867) — diving support vessel anchored 200+ hours directly over the "Old AK C" pipeline rupture point, temporally coinciding with the onset and peak of the discharge
- **50 km² peak slick extent** measured via SAR on February 14, 2026
- **< 1 km spatial convergence** between the vessel position, pipeline route, and slick origin
- **39 coastal communities** impacted across Veracruz, Tabasco, and Tamaulipas

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 + MapLibre GL 4.7.1 | Interactive WebGL map with temporal playback |
| API Proxy | Express.js (Docker) | Secure credential isolation for external APIs |
| Satellite | Copernicus CDSE (OAuth2) | Sentinel-1 SAR + Sentinel-2 optical tile rendering |
| Vessel Data | Global Fishing Watch API v3 | AIS telemetry, behavioral events, vessel registry |
| Slick Detection | SkyTruth Cerulean OGC API | Automated SAR-based oil slick polygon retrieval |
| Deployment | Docker Compose | Containerized dev and production environments |

## Documentation

| Document | Description |
|---|---|
| [docs/installation.md](docs/installation.md) | Prerequisites, setup, and quickstart guide |
| [docs/configuration.md](docs/configuration.md) | Environment variables, API keys, and deployment parameters |
| [docs/architecture.md](docs/architecture.md) | System design, data flow diagrams, and component deep-dive |
| [specs/specs.txt](specs/specs.txt) | Complete capability specification |
| [LICENSE](LICENSE) | MIT License |

## Visual Evidence & Forensic Analysis

### Incident Animation: Vessel, Pipeline, and Oil Slick Dynamics

![Incident Animation](public/data/output1.gif)

The animation above visualizes the spatial and temporal evolution of the 2026 Gulf of Mexico oil spill. Visual encodings:

- **Green lines:** Subsea pipelines operated by Pemex, including the critical "Old AK C" pipeline.
- **Yellow polygons:** Oil slick extents detected by Sentinel-1 SAR and vectorized by the Copernicus/SkyTruth Cerulean API.
- **Blue vessels:** Ships affiliated with Pemex operations, most notably the Árbol Grande (IMO 9264867), a diving support and pipeline repair vessel.

**Key forensic sequence:**

- On **February 7, 2026**, Árbol Grande anchors directly above the Old AK C pipeline and remains stationary until February 18.
- On **February 14**, Sentinel-1 SAR detects a pronounced oil slick precisely at the vessel's location, coinciding with the pipeline route.
- The vessel's prolonged presence and the timing of the slick's emergence strongly implicate a subsea infrastructure failure, rather than a random shipping incident.

Árbol Grande's role is pivotal: as a specialized repair vessel, its 200+ hour anchoring over the pipeline during the discharge window is the strongest available evidence linking the spill to pipeline failure. No comparable behavior was observed from other vessels in the area.

### Satellite Evidence: SAR Oil Slick Detection

![Sentinel-1 SAR Evidence](public/data/output2.gif)

The second video presents a recent Sentinel-1 SAR satellite image. SAR (Synthetic Aperture Radar) is the gold standard for oil spill detection because it can penetrate cloud cover and operate day or night. Oil slicks dampen surface waves, creating distinct dark patches in SAR imagery that correspond to hydrocarbon presence.

**Why Sentinel-1 SAR?**

- **All-weather, day/night capability:** Ensures continuous monitoring regardless of cloud or light conditions.
- **Surface dampening detection:** Oil films reduce backscatter, making slicks visible as dark areas.
- **High spatial resolution:** Enables precise mapping of slick boundaries and correlation with vessel and pipeline locations.

By integrating vessel telemetry (GFW), pipeline infrastructure, and SAR-based slick detection, this project provides a transparent, data-driven reconstruction of the incident, supporting independent forensic analysis.

---

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.

---

*Built with data from [Global Fishing Watch](https://globalfishingwatch.org), [Copernicus Data Space](https://dataspace.copernicus.eu), and [SkyTruth Cerulean](https://cerulean.skytruth.org).*

# PEMEX Oil Spill — Geospatial Data Visualization Platform

## Geographic Information Systems (GIS) Focus

This project is fundamentally a Geographic Information Systems (GIS) application, leveraging advanced spatial analysis and geodata integration to reconstruct and visualize the 2026 Gulf of Mexico oil spill. The platform demonstrates the power of GIS in environmental forensics, combining multiple spatial data sources and temporal layers to provide actionable insight and transparent evidence.

### Key GIS Capabilities Demonstrated

- **Spatial Data Integration:** Merging satellite imagery (SAR, optical), vector infrastructure (pipelines, platforms), vessel telemetry (AIS), and environmental boundaries (protected areas) into a unified geospatial framework.
- **Coordinate Reference Systems:** Accurate handling and transformation of WGS-84 geodetic coordinates for all data layers, ensuring spatial alignment and precision.
- **Geoprocessing & Analysis:** Buffering, intersection, and spatial joins to correlate vessel positions, pipeline routes, and oil slick extents.
- **Temporal GIS:** Synchronizing spatial events across time, enabling spatio-temporal animation and incident chronology reconstruction.
- **Remote Sensing:** Processing and interpreting radar (Sentinel-1 SAR) and optical (Sentinel-2) satellite data for environmental monitoring and change detection.
- **Cartographic Visualization:** Designing effective map symbology, color encoding, and interactive controls for clear communication of complex spatial phenomena.
- **Open Geospatial Standards:** Utilizing OGC-compliant APIs (WMS, WFS, OGC Features) for data access and interoperability.

### GIS Specifications and Requirements

This project implements the following GIS specifications:

- **Spatial data formats:** All geospatial layers are managed in open formats such as GeoJSON for vector data and raster tiles for imagery.
- **Web mapping stack:** Interactive visualization is delivered via MapLibre GL, supporting dynamic rendering and user-driven layer toggling.
- **Satellite remote sensing:** The platform processes and visualizes both radar (Sentinel-1 SAR) and optical (Sentinel-2) satellite data for environmental monitoring and change detection.
- **Geospatial analysis:** Core operations include spatial joins, buffering, intersection, and temporal filtering to correlate vessel tracks, pipeline routes, and oil slick extents.
- **Coordinate reference system:** All data is projected and aligned using the WGS-84 geodetic datum to ensure spatial accuracy across sources.
- **Cartographic design:** The map employs clear symbology, color encoding, and legend elements to communicate spatial relationships and incident chronology.
- **Open geospatial standards:** Data access and interoperability are achieved through OGC-compliant APIs (WMS, WFS, OGC Features).


**A data science project focused on geospatial data visualization, combining satellite imagery, vessel telemetry, and environmental monitoring to reconstruct the 2026 Gulf of Mexico hydrocarbon incident through interactive visual storytelling.**

---

## Problem Statement

On February 6, 2026, Synthetic Aperture Radar (SAR) imagery detected an anomalous hydrocarbon signature in the Sonda de Campeche — Mexico's most critical offshore production zone. Despite official denials, independent satellite monitoring revealed a sustained oil discharge reaching ~50 km² at peak extent, with coastal landfall confirmed by March 2.

This platform was built to answer a single question: **What happened, and who is responsible?**

## Data Visualization Approach

This project applies core data science visualization principles to make complex, multi-dimensional geospatial data accessible and interpretable:

### Spatio-Temporal Visualization

- **Animated timeline playback** with sub-hourly resolution (125ms tick rate) — transforms static satellite snapshots into a continuous narrative of the incident unfolding over time
- **Multi-layer map composition** — 10+ independently toggleable data layers allow the viewer to isolate variables, compare patterns, and build causal understanding
- **Temporal interpolation** of vessel positions between sparse AIS waypoints for smooth, continuous trajectory animation

### Satellite Imagery Rendering

- **Sentinel-1 SAR** (radar) — cloud-penetrating imagery processed with polarimetric band math (`VV×3.5, VH×5.0, VV×0.6`) to visualize surface dampening caused by hydrocarbon films
- **Sentinel-2 L2A** (optical) — true-color RGB composition (B04/B03/B02) for visual confirmation
- **NASA MODIS** daily composites — broad-area atmospheric and surface context at 250m/px
- **ESRI World Imagery** — high-resolution base layer for geographic reference

### Vector Data Overlays

- **Oil slick polygons** from SkyTruth Cerulean — SAR-derived slick boundaries rendered as semi-transparent fills with date filtering to show slick evolution
- **Vessel trajectories** — 760+ ships reconstructed from AIS event data (loitering, port visits, encounters), rendered as animated directional arrows with computed bearings
- **Infrastructure mapping** — pipeline routes, platforms, and terminals positioned from PEMEX operational data
- **Protected area boundaries** — Marine Protected Areas (WDPA) overlaid to assess environmental impact

### Visual Encoding & Interaction Design

| Visual Element | Encoding | Purpose |
|---|---|---|
| Arrow direction & rotation | Vessel bearing (heading) | Show movement direction at a glance |
| Arrow color | Fleet affiliation | Distinguish PEMEX, dark vessels, Árbol Grande |
| Pulsating aura | Animation emphasis | Draw attention to the key vessel under investigation |
| Slick fill opacity | Detection confidence | Convey SAR detection strength |
| Dashed vs. solid lines | Pipeline status | Differentiate active infrastructure from incident site |
| Layer toggle panel | User-driven filtering | Enable hypothesis testing by isolating variables |

## GFW Data Extraction Pipeline

The backbone of the vessel analysis is a multi-phase data extraction pipeline built against the [Global Fishing Watch API v3](https://globalfishingwatch.org/our-apis/). GFW provides the world's largest open-access AIS dataset, but extracting a coherent fleet picture from it required careful orchestration:

### Phase 1 — Fleet Discovery

- Queried the **4Wings vessel presence API** with a bounding box covering the Sonda de Campeche AOI (`-97.5,18.0 to -91.3,21.5`) for the incident window (January–March 2026)
- Identified **760+ unique vessels** (by SSVID/MMSI) that transited the area during the period
- Cross-referenced each SSVID against the **GFW vessel registry** (`/vessels/search`) to resolve IMO numbers, flag states, vessel types, and operator names
- Classified vessels into PEMEX-affiliated (24), foreign-flag (700+), and unidentified (dark vessels)

### Phase 2 — Behavioral Event Extraction

- For each vessel, queried **four event datasets** in batched groups of 20 SSVIDs across weekly time windows to stay within API rate limits:
  - **Loitering events** — stationary positions exceeding duration thresholds (hours anchored, distance from shore)
  - **Port visit events** — arrival/departure timestamps and port identifiers
  - **Encounter events** — vessel-to-vessel meetings at sea (potential transfers)
  - **AIS gap events** — periods where transponders were disabled (dark activity)
- Extracted **461 PEMEX loitering events**, **4,509 non-PEMEX loitering events**, and **6 dark vessel track segments**

### Phase 3 — Data Normalization

- Parsed heterogeneous GFW response formats (loitering vs. port visit vs. gap events have different schemas) into a unified `{timestamp, lat, lon, vessel_id}` structure
- Deduplicated overlapping events for the same vessel (a single anchorage can generate multiple loitering records)
- Resolved vessel identity conflicts (same physical ship with different MMSI numbers over time)
- Downsampled high-frequency AIS positions to hourly intervals for manageable dataset size

### Phase 4 — Track Reconstruction

- Fused event positions chronologically per vessel to reconstruct **continuous movement trajectories**
- Generated `pemex-tracks.json` (24 vessels, 2,239 track points), `other-tracks.json` (736 vessels, 19,586 points), and `dark-vessels-tracks.json` (2 vessels, 6 points)
- For **Arbol Grande** specifically, downloaded the full AIS track via the GFW vessel track endpoint (108 high-resolution waypoints) to enable precise interpolation over its 200+ hour anchoring period

## Data Analysis & Narrative Construction

The extracted data was analyzed to build a comprehensive, evidence-based narrative of the incident. Each finding links directly to observable patterns in the visualization:

### Timeline Reconstruction

By synchronizing vessel positions, SAR slick detections, and satellite imagery across the same temporal axis, the platform reveals a clear sequence of events:

1. **Jan 31 – Feb 5**: Arbol Grande departs its home port and transits to the Sonda de Campeche, arriving at coordinates directly above the Old AK-C submarine pipeline
2. **Feb 6**: First SAR detection of hydrocarbon discharge — the slick appears centered on the Arbol Grande's anchoring position
3. **Feb 6 – Feb 17**: Arbol Grande remains stationary for **200+ consecutive hours** while the slick grows from initial detection to ~50 km² peak extent
4. **Feb 9 – Feb 14**: Peak discharge period — daily SAR passes show the slick expanding radially from the pipeline rupture point
5. **Feb 17**: Arbol Grande departs the site; slick persistence continues from residual seepage
6. **Mar 2**: Satellite-confirmed coastal landfall across Veracruz shoreline

### Vessel Behavior Analysis

- **Anchoring anomaly**: Arbol Grande's 200+ hour stationary period directly over a known pipeline is statistically exceptional — no other PEMEX vessel exhibited comparable behavior at that location during the study period
- **Dark vessel correlation**: Two vessels disabled AIS transponders in the immediate vicinity during the peak discharge window, suggesting coordinated activity to avoid monitoring
- **Fleet response pattern**: PEMEX fleet movements show no emergency mobilization consistent with an official spill response, contradicting the scale of the observed discharge

### Spatial Correlation

- The SAR-detected slick origin point, the Arbol Grande anchoring position, and the Old AK-C pipeline route converge within a **< 1 km radius** — establishing a direct spatial link between the vessel, the infrastructure, and the discharge
- Cerulean slick polygons, when filtered by date, show directional spreading consistent with prevailing Gulf currents originating from this convergence point

## Data Sources

| Data Source | Type | Role in Analysis |
|---|---|---|
| Sentinel-1 SAR | Radar imagery | Oil slick detection and extent measurement |
| Sentinel-2 L2A | Optical imagery | Visual confirmation and coastal impact assessment |
| SkyTruth Cerulean | Vectorized SAR detections | Temporal slick polygon tracking |
| Global Fishing Watch | AIS telemetry & events | Vessel trajectory reconstruction and behavior analysis |
| NASA GIBS MODIS | Daily composites | Broad-area environmental context |
| ESRI World Imagery | Satellite base layer | High-resolution geographic reference |
| WDPA | Protected area polygons | Environmental impact zone identification |

## Key Findings

- **24 PEMEX-affiliated vessels** identified operating in the AOI during the incident window
- **2 dark vessels** detected with AIS transponders disabled in the spill epicenter
- **Arbol Grande** (IMO 9264867) — diving support vessel anchored 200+ hours directly over the "Old AK C" pipeline rupture point, temporally coinciding with the onset and peak of the discharge
- **50 km² peak slick extent** measured via SAR on February 14, 2026
- **< 1 km spatial convergence** between the vessel position, pipeline route, and slick origin
- **39 coastal communities** impacted across Veracruz, Tabasco, and Tamaulipas

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 + MapLibre GL 4.7.1 | Interactive WebGL map with temporal playback |
| API Proxy | Express.js (Docker) | Secure credential isolation for external APIs |
| Satellite | Copernicus CDSE (OAuth2) | Sentinel-1 SAR + Sentinel-2 optical tile rendering |
| Vessel Data | Global Fishing Watch API v3 | AIS telemetry, behavioral events, vessel registry |
| Slick Detection | SkyTruth Cerulean OGC API | Automated SAR-based oil slick polygon retrieval |
| Deployment | Docker Compose | Containerized dev and production environments |

## Documentation

| Document | Description |
|---|---|
| [docs/installation.md](docs/installation.md) | Prerequisites, setup, and quickstart guide |
| [docs/configuration.md](docs/configuration.md) | Environment variables, API keys, and deployment parameters |
| [docs/architecture.md](docs/architecture.md) | System design, data flow diagrams, and component deep-dive |
| [specs/specs.txt](specs/specs.txt) | Complete capability specification |
| [LICENSE](LICENSE) | MIT License |


## Visual Evidence & Forensic Analysis

### Incident Animation: Vessel, Pipeline, and Oil Slick Dynamics

![Incident Animation](public/data/output1.gif)

The animation above visualizes the spatial and temporal evolution of the 2026 Gulf of Mexico oil spill. Visual encodings:

- **Green lines:** Subsea pipelines operated by Pemex, including the critical "Old AK C" pipeline.
- **Yellow polygons:** Oil slick extents detected by Sentinel-1 SAR and vectorized by the Copernicus/SkyTruth Cerulean API.
- **Blue vessels:** Ships affiliated with Pemex operations, most notably the Árbol Grande (IMO 9264867), a diving support and pipeline repair vessel.

**Key forensic sequence:**

- On **February 7, 2026**, Árbol Grande anchors directly above the Old AK C pipeline and remains stationary until February 18.
- On **February 14**, Sentinel-1 SAR detects a pronounced oil slick precisely at the vessel's location, coinciding with the pipeline route.
- The vessel's prolonged presence and the timing of the slick's emergence strongly implicate a subsea infrastructure failure, rather than a random shipping incident.

Árbol Grande's role is pivotal: as a specialized repair vessel, its 200+ hour anchoring over the pipeline during the discharge window is the strongest available evidence linking the spill to pipeline failure. No comparable behavior was observed from other vessels in the area.

### Satellite Evidence: SAR Oil Slick Detection

![Sentinel-1 SAR Evidence](public/data/output2.gif)

The second video presents a recent Sentinel-1 SAR satellite image. SAR (Synthetic Aperture Radar) is the gold standard for oil spill detection because it can penetrate cloud cover and operate day or night. Oil slicks dampen surface waves, creating distinct dark patches in SAR imagery that correspond to hydrocarbon presence.

**Why Sentinel-1 SAR?**

- **All-weather, day/night capability:** Ensures continuous monitoring regardless of cloud or light conditions.
- **Surface dampening detection:** Oil films reduce backscatter, making slicks visible as dark areas.
- **High spatial resolution:** Enables precise mapping of slick boundaries and correlation with vessel and pipeline locations.

By integrating vessel telemetry (GFW), pipeline infrastructure, and SAR-based slick detection, this project provides a transparent, data-driven reconstruction of the incident, supporting independent forensic analysis.

---
## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.

---

*Built with data from [Global Fishing Watch](https://globalfishingwatch.org), [Copernicus Data Space](https://dataspace.copernicus.eu), and [SkyTruth Cerulean](https://cerulean.skytruth.org).*
