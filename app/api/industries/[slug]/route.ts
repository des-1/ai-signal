import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const db = supabaseAdmin();
  const body = await request.json();

  const { data, error } = await db
    .from("industries")
    .update(body)
    .eq("slug", params.slug)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const db = supabaseAdmin();

  const { error } = await db
    .from("industries")
    .delete()
    .eq("slug", params.slug);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
