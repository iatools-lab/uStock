export const project = ([lon, lat]) => [lon * 100 * Math.cos(7 * Math.PI / 180), -lat * 100];
export function geometryRings(geometry) { return geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat(); }
export function geometryPoints(geometry) { return geometryRings(geometry).flat().map(project); }
export function geometryPath(geometry) {
  return geometryRings(geometry).map(ring => ring.map((p, i) => `${i ? 'L' : 'M'}${project(p).map(n => n.toFixed(2)).join(',')}`).join(' ') + 'Z').join(' ');
}
export function fitMap(points, minimum = 35) {
  if (!points.length) return [820, -1360, 1060, 795];
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
  const height = Math.max(minimum, (bottom - top) * 1.3, (right - left) * 1.3 * .75);
  const width = height * 4 / 3;
  return [(left + right - width) / 2, (top + bottom - height) / 2, width, height];
}
