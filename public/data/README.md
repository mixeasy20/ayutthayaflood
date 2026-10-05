# Ayutthaya Province Boundary

`ayutthaya-province.geojson` contains the ADM1 Polygon with `shapeISO` `TH-14` and `shapeName` `Phra Nakhon Si Ayutthaya Province`.

- Dataset: geoBoundaries `gbOpen`, Thailand ADM1
- Boundary ID: `THA-ADM1-36821470`
- Year represented: 2017
- Boundary source: OpenStreetMap, Wambacher
- License: Open Data Commons Open Database License 1.0 (ODbL)
- Dataset metadata: https://www.geoboundaries.org/api/current/gbOpen/THA/ADM1/
- Pinned source GeoJSON: https://github.com/wmgeolab/geoBoundaries/raw/9469f09592ced973a3448cf66b6100b741b64c0d/releaseData/gbOpen/THA/ADM1/geoBoundaries-THA-ADM1_simplified.geojson

The local GeoJSON contains only the `TH-14` province feature from the source FeatureCollection. It is geographic boundary data, not flood data.

## District Boundaries

`ayutthaya-districts.geojson` contains 16 ADM2 district polygons sourced from geoBoundaries `gbOpen`, Thailand. Each feature has a stable `districtCode` from its source `shapeID`, the source English `districtName`, and a `labelPoint` derived from its clipped geometry. Geometry is intersected with the local `TH-14` ADM1 polygon so district edges do not extend beyond the displayed province boundary.

- Boundary ID: `THA-ADM2-78962969`
- Year represented: 2019
- Boundary source: Royal Thai Survey Department, OCHA ROAP
- License: Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)
- Dataset metadata: https://www.geoboundaries.org/api/current/gbOpen/THA/ADM2/
- Pinned source GeoJSON: https://github.com/wmgeolab/geoBoundaries/raw/9469f09592ced973a3448cf66b6100b741b64c0d/releaseData/gbOpen/THA/ADM2/geoBoundaries-THA-ADM2_simplified.geojson

The source ADM2 GeoJSON has English `shapeName` values. Thai UI labels are mapped by stable `districtCode` in `lib/i18n.ts`; no label coordinates are hard-coded.