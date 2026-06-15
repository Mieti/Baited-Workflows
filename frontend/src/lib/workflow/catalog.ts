import type { BlockDefinition } from "./types";

export const blockCatalog: BlockDefinition[] = [
  {
    type: "campaign_entrypoint",
    category: "Entry",
    label: "Campaign Start",
    description: "Defines where the automation begins.",
    icon: "play",
    color: "emerald",
    params: [
      {
        name: "audience",
        label: "Audience",
        kind: "select",
        required: true,
        options: ["All targets", "Finance group", "Executive group", "Manual selection"]
      }
    ],
    allowedBranches: ["success"]
  },
  {
    type: "create_campaign",
    category: "Campaign Actions",
    label: "Create Campaign",
    description: "Creates a phishing or awareness campaign draft.",
    icon: "mail",
    color: "sky",
    params: [
      { name: "campaignName", label: "Campaign name", kind: "text", required: true },
      {
        name: "channel",
        label: "Channel",
        kind: "select",
        required: true,
        options: ["email", "sms", "instant_message"]
      },
      {
        name: "template",
        label: "Template",
        kind: "select",
        required: true,
        options: ["Invoice reminder", "Password reset", "HR policy update"]
      }
    ],
    allowedBranches: ["success"]
  },
  {
    type: "send_message",
    category: "Campaign Actions",
    label: "Send Message",
    description: "Sends a follow-up message on a selected channel.",
    icon: "message-square",
    color: "violet",
    params: [
      {
        name: "channel",
        label: "Channel",
        kind: "select",
        required: true,
        options: ["sms", "instant_message", "email"]
      },
      { name: "messageTemplate", label: "Message template", kind: "text", required: true }
    ],
    allowedBranches: ["success"]
  },
  {
    type: "start_awareness_campaign",
    category: "Campaign Actions",
    label: "Start Awareness Campaign",
    description: "Assigns training content to selected targets.",
    icon: "graduation-cap",
    color: "amber",
    params: [
      {
        name: "trainingLevel",
        label: "Training level",
        kind: "select",
        required: true,
        options: ["basic", "intermediate", "advanced"]
      },
      { name: "dueInDays", label: "Due in days", kind: "number", required: true }
    ],
    allowedBranches: ["success"]
  },
  {
    type: "add_target_to_group",
    category: "Target Management",
    label: "Add Target To Group",
    description: "Moves matching targets into a risk or training group.",
    icon: "users",
    color: "rose",
    params: [
      {
        name: "groupId",
        label: "Group",
        kind: "select",
        required: true,
        options: ["high-risk", "medium-risk", "low-risk", "training-basic"]
      },
      {
        name: "reason",
        label: "Reason",
        kind: "select",
        required: true,
        options: ["credentials_submitted", "link_clicked", "no_response", "manual_review"]
      }
    ],
    allowedBranches: ["success"]
  },
  {
    type: "start_osint_on_targets",
    category: "Target Management",
    label: "Start OSINT On Targets",
    description: "Collects public information to prepare a scenario.",
    icon: "search",
    color: "cyan",
    params: [
      {
        name: "scanType",
        label: "Scan type",
        kind: "select",
        required: true,
        options: ["social", "company", "breach-exposure"]
      }
    ],
    allowedBranches: ["success"]
  },
  {
    type: "wait_for_event",
    category: "Logic",
    label: "Wait For Event",
    description: "Waits for a target event within a time window.",
    icon: "timer",
    color: "zinc",
    params: [
      {
        name: "event",
        label: "Event",
        kind: "select",
        required: true,
        options: ["email_opened", "link_clicked", "credentials_submitted", "message_delivered"]
      },
      { name: "window", label: "Evaluation window", kind: "text", required: true }
    ],
    allowedBranches: ["success", "timeout"]
  },
  {
    type: "condition",
    category: "Logic",
    label: "Condition",
    description: "Branches the workflow based on a previous event.",
    icon: "split",
    color: "lime",
    params: [
      {
        name: "condition",
        label: "Condition",
        kind: "select",
        required: true,
        options: ["email_opened", "link_clicked", "credentials_submitted"]
      },
      {
        name: "defaultBranch",
        label: "Default branch",
        kind: "select",
        required: true,
        options: ["else", "no", "timeout"]
      }
    ],
    allowedBranches: [
      "yes",
      "no",
      "else",
      "opened",
      "not_opened",
      "clicked",
      "not_clicked",
      "credentials_submitted",
      "not_submitted",
      "timeout"
    ]
  },
  {
    type: "mark_low_risk",
    category: "End States",
    label: "Mark Low Risk",
    description: "Ends the path and marks the target as low risk.",
    icon: "shield-check",
    color: "emerald",
    params: [],
    allowedBranches: [],
    terminal: true
  },
  {
    type: "mark_medium_risk",
    category: "End States",
    label: "Mark Medium Risk",
    description: "Ends the path and marks the target as medium risk.",
    icon: "shield-alert",
    color: "amber",
    params: [],
    allowedBranches: [],
    terminal: true
  },
  {
    type: "mark_high_risk",
    category: "End States",
    label: "Mark High Risk",
    description: "Ends the path and marks the target as high risk.",
    icon: "shield-x",
    color: "rose",
    params: [],
    allowedBranches: [],
    terminal: true
  }
];

export const blocksByType = Object.fromEntries(blockCatalog.map((block) => [block.type, block]));

export function groupedBlocks(blocks: BlockDefinition[]) {
  return blocks.reduce<Record<string, BlockDefinition[]>>((acc, block) => {
    acc[block.category] = acc[block.category] ?? [];
    acc[block.category].push(block);
    return acc;
  }, {});
}
