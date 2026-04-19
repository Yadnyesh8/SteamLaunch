"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";

type SearchItem = {
  steamAppId: number;
  name: string;
  tinyImage: string | null;
  launched: boolean;
};

type SearchResponse = { total: number; items: SearchItem[] };

const DEBOUNCE_MS = 350;
const MIN_QUERY = 2;

export function SteamGameSearch() {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const runSearch = useCallback(async (q: string) => {
    if (q.length < MIN_QUERY) {
      setItems([]);
      setTotal(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/steam/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const body = (await res.json()) as SearchResponse & { error?: string };
      if (!res.ok) {
        setItems([]);
        setTotal(null);
        setError(body.error ?? `Search failed (${res.status})`);
        return;
      }
      const raw = body.items ?? [];
      setItems(
        raw.map((item) => ({
          steamAppId: item.steamAppId,
          name: item.name,
          tinyImage: item.tinyImage ?? null,
          launched: Boolean(item.launched),
        })),
      );
      setTotal(body.total ?? 0);
    } catch {
      setItems([]);
      setTotal(null);
      setError("Network error while searching");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runSearch(debounced);
  }, [debounced, runSearch]);

  const showHint = query.trim().length > 0 && query.trim().length < MIN_QUERY;
  const showEmpty = debounced.length >= MIN_QUERY && !loading && !error && items.length === 0;

  return (
    <section style={{ maxWidth: "44rem", marginBottom: "2rem" }}>
      <h2 className="steam-h2" style={{ marginBottom: "0.5rem" }}>
        Search games
      </h2>
      <p className="steam-muted" style={{ margin: "0 0 0.65rem" }}>
        Steam store results; a token is <span className="steam-pill steam-pill--launched">Launched</span>{" "}
        once a mint is registered here.
      </p>
      <label htmlFor="steam-search" className="steam-label">
        Search
      </label>
      <div className="steam-search-row steam-search-row--wide">
        <input
          id="steam-search"
          type="search"
          className="steam-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type at least 2 characters…"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-controls={listId}
        />
        <span className="steam-search-submit" aria-hidden title="Search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.2" />
            <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </span>
      </div>
      {showHint ? (
        <p className="steam-muted" style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
          Enter {MIN_QUERY}+ characters to search.
        </p>
      ) : null}
      {loading ? (
        <p className="steam-muted" style={{ margin: "0.5rem 0 0", fontSize: "0.9rem" }}>
          Searching…
        </p>
      ) : null}
      {error ? (
        <p className="steam-error" style={{ margin: "0.5rem 0 0", fontSize: "0.9rem" }}>
          {error}
        </p>
      ) : null}
      {total !== null && debounced.length >= MIN_QUERY && !loading && !error ? (
        <p className="steam-muted" style={{ margin: "0.5rem 0 0", fontSize: "0.85rem" }}>
          {total} result{total === 1 ? "" : "s"}
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul id={listId} aria-label="Search results" className="steam-list">
          {items.map((item) => (
            <li key={item.steamAppId}>
              <Link href={`/games/${item.steamAppId}`} className="steam-list-item">
                {item.tinyImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote Steam CDN
                  <img
                    src={item.tinyImage}
                    alt=""
                    width={120}
                    height={45}
                    className="steam-game-thumb"
                  />
                ) : (
                  <span className="steam-game-thumb-placeholder" />
                )}
                <span className="steam-list-item-text">
                  <span className="steam-list-item-title-row">
                    <span className="steam-list-item-title">{item.name}</span>
                    <span
                      className={
                        item.launched ? "steam-pill steam-pill--launched" : "steam-pill steam-pill--not"
                      }
                    >
                      {item.launched ? "Launched" : "Not launched"}
                    </span>
                  </span>
                  <span className="steam-list-item-meta">App {item.steamAppId}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {showEmpty ? (
        <p className="steam-muted" style={{ margin: "0.5rem 0 0", fontSize: "0.9rem" }}>
          No games found.
        </p>
      ) : null}
    </section>
  );
}
