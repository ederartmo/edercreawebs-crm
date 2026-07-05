import { buildLeadAnalysis } from "@/lib/analysis/build-lead-analysis";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Tu sesión expiró. Vuelve a iniciar sesión." },
      { status: 401 },
    );
  }

  let payload: { lead_id?: unknown };
  try {
    payload = (await request.json()) as { lead_id?: unknown };
  } catch {
    return NextResponse.json(
      { error: "No pude leer la solicitud. Inténtalo de nuevo." },
      { status: 400 },
    );
  }

  const leadId = typeof payload.lead_id === "string" ? payload.lead_id.trim() : "";
  if (!UUID_PATTERN.test(leadId)) {
    return NextResponse.json({ error: "El lead_id no es válido." }, { status: 400 });
  }

  const { data: leadData, error: leadError } = await supabase
    .from("leads")
    .select("*,contacts(*),businesses(*)")
    .eq("id", leadId)
    .maybeSingle();

  if (leadError) {
    return NextResponse.json(
      { error: "No pude cargar el lead." },
      { status: 500 },
    );
  }

  if (!leadData) {
    return NextResponse.json(
      { error: "No encontré ese lead." },
      { status: 404 },
    );
  }

  if (leadData.owner_id !== user.id) {
    return NextResponse.json(
      { error: "No puedes analizar un lead que no te pertenece." },
      { status: 403 },
    );
  }

  const startedAt = new Date().toISOString();
  const [
    { data: messages, error: messagesError },
    { data: assets, error: assetsError },
    { data: payments, error: paymentsError },
    { data: tasks, error: tasksError },
    { data: meetings, error: meetingsError },
    { data: previousAnalysisRuns, error: previousAnalysisError },
  ] = await Promise.all([
    supabase
      .from("messages")
      .select(
        "id,direction,type,sender_name,body,processed_text,transcription,created_at",
      )
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true }),
    supabase
      .from("assets")
      .select(
        "id,message_id,category,original_filename,mime_type,extracted_text,transcription,metadata",
      )
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true }),
    supabase
      .from("payments")
      .select("id,type,status,amount,currency,paid_at,created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("id,title,status,due_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false }),
    supabase
      .from("meetings")
      .select("id,type,title,status,starts_at,meeting_url")
      .eq("lead_id", leadId)
      .order("starts_at", { ascending: true }),
    supabase
      .from("automation_runs")
      .select("id")
      .eq("lead_id", leadId)
      .eq("workflow_name", "whatsapp_import_analysis_v1")
      .eq("status", "completed")
      .order("finished_at", { ascending: false })
      .limit(1),
  ]);

  if (messagesError || assetsError || paymentsError || tasksError || meetingsError || previousAnalysisError) {
    return NextResponse.json(
      { error: "No pude reunir todo el expediente del lead." },
      { status: 500 },
    );
  }

  const contact = Array.isArray(leadData.contacts) ? leadData.contacts[0] ?? null : leadData.contacts;
  const business = Array.isArray(leadData.businesses)
    ? leadData.businesses[0] ?? null
    : leadData.businesses;

  const built = buildLeadAnalysis({
    lead: {
      id: leadData.id,
      project_type: leadData.project_type,
    },
    business: business
      ? {
          name: business.name ?? null,
        }
      : null,
    contact: contact
      ? {
          full_name: contact.full_name ?? null,
          phone: contact.phone ?? null,
        }
      : null,
    messages: messages ?? [],
    assets: assets ?? [],
    payments: payments ?? [],
    tasks: tasks ?? [],
    meetings: meetings ?? [],
    previousAnalysisRun: previousAnalysisRuns?.[0] ?? null,
    userEmail: user.email ?? null,
    userDisplayName:
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : null,
  });

  const finishedAt = new Date().toISOString();
  const externalExecutionId = `lead_full_analysis_v1:${leadId}:${Date.now()}`;

  const { data: insertedRun, error: insertError } = await supabase
    .from("automation_runs")
    .insert({
      owner_id: user.id,
      lead_id: leadId,
      workflow_name: "lead_full_analysis_v1",
      external_execution_id: externalExecutionId,
      status: "completed",
      input: built.input,
      output: built.output,
      error: null,
      started_at: startedAt,
      finished_at: finishedAt,
    })
    .select("id,finished_at")
    .single();

  if (insertError || !insertedRun) {
    return NextResponse.json(
      { error: "No pude guardar el nuevo análisis del expediente." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    run_id: insertedRun.id,
    finished_at: insertedRun.finished_at,
  });
}
