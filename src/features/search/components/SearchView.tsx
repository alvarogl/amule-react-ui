import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Search as SearchIcon, X } from "lucide-react";
import { api, type SearchFilters } from "@/shared/api/amule-api";
import { toast } from "sonner";
import { SortableHeader } from "@/shared/components/SortableHeader";
import { queryKeys } from "@/shared/api/query-keys";
import { useSortState } from "@/shared/hooks/use-sort-state";

const fileTypes = [
  "any",
  "audio",
  "videos",
  "archives",
  "cd-images",
  "pictures",
  "texts",
  "programs",
];

export function SearchView() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"local" | "global" | "kad">("global");
  const [fileType, setFileType] = useState("");
  const [extension, setExtension] = useState("");
  const [minSize, setMinSize] = useState("");
  const [maxSize, setMaxSize] = useState("");
  const [minAvail, setMinAvail] = useState("");
  const [chosenNames, setChosenNames] = useState<Record<string, string>>({});
  const [deletingSearches, setDeletingSearches] = useState<Set<number>>(new Set());
  const { sort, direction, toggleSort } = useSortState<"name" | "sources" | "size">("name");
  const [active, setActive] = useState<number>();
  const input = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const searches = useQuery({
    queryKey: queryKeys.searches,
    queryFn: api.searches,
    refetchInterval: 10_000,
  });
  const results = useQuery({
    queryKey: queryKeys.searchResults(active),
    queryFn: () => api.searchResults(active!),
    enabled: active !== undefined,
    refetchInterval: 4_000,
  });
  const activeSearch = searches.data?.searches.find((search) => search.search_id === active);
  const isActiveSearchFinished = results.data?.progress.state === "finished";
  const displayedQuery = isActiveSearchFinished && query === activeSearch?.query ? "" : query;
  const start = useMutation({
    mutationFn: (searchQuery: string) => api.startSearch(searchQuery, kind, filters()),
    onSuccess: (data) => {
      setActive(data.search_id);
      void queryClient.invalidateQueries({ queryKey: queryKeys.searches });
    },
    onError: (error) => toast.error(error.message),
  });
  const download = useMutation({
    mutationFn: ({ hash, ecid }: { hash: string; ecid?: number }) =>
      api.downloadSearchResult(hash, ecid),
    onSuccess: () => {
      toast.success("Search result added to transfers.");
      void queryClient.invalidateQueries({ queryKey: queryKeys.downloads });
    },
    onError: (error) => toast.error(error.message),
  });
  const close = useMutation({
    mutationFn: (searchId: number) => api.stopSearch(searchId),
    onMutate: (searchId) => {
      setDeletingSearches((current) => new Set(current).add(searchId));
    },
    onSuccess: async (_, searchId) => {
      setActive(undefined);
      setQuery("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.searches });
      void queryClient.removeQueries({
        queryKey: queryKeys.searchResults(searchId),
      });
      input.current?.focus();
    },
    onSettled: (_, __, searchId) => {
      setDeletingSearches((current) => {
        const next = new Set(current);
        next.delete(searchId);
        return next;
      });
    },
    onError: (error) => toast.error(error.message),
  });
  useEffect(() => {
    if (isActiveSearchFinished) input.current?.focus();
  }, [isActiveSearchFinished]);

  function filters(): SearchFilters {
    const mib = (value: string) =>
      value.trim() ? Math.round(Number(value) * 1024 * 1024) : undefined;
    const minimum = mib(minSize);
    const maximum = mib(maxSize);
    return {
      ...(fileType ? { file_type: fileType } : {}),
      ...(extension.trim() ? { extension: extension.trim().replace(/^\./, "") } : {}),
      ...(minimum !== undefined ? { min_size: minimum } : {}),
      ...(maximum !== undefined ? { max_size: maximum } : {}),
      ...(minAvail.trim() ? { min_avail: Number(minAvail) } : {}),
    };
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!displayedQuery.trim()) return toast.warning("Enter a search query.");
    if (
      (minSize && (!Number.isFinite(Number(minSize)) || Number(minSize) < 0)) ||
      (maxSize && (!Number.isFinite(Number(maxSize)) || Number(maxSize) < 0)) ||
      (minAvail && (!Number.isInteger(Number(minAvail)) || Number(minAvail) < 0))
    )
      return toast.warning("Use non-negative sizes and a whole minimum availability.");
    start.mutate(displayedQuery);
  }
  const orderedResults = [...(results.data?.results ?? [])].sort((left, right) => {
    const comparison =
      sort === "name"
        ? left.name.localeCompare(right.name)
        : sort === "sources"
          ? left.sources.total - right.sources.total
          : left.size - right.size;
    return direction === "asc" ? comparison : -comparison;
  });
  return (
    <div className="content">
      <h1>Search</h1>
      <form className="search-form" onSubmit={submit}>
        <input
          ref={input}
          placeholder="Find files"
          value={displayedQuery}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
          <option value="global">Global</option>
          <option value="local">Local</option>
          <option value="kad">Kad</option>
        </select>
        <button disabled={start.isPending}>
          <SearchIcon size={16} /> Search
        </button>
      </form>
      <details className="search-filters">
        <summary>Search filters</summary>
        <div>
          <label>
            Type
            <select value={fileType} onChange={(event) => setFileType(event.target.value)}>
              <option value="">Any type</option>
              {fileTypes.map((type) => (
                <option value={type} key={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            Extension
            <input
              placeholder="e.g. iso"
              value={extension}
              onChange={(event) => setExtension(event.target.value)}
            />
          </label>
          <label>
            Min MiB
            <input
              type="number"
              min="0"
              value={minSize}
              onChange={(event) => setMinSize(event.target.value)}
            />
          </label>
          <label>
            Max MiB
            <input
              type="number"
              min="0"
              value={maxSize}
              onChange={(event) => setMaxSize(event.target.value)}
            />
          </label>
          <label>
            Min sources
            <input
              type="number"
              min="0"
              step="1"
              value={minAvail}
              onChange={(event) => setMinAvail(event.target.value)}
            />
          </label>
        </div>
      </details>
      <div className="tabs">
        {searches.data?.searches.map((item) => {
          const deleting = deletingSearches.has(item.search_id);
          return (
            <span className={active === item.search_id ? "tab active" : "tab"} key={item.search_id}>
              <button disabled={deleting} onClick={() => setActive(item.search_id)}>
                {item.query} <small>{deleting ? "deleting" : item.state}</small>
              </button>
              {!deleting && (
                <button
                  className="close-search"
                  disabled={close.isPending}
                  onClick={() => close.mutate(item.search_id)}
                  aria-label={`Close ${item.query}`}
                >
                  <X size={13} />
                </button>
              )}
            </span>
          );
        })}
      </div>
      {results.data && (
        <section className="panel">
          <div className="panel-title">
            <h2>{results.data.progress.kind} results</h2>
            <span>
              {results.data.progress.state} · {results.data.progress.percent}%
            </span>
          </div>
          {results.data.results.length === 0 ? (
            <p className="empty">Waiting for results…</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <colgroup>
                  <col style={{ width: 440 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 58 }} />
                </colgroup>
                <thead>
                  <tr>
                    <SortableHeader
                      column="name"
                      label="Name"
                      sort={sort}
                      direction={direction}
                      onSort={toggleSort}
                    />
                    <SortableHeader
                      column="sources"
                      label="Sources"
                      sort={sort}
                      direction={direction}
                      onSort={toggleSort}
                    />
                    <SortableHeader
                      column="size"
                      label="Size"
                      sort={sort}
                      direction={direction}
                      onSort={toggleSort}
                    />
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {orderedResults.map((item) => {
                    const chosen = chosenNames[item.hash];
                    const child = item.children.find(
                      (candidate) => String(candidate.ecid) === chosen,
                    );
                    return (
                      <tr key={item.hash}>
                        <td title={child?.name ?? item.name}>
                          {item.children.length > 0 ? (
                            <select
                              className="result-name"
                              aria-label={`Filename for ${item.name}`}
                              title={child?.name ?? item.name}
                              value={chosen ?? ""}
                              onChange={(event) =>
                                setChosenNames((names) => ({
                                  ...names,
                                  [item.hash]: event.target.value,
                                }))
                              }
                            >
                              <option value="">{item.name}</option>
                              {item.children.map((candidate) => (
                                <option key={candidate.ecid} value={candidate.ecid}>
                                  {candidate.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            item.name
                          )}
                          {item.children.length > 0 && <small>Choose an advertised filename</small>}
                        </td>
                        <td>
                          {item.sources.complete}/{item.sources.total}
                        </td>
                        <td>{(item.size / 1024 / 1024).toFixed(1)} MiB</td>
                        <td>
                          <button
                            className="icon"
                            disabled={item.already_have || download.isPending}
                            onClick={() =>
                              download.mutate({
                                hash: item.hash,
                                ...(child ? { ecid: child.ecid } : {}),
                              })
                            }
                            aria-label="Download result"
                          >
                            <Download size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
