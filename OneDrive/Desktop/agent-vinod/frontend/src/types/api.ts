/** Shared TypeScript interfaces matching the backend Pydantic models. */

export interface Workspace {
  id: string;
  organization_id?: string | null;
  name: string;
  description: string | null;
  product_url: string | null;
  allowed_domains: string;
  browser_auth_mode: string;
  public_token: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceCreate {
  name: string;
  description?: string;
  product_url?: string;
  allowed_domains?: string;
  browser_auth_mode?: string;
}

export interface Document {
  id: string;
  workspace_id: string;
  filename: string;
  file_type: string;
  content_text: string | null;
  status: string;
  created_at: string;
}

export interface Credential {
  id: string;
  workspace_id: string;
  label: string;
  login_url: string;
  is_active: boolean;
  created_at: string;
}

export interface CredentialCreate {
  label: string;
  login_url: string;
  username: string;
  password: string;
}

export interface DemoRecipe {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  trigger_phrases: string;
  steps_json: string;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface RecipeCreate {
  name: string;
  description?: string;
  trigger_phrases?: string;
  steps_json: string;
  priority: number;
}

export interface PolicyRule {
  id: string;
  workspace_id: string;
  rule_type: string;
  pattern: string;
  description: string | null;
  action: string;
  severity: string;
  is_active: boolean;
  created_at: string;
}

export interface PolicyCreate {
  rule_type: string;
  pattern: string;
  description?: string;
  action: string;
  severity: string;
}

export interface DemoSession {
  id: string;
  workspace_id: string;
  status: string;
  buyer_name: string | null;
  buyer_email: string | null;
  mode: string;
  live_status: string;
  active_recipe_id: string | null;
  current_step_index: number;
  live_room_name: string | null;
  started_at: string;
  ended_at: string | null;
}

export interface LiveStartResponse {
  mode: string;
  livekit_url: string | null;
  room_name: string | null;
  participant_token: string | null;
  participant_identity: string | null;
  participant_name: string | null;
  event_ws_url: string | null;
  browser_session_id: string | null;
  capabilities_json: string;
  message: string | null;
}

export interface LiveControlResponse {
  session_id: string;
  live_status: string;
  active_recipe_id: string | null;
  current_step_index: number;
  detail: string | null;
}

export interface SessionMessage {
  id: string;
  session_id: string;
  role: "user" | "agent" | "system";
  content: string;
  message_type: string;
  planner_decision: string | null;
  created_at: string;
}

export interface SessionSummary {
  id: string;
  session_id: string;
  summary_text: string;
  top_questions: string;
  features_interest: string;
  objections: string;
  unresolved_items: string;
  escalation_reasons: string;
  lead_intent_score: number;
  total_messages: number;
  total_actions: number;
  duration_seconds: number;
  created_at: string;
}

export interface WorkspaceAnalytics {
  workspace_id: string;
  total_sessions: number;
  completed_sessions: number;
  average_lead_score: number;
  total_messages: number;
  total_browser_actions: number;
  top_questions: string[];
  features_interest: string[];
  objections: string[];
  sessions: {
    id: string;
    buyer_name: string | null;
    status: string;
    mode: string;
    started_at: string | null;
    ended_at: string | null;
  }[];
}

export type AgentStatus =
  | "idle"
  | "thinking"
  | "checking_docs"
  | "navigating"
  | "showing_feature"
  | "escalated"
  | "error";

export interface AdminSessionUser {
  id: string;
  email: string;
  full_name: string;
}

export interface AdminSessionInfo {
  user: AdminSessionUser;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  role: "owner" | "admin" | "editor" | "viewer";
}

export interface AdminProduct extends Workspace {
  knowledge_count: number;
  session_count: number;
  recording_enabled: boolean;
  citation_mode: string;
  navigation_style: string;
  live_link: string;
  embed_code: string;
  share_title: string;
  share_description: string;
}

export interface DashboardPayload {
  stats: {
    products: number;
    demos_taken: number;
    completed_demos: number;
    positive_intent_sessions: number;
    average_intent_score: number;
    transcript_coverage: number;
    recording_enabled_products: number;
  };
  reports: {
    top_questions: string[];
    objections: string[];
    features_interest: string[];
  };
  products: AdminProduct[];
}

export interface KnowledgeSource {
  id: string;
  workspace_id: string;
  source_type: string;
  title: string;
  source_url: string | null;
  file_name: string | null;
  status: string;
  sync_status: string;
  metadata: Record<string, unknown>;
  document_id: string | null;
  jobs: {
    id: string;
    status: string;
    job_type: string;
    error_message: string | null;
  }[];
  created_at: string;
  updated_at: string;
}

export interface ProductConfig {
  agent_name: string;
  greeting_template: string;
  warmth: number;
  enthusiasm: number;
  formality: number;
  response_length: string;
  confidence_threshold: number;
  citation_mode: string;
  navigation_style: string;
  model_provider: string;
  avoid_topics_json: string;
  escalation_message: string;
  escalation_destination: string;
}

export interface ProductSessionSettings {
  time_limit_minutes: number;
  welcome_flow: string;
  suggested_questions_json: string;
  post_session_message: string;
  recording_enabled: boolean;
}

export interface ProductShareSettings {
  live_link: string;
  embed_code: string;
  share_title: string;
  share_description: string;
}

export interface EmbedShareEntry extends ProductShareSettings {
  product_id: string;
  product_name: string;
}

export interface BrandingSettings {
  company_name: string;
  logo_url: string;
  primary_color: string;
  accent_color: string;
}

export interface SessionRecording {
  id: string;
  video_path: string | null;
  audio_path: string | null;
  status: string;
  duration_seconds: number | null;
}

export interface Citation {
  document_id: string;
  title: string;
  source_type: string;
  source_url: string | null;
  excerpt: string;
}
