import { CircleMarker, MapContainer, TileLayer, useMapEvents } from 'react-leaflet';

function PontoSelecionavel({ value, onChange }) {
  useMapEvents({ click(e) { onChange({ latitude: e.latlng.lat, longitude: e.latlng.lng }); } });
  return value ? <CircleMarker center={[value.latitude, value.longitude]} radius={10} pathOptions={{ color: '#d4af37', fillColor: '#d4af37', fillOpacity: .8 }} /> : null;
}

export default function LocationMapPicker({ latitude, longitude, onChange }) {
  const point = latitude && longitude ? { latitude: Number(latitude), longitude: Number(longitude) } : null;
  const center = point ? [point.latitude, point.longitude] : [-14.235, -51.9253];
  return <MapContainer center={center} zoom={point ? 16 : 4} style={{ height: 360, width: '100%', borderRadius: 12 }}><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><PontoSelecionavel value={point} onChange={onChange} /></MapContainer>;
}
