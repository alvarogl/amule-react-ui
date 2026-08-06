import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export type SortDirection = "asc" | "desc";

export function SortableHeader<K extends string>({
  column,
  label,
  sort,
  direction,
  onSort,
}: {
  column: K;
  label: string;
  sort: K;
  direction: SortDirection;
  onSort: (column: K) => void;
}) {
  const Icon = sort === column ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className="data-header">
      <button className="header-sort" onClick={() => onSort(column)}>
        {label}
        <Icon size={14} aria-hidden="true" />
      </button>
    </th>
  );
}
