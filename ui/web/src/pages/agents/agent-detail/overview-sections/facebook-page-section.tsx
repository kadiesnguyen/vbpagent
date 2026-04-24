import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle2, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHttp } from "@/hooks/use-ws";

interface FacebookPage {
  page_id: string;
  page_name: string;
  category?: string;
}

interface FacebookAssignmentResponse {
  assigned: boolean;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  pages?: FacebookPage[];
  assigned_at?: string;
}

interface FacebookPageSectionProps {
  agentId: string;
}

export function FacebookPageSection({ agentId }: FacebookPageSectionProps) {
  const http = useHttp();
  const queryClient = useQueryClient();

  const { data: assignmentData, isLoading: loadingAssignment } = useQuery<FacebookAssignmentResponse>({
    queryKey: ["agents", agentId, "facebook"],
    queryFn: () => http.get<FacebookAssignmentResponse>(`/v1/agents/${agentId}/facebook`),
    staleTime: 30_000,
    retry: false,
  });

  const unassignMutation = useMutation({
    mutationFn: async () => {
      return http.delete(`/v1/agents/${agentId}/facebook`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "facebook"] });
    },
    onError: (error: any) => {
      console.error("Failed to unassign Facebook account:", error);
    },
  });

  const currentAssignment = assignmentData?.assigned ? assignmentData : null;
  const isLoading = loadingAssignment;

  const handleUnassign = () => {
    if (currentAssignment) {
      unassignMutation.mutate();
    }
  };

  const authLink = `${window.location.origin}/fb/auth?agent_id=${agentId}`;

  const copyAuthLink = () => {
    navigator.clipboard.writeText(authLink);
  };

  return (
    <section className="space-y-3 rounded-lg border p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          <h3 className="text-sm font-medium">Facebook Page Integration</h3>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Kết nối Facebook Page với agent này để agent có thể tương tác với Facebook.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Đang tải...
        </div>
      ) : currentAssignment ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-green-800 dark:text-green-200 truncate">
                  {currentAssignment.user_name}
                </p>
                {currentAssignment.user_email && (
                  <p className="text-xs text-green-600 dark:text-green-400 truncate">
                    {currentAssignment.user_email}
                  </p>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleUnassign}
              disabled={unassignMutation.isPending}
              className="flex-shrink-0"
              title="Gỡ kết nối"
            >
              {unassignMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
            </Button>
          </div>

          {currentAssignment.pages && currentAssignment.pages.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium">Pages được quản lý ({currentAssignment.pages.length})</p>
              <div className="space-y-1">
                {currentAssignment.pages.map((page) => (
                  <div
                    key={page.page_id}
                    className="rounded-md border bg-muted p-2"
                  >
                    <p className="text-xs font-medium">{page.page_name}</p>
                    {page.category && (
                      <p className="text-xs text-muted-foreground">{page.category}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Chưa kết nối tài khoản Facebook. Gửi link bên dưới cho người dùng để xác thực.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium">Link xác thực Facebook</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={authLink}
                className="flex-1 rounded-md border bg-muted px-3 py-2 text-xs font-mono"
                onClick={(e) => e.currentTarget.select()}
              />
              <Button size="sm" onClick={copyAuthLink}>
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Sau khi xác thực xong, F5 trang này để xem tất cả Pages được kết nối.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
