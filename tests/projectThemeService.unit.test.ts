/**
 * ProjectThemeService - Equivalence partitions and test mapping
 *
 * Unit under test:
 * - ProjectThemeService.getProjectAndTheme(project_id)
 *
 * Input partitions (project_id):
 * - P1: missing / undefined (invalid)
 * - P2: empty string ('') (boundary)
 * - P3: whitespace-only ('   ') (atypical)
 * - P4: normal non-empty ID (valid)
 *
 * Model/DB response partitions:
 * - R1: ProjectModel.getById returns {data: project, error: null} (valid)
 * - R2: ProjectModel.getById returns {data: null, error: Error} or error -> treat as not found (invalid)
 * - R3: ThemeModel.getById returns {data: theme, error: null} (valid)
 * - R4: ThemeModel.getById returns {data: null, error: Error} or error -> not found (invalid)
 *
 * Mapping -> tests target:
 * - Valid path: P4, R1, R3 -> returns {project, theme}
 * - Project not found: P4, R2 -> returns null and logs error
 * - Theme not found: P4, R1, R4 -> returns null and logs error
 * - Missing/empty/whitespace inputs: P1/P2/P3 -> service should return null when models indicate not found or when errors occur
 * - Exceptions thrown by models -> service returns null and logs error
 */

import logger from "../src/config/logger";
import { ProjectThemeService } from "../src/services/ProjectThemeService";
import { ProjectModel } from "../src/models/ProjectModel";
import { ThemeModel } from "../src/models/ThemeModel";

jest.mock("../src/models/ProjectModel");
jest.mock("../src/models/ThemeModel");
jest.spyOn(logger, "info").mockImplementation();
jest.spyOn(logger, "error").mockImplementation();

describe("ProjectThemeService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getProjectAndTheme", () => {
    // Valid: project and theme exist -> returns both (Valid - P4/R1/R3)
    it("returns project and theme when both exist (valid)", async () => {
      const project = { id: "p1", theme_id: "t1" } as any;
      const theme = { id: "t1", name: "Theme" } as any;

      (ProjectModel.getById as jest.Mock).mockResolvedValue({
        data: project,
        error: null,
      });
      (ThemeModel.getById as jest.Mock).mockResolvedValue({
        data: theme,
        error: null,
      });

      const res = await ProjectThemeService.getProjectAndTheme("p1");
      expect(res).toEqual({ project, theme });
      expect(ProjectModel.getById).toHaveBeenCalledWith("p1");
      expect(ThemeModel.getById).toHaveBeenCalledWith("t1");
    });

    // Invalid: project not found -> returns null and logs error (Invalid - R2)
    it("returns null and logs when project not found (invalid)", async () => {
      (ProjectModel.getById as jest.Mock).mockResolvedValue({
        data: null,
        error: new Error("not found"),
      });

      const res = await ProjectThemeService.getProjectAndTheme("missing");
      expect(res).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Project not found"),
        expect.any(Error)
      );
    });

    // Invalid: theme not found -> returns null and logs error (Invalid - R4)
    it("returns null and logs when theme not found (invalid)", async () => {
      const project = { id: "p2", theme_id: "t-missing" } as any;
      (ProjectModel.getById as jest.Mock).mockResolvedValue({
        data: project,
        error: null,
      });
      (ThemeModel.getById as jest.Mock).mockResolvedValue({
        data: null,
        error: new Error("theme missing"),
      });

      const res = await ProjectThemeService.getProjectAndTheme("p2");
      expect(res).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Theme not found for project"),
        expect.any(Error)
      );
    });

    // Invalid: model throws an exception -> service catches and returns null (Invalid/exception)
    it("returns null and logs when ProjectModel.getById throws (invalid)", async () => {
      (ProjectModel.getById as jest.Mock).mockRejectedValue(new Error("boom"));

      const res = await ProjectThemeService.getProjectAndTheme("p-exc");
      expect(res).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "ProjectThemeService: Error fetching project and theme:"
        ),
        expect.any(Error)
      );
    });

    // Atypical: whitespace-only project id -> treat as invalid when project not found (Atypical - P3)
    it("returns null for whitespace-only project id (atypical)", async () => {
      (ProjectModel.getById as jest.Mock).mockResolvedValue({
        data: null,
        error: new Error("not found"),
      });

      const res = await ProjectThemeService.getProjectAndTheme("   ");
      expect(res).toBeNull();
    });

    // Boundary: empty string project id -> treat as invalid (P2)
    it("returns null for empty project id (boundary)", async () => {
      (ProjectModel.getById as jest.Mock).mockResolvedValue({
        data: null,
        error: new Error("not found"),
      });
      const res = await ProjectThemeService.getProjectAndTheme("");
      expect(res).toBeNull();
    });

    // Invalid: undefined project id -> model may be called; ensure null returned (P1)
    it("returns null when project id is undefined (invalid)", async () => {
      (ProjectModel.getById as jest.Mock).mockResolvedValue({
        data: null,
        error: new Error("not found"),
      });
      const res = await ProjectThemeService.getProjectAndTheme(
        undefined as any
      );
      expect(res).toBeNull();
    });
  });
});
