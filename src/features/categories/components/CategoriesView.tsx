import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Trash2 } from "lucide-react";
import { api } from "@/shared/api/amule-api";
import { toast } from "sonner";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { queryKeys } from "@/shared/api/query-keys";
import { getErrorMessage } from "@/shared/lib/errors";
import { QueryNotice } from "@/shared/components/QueryNotice";

export function CategoriesView() {
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [drafts, setDrafts] = useState<Record<number, { name: string; path: string }>>({});
  const client = useQueryClient();
  const categories = useQuery({
    queryKey: queryKeys.categories,
    queryFn: api.categories,
  });
  const refresh = () => void client.invalidateQueries({ queryKey: queryKeys.categories });
  const customCategories =
    categories.data?.categories.filter((category) => category.index !== 0) ?? [];
  const add = useMutation({
    mutationFn: () => api.addCategory(name, path),
    onSuccess: () => {
      setName("");
      setPath("");
      toast.success("Category created.");
      refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const save = useMutation({
    mutationFn: ({ index, patch }: { index: number; patch: { name: string; path: string } }) =>
      api.patchCategory(index, patch),
    onSuccess: (_, { index }) => {
      setDrafts((all) => {
        const next = { ...all };
        delete next[index];
        return next;
      });
      toast.success("Category saved.");
      refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: api.removeCategory,
    onSuccess: () => {
      toast.success("Category removed.");
      refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return toast.warning("A category name is required.");
    add.mutate();
  }
  return (
    <div className="content">
      <h1>Categories</h1>
      <form className="server-form" onSubmit={submit}>
        <input placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          placeholder="Optional download path"
          value={path}
          onChange={(e) => setPath(e.target.value)}
        />
        <button disabled={add.isPending}>Create</button>
      </form>
      <section className="panel">
        <div className="panel-title">
          <h2>Download categories</h2>
          <span>{customCategories.length}</span>
        </div>
        {categories.isPending || categories.isError ? (
          <QueryNotice
            loading={categories.isPending}
            error={categories.error}
            onRetry={() => void categories.refetch()}
          />
        ) : customCategories.length ? (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Path</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {customCategories.map((category) => {
                const draft = drafts[category.index] ?? category;
                const changed = draft.name !== category.name || draft.path !== category.path;
                return (
                  <tr key={category.index}>
                    <td>
                      <input
                        className="category-input"
                        aria-label={`Name for ${category.name}`}
                        value={draft.name}
                        onChange={(event) =>
                          setDrafts((all) => ({
                            ...all,
                            [category.index]: {
                              ...draft,
                              name: event.target.value,
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="category-input"
                        aria-label={`Path for ${category.name}`}
                        value={draft.path}
                        onChange={(event) =>
                          setDrafts((all) => ({
                            ...all,
                            [category.index]: {
                              ...draft,
                              path: event.target.value,
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <button
                        className="icon"
                        disabled={!changed || save.isPending || !draft.name.trim()}
                        aria-label={`Save ${category.name}`}
                        onClick={() => save.mutate({ index: category.index, patch: draft })}
                      >
                        <Save size={15} />
                      </button>
                      <ConfirmDialog
                        trigger={
                          <button className="icon danger" aria-label={`Delete ${category.name}`}>
                            <Trash2 size={15} />
                          </button>
                        }
                        title="Delete category?"
                        description={`Delete the “${category.name || "Unnamed category"}” category? Downloads assigned to it are not deleted.`}
                        actionLabel="Delete category"
                        dangerous
                        onConfirm={() => remove.mutate(category.index)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="empty">No custom download categories.</p>
        )}
      </section>
    </div>
  );
}
