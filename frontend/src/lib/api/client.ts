import type {
  BlockDefinition,
  SubmissionRead,
  ValidationResult,
  WorkflowPayload,
  WorkflowRead
} from "@/lib/workflow/types";

type ApiOptions = {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
};

class ApiNetworkError extends Error {
  constructor(public originalError: unknown) {
    super("Backend unavailable. Please retry in a moment.");
    this.name = "ApiNetworkError";
  }
}

class ApiRequestError extends Error {
  constructor(
    public status: number,
    public detail: unknown
  ) {
    super(formatApiErrorMessage(status, detail));
    this.name = "ApiRequestError";
  }
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      method: options.method ?? "GET",
      headers: { "Content-Type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
  } catch (error) {
    throw new ApiNetworkError(error);
  }

  if (!response.ok) {
    throw new ApiRequestError(response.status, await readResponseBody(response));
  }

  return response.json() as Promise<T>;
}

export async function getWorkflowBlocks(): Promise<BlockDefinition[]> {
  return request<BlockDefinition[]>("/api/workflow-blocks");
}

export async function getDemoWorkflow(): Promise<WorkflowRead> {
  return request<WorkflowRead>("/api/workflows/demo");
}

export async function saveWorkflow(
  workflowId: string | null,
  name: string,
  description: string,
  payload: WorkflowPayload
): Promise<WorkflowRead> {
  if (!workflowId) {
    return request<WorkflowRead>("/api/workflows", {
      method: "POST",
      body: { name, description, ...payload }
    });
  }

  return request<WorkflowRead>(`/api/workflows/${workflowId}`, {
    method: "PUT",
    body: { name, description, ...payload }
  });
}

export async function validateWorkflow(
  workflowId: string | null,
  payload: WorkflowPayload
): Promise<ValidationResult> {
  if (!workflowId) {
    return request<ValidationResult>("/api/workflows/validate", {
      method: "POST",
      body: payload
    });
  }

  return request<ValidationResult>(`/api/workflows/${workflowId}/validate`, {
    method: "POST",
    body: payload
  });
}

export async function submitWorkflow(
  workflowId: string | null,
  payload: WorkflowPayload
): Promise<SubmissionRead> {
  if (!workflowId) {
    throw new Error("Save the workflow once before submitting it.");
  }
  return request<SubmissionRead>(`/api/workflows/${workflowId}/submit`, {
    method: "POST",
    body: payload
  });
}

export function getApiErrorMessage(error: unknown, fallback = "API request failed.") {
  return error instanceof Error ? error.message : fallback;
}

async function readResponseBody(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function formatApiErrorMessage(status: number, detail: unknown) {
  const detailMessage = extractDetailMessage(detail);
  return detailMessage ? `API request failed (${status}): ${detailMessage}` : `API request failed (${status}).`;
}

function extractDetailMessage(detail: unknown): string | null {
  if (typeof detail === "string") return detail;
  if (!detail || typeof detail !== "object") return null;

  const body = detail as {
    detail?: unknown;
    message?: unknown;
    errors?: unknown;
  };

  if (typeof body.message === "string") return body.message;
  if (typeof body.detail === "string") return body.detail;

  if (Array.isArray(body.detail)) {
    const firstIssue = body.detail[0] as { msg?: unknown } | undefined;
    if (typeof firstIssue?.msg === "string") return firstIssue.msg;
  }

  const validationDetail = body.detail as { errors?: unknown } | undefined;
  if (Array.isArray(validationDetail?.errors)) {
    const firstError = validationDetail.errors[0] as { message?: unknown } | undefined;
    if (typeof firstError?.message === "string") return firstError.message;
  }

  if (Array.isArray(body.errors)) {
    const firstError = body.errors[0] as { message?: unknown } | undefined;
    if (typeof firstError?.message === "string") return firstError.message;
  }

  return null;
}
