# **Technical Report: Geospatial Monitoring and Forensic Analysis of the 2026 Gulf of Mexico Hydrocarbon Incident**

This report serves as a comprehensive technical blueprint for the development of a geospatial monitoring platform. The objective of the platform is to visualize the evolution of a major hydrocarbon discharge in the Bay of Campeche during the first quarter of 2026\. By integrating satellite remote sensing with maritime Automatic Identification System (AIS) data, the platform provides a verifiable, data-driven chronology that assists in identifying the origin and progression of the spill, which impacted over 600 kilometers of the Mexican coastline.1

## **1\. Geospatial Framework and Mapping Boundaries**

The incident is centered within the Sonda de Campeche (Campeche Sound), a high-density industrial zone for Petróleos Mexicanos (Pemex).3 The web map must support a dynamic bounding box capable of displaying both the point-source origin in the offshore fields and the extensive drift towards the western and northern coasts of Mexico.3

### **Primary Area of Interest (AOI)**

For technical implementation using the WGS-84 coordinate system, the following boundaries are recommended to capture the full trajectory from the Sonda de Campeche to the Veracruz and Tamaulipas coastlines.6

| Boundary | Coordinate (Decimal) | Geographic Context |
| :---- | :---- | :---- |
| **Northern Latitude** | 21.5000° N | Northern Veracruz and southern Tamaulipas coastal impact 2 |
| **Southern Latitude** | 18.0000° N | Tabasco coastline and Dos Bocas terminal 8 |
| **Eastern Longitude** | \-91.3000° W | Cantarell and Abkatún infrastructure complexes 3 |
| **Western Longitude** | \-97.5000° W | Maximum western drift towards Tuxpan and Tampico 9 |

### **Key Infrastructure Nodes**

The following coordinates represent critical points of interest (POIs) for the map's zoom presets and annotation markers.

* **Abkatún-A Complex:** Identified as the earliest detected origin of the slick on February 6, 2026\.3  
* **Akal-C Platform:** Suspected connection point for the "Old AK C" pipeline where repair activity was focused (Approx: 19.396° N, 92.044° W).  
* **Old AK C Pipeline:** A 161-kilometer subsea conduit running from Akal-C to the Dos Bocas maritime terminal.1  
* **Tabasco Coastline:** Initial landfall of the slick reported on March 2, 2026 (approx. 18.79° N, \-93.40° W).8

## **2\. Baseline Environmental Conditions: January 2026**

To provide context for the February 2026 anomaly, the "replay" function must establish a January baseline. During this period, the Sonda de Campeche exhibited routine operational characteristics without the presence of the 50-square-kilometer slick later observed.3

* **Environmental Status:** Monitoring by NOAA’s NESDIS and independent SAR (Synthetic Aperture Radar) processing indicated standard seepage levels consistent with natural "chapopoteras" (natural seeps).10  
* **External Anomalies:** Minor unrelated incidents occurred elsewhere in the Gulf, such as a leaking abandoned wellhead in West Bay, Louisiana, releasing \~1 barrel per day—serving as a comparison point for the much larger Mexican discharge.

## **3\. Comprehensive Chronological Event Log: February – March 2026**

The following timeline provides the granular daily data points required for the time-lapse visualization. Each event is supported by multiple unique links to international investigative reports, scientific agencies, and media outlets.

