import CloudConvert from "cloudconvert";

function blobToFile(blob: Blob, filename: string): File {
  return new File([blob], filename, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export async function cloudConvertDocxToPdf(
  docxBlob: Blob,
  apiKey: string,
  outName = "reporte.pdf"
): Promise<Blob> {
  const cloudConvert = new CloudConvert(apiKey);

  // 1) Crear job (import/upload -> convert -> export/url)
  const job = await cloudConvert.jobs.create({
    tasks: {
      "import-docx": { operation: "import/upload" },
      "convert-to-pdf": {
        operation: "convert",
        input: "import-docx",
        input_format: "docx",
        output_format: "pdf",
      },
      "export-pdf": {
        operation: "export/url",
        input: "convert-to-pdf",
        inline: false,
      },
    },
  });

  // 2) Subir el archivo al URL que CloudConvert devuelve
  const uploadTask: any = Object.values(job.tasks).find((t: any) => t.name === "import-docx");
  const form = new FormData();

  // cloudconvert te da "result.form" con los campos y "result.url"
  const uploadUrl = uploadTask.result.form.url;
  const params = uploadTask.result.form.parameters;

  Object.entries(params).forEach(([k, v]) => form.append(k, String(v)));

  const file = blobToFile(docxBlob, "reporte.docx");
  form.append("file", file);

  const upResp = await fetch(uploadUrl, { method: "POST", body: form });
  if (!upResp.ok) throw new Error("CloudConvert: fallo subiendo el DOCX");

  // 3) Esperar a que termine
  const done = await cloudConvert.jobs.wait(job.id);

  const exportTask: any = Object.values(done.tasks).find((t: any) => t.name === "export-pdf");
  const fileUrl = exportTask.result.files?.[0]?.url;
  if (!fileUrl) throw new Error("CloudConvert: no devolvió URL del PDF");

  // 4) Descargar PDF (bytes)
  const pdfResp = await fetch(fileUrl);
  if (!pdfResp.ok) throw new Error("CloudConvert: no se pudo descargar el PDF");

  const pdfBlob = await pdfResp.blob();

  // Tip: fuerza MIME a pdf por si acaso
  return new Blob([await pdfBlob.arrayBuffer()], { type: "application/pdf" });
}