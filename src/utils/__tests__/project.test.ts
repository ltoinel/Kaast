import { describe, it, expect, beforeEach } from "vitest";
import {
  generateProjectId,
  saveProjects,
  loadProjects,
  addProject,
  removeProject,
  setCurrentProject,
  getCurrentProject,
  createProject,
} from "../project";
import type { Project } from "../project";

beforeEach(() => {
  localStorage.clear();
});

describe("generateProjectId", () => {
  it("returns a string matching project_*_* format", () => {
    const id = generateProjectId();
    expect(id).toMatch(/^project_\d+_[a-z0-9]+$/);
  });

  it("generates unique ids", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateProjectId()));
    expect(ids.size).toBe(50);
  });
});

describe("saveProjects / loadProjects", () => {
  it("round-trips an array of projects", () => {
    const projects: Project[] = [
      { id: "p1", name: "A", path: "/a", createdAt: "t1", updatedAt: "t1" },
      { id: "p2", name: "B", path: "/b", createdAt: "t2", updatedAt: "t2" },
    ];
    saveProjects(projects);
    expect(loadProjects()).toEqual(projects);
  });

  it("returns [] when nothing is stored", () => {
    expect(loadProjects()).toEqual([]);
  });

  it("returns [] when stored JSON is invalid", () => {
    localStorage.setItem("kaast_projects", "not-json");
    expect(loadProjects()).toEqual([]);
  });
});

describe("addProject", () => {
  it("adds a new project", () => {
    const p: Project = { id: "p1", name: "A", path: "/a", createdAt: "t", updatedAt: "t" };
    addProject(p);
    expect(loadProjects()).toEqual([p]);
  });

  it("updates an existing project with the same id", () => {
    const p1: Project = { id: "p1", name: "A", path: "/a", createdAt: "t", updatedAt: "t1" };
    const p2: Project = { id: "p1", name: "A-updated", path: "/a2", createdAt: "t", updatedAt: "t2" };
    addProject(p1);
    addProject(p2);
    const projects = loadProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("A-updated");
  });
});

describe("removeProject", () => {
  it("removes a project by id", () => {
    const p1: Project = { id: "p1", name: "A", path: "/a", createdAt: "t", updatedAt: "t" };
    const p2: Project = { id: "p2", name: "B", path: "/b", createdAt: "t", updatedAt: "t" };
    saveProjects([p1, p2]);
    removeProject("p1");
    expect(loadProjects()).toEqual([p2]);
  });

  it("does nothing when id does not exist", () => {
    const p: Project = { id: "p1", name: "A", path: "/a", createdAt: "t", updatedAt: "t" };
    saveProjects([p]);
    removeProject("nonexistent");
    expect(loadProjects()).toEqual([p]);
  });
});

describe("setCurrentProject / getCurrentProject", () => {
  it("sets and gets the current project", () => {
    const p: Project = { id: "p1", name: "A", path: "/a", createdAt: "t", updatedAt: "t" };
    setCurrentProject(p);
    expect(getCurrentProject()).toEqual(p);
  });

  it("returns null when no current project is set", () => {
    expect(getCurrentProject()).toBeNull();
  });

  it("clears the current project when set to null", () => {
    const p: Project = { id: "p1", name: "A", path: "/a", createdAt: "t", updatedAt: "t" };
    setCurrentProject(p);
    setCurrentProject(null);
    expect(getCurrentProject()).toBeNull();
  });

  it("returns null when stored JSON is invalid", () => {
    localStorage.setItem("kaast_current_project", "{broken");
    expect(getCurrentProject()).toBeNull();
  });
});

describe("createProject", () => {
  it("creates a project with the given name and path", () => {
    const project = createProject("My Podcast", "/home/user/podcast");
    expect(project.name).toBe("My Podcast");
    expect(project.path).toBe("/home/user/podcast");
    expect(project.id).toMatch(/^project_\d+_[a-z0-9]+$/);
    expect(project.createdAt).toBe(project.updatedAt);
  });

  it("persists the created project", () => {
    createProject("Test", "/tmp/test");
    const projects = loadProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("Test");
  });
});
