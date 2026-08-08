import { Link } from "@tanstack/react-router";
import { Star, MapPin, BadgeCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { brl, type Category, type Provider, type Service } from "@/lib/fixnow";

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`Nota ${value} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn("h-4 w-4", i <= Math.round(value) ? "fill-warning text-warning" : "text-border")}
        />
      ))}
    </span>
  );
}

export function CategoryTile({ category }: { category: Category }) {
  return (
    <Link
      to="/categoria/$slug"
      params={{ slug: category.slug }}
      className="press flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3 text-center shadow-[var(--shadow-card)]"
    >
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-2xl">{category.emoji}</span>
      <span className="text-xs font-bold leading-tight text-foreground">{category.name}</span>
    </Link>
  );
}

export function ServiceCard({ service, category }: { service: Service; category?: Category | undefined }) {
  return (
    <Link
      to="/solicitar"
      search={{ service: service.slug }}
      className="press flex min-w-[220px] flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-xl">
          {category?.emoji ?? "🔧"}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{service.name}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{service.description}</p>
        </div>
      </div>
      <p className="text-xs font-bold text-primary">a partir de {brl(Number(service.price_from))}</p>
    </Link>
  );
}

export function ProviderCard({ provider, categoryName }: { provider: Provider; categoryName?: string | undefined }) {
  return (
    <article className="surface-card press flex flex-col gap-4 p-4 sm:p-5">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
        <img
          src={provider.avatar_url ?? ""}
          alt={`Foto de ${provider.name}`}
          loading="lazy"
          className="h-16 w-16 shrink-0 rounded-2xl object-cover"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-display text-base font-bold">{provider.name}</h3>
            {provider.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />}
          </div>
          <p className="truncate text-xs font-medium text-muted-foreground">
            {categoryName ? `${categoryName} · ` : ""}
            {provider.headline}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-bold text-foreground">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" />
              {Number(provider.rating).toFixed(1)}
              <span className="font-medium text-muted-foreground">({provider.reviews_count})</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {Number(provider.distance_km).toFixed(1).replace(".", ",")} km
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {provider.years_experience} anos
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-bold",
            provider.available_now
              ? "bg-success/15 text-success"
              : "bg-muted text-muted-foreground",
          )}
        >
          {provider.available_now ? "✓ Disponível hoje" : "Agenda para depois"}
        </span>
        <span className="text-sm font-extrabold text-foreground">
          A partir de <span className="text-primary">{brl(Number(provider.price_from))}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link to="/prestador/$id" params={{ id: provider.id }}>
          <Button variant="outline" className="w-full font-bold">
            Ver perfil
          </Button>
        </Link>
        <Link to="/solicitar" search={{ provider: provider.id }}>
          <Button className="w-full font-bold">Solicitar</Button>
        </Link>
      </div>
    </article>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <span className="text-3xl">🔍</span>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface-card h-44 animate-pulse bg-muted/50" />
      ))}
    </div>
  );
}
