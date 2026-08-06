import { useCallback, useState } from "react";
import type { SortDirection } from "@/shared/components/SortableHeader";

export function useSortState<Key extends string>(initialSort: Key) {
  const [sort, setSort] = useState<Key>(initialSort);
  const [direction, setDirection] = useState<SortDirection>("asc");

  const toggleSort = useCallback(
    (column: Key) => {
      if (sort === column) {
        setDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"));
        return;
      }

      setSort(column);
      setDirection("asc");
    },
    [sort],
  );

  return { sort, direction, toggleSort };
}
