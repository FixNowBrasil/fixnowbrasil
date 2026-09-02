import { createServerFn } from "@tanstack/react-start";

type GeocodeResult = { lat: number; lng: number } | null;

/** Endereço estruturado devolvido pelas buscas de endereço. */
export type GeocodedAddress = {
  formatted: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
};

type GoogleComponent = { long_name: string; short_name: string; types: string[] };
type GoogleResult = {
  formatted_address?: string;
  address_components?: GoogleComponent[];
  geometry?: { location?: { lat: number; lng: number } };
};

function pick(components: GoogleComponent[], type: string, short = false): string {
  const found = components.find((c) => c.types.includes(type));
  if (!found) return "";
  return short ? found.short_name : found.long_name;
}

function toAddress(result: GoogleResult): GeocodedAddress | null {
  const loc = result.geometry?.location;
  if (!loc) return null;
  const components = result.address_components ?? [];
  return {
    formatted: result.formatted_address ?? "",
    street: pick(components, "route"),
    number: pick(components, "street_number"),
    neighborhood:
      pick(components, "sublocality_level_1") ||
      pick(components, "sublocality") ||
      pick(components, "neighborhood"),
    city:
      pick(components, "administrative_area_level_2") ||
      pick(components, "locality") ||
      pick(components, "administrative_area_level_1"),
    state: pick(components, "administrative_area_level_1", true),
    zip: pick(components, "postal_code"),
    lat: loc.lat,
    lng: loc.lng,
  };
}

async function callGoogle(query: string): Promise<GoogleResult[]> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) throw new Error("Google Maps não está configurado");

  const url = `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?${query}&region=br&language=pt-BR`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": mapsKey,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Geocode falhou [${response.status}]: ${body}`);
    throw new Error(`Geocode falhou [${response.status}]`);
  }
  const json = (await response.json()) as { results?: GoogleResult[] };
  return json.results ?? [];
}

export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((input: { address: string }) => {
    const address = String(input?.address ?? "").trim();
    if (address.length < 4) throw new Error("Endereço inválido");
    return { address: address.slice(0, 300) };
  })
  .handler(async ({ data }): Promise<GeocodeResult> => {
    const results = await callGoogle(`address=${encodeURIComponent(data.address)}`);
    const loc = results[0]?.geometry?.location;
    if (!loc) return null;
    return { lat: loc.lat, lng: loc.lng };
  });

/** Busca endereços por texto livre ("rua x, 123 são paulo") e devolve opções estruturadas. */
export const searchAddress = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string }) => {
    const query = String(input?.query ?? "").trim();
    if (query.length < 4) throw new Error("Digite um endereço um pouco maior");
    return { query: query.slice(0, 300) };
  })
  .handler(async ({ data }): Promise<GeocodedAddress[]> => {
    const results = await callGoogle(`address=${encodeURIComponent(data.query)}`);
    return results
      .slice(0, 5)
      .map(toAddress)
      .filter((item): item is GeocodedAddress => !!item);
  });

/** Converte coordenadas do GPS do celular em um endereço estruturado. */
export const reverseGeocode = createServerFn({ method: "POST" })
  .inputValidator((input: { lat: number; lng: number }) => {
    const lat = Number(input?.lat);
    const lng = Number(input?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("Coordenadas inválidas");
    return { lat, lng };
  })
  .handler(async ({ data }): Promise<GeocodedAddress | null> => {
    const results = await callGoogle(`latlng=${data.lat},${data.lng}`);
    for (const result of results) {
      const address = toAddress(result);
      if (address?.street) return address;
    }
    return results[0] ? toAddress(results[0]) : null;
  });
