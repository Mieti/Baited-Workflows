import { demoWorkflowPayload } from "@/lib/workflow/demo";
import { validateWorkflowClient } from "@/lib/workflow/validation";
import type {
  BlockDefinition,
  SubmissionRead,
  ValidationResult,
  WorkflowPayload,
  WorkflowRead
} from "@/lib/workflow/types";
import { blockCatalog } from "@/lib/workflow/catalog";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ApiOptions = {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
};

class ApiNetworkError extends Error {
  constructor(public originalError: unknown) {
    super("FastAPI backend is unreachable. Local fallback data is being used where possible.");
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
    response = await fetch(`${API_URL}${path}`, {
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
  try {
    return await request<BlockDefinition[]>("/api/workflow-blocks");
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    return blockCatalog;
  }
}

export async function getDemoWorkflow(): Promise<WorkflowRead> {
  try {
    return await request<WorkflowRead>("/api/workflows/demo");
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    return {
      id: "local-demo",
      name: "Baited demo workflow",
      description: "Local fallback demo while the API is offline.",
      status: "draft",
      version: 1,
      definition: demoWorkflowPayload.definition,
      layout: demoWorkflowPayload.layout,
      validationResult: validateWorkflowClient(demoWorkflowPayload),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
}

export async function saveWorkflow(
  workflowId: string,
  name: string,
  description: string,
  payload: WorkflowPayload
): Promise<WorkflowRead> {
  if (workflowId === "local-demo") {
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
  workflowId: string,
  payload: WorkflowPayload
): Promise<ValidationResult> {
  try {
    if (workflowId === "local-demo") {
      return await request<ValidationResult>("/api/workflows/validate", {
        method: "POST",
        body: payload
      });
    }
    return await request<ValidationResult>(`/api/workflows/${workflowId}/validate`, {
      method: "POST",
      body: payload
    });
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    return validateWorkflowClient(payload);
  }
}

export async function submitWorkflow(
  workflowId: string,
  payload: WorkflowPayload
): Promise<SubmissionRead> {
  if (workflowId === "local-demo") {
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

function isNetworkError(error: unknown): error is ApiNetworkError {
  return error instanceof ApiNetworkError;
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
