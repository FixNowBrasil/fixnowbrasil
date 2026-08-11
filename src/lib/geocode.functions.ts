import { createServerFn } from "@tanstack/react-start";

type GeocodeResult = { lat: number; lng: number } | null;

export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((input: { address: string }) => {
    const address = String(input?.address ?? "").trim();
    if (address.length < 4) throw new Error("Endereço inválido");
    return { address: address.slice(0, 300) };
  })
  .handler(async ({ data }): Promise<GeocodeResult> => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
    if (!lovableKey || !mapsKey) throw new Error("Google Maps não está configurado");

    const url = `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?address=${encodeURIComponent(
      data.address,
    )}&region=br&language=pt-BR`;

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

    const json = (await response.json()) as {
      status?: string;
      results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }>;
    };
    const loc = json.results?.[0]?.geometry?.location;
    if (!loc) return null;
    return { lat: loc.lat, lng: loc.lng };
  });
