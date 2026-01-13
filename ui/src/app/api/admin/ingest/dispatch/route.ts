import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const githubToken = process.env.GITHUB_TOKEN;
const githubOwner = process.env.GITHUB_OWNER;
const githubRepo = process.env.GITHUB_REPO;
const githubWorkflow = process.env.GITHUB_WORKFLOW_FILE;

const allowedActions = new Set(["initial", "current"]);

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase env não configurado." }, { status: 500 });
  }

  if (!githubToken || !githubOwner || !githubRepo || !githubWorkflow) {
    return NextResponse.json({ error: "GitHub env não configurado." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const { data: adminData, error: adminError } = await supabase
    .from("admin_users")
    .select("id, is_active")
    .eq("user_id", userData.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (adminError || !adminData?.is_active) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  let payload: { dataset?: string; action?: string } = {};

  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  if (!payload.dataset || !payload.action) {
    return NextResponse.json({ error: "Dataset ou action ausente." }, { status: 400 });
  }

  if (!allowedActions.has(payload.action)) {
    return NextResponse.json({ error: "Action inválida." }, { status: 400 });
  }

  const { data: jobData, error: jobError } = await supabase
    .from("ingest_jobs")
    .insert({
      dataset: payload.dataset,
      params: { action: payload.action },
      status: "queued",
      requested_by: userData.user.id,
    })
    .select("id, status")
    .single();

  if (jobError || !jobData) {
    return NextResponse.json({ error: "Falha ao criar job." }, { status: 500 });
  }

  const dispatchResponse = await fetch(
    `https://api.github.com/repos/${githubOwner}/${githubRepo}/actions/workflows/${githubWorkflow}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: process.env.GITHUB_REF ?? "main",
        inputs: {
          dataset: payload.dataset,
          action: payload.action,
        },
      }),
    }
  );

  if (!dispatchResponse.ok) {
    const errorText = await dispatchResponse.text();
    return NextResponse.json({ error: errorText || "Falha ao disparar workflow." }, { status: 502 });
  }

  return NextResponse.json({ job_id: jobData.id, status: jobData.status });
}
