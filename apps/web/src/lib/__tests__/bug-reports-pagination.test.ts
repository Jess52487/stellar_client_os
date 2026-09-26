import { describe, expect, it, vi, beforeEach } from "vitest";
import {
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
} from "../lib/bug-reports-pagination";

const defaultFilters: BugReportFilter = {
  status: "open",
  severity: "high",
};

describe("Cursor generation and parsing", () => {
  describe("generateCursor", () => {
    it("generates a valid base64 cursor", () => {
      const cursor = generateCursor(true, 20, defaultFilters);
      expect(typeof cursor).toBe("string");
      expect(cursor.length).toBeGreaterThan(0);

      // Should be able to parse it back
      const parsed = parseCursor(cursor);
      expect(parsed.hasMore).toBe(true);
      expect(parsed.limit).toBe(20);
    });

    it("includes filter state in cursor", () => {
      const cursor = generateCursor(true, 10, { status: "resolved", severity: "critical" });
      const parsed = parseCursor(cursor);
      expect(parsed.filters.status).toBe("resolved");
      expect(parsed.filters.severity).toBe("critical");
    });
  });

  describe("parseCursor", () => {
    it("parses a valid cursor correctly", () => {
      const cursor = generateCursor(false, 30, { status: "open" });
      const parsed = parseCursor(cursor);
      expect(parsed.hasMore).toBe(false);
      expect(parsed.limit).toBe(30);
      expect(parsed.bookmark).toBeNull();
    });

    it("returns null bookmark when not included", () => {
      const cursor = generateCursor(true, 20, defaultFilters);
      const parsed = parseCursor(cursor);
      expect(parsed.bookmark).toBeNull();
    });

    it("throws on invalid cursor", () => {
      expect(() => parseCursor("invalid-base64")).toThrow("Invalid cursor format");
      expect(() => parseCursor("")).toThrow("Invalid cursor format");
    });

    it("validates cursor structure", () => {
      // Cursor missing required fields
      const badCursor = Buffer.from(JSON.stringify({ bad: "data" })).toString("base64");
      expect(() => parseCursor(badCursor)).toThrow("Invalid cursor structure");
    });
  });

  describe("createBoundaryCursor", () => {
    it("creates forward boundary cursor", () => {
      const cursor = createBoundaryCursor("forward", 25, defaultFilters);
      const parsed = parseCursor(cursor);
      expect(parsed.hasMore).toBe(true);
      expect(parsed.limit).toBe(25);
    });

    it("creates backward boundary cursor", () => {
      const cursor = createBoundaryCursor("backward", 10, defaultFilters);
      const parsed = parseCursor(cursor);
      expect(parsed.hasMore).toBe(true);
      expect(parsed.limit).toBe(10);
    });
  });

  describe("nextCursor and previousCursor", () => {
    it("nextCursor returns null when hasMore is false", () => {
      const cursor = generateCursor(false, 20, defaultFilters);
      const result = nextCursor(cursor, false, 20, defaultFilters);
      expect(result).toBeNull();
    });

    it("nextCursor generates new cursor when hasMore is true", () => {
      const cursor = generateCursor(true, 20, defaultFilters);
      const result = nextCursor(cursor, true, 20, defaultFilters);
      expect(result).not.toBeNull();
      if (result) {
        const parsed = parseCursor(result);
        expect(parsed.hasMore).toBe(true);
      }
    });

    it("previousCursor returns boundary cursor when no current cursor", () => {
      const result = previousCursor(null, true, 20, defaultFilters);
      expect(result).not.toBeNull();
      if (result) {
        const parsed = parseCursor(result);
        expect(parsed.direction).toBe("backward");
      }
    });

    it("previousCursor navigates backward from current cursor", () => {
      const cursor = generateCursor(true, 20, defaultFilters);
      const result = previousCursor(cursor, true, 20, defaultFilters);
      expect(result).not.toBeNull();
      if (result) {
        const parsed = parseCursor(result);
        expect(parsed.hasMore).toBe(true);
        expect(parsed.bookmark).not.toBeNull();
      }
    });
  });
});

describe("Filter persistence to URL", () => {
  let searchParams: URLSearchParams;

  beforeEach(() => {
    searchParams = new URLSearchParams();
  });

  describe("persistFiltersToURL", () => {
    it("persists status filter", () => {
      persistFiltersToURL(searchParams, { status: "resolved" });
      expect(searchParams.get("status")).toBe("resolved");
    });

    it("removes status filter when undefined", () => {
      persistFiltersToURL(searchParams, { status: undefined });
      expect(searchParams.get("status")).toBeNull();
    });

    it("persists all filters", () => {
      persistFiltersToURL(searchParams, {
        status: "open",
        severity: "high",
        author: "john@example.com",
        tag: "security",
      });
      expect(searchParams.get("status")).toBe("open");
      expect(searchParams.get("severity")).toBe("high");
      expect(searchParams.get("author")).toBe("john@example.com");
      expect(searchParams.get("tag")).toBe("security");
    });

    it("removes all filters when all undefined", () => {
      persistFiltersToURL(searchParams, {
        status: undefined,
        severity: undefined,
        author: undefined,
        tag: undefined,
      });
      expect(searchParams.get("status")).toBeNull();
      expect(searchParams.get("severity")).toBeNull();
      expect(searchParams.get("author")).toBeNull();
      expect(searchParams.get("tag")).toBeNull();
    });
  });

  describe("extractFiltersFromURL", () => {
    it("extracts filters from URL", () => {
      searchParams.set("status", "closed");
      searchParams.set("severity", "medium");
      searchParams.set("author", "jane@example.com");
      searchParams.set("tag", "bug");

      const filters = extractFiltersFromURL(searchParams);
      expect(filters.status).toBe("closed");
      expect(filters.severity).toBe("medium");
      expect(filters.author).toBe("jane@example.com");
      expect(filters.tag).toBe("bug");
    });

    it("returns undefined filters when no params", () => {
      searchParams = new URLSearchParams();
      const filters = extractFiltersFromURL(searchParams);
      expect(filters.status).toBeUndefined();
      expect(filters.severity).toBeUndefined();
      expect(filters.author).toBeUndefined();
      expect(filters.tag).toBeUndefined();
    });
  });
});

describe("createInitialPaginationState", () => {
  it("creates state with boundary cursor when no URL params", () => {
    const state = createInitialPaginationState(20);
    expect(state.cursor.after).toBeNull();
    expect(state.cursor.before).toBeNull();
    expect(state.filters.status).toBeUndefined();
    expect(state.filters.severity).toBeUndefined();
  });

  it("preserves filter state from URL", () => {
    const state = createInitialPaginationState(20, new URLSearchParams("status=open&severity=high"));
    expect(state.filters.status).toBe("open");
    expect(state.filters.severity).toBe("high");
  });

  it("uses provided limit from URL", () => {
    const state = createInitialPaginationState(20, new URLSearchParams("limit=50"));
    expect(state.cursor.limit).toBe(20); // default wins when no cursor
  });
});

describe("Optimistic updates", () => {
  const mockReport = {
    id: "report-1",
    title: "Test report",
    status: "open",
    severity: "high",
    createdAt: "2024-01-01T00:00:00Z",
  };

  const mockReports = [
    {
      id: "report-2",
      title: "Existing report",
      status: "resolved",
      severity: "medium",
      createdAt: "2024-01-02T00:00:00Z",
    },
  ];

  describe("optimisticCreateReport", () => {
    it("prepends new report to list", () => {
      const result = optimisticCreateReport(mockReport, mockReports);
      expect(result.optimisticReports.length).toBe(3);
      expect(result.optimisticReports[0]).toEqual(mockReport);
    });

    it("generates cursor with updated state", () => {
      const result = optimisticCreateReport(mockReport, mockReports);
      expect(result.cursor).toBeDefined();
      const parsed = parseCursor(result.cursor!);
      expect(parsed.limit).toBe(3); // original 2 + 1 new
    });
  });

  describe("optimisticUpdateReportStatus", () => {
    it("updates report status in list", () => {
      const result = optimisticUpdateReportStatus("report-1", "resolved", mockReports);
      expect(result.updatedReports[0].status).toBe("resolved");
      expect(result.updatedReports[1].status).toBe("medium"); // unchanged
    });

    it("does not modify reports when ID not found", () => {
      const result = optimisticUpdateReportStatus("nonexistent", "open", mockReports);
      expect(result.updatedReports).toEqual(mockReports);
    });
  });
});