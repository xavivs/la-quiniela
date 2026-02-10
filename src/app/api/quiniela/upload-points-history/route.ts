import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";
import { QUINIELA_NAMES } from "@/lib/quiniela-constants";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: dbUser } = await supabase.from("users").select("role").eq("id", user.id).single();
  const role = (dbUser?.role as "user" | "admin" | "superadmin") ?? "user";
  if (role !== "admin" && role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as unknown[][];

    if (data.length < 2) {
      return NextResponse.json({ error: "El Excel debe tener al menos 2 filas (encabezados y datos)" }, { status: 400 });
    }

    // Primera fila: primera columna puede ser "Nombre", luego nombres de usuarios (Xavi, Laura, Montse, etc.)
    // Segunda fila: puede ser "TOTAL" con los totales (la ignoramos)
    // Filas siguientes: primera columna "Jornada N", luego puntos por usuario

    const headerRow = data[0] as string[];
    const secondRow = data[1] as string[];

    // La primera fila debe tener los nombres de usuarios (ignorar primera columna si dice "Nombre")
    const userNamesRow = headerRow;
    let jornadasStartRow = 1;
    let firstDataColumn = 0;

    // Si la primera columna dice "Nombre", los nombres empiezan desde la columna 1
    if (headerRow[0]?.toString().trim().toUpperCase() === "NOMBRE") {
      firstDataColumn = 1;
    }

    // Si la segunda fila empieza con "TOTAL", la ignoramos y empezamos desde la tercera
    if (secondRow[0]?.toString().toUpperCase().trim() === "TOTAL") {
      jornadasStartRow = 2;
    }

    // Mapear índices de columnas a quiniela_name (empezar desde firstDataColumn)
    // Buscar nombres con coincidencia flexible (ignorar mayúsculas/minúsculas)
    const columnToName: Record<number, string> = {};
    const nameMap: Record<string, string> = {}; // nombre en Excel -> nombre correcto en QUINIELA_NAMES
    for (const correctName of QUINIELA_NAMES) {
      nameMap[correctName.toLowerCase()] = correctName;
    }

    for (let i = firstDataColumn; i < userNamesRow.length; i++) {
      const name = userNamesRow[i]?.toString().trim();
      if (!name) continue;
      
      // Buscar coincidencia exacta primero
      if (QUINIELA_NAMES.includes(name as typeof QUINIELA_NAMES[number])) {
        columnToName[i] = name;
      } else {
        // Buscar coincidencia sin distinguir mayúsculas/minúsculas
        const lowerName = name.toLowerCase();
        if (nameMap[lowerName]) {
          columnToName[i] = nameMap[lowerName];
        }
      }
    }

    if (Object.keys(columnToName).length === 0) {
      const foundNames = headerRow
        .slice(firstDataColumn)
        .map((h) => h?.toString().trim())
        .filter((h) => h);
      return NextResponse.json(
        {
          error:
            "No se encontraron nombres de usuarios válidos en el Excel. Debe contener: " +
            QUINIELA_NAMES.join(", ") +
            ". Nombres encontrados en la primera fila: " +
            foundNames.join(", "),
        },
        { status: 400 }
      );
    }

    // Obtener usuarios de la BD
    const expectedNames = Object.values(columnToName);
    const { data: users } = await supabase
      .from("users")
      .select("id, quiniela_name")
      .in("quiniela_name", expectedNames);

    const nameToUserId: Record<string, string> = {};
    for (const u of users ?? []) {
      if (u.quiniela_name) nameToUserId[u.quiniela_name] = u.id;
    }

    if (Object.keys(nameToUserId).length === 0) {
      return NextResponse.json(
        {
          error: `No se encontraron usuarios en la base de datos para los nombres: ${expectedNames.join(", ")}. Asegúrate de que los usuarios existan con esos quiniela_name.`,
        },
        { status: 400 }
      );
    }

    // Obtener jornadas existentes (de todas las temporadas para evitar duplicados)
    const { data: jornadas } = await supabase.from("jornadas").select("id, number, season").order("number", { ascending: true });
    const jornadaNumberToId: Record<number, string> = {};
    // Si hay múltiples jornadas con el mismo número, usar la más reciente o la de la temporada activa
    for (const j of jornadas ?? []) {
      // Si ya existe una jornada con este número, mantener la existente (evitar sobrescribir)
      if (!jornadaNumberToId[j.number]) {
        jornadaNumberToId[j.number] = j.id;
      }
    }

    // Detectar qué jornadas necesitamos del Excel (antes de procesar filas)
    const jornadasNeeded = new Set<number>();
    for (let rowIdx = jornadasStartRow; rowIdx < data.length; rowIdx++) {
      const row = data[rowIdx] as unknown[];
      if (!row || row.length === 0) continue;
      const firstCell = row[0]?.toString().trim();
      if (!firstCell) continue;
      const jornadaMatch =
        firstCell.match(/jornada\s*(\d+)/i) ||
        firstCell.match(/^(\d+)$/) ||
        firstCell.match(/^(\d+)\s*ª?$/i);
      if (jornadaMatch) {
        jornadasNeeded.add(parseInt(jornadaMatch[1], 10));
      }
    }

    // Obtener temporada activa para las jornadas históricas
    const { data: activeSeason } = await supabase
      .from("seasons")
      .select("name")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    const seasonName = activeSeason?.name ?? "2024-25";
    const errors: string[] = [];

    // Crear jornadas históricas que falten
    const jornadasCreated: number[] = [];
    for (const jornadaNumber of Array.from(jornadasNeeded)) {
      if (!jornadaNumberToId[jornadaNumber]) {
        const { data: newJornada, error: errJ } = await supabase
          .from("jornadas")
          .insert({
            number: jornadaNumber,
            season: seasonName,
            is_historical: true,
          })
          .select("id")
          .single();
        if (errJ) {
          errors.push(`Error al crear jornada ${jornadaNumber}: ${errJ.message}`);
        } else if (newJornada) {
          jornadaNumberToId[jornadaNumber] = newJornada.id;
          jornadasCreated.push(jornadaNumber);
        }
      }
    }

    // Procesar filas de jornadas
    const pointsToInsert: Array<{ user_id: string; jornada_id: string; points: number }> = [];
    let rowsProcessed = 0;

    for (let rowIdx = jornadasStartRow; rowIdx < data.length; rowIdx++) {
      const row = data[rowIdx] as unknown[];
      if (!row || row.length === 0) continue;

      const firstCell = row[0]?.toString().trim();
      if (!firstCell) continue;

      // Buscar "Jornada N", "JornadaN", o solo número en la primera celda
      const jornadaMatch =
        firstCell.match(/jornada\s*(\d+)/i) ||
        firstCell.match(/^(\d+)$/) ||
        firstCell.match(/^(\d+)\s*ª?$/i);
      if (!jornadaMatch) {
        // No es una jornada, continuar
        continue;
      }

      rowsProcessed++;
      const jornadaNumber = parseInt(jornadaMatch[1], 10);
      let jornadaId = jornadaNumberToId[jornadaNumber];
      
      // Si la jornada no existe, intentar crearla ahora (por si acaso no se creó antes)
      if (!jornadaId) {
        const { data: newJornada, error: errJ } = await supabase
          .from("jornadas")
          .insert({
            number: jornadaNumber,
            season: seasonName,
            is_historical: true,
          })
          .select("id")
          .single();
        if (errJ) {
          errors.push(`Error al crear jornada ${jornadaNumber}: ${errJ.message}`);
          continue;
        } else if (newJornada) {
          jornadaNumberToId[jornadaNumber] = newJornada.id;
          jornadaId = newJornada.id;
          if (!jornadasCreated.includes(jornadaNumber)) {
            jornadasCreated.push(jornadaNumber);
          }
        } else {
          errors.push(`Jornada ${jornadaNumber} no se pudo crear.`);
          continue;
        }
      }

      // Leer puntos por columna
      for (const [colIdx, quinielaName] of Object.entries(columnToName)) {
        const userId = nameToUserId[quinielaName];
        if (!userId) {
          errors.push(`Usuario ${quinielaName} no encontrado en la base de datos`);
          continue;
        }

        const colIndex = parseInt(colIdx, 10);
        if (colIndex >= row.length) {
          errors.push(`Columna ${colIndex} fuera de rango para jornada ${jornadaNumber}, usuario ${quinielaName}`);
          continue;
        }

        const pointsValue = row[colIndex];
        let points = 0;
        
        // Manejar diferentes tipos de valores
        if (pointsValue == null || pointsValue === "") {
          points = 0;
        } else if (typeof pointsValue === "number") {
          points = Math.max(0, Math.round(pointsValue));
        } else if (typeof pointsValue === "string") {
          const trimmed = pointsValue.trim();
          if (trimmed === "" || trimmed === "-") {
            points = 0;
          } else {
            const parsed = parseInt(trimmed, 10);
            if (!isNaN(parsed)) {
              points = Math.max(0, parsed);
            }
          }
        } else if (typeof pointsValue === "boolean") {
          points = 0;
        }

        // Insertar siempre (incluso si points es 0, puede ser válido)
        pointsToInsert.push({ user_id: userId, jornada_id: jornadaId, points });
      }
    }

    if (rowsProcessed === 0) {
      return NextResponse.json(
        {
          error:
            "No se encontraron filas de jornadas. Verifica que las filas empiecen con 'Jornada N' o un número. Filas procesadas: " +
            data.length,
        },
        { status: 400 }
      );
    }

    if (pointsToInsert.length === 0) {
      const jornadasInExcel = new Set<number>();
      for (let rowIdx = jornadasStartRow; rowIdx < data.length; rowIdx++) {
        const row = data[rowIdx] as unknown[];
        if (!row || row.length === 0) continue;
        const firstCell = row[0]?.toString().trim();
        const jornadaMatch = firstCell?.match(/jornada\s*(\d+)/i) || firstCell?.match(/^(\d+)$/) || firstCell?.match(/^(\d+)\s*ª?$/i);
        if (jornadaMatch) {
          jornadasInExcel.add(parseInt(jornadaMatch[1], 10));
        }
      }
      
      const jornadasExcelList = Array.from(jornadasInExcel).sort((a, b) => a - b);
      const jornadasBdList = Object.keys(jornadaNumberToId).map(Number).sort((a, b) => a - b);
      
      return NextResponse.json(
        {
          error: `No se encontraron puntos para insertar. Se procesaron ${rowsProcessed} filas de jornadas pero ninguna jornada del Excel existe en la base de datos. Jornadas en Excel: ${jornadasExcelList.join(", ")}. Jornadas en BD: ${jornadasBdList.length > 0 ? jornadasBdList.join(", ") : "ninguna"}. Crea las jornadas primero en Admin.`,
        },
        { status: 400 }
      );
    }

    // Insertar/actualizar puntos históricos (upsert)
    let inserted = 0;
    for (const item of pointsToInsert) {
      const { error } = await supabase
        .from("quiniela_points_history")
        .upsert(
          { user_id: item.user_id, jornada_id: item.jornada_id, points: item.points },
          { onConflict: "user_id,jornada_id" }
        );
      if (!error) inserted++;
    }

    const messageParts = [];
    if (jornadasCreated.length > 0) {
      messageParts.push(`Se crearon ${jornadasCreated.length} jornada(s) histórica(s): ${jornadasCreated.sort((a, b) => a - b).join(", ")}`);
    }
    const jornadasProcessed = new Set(pointsToInsert.map(p => {
      const jornadaNum = Object.entries(jornadaNumberToId).find(([_, id]) => id === p.jornada_id)?.[0];
      return jornadaNum ? parseInt(jornadaNum, 10) : null;
    })).filter(n => n !== null) as number[];
    if (jornadasProcessed.length > 0) {
      messageParts.push(`Jornadas procesadas: ${jornadasProcessed.sort((a, b) => a - b).join(", ")}`);
    }
    messageParts.push(`Se procesaron ${inserted} registros de puntos históricos.`);
    if (errors.length > 0) {
      messageParts.push(`Errores: ${errors.slice(0, 5).join("; ")}`);
    }

    return NextResponse.json({
      ok: true,
      message: messageParts.join(" "),
      inserted,
      jornadasCreated,
      errors: errors.slice(0, 10),
    });
  } catch (err) {
    console.error("Error processing Excel:", err);
    return NextResponse.json(
      { error: "Error al procesar el Excel: " + String(err) },
      { status: 500 }
    );
  }
}
