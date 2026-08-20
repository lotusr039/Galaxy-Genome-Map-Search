(function () {
  const YEARS_PER_PIXEL = 43.74;
  const SOL_MAP_X = 1025;
  const SOL_MAP_Y = 1591;
  const ZONE_ANGLE = Math.PI / 6;
  const ZONE_PIXELS = 10000 / YEARS_PER_PIXEL;

  function sectorId(mapX, mapY) {
    let angle = Math.PI - Math.atan2(-(SOL_MAP_Y - mapY), SOL_MAP_X - mapX);
    if (angle < 0) angle += Math.PI * 2;
    const angleSector = Math.floor(angle / ZONE_ANGLE);
    const ring = Math.trunc(Math.trunc(Math.hypot(SOL_MAP_X - mapX, SOL_MAP_Y - mapY)) / ZONE_PIXELS);
    const index = angleSector * 8 + ring;
    return index >= 96 ? 0 : index;
  }

  function buildSectorCenters() {
    const centers = Array.from({ length: 96 }, () => null);
    for (let x = 1; x < 2048; x += 20) {
      for (let y = 1; y < 2048; y += 20) {
        const index = sectorId(x, y);
        if (centers[index]) continue;
        const angleSector = Math.floor(index / 8);
        const ring = index % 8;
        const radius = Math.trunc(ring * ZONE_PIXELS + ZONE_PIXELS / 2);
        const middle = angleSector * ZONE_ANGLE + ZONE_ANGLE / 2;
        centers[index] = {
          x: Math.trunc(radius * Math.cos(middle)) + SOL_MAP_X,
          y: Math.trunc(radius * Math.sin(middle)) + SOL_MAP_Y
        };
      }
    }
    return centers;
  }

  function decodePair(value) {
    if (value.length !== 2 || value.charCodeAt(0) < 65 ||
        value.charCodeAt(1) < 97 || value.charCodeAt(1) > 122) return null;
    return (value.charCodeAt(0) - 65) * 26 + value.charCodeAt(1) - 97;
  }

  function encodePair(value) {
    return String.fromCharCode(Math.floor(value / 26) + 65) +
      String.fromCharCode(value % 26 + 97);
  }

  function encodeCell(mapX, mapY, starId, sectors, centers) {
    const index = sectorId(mapX, mapY);
    const center = centers[index];
    if (!center || !sectors[index]) return null;
    let dx = center.x - mapX;
    let dy = center.y - mapY;
    let quadrant = 1;
    if (dx < 0 && dy > 0) quadrant = 4;
    else if (dx > 0 && dy > 0) quadrant = 1;
    else if (dx < 0 && dy < 0) quadrant = 3;
    else if (dx > 0 && dy < 0) quadrant = 2;
    dx = Math.abs(dx);
    dy = Math.abs(dy);
    return `${sectors[index].Name} ${encodePair(dx)}-${encodePair(dy)} ${String.fromCharCode(quadrant + 65)}${starId}`;
  }

  function parseName(input, sectors, centers) {
    const match = input.match(/^(.+?)\s+(.{2})-(.{2})\s+([B-E])(\d+)$/i);
    if (!match) return null;
    const index = sectors.findIndex(sector =>
      String(sector.Name).toLocaleLowerCase() === match[1].toLocaleLowerCase());
    const offsetX = decodePair(match[2]);
    const offsetY = decodePair(match[3]);
    const quadrant = match[4].toUpperCase().charCodeAt(0) - 65;
    const starId = Number(match[5]);
    if (index < 0 || offsetX == null || offsetY == null ||
        !Number.isInteger(starId) || starId < 0 || starId > 255) return null;
    const center = centers[index];
    if (!center) return null;
    let dx = offsetX;
    let dy = offsetY;
    if (quadrant === 4) dx *= -1;
    else if (quadrant === 3) { dx *= -1; dy *= -1; }
    else if (quadrant === 2) dy *= -1;
    const candidates = [{ mapX:center.x-dx, mapY:center.y-dy }];
    // GetSecName leaves quadrant B unchanged when either signed offset is 0,
    // so the original format loses the sign on the other axis.
    if (quadrant === 1 && offsetX === 0 && offsetY > 0)
      candidates.push({ mapX:center.x, mapY:center.y+offsetY });
    else if (quadrant === 1 && offsetY === 0 && offsetX > 0)
      candidates.push({ mapX:center.x+offsetX, mapY:center.y });
    return { sectorIndex:index, mapX:candidates[0].mapX, mapY:candidates[0].mapY, starId, candidates };
  }

  const api = { sectorId, buildSectorCenters, encodeCell, parseName };
  globalThis.GalaxyNaming = api;
  if (typeof window !== "undefined") window.GalaxyNaming = api;
})();