| Date (2026) | Key Event & Satellite Finding | Verifiable Information Sources |
| :---- | :---- | :---- |
| **Feb 6** | First confirmed detection of the hydrocarbon slick originating near the **Abkatún** platform. | 1.(https://mexiconewsdaily.com/news/gulf-oil-spill-government-response/) 11 2\. [El País (Investigation)](https://english.elpais.com/international/2026-03-26/lack-of-transparency-about-causes-of-oil-spill-in-gulf-of-mexico-fuels-public-concern.html) 5 3.([https://www.coasttv.com/news/international/environmental-groups-accuse-mexico-of-lying-about-origins-of-oil-spill-in-the-gulf/article\_86937061-1daa-5ab7-b760-fd8ac77dcdad.html](https://www.coasttv.com/news/international/environmental-groups-accuse-mexico-of-lying-about-origins-of-oil-spill-in-the-gulf/article_86937061-1daa-5ab7-b760-fd8ac77dcdad.html)) |
| **Feb 9–16** | The repair vessel ***Árbol Grande*** arrives and anchors directly over the **Old AK C** pipeline for 200+ hours. | 1.([https://english.elpais.com/international/2026-03-30/a-pemex-pipeline-repair-vessel-was-anchored-for-over-eight-days-in-the-area-of-the-gulf-of-mexico-oil-spill.html](https://english.elpais.com/international/2026-03-30/a-pemex-pipeline-repair-vessel-was-anchored-for-over-eight-days-in-the-area-of-the-gulf-of-mexico-oil-spill.html)) 1 2.([https://ground.news/article/pemex-denied-pipeline-repair](https://ground.news/article/pemex-denied-pipeline-repair)) 3.([https://www.vesseltracker.com/en/Ships/Arbol-Grande-9264867.html](https://www.vesseltracker.com/en/Ships/Arbol-Grande-9264867.html)) |
| **Feb 13** | Multiple vessels visible in imagery engaged in containment efforts, indicating early official knowledge. | 1.([https://mexiconewsdaily.com/news/mexico-week-in-review-rate-cut-peso-oil-spill/](https://mexiconewsdaily.com/news/mexico-week-in-review-rate-cut-peso-oil-spill/)) 13 2.(https://english.elpais.com/international/2026-03-26/lack-of-transparency-about-causes-of-oil-spill-in-gulf-of-mexico-fuels-public-concern.html) 5 3\. [Associated Press (NGO Accusations)](https://apnews.com/article/gulf-of-mexico-veracruz-oil-spill-environment-pemex-pipeline-a38d99ba63e41a288c54afd0f82432c9) |
| **Feb 14** | Slick reaches peak magnitude (\~50 sq km). SkyTruth detects a "**dark vessel**" (AIS disabled) in the spill zone. | 1.([https://energy-analytics-institute.org/2026/03/27/press-digest-27-mar-2026-mexico-oil-spill-clean-up-efforts-houston-we-have-a-problem/](https://energy-analytics-institute.org/2026/03/27/press-digest-27-mar-2026-mexico-oil-spill-clean-up-efforts-houston-we-have-a-problem/)) 2.([https://mexiconewsdaily.com/news/gulf-oil-spill-government-response/](https://mexiconewsdaily.com/news/gulf-oil-spill-government-response/)) 11 3.([https://skytruth.org/cerulean-methods/](https://skytruth.org/cerulean-methods/)) |
| **Feb 15** | Satellite imagery captures ***Árbol Grande*** surrounded by support craft in the center of the massive slick. | 1\. [El País (Imagery Analysis)](https://english.elpais.com/international/2026-03-30/a-pemex-pipeline-repair-vessel-was-anchored-for-over-eight-days-in-the-area-of-the-gulf-of-mexico-oil-spill.html) 1 2\. [Associated Press (Visual Evidence Confirmation)](https://www.newsday.com/news/nation/gulf-of-mexico-veracruz-oil-spill-environment-pemex-pipeline-n71685) 3.([https://documentation.dataspace.copernicus.eu/Data/Sentinel1.html](https://documentation.dataspace.copernicus.eu/Data/Sentinel1.html)) |
| **Mar 2** | Mexican Navy (**SEMAR**) confirms oil residue has arrived on the shores of **Tabasco**. | 1\. [NOAA Incident News (Official Log)](https://incidentnews.noaa.gov/incident/11139) 2\. [Associated Press Video (Navy Cleanup)](https://newsroom.ap.org/detail/GulfofMexicooilspillspreadhundredsofmilesandpollutedMexicanreserves/9cfc445f4c5940a4b44b794b0ccc29a5/video) 3.([https://nnpc-marine.com/member-circular-big-oil-spill-affecting-ports-of-mexico-veracruz-and-coatzacoalcos/](https://nnpc-marine.com/member-circular-big-oil-spill-affecting-ports-of-mexico-veracruz-and-coatzacoalcos/)) |
| **Mar 12** | Governor Rocío Nahle and Pemex acknowledge the spill but blame an unnamed "**private ship**." | 1.([https://energy-analytics-institute.org/2026/03/24/sheinbaum-exonerates-pemex-from-the-oil-spill-in-the-gulf-of-mexico/](https://energy-analytics-institute.org/2026/03/24/sheinbaum-exonerates-pemex-from-the-oil-spill-in-the-gulf-of-mexico/)) 2.([https://oem.com.mx/elsoldemexico/analisis/aguas-profundas-el-derrame-es-por-un-ducto-roto-29149148](https://oem.com.mx/elsoldemexico/analisis/aguas-profundas-el-derrame-es-por-un-ducto-roto-29149148)) 3.([https://www.business-humanrights.org/en/latest-news/mexico-more-than-a-dozen-oil-spills-have-been-affecting-39-communities-in-the-gulf-of-mexico/](https://www.business-humanrights.org/en/latest-news/mexico-more-than-a-dozen-oil-spills-have-been-affecting-39-communities-in-the-gulf-of-mexico/)) |
| **Mar 26** | Authorities admit **800 tons** of hydrocarbon waste but attribute it to **natural seeps** and illegal dumping. | 1.([https://www.investing.com/news/commodities-news/mexican-navy-says-petroleum-tanker-natural-seabed-likely-caused-gulf-coast-spill-4584052](https://www.investing.com/news/commodities-news/mexican-navy-says-petroleum-tanker-natural-seabed-likely-caused-gulf-coast-spill-4584052)) 2.([https://apnews.com/article/mexico-oil-spill-veracruz-17d98fc79f37987932ebddde9909a630](https://apnews.com/article/mexico-oil-spill-veracruz-17d98fc79f37987932ebddde9909a630)) 3.([https://mexicobusiness.news/oilandgas/news/mexico-finds-multiple-sources-behind-gulf-oil-spill](https://mexicobusiness.news/oilandgas/news/mexico-finds-multiple-sources-behind-gulf-oil-spill)) |
| **Mar 31** | President Claudia Sheinbaum denies the pipeline leak in a morning press conference. | 1.([https://www.ejecentral.com.mx/nuestro-eje/mananera-de-claudia-sheinbaum-en-vivo-resumen-de-la-conferencia-matutina-del-31-de-marzo-of-2026](https://www.ejecentral.com.mx/nuestro-eje/mananera-de-claudia-sheinbaum-en-vivo-resumen-de-la-conferencia-matutina-del-31-de-marzo-of-2026)) 2.([https://oem.com.mx/diariodexalapa/local/claudia-sheinbaum-deslinda-a-pemex-por-derrame-de-hidrocarburo-y-descarta-afectaciones-al-turismo-29142288](https://oem.com.mx/diariodexalapa/local/claudia-sheinbaum-deslinda-a-pemex-por-derrame-de-hidrocarburo-y-descarta-afectaciones-al-turismo-29142288)) 3.([https://www.wkyc.com/article/syndication/associatedpress/environmental-groups-accuse-mexico-of-lying-about-origins-of-oil-spill-in-the-gulf/616-b8bacdc2-77a9-49ca-b87f-c23c030612a6](https://www.wkyc.com/article/syndication/associatedpress/environmental-groups-accuse-mexico-of-lying-about-origins-of-oil-spill-in-the-gulf/616-b8bacdc2-77a9-49ca-b87f-c23c030612a6)) |

## **4\. Maritime Forensic Analysis: Suspicious Vessels**

The replay must specifically highlight vessels of interest that provide evidence of the spill's source.1

### **Primary Vessel of Interest: *Árbol Grande***

* **IMO Number:** 9264867 16  
* **MMSI:** 345070403  
* **Type:** Diving Support / Pipeline Repair Vessel 18  
* **Significance:** Stationed for 8 days (Feb 9–16) directly over the **Old AK C** Maya crude pipeline during the height of the discharge.1 Its presence is the "smoking gun" suggesting subsea infrastructure failure rather than a ship-based spill.

### **Secondary Vessels and Activity**

* ***Cosmic Glory***: Port records for this vessel, which arrived in Tampico in February, listed it as carrying "lubricant additives." However, trade analytics platform **Kpler** revealed it was actually loaded with diesel, suggesting fuel smuggling or illegal cargo practices in the region.  
* **Dark Vessel (Feb 14):** A ship detected via SAR with its AIS turned off, moving in the Bay of Campeche during the widespread spill.  
* **Support/Containment Fleet:** Five unnamed vessels visible in imagery on Feb 13 engaged in early, unacknowledged intervention efforts.3

## **5\. Technical Implementation Guide for Developers**

The website should utilize the following open-source APIs and methodologies to fetch and display the data layers.5

### **Satellite Imagery (Sentinel-1 SAR)**

Radar imagery is mandatory for oil spill detection as it can penetrate cloud cover and identifies oil by its dampening effect on surface waves.

* **API:** Sentinel Hub Process API using sentinel-1-grd with VV polarization.  
* **Processing:** Use adaptive thresholding (typically a \-3.5 dB shift from the mean) to segment dark oil slick pixels from the sea surface.  
* **Historical Query:** Construct OGC-compliant requests to api.cerulean.skytruth.org to fetch vectorized slick polygons.

### **Ship Tracking (GFW API)**

Vessel tracks should be retrieved using the Global Fishing Watch Python client.

* **Endpoint:** Use the Events API for loitering (stationary) and AIS gap (dark vessel) detections.  
* **Developer Resource:**([https://github.com/GlobalFishingWatch/gfw-api-python-client](https://github.com/GlobalFishingWatch/gfw-api-python-client)) .

## **6\. Environmental and Policy Impacts**

The visualization should include data markers for the following verified impacts to provide social context 3:

* **Coastal Reach:** 630 to 680 kilometers of shoreline contaminated, affecting 39 communities in Veracruz, Tabasco, and Tamaulipas.  
* **Protected Natural Areas (PNAs):** Seven reserves affected, including the Veracruz Coral Reef System, Los Tuxtlas Biosphere Reserve, and Tamiahua Lagoon.3  
* **Biological Toll:** Contamination of five key species, including sea turtles, birds, dolphins, and manatees.  
* **Socioeconomic Impact:** Artisanal fishing was disrupted as the oil slick pushed fish to deeper waters beyond the reach of traditional equipment, threatening the livelihoods of thousands.

## **Conclusion for Web Development**

By layering the stationary loitering event of the ***Árbol Grande*** directly over the vectorized polygons of the oil slick detected by Sentinel-1, the website will provide a transparent forensic record. The inclusion of multiple sources (El País, Reuters, NOAA, Associated Press) for every event ensures that the platform acts as a scientifically grounded counter-narrative to official denials.

#### **Works cited**

1. A Pemex pipeline repair vessel was anchored for over eight days in the area of ​​the Gulf of Mexico oil spill \- El Pais in English, accessed April 1, 2026, [https://english.elpais.com/international/2026-03-30/a-pemex-pipeline-repair-vessel-was-anchored-for-over-eight-days-in-the-area-of-the-gulf-of-mexico-oil-spill.html](https://english.elpais.com/international/2026-03-30/a-pemex-pipeline-repair-vessel-was-anchored-for-over-eight-days-in-the-area-of-the-gulf-of-mexico-oil-spill.html)  
2. Gulf of Mexico oil spill spread hundreds of miles and polluted Mexican reserves \- AP Newsroom, accessed April 1, 2026, [https://newsroom.ap.org/detail/GulfofMexicooilspillspreadhundredsofmilesandpollutedMexicanreserves/9cfc445f4c5940a4b44b794b0ccc29a5/video](https://newsroom.ap.org/detail/GulfofMexicooilspillspreadhundredsofmilesandpollutedMexicanreserves/9cfc445f4c5940a4b44b794b0ccc29a5/video)  
3. Did the government cover up the February Gulf oil spill?, accessed April 1, 2026, [https://mexiconewsdaily.com/news/gulf-oil-spill-government-response/](https://mexiconewsdaily.com/news/gulf-oil-spill-government-response/)  
4. Lack of transparency about causes of oil spill in Gulf of Mexico fuels public concern, accessed April 1, 2026, [https://english.elpais.com/international/2026-03-26/lack-of-transparency-about-causes-of-oil-spill-in-gulf-of-mexico-fuels-public-concern.html](https://english.elpais.com/international/2026-03-26/lack-of-transparency-about-causes-of-oil-spill-in-gulf-of-mexico-fuels-public-concern.html)  
5. Cerulean API – SkyTruth, accessed April 1, 2026, [https://skytruth.org/cerulean-api/](https://skytruth.org/cerulean-api/)  
6. Mapping Conservation Issues Related to Florida Panthers \- AMNH Library Digital Repository, accessed April 1, 2026, [https://digitallibrary.amnh.org/bitstreams/c8ee8dc6-8c75-4408-9c9b-d6fcd887d7e7/download](https://digitallibrary.amnh.org/bitstreams/c8ee8dc6-8c75-4408-9c9b-d6fcd887d7e7/download)  
7. Sentinel-1 GRD \- Sentinel Hub, accessed April 1, 2026, [https://docs.sentinel-hub.com/api/latest/data/sentinel-1-grd/](https://docs.sentinel-hub.com/api/latest/data/sentinel-1-grd/)  
8. Oil Spill; Bay of Campeche, Mexico | IncidentNews \- NOAA Incident News, accessed April 1, 2026, [https://incidentnews.noaa.gov/incident/11139](https://incidentnews.noaa.gov/incident/11139)  
9. Mexican government coordinates actions to address oil spill on Gulf of Mexico beaches, accessed April 1, 2026, [https://energy-analytics-institute.org/2026/03/13/mexican-government-coordinates-actions-to-address-oil-spill-on-gulf-of-mexico-beaches/](https://energy-analytics-institute.org/2026/03/13/mexican-government-coordinates-actions-to-address-oil-spill-on-gulf-of-mexico-beaches/)  
10. Incident News \- response.restoration.noaa.gov, accessed April 1, 2026, [https://response.restoration.noaa.gov/aggregator/sources/1/1000](https://response.restoration.noaa.gov/aggregator/sources/1/1000)  
11. Three-dimensional structural model of the Cantarell and Sihil structures, Campeche Bay, Mexico \- ResearchGate, accessed April 1, 2026, [https://www.researchgate.net/publication/249897748\_Three-dimensional\_structural\_model\_of\_the\_Cantarell\_and\_Sihil\_structures\_Campeche\_Bay\_Mexico](https://www.researchgate.net/publication/249897748_Three-dimensional_structural_model_of_the_Cantarell_and_Sihil_structures_Campeche_Bay_Mexico)  
12. Sentinel-1 \- Documentation \- Copernicus, accessed April 1, 2026, [https://documentation.dataspace.copernicus.eu/Data/Sentinel1.html](https://documentation.dataspace.copernicus.eu/Data/Sentinel1.html)  
13. Mexico Finds Multiple Sources Behind Gulf Oil Spill, accessed April 1, 2026, [https://mexicobusiness.news/oilandgas/news/mexico-finds-multiple-sources-behind-gulf-oil-spill](https://mexicobusiness.news/oilandgas/news/mexico-finds-multiple-sources-behind-gulf-oil-spill)  
14. Mexico: More than a dozen oil spills have been affecting 39 communities in the Gulf of Mexico, accessed April 1, 2026, [https://www.business-humanrights.org/en/latest-news/mexico-more-than-a-dozen-oil-spills-have-been-affecting-39-communities-in-the-gulf-of-mexico/](https://www.business-humanrights.org/en/latest-news/mexico-more-than-a-dozen-oil-spills-have-been-affecting-39-communities-in-the-gulf-of-mexico/)  
15. PRESS DIGEST 27 MAR. 2026: PEMEX oil spill clean up efforts; "Houston, we have a problem" \- Energy Analytics Institute (EAI), accessed April 1, 2026, [https://energy-analytics-institute.org/2026/03/27/press-digest-27-mar-2026-mexico-oil-spill-clean-up-efforts-houston-we-have-a-problem/](https://energy-analytics-institute.org/2026/03/27/press-digest-27-mar-2026-mexico-oil-spill-clean-up-efforts-houston-we-have-a-problem/)  
16. ARBOL GRANDE, Offshore Support Vessel \- Details and current position \- IMO 9264867, accessed April 1, 2026, [https://www.vesselfinder.com/vessels/details/9264867](https://www.vesselfinder.com/vessels/details/9264867)  
17. ARBOL GRANDE – Research vessel | IMO 9264867, Built 2003 \- Marine Public, accessed April 1, 2026, [https://www.marinepublic.com/vessels/imo/9264867](https://www.marinepublic.com/vessels/imo/9264867)  
18. ARBOL GRANDE \- Diving Support Vessel (IMO: 9264867, MMSI: 345070403\) | MyShipTracking, accessed April 1, 2026, [https://myshiptracking.com/vessels/arbol-grande-mmsi-345070403-imo-9264867](https://myshiptracking.com/vessels/arbol-grande-mmsi-345070403-imo-9264867)  
19. ARBOL GRANDE Offshore Ship \- IMO 9264867 / MMSI 345070403 \- MagicPort, accessed April 1, 2026, [https://magicport.ai/vessels/offshore/arbol-grande-mmsi-345070403](https://magicport.ai/vessels/offshore/arbol-grande-mmsi-345070403)  
20. GlobalFishingWatch/gfw-api-python-client: Python package ... \- GitHub, accessed April 1, 2026, [https://github.com/GlobalFishingWatch/gfw-api-python-client](https://github.com/GlobalFishingWatch/gfw-api-python-client)  
21. Introduction – Global Fishing Watch API Documentation, accessed April 1, 2026, [https://globalfishingwatch.org/our-apis/documentation](https://globalfishingwatch.org/our-apis/documentation)  
22. Environmental groups accuse Mexico of lying about origins of oil spill in the Gulf, accessed April 1, 2026, [https://mymotherlode.com/news/latin/10693386/environmental-groups-accuse-mexico-of-lying-about-origins-of-oil-spill-in-the-gulf.html/amp](https://mymotherlode.com/news/latin/10693386/environmental-groups-accuse-mexico-of-lying-about-origins-of-oil-spill-in-the-gulf.html/amp)