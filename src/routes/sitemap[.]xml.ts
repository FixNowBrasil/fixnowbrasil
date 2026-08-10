import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://fixnowbrasil.lovable.app";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/buscar", changefreq: "daily", priority: "0.9" },
          { path: "/solicitar", changefreq: "monthly", priority: "0.6" },
          { path: "/auth", changefreq: "yearly", priority: "0.2" },
        ];

        try {
          const supabase = createClient(
            process.env["VITE_SUPABASE_URL"]!,
            process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]!,
            { auth: { persistSession: false } },
          );

          const [{ data: categories }, { data: providers }] = await Promise.all([
            supabase.from("categories").select("slug"),
            supabase.from("providers").select("id").eq("approved", true),
          ]);

          for (const c of categories ?? []) {
            entries.push({ path: `/categoria/${c.slug}`, changefreq: "weekly", priority: "0.8" });
          }
          for (const p of providers ?? []) {
            entries.push({ path: `/prestador/${p.id}`, changefreq: "weekly", priority: "0.7" });
          }
        } catch {
          // fall back to static routes only
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
