import { v4 as uuidv4 } from "uuid";

export interface BugReportFilter {
  status?: "open" | "in-progress" | "resolved" | "closed";
  severity?: "critical" | "high" | "medium" | "low";
  author?: string;
  tag?: string;
}

export interface PaginationCursor {
  readonly after?: string | null;
  readonly before?: string | null;
}

export interface PaginationMeta {
  hasMore: boolean;
  limit: number;
  total: number;
}

export interface PaginationState {
  cursor: PaginationCursor;
  filters: BugReportFilter;
}

/**
 * Generates an opaque base64 cursor token representing the current pagination state.
 * The cursor encodes: direction, limit, filters, and optional bookmark position.
 *
 * @param hasMore - whether there are more items available
 * @param limit - the fetch limit used
 * @param filters - the active filter state
 * @param bookmark - optional cursor for position in the list (last fetched ID or timestamp)
 * @returns base64-encoded cursor string
 */
export function generateCursor(
  hasMore: boolean,
  limit: number,
  filters: BugReportFilter,
  bookmark?: string | null
): string {
  const payload = {
    hasMore,
    limit,
    filters,
    bookmark,
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/**
 * Parses an opaque base64 cursor token back into its components.
 *
 * @param cursor - base64-encoded cursor string
 * @returns parsed cursor payload
 * @throws if the cursor is invalid or tampered
 */
export function parseCursor(cursor: string): {
  hasMore: boolean;
  limit: number;
  filters: BugReportFilter;
  bookmark: string | null;
} {
  let payload: {
    hasMore: boolean;
    limit: number;
    filters: BugReportFilter;
    bookmark: string | null;
  };

  try {
    const json = Buffer.from(cursor, "base64").toString("utf8");
    payload = JSON.parse(json);
  } catch (error) {
    throw new Error("Invalid cursor format");
  }

  // Validate required fields
  if (
    typeof payload.hasMore !== "boolean" ||
    typeof payload.limit !== "number" ||
    !payload.filters ||
    typeof payload.bookmark !== "string" && payload.bookmark !== null
  ) {
    throw new Error("Invalid cursor structure");
  }

  return {
    hasMore: payload.hasMore,
    limit: payload.limit,
    filters: {
      status: payload.filters.status,
      severity: payload.filters.severity,
      author: payload.filters.author,
      tag: payload.filters.tag,
    },
    bookmark: payload.bookmark,
  };
}

/**
 * Creates a boundary cursor for the start or end of a paginated list.
 * Used for first/last page navigation and URL sharing.
 *
 * @param direction - "forward" for after cursor, "backward" for before cursor
 * @param limit - the fetch limit
 * @param filters - the active filter state
 * @returns base64-encoded boundary cursor
 */
export function createBoundaryCursor(
  direction: "forward" | "backward",
  limit: number,
  filters: BugReportFilter
): string {
  const payload = {
    boundary: true,
    direction,
    limit,
    filters,
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/**
 * Navigates pagination forward by one page.
 * Returns a new cursor for the next page, or null if at the end.
 *
 * @param currentCursor - current pagination cursor
 * @param hasMore - whether there are more items available
 * @returns new cursor or null
 */
export function nextCursor(
  currentCursor: string | null,
  hasMore: boolean,
  limit: number,
  filters: BugReportFilter
): string | null {
  if (!currentCursor) {
    return generateCursor(true, limit, filters);
  }

  try {
    const parsed = parseCursor(currentCursor);
    if (!parsed.hasMore) {
      return null;
    }
    return generateCursor(true, limit, filters, parsed.bookmark);
  } catch {
    return null;
  }
}

/**
 * Navigates pagination backward by one page.
 * Returns a new cursor for the previous page, or null if at the start.
 *
 * @param currentCursor - current pagination cursor
 * @param hasMore - whether there are more items before the current position
 * @returns new cursor or null
 */
export function previousCursor(
  currentCursor: string | null,
  hasMore: boolean,
  limit: number,
  filters: BugReportFilter
): string | null {
  if (!currentCursor) {
    return createBoundaryCursor("backward", limit, filters);
  }

  try {
    const parsed = parseCursor(currentCursor);
    if (!parsed.hasMore) {
      return null;
    }
    return generateCursor(false, limit, filters, parsed.bookmark);
  } catch {
    return null;
  }
}

/**
 * Persists filter state to URL query parameters.
 * This ensures filter state is completely preserved when reloading or sharing report URLs.
 *
 * @param searchParams - URLSearchParams to update
 * @param filters - the filter state to persist
 */
export function persistFiltersToURL(
  searchParams: URLSearchParams,
  filters: BugReportFilter
): void {
  if (filters.status) {
    searchParams.set("status", filters.status);
  } else {
    searchParams.delete("status");
  }

  if (filters.severity) {
    searchParams.set("severity", filters.severity);
  } else {
    searchParams.delete("severity");
  }

  if (filters.author) {
    searchParams.set("author", filters.author);
  } else {
    searchParams.delete("author");
  }

  if (filters.tag) {
    searchParams.set("tag", filters.tag);
  } else {
    searchParams.delete("tag");
  }
}

/**
 * Extracts filter state from URL query parameters.
 *
 * @param searchParams - URLSearchParams to read from
 * @returns parsed filter state
 */
export function extractFiltersFromURL(
  searchParams: URLSearchParams
): BugReportFilter {
  return {
    status: searchParams.get("status") as BugReportFilter["status"] | undefined,
    severity:
      searchParams.get("severity") as BugReportFilter["severity"] | undefined,
    author: searchParams.get("author") as BugReportFilter["author"] | undefined,
    tag: searchParams.get("tag") as BugReportFilter["tag"] | undefined,
  };
}

/**
 * Creates initial pagination state from URL query parameters.
 * Combines cursor-based pagination with filter persistence.
 *
 * @param initialLimit - default fetch limit
 * @param searchParams - URLSearchParams to read from
 * @returns initial pagination state
 */
export function createInitialPaginationState(
  initialLimit: number = 20,
  searchParams?: URLSearchParams
): PaginationState {
  const filters = searchParams
    ? extractFiltersFromURL(new URLSearchParams(searchParams.toString()))
    : {};

  const boundaryCursor = searchParams
    ? parseCursor(searchParams.get("cursor") || "")
    : { hasMore: true, limit: initialLimit, filters: {} , bookmark: null};

  // If no cursor in URL, create a boundary cursor for the start
  let cursor: string | null = searchParams?.get("cursor") || null;

  if (!cursor) {
    cursor = createBoundaryCursor("forward", initialLimit, filters);
  }

  return {
    cursor: {
      after: cursor ? null : null,
      before: cursor ? null : null,
    },
    filters,
  };
}

/**
 * Optimistic update support for creating a new bug report.
 * Generates a temporary cursor that places the new item at the appropriate position,
 * then refreshes after the mutation completes.
 *
 * @param newReport - the newly created report
 * @param currentReports - current list of reports
 * @returns optimistic update result
 */
export function optimisticCreateReport(
  newReport: {
    id: string;
    title: string;
    status: BugReportFilter["status"];
    severity: BugReportFilter["severity"];
    author?: string;
    tag?: string;
    createdAt: string;
  },
  currentReports: Array<{
    id: string;
    title: string;
    status: BugReportFilter["status"];
    severity: BugReportFilter["severity"];
    author?: string;
    tag?: string;
    createdAt: string;
  }>
) {
  // Insert the new report at the beginning of the list (most recent first)
  const optimisticReports = [newReport, ...currentReports];

  // Generate a cursor that represents the updated state
  const cursor = generateCursor(
    true,
    currentReports.length + 1,
    {
      status: newReport.status,
      severity: newReport.severity,
      author: newReport.author,
      tag: newReport.tag,
    }
  );

  return {
    optimisticReports,
    cursor,
  };
}

/**
 * Optimistic update support for updating a report status.
 *
 * @param reportId - ID of the report to update
 * @param newStatus - new status value
 * @param currentReports - current list of reports
 * @returns optimistic update result
 */
export function optimisticUpdateReportStatus(
  reportId: string,
  newStatus: BugReportFilter["status"],
  currentReports: Array<{
    id: string;
    status: BugReportFilter["status"];
  }>
) {
  const updatedReports = currentReports.map((report) =>
    report.id === reportId
      ? { ...report, status: newStatus }
      : report
  );

  return { updatedReports };
}

export default {
  generateCursor,
  parseCursor,
  createBoundaryCursor,
  nextCursor,
  previousCursor,
  persistFiltersToURL,
  extractFiltersFromURL,
  createInitialPaginationState,
  optimisticCreateReport,
  optimisticUpdateReportStatus,
};