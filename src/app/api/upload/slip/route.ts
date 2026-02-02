import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado. Inicia sesión." }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });

    const ext = file.name.split(".").pop() || "png";
    const path = `slips/${user.id}/${Date.now()}.${ext}`;

    const buf = await file.arrayBuffer();
    const { error } = await supabase.storage
      .from("quiniela-slips")
      .upload(path, buf, { contentType: file.type, upsert: true });

    if (error) {
      const msg = error.message || "";
      if (msg.includes("Bucket") || msg.includes("bucket") || msg.includes("not found")) {
        return NextResponse.json(
          { error: "Bucket 'quiniela-slips' no existe. Créalo en Supabase → Storage → New bucket (id: quiniela-slips, público)." },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from("quiniela-slips").getPublicUrl(path);
    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al subir la imagen.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
