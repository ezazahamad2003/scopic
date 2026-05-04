import { useState, useEffect, useCallback } from "react";
import { getProjects, saveProject, deleteProject } from "../utils/storage.js";

export function useProjects() {
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    refresh();
  }, []);

  const refresh = useCallback(async () => {
    const list = await getProjects();
    setProjects(list || []);
  }, []);

  const upsert = useCallback(async (project) => {
    const list = await saveProject(project);
    if (Array.isArray(list)) setProjects(list);
    else await refresh();
    return project;
  }, [refresh]);

  const remove = useCallback(async (id) => {
    await deleteProject(id);
    await refresh();
  }, [refresh]);

  return { projects, upsertProject: upsert, deleteProject: remove, refreshProjects: refresh };
}
