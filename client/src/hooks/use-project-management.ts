import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Document } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useProjectManagement(userId: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: projects = [], isLoading } = useQuery<Document[]>({
    queryKey: ["/api/projects", userId],
    enabled: !!userId,
  });

  const saveProjectMutation = useMutation({
    mutationFn: async (project: Omit<Document, "id" | "createdAt" | "updatedAt">) => {
      return await apiRequest("POST", "/api/projects", project);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", userId] });
      toast({
        title: "Project Saved",
        description: "Your project has been saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save project",
        variant: "destructive",
      });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      return await apiRequest("DELETE", `/api/projects/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", userId] });
      toast({
        title: "Project Deleted",
        description: "Project has been deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete project",
        variant: "destructive",
      });
    },
  });

  return {
    projects,
    isLoading,
    saveProject: saveProjectMutation.mutate,
    isSaving: saveProjectMutation.isPending,
    deleteProject: deleteProjectMutation.mutate,
    isDeleting: deleteProjectMutation.isPending,
  };
}
