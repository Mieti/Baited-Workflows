import type { WorkflowDefinition, WorkflowLayout, WorkflowPayload } from "./types";

export const demoDefinition: WorkflowDefinition = {
  schemaVersion: 1,
  nodes: [
    {
      id: "start",
      type: "campaign_entrypoint",
      label: "Finance targets",
      params: { audience: "Finance group" }
    },
    {
      id: "email",
      type: "create_campaign",
      label: "Initial phishing email",
      params: {
        campaignName: "Finance Q3 invoice simulation",
        channel: "email",
        template: "Invoice reminder"
      }
    },
    {
      id: "wait-open",
      type: "wait_for_event",
      label: "Wait 48h for open",
      params: { event: "email_opened", window: "48h" }
    },
    {
      id: "opened-condition",
      type: "condition",
      label: "Email opened?",
      params: { condition: "email_opened" }
    },
    {
      id: "sms",
      type: "send_message",
      label: "Send SMS follow-up",
      params: { channel: "sms", messageTemplate: "Security reminder" }
    },
    {
      id: "wait-creds",
      type: "wait_for_event",
      label: "Wait 24h for credentials",
      params: { event: "credentials_submitted", window: "24h" }
    },
    {
      id: "creds-condition",
      type: "condition",
      label: "Credentials submitted?",
      params: { condition: "credentials_submitted" }
    },
    {
      id: "high-risk-group",
      type: "add_target_to_group",
      label: "Move to high risk",
      params: { groupId: "high-risk", reason: "credentials_submitted" }
    },
    {
      id: "training",
      type: "start_awareness_campaign",
      label: "Assign basic training",
      params: { trainingLevel: "basic", dueInDays: 7 }
    },
    { id: "low-risk", type: "mark_low_risk", label: "Mark low risk", params: {} },
    { id: "medium-risk", type: "mark_medium_risk", label: "Mark medium risk", params: {} },
    { id: "high-risk", type: "mark_high_risk", label: "Mark high risk", params: {} }
  ],
  edges: [
    { id: "e-start-email", source: "start", target: "email", branch: "success" },
    { id: "e-email-wait", source: "email", target: "wait-open", branch: "success" },
    {
      id: "e-wait-open-condition",
      source: "wait-open",
      target: "opened-condition",
      branch: "success"
    },
    { id: "e-opened-low", source: "opened-condition", target: "low-risk", branch: "opened" },
    { id: "e-not-opened-sms", source: "opened-condition", target: "sms", branch: "not_opened" },
    { id: "e-sms-wait", source: "sms", target: "wait-creds", branch: "success" },
    {
      id: "e-wait-creds-condition",
      source: "wait-creds",
      target: "creds-condition",
      branch: "success"
    },
    {
      id: "e-creds-high",
      source: "creds-condition",
      target: "high-risk-group",
      branch: "credentials_submitted"
    },
    {
      id: "e-creds-medium",
      source: "creds-condition",
      target: "medium-risk",
      branch: "not_submitted"
    },
    {
      id: "e-high-training",
      source: "high-risk-group",
      target: "training",
      branch: "success"
    },
    { id: "e-training-high", source: "training", target: "high-risk", branch: "success" }
  ]
};

export const demoLayout: WorkflowLayout = {
  nodes: {
    start: { x: -220, y: 20 },
    email: { x: 40, y: 20 },
    "wait-open": { x: 320, y: 20 },
    "opened-condition": { x: 600, y: 20 },
    "low-risk": { x: 880, y: -120 },
    sms: { x: 880, y: 130 },
    "wait-creds": { x: 1160, y: 130 },
    "creds-condition": { x: 1440, y: 130 },
    "medium-risk": { x: 1720, y: 20 },
    "high-risk-group": { x: 1720, y: 240 },
    training: { x: 2000, y: 240 },
    "high-risk": { x: 2280, y: 240 }
  },
  viewport: { x: 0, y: 0, zoom: 0.72 }
};

export const demoWorkflowPayload: WorkflowPayload = {
  definition: demoDefinition,
  layout: demoLayout
};
