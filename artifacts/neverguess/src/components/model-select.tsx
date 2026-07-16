// Combobox for picking the analysis model an audit runs on.
//
// Data comes from GET /models (useListModels) and is seeded with the static
// catalog as placeholderData, so the selector renders fully before the first
// response — and keeps rendering in static preview mode, where no API is
// mounted and the query simply errors. Live-only fields (context window,
// pricing) are shown per-row only when the server enriched them; we never
// invent numbers on the client.
import { useState } from "react";
import { useLocation } from "wouter";
import { Check, ChevronsUpDown, Lock } from "lucide-react";
import {
  useListModels,
  getListModelsQueryKey,
  type ModelCatalogEntry,
  type ModelsResponse,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DEFAULT_MODEL_ID, STATIC_MODEL_CATALOG, displayNameFor } from "@/data/model-catalog";

// Static catalog mapped to the wire shape. Standard models are selectable,
// premium ones show locked — the same view an anonymous/free caller gets from
// the live endpoint, minus enrichment.
const STATIC_MODELS_RESPONSE: ModelsResponse = {
  models: STATIC_MODEL_CATALOG.map((m) => ({
    id: m.id,
    displayName: m.displayName,
    provider: m.provider,
    tier: m.tier,
    proOnly: m.proOnly,
    isDefault: m.isDefault,
    available: !m.proOnly,
    lockReason: m.proOnly ? "pro-required" : null,
    blurb: m.blurb,
    contextLength: null,
    promptPricePerMTok: null,
    completionPricePerMTok: null,
  })),
  defaultModel: DEFAULT_MODEL_ID,
  live: false,
};

function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) {
    const millions = tokens / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M ctx`;
  }
  return `${Math.round(tokens / 1_000)}K ctx`;
}

function formatPromptPrice(usdPerMTok: number): string {
  return `$${usdPerMTok.toFixed(2)}/M in`;
}

function ModelRow({
  model,
  selected,
  onSelect,
}: {
  model: ModelCatalogEntry;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const locked = !model.available;
  const hasLiveMeta = model.contextLength !== null || model.promptPricePerMTok !== null;
  return (
    <CommandItem
      value={`${model.displayName} ${model.id}`}
      disabled={locked}
      onSelect={() => onSelect(model.id)}
      data-testid={`option-model-${model.id}`}
      className="gap-3"
    >
      <Check className={cn("h-4 w-4 shrink-0 text-primary", selected ? "opacity-100" : "opacity-0")} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{model.displayName}</span>
          {locked && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
          {locked && model.lockReason === "pro-required" && (
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">Pro</Badge>
          )}
        </div>
        <div className="truncate font-mono text-[11px] text-muted-foreground">{model.id}</div>
      </div>
      {hasLiveMeta && (
        <div className="ml-auto shrink-0 text-right font-mono text-[11px] leading-tight text-muted-foreground">
          {model.contextLength !== null && <div>{formatContext(model.contextLength)}</div>}
          {model.promptPricePerMTok !== null && <div>{formatPromptPrice(model.promptPricePerMTok)}</div>}
        </div>
      )}
    </CommandItem>
  );
}

export function ModelSelect({
  value,
  onChange,
  disabled,
  lockedForTrial,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  /** Anonymous trial: the server only accepts the default model. */
  lockedForTrial?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { data } = useListModels({
    query: {
      queryKey: getListModelsQueryKey(),
      placeholderData: STATIC_MODELS_RESPONSE,
      staleTime: 60_000,
      enabled: !lockedForTrial,
    },
  });
  // placeholderData only covers the pending state; fall back to the static
  // catalog again when the query errors. Shape-check rather than null-check:
  // in static preview the SPA shell answers /api/models with HTML (a truthy
  // 200 string), not JSON.
  const catalog =
    data && typeof data === "object" && Array.isArray(data.models)
      ? data
      : STATIC_MODELS_RESPONSE;

  const triggerClasses =
    "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3.5 py-2 text-sm shadow-xs transition-[box-shadow,border-color] focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50";

  if (lockedForTrial) {
    return (
      <div className="space-y-1.5">
        <button type="button" disabled className={triggerClasses} data-testid="button-model-select">
          <span className="truncate font-mono">{displayNameFor(DEFAULT_MODEL_ID)}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
        <p className="text-xs text-muted-foreground">
          Trial audits run {displayNameFor(DEFAULT_MODEL_ID)} — sign in to choose a model.
        </p>
      </div>
    );
  }

  const standard = catalog.models.filter((m) => m.tier === "standard");
  const premium = catalog.models.filter((m) => m.tier === "premium");
  const anyProLocked = catalog.models.some((m) => !m.available && m.lockReason === "pro-required");

  function handleSelect(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={triggerClasses}
          data-testid="button-model-select"
        >
          <span className="truncate font-mono">{displayNameFor(value) ?? displayNameFor(DEFAULT_MODEL_ID)}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search models…" data-testid="input-model-search" />
          <CommandList>
            <CommandEmpty>No model found.</CommandEmpty>
            <CommandGroup heading="Standard">
              {standard.map((m) => (
                <ModelRow key={m.id} model={m} selected={m.id === value} onSelect={handleSelect} />
              ))}
            </CommandGroup>
            <CommandGroup heading="Max quality — Pro">
              {premium.map((m) => (
                <ModelRow key={m.id} model={m} selected={m.id === value} onSelect={handleSelect} />
              ))}
            </CommandGroup>
          </CommandList>
          {!catalog.live && (
            <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
              Live model metadata unavailable
            </p>
          )}
          {anyProLocked && (
            <div className="sticky bottom-0 border-t border-border bg-popover p-1">
              <CommandItem
                forceMount
                value="__pro-upsell"
                onSelect={() => {
                  setOpen(false);
                  setLocation("/pricing");
                }}
                data-testid="link-model-pro-upsell"
                className="justify-center text-xs font-medium text-primary"
              >
                Unlock max-quality models — see Pro
              </CommandItem>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
