import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { useAcuerdoData } from "@/shared/useAcuerdoData";
import { Spinner } from "@/shared/ui/spinner";
import numeroALetras from "@/shared/numeroALetras";
import { CuotaAmortizacionVisual } from "@/modules/cobranza/models/cuotaVisual.model";


interface Props {
  clienteId: string;
  deudorId: string;
  cuotasVisuales?: CuotaAmortizacionVisual[]; // ✅ NUEVO
}


export function AcuerdoPDFView({ clienteId, deudorId, cuotasVisuales }: Props) {
  const cuotas = cuotasVisuales ?? [];
  const { data, loading } = useAcuerdoData(clienteId, deudorId);
  const printRef = useRef(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });
  const fechaActual = new Date().toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (loading) return <Spinner className="h-5 w-5 animate-spin text-primary" />;
  if (!data) return <p className="text-sm text-muted-foreground">No hay datos de acuerdo.</p>;

  const deudor = data.deudor;
  const cliente = data.cliente;


  return (
    <div className="space-y-4">
      <div className="text-right">
        <button
          onClick={handlePrint}
          className="bg-primary text-white px-4 py-2 rounded hover:bg-primary/90"
        >
          Imprimir acuerdo
        </button>
      </div>

      <div ref={printRef} className="bg-white p-6 text-black rounded shadow">
        <h1 className="text-xl font-bold text-center mb-4 text-blue-800">ACUERDO DE PAGO CELEBRADO
          ENTRE GESTION GLOBAL ACG S.A.S
          Y {deudor?.nombreResponsable?.toUpperCase()}
        </h1>
        <p className="text-justify leading-snug mb-2">Entre los suscritos a saber por una parte <strong>GESTION GLOBAL ACG S.A.S.</strong> actuando como
          apoderado(a) judicial de la <strong> {(cliente?.nombre ?? "Sin nombre").toUpperCase()}</strong>,
          y por otra parte <strong> {(deudor?.nombreResponsable).toUpperCase()} </strong> persona mayor
          de edad identificada con la Cédula de Ciudadanía No <strong> {deudor?.cedulaResponsable}</strong>  de Bogotá quien en adelante
          se denominará el <strong>DEUDOR</strong>, hemos convenido celebrar el presente <strong>ACUERDO DE PAGO </strong>, que
          en adelante se regirá por las cláusulas que a continuación se enuncian, previas las siguientes
        </p>

        <h2 className="text-lg text-center font-semibold mt-4 mb-2 text-blue-800">CONSIDERACIONES</h2>

        <p className="text-justify leading-snug mb-2">Que el señor <strong> {(deudor?.nombreResponsable)} </strong> adeuda acreencias a favor del <strong>{(cliente?.nombre ?? "Sin nombre")} </strong>,
          por valor de <strong> ${deudor?.deuda_total?.toLocaleString("es-CO")} (
            {numeroALetras(deudor?.deuda_total || 0)} M/CTE) </strong> Conforme al estado de deuda bajado directamente
          del sistema a la fecha {fechaActual}, el cual forma parte de este documento.
        </p>
        <p >
          Que la anterior suma de dinero corresponde a las cuotas vencidas de las expensas de
          administración, intereses de mora y honorarios causados, de la TORRE No {deudor?.torre} APARTAMENTO
          No {deudor?.apartamento} {cliente?.direccion ?? ""} de propiedad del <strong>{(cliente?.nombre ?? "Sin nombre")}</strong>,
          Que en virtud de lo anterior y con el fin de resolver el inconveniente presentado de manera
          amigable <strong>GESTION GLOBAL ACG S.A.S </strong> de una parte y de la otra <strong> {(deudor?.responsable)} </strong>
          hemos acordado celebrar el presente acuerdo que se regirá en
          especial por las siguientes:
        </p>

        <h2 className="text-lg text-center font-semibold mt-4 mb-2 text-blue-800">CLAUSULAS</h2>

        <p>
          <strong>CLÁUSULA PRIMERA. - OBJETO: </strong> El presente acuerdo tiene como objeto principal, facilitar a
          EL DEUDOR el pago de las obligaciones a favor de la entidad <strong>ACREEDORA</strong> por valor de
          $<strong> ${deudor?.deuda_total?.toLocaleString("es-CO")} (
            {numeroALetras(deudor?.deuda_total || 0)} M/CTE) </strong>. Frente a lo cual asume desde ya los compromisos y obligaciones contenidos en
          este Acuerdo.
        </p>

        <p>
          <strong>CLÁUSULA SEGUNDA.- FACILIDAD DE PAGO DE LAS OBLIGACIONES: </strong> Las condiciones de
          pago objeto del presente acuerdo, son las siguientes:
        </p>

        <p>LA SUMA DE $<strong> ${deudor?.deuda_total?.toLocaleString("es-CO")} (
          {numeroALetras(deudor?.deuda_total || 0)} M/CTE) </strong>.
          Serán cancelados por el <strong>DEUDOR </strong> a la
          <strong> {(cliente?.nombre ?? "Sin nombre")}</strong>, según
          tabla de amortización.</p>

        <table className="w-full mt-4 border text-sm ">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2">Cuota</th>
              <th className="border p-2">Deuda capital</th>
              <th className="border p-2">Cuota capital</th>
              <th className="border p-2">Fecha límite</th>
              <th className="border p-2">Deuda honorarios</th>
              <th className="border p-2">Honorarios</th>
              <th className="border p-2">Total cuota</th>
            </tr>
          </thead>
          <tbody>
            {cuotas.map((cuota, index) => (
              <tr key={index}>
                <td className="border p-2 text-center">{index + 1}</td>
                <td className="border p-2 text-right">
                  {cuota.deuda_capital.toLocaleString("es-CO", { style: "currency", currency: "COP" })}
                </td>
                <td className="border p-2 text-right">
                  {cuota.cuota_capital.toLocaleString("es-CO", { style: "currency", currency: "COP" })}
                </td>
                <td className="border p-2">{cuota.fecha_limite}</td>
                <td className="border p-2 text-right">
                  {cuota.deuda_honorarios.toLocaleString("es-CO", { style: "currency", currency: "COP" })}
                </td>
                <td className="border p-2 text-right">
                  {cuota.honorarios.toLocaleString("es-CO", { style: "currency", currency: "COP" })}
                </td>
                <td className="border p-2 text-right">
                  {cuota.cuota_acuerdo.toLocaleString("es-CO", { style: "currency", currency: "COP" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <br />
        <p ><strong>PARÁGRAFO 1: </strong>LAS CUOTAS PACTADAS EN EL PRESENTE ACUERDO DEBERA SER
          CONSIGNADA ASI:</p>

        <p>CUOTA ACUERDO DE PAGO EN EL BANCO <strong> {(cliente?.banco).toUpperCase()} </strong> CUENTA DE <strong>{(cliente?.tipoCuenta).toUpperCase()} </strong> No <strong>{(cliente?.numeroCuenta)} </strong> EN REFERENCIA No DE TORRE Y APARTAMENTO (<strong> {(cliente?.nombre ?? "Sin nombre").toUpperCase()}</strong>) SEGUIDO DE LA TORRE
          Y APARTAMENTO Y HACER LLEGAR AL EMAIL
          {(deudor?.ejecutivoEmail)} O AL WHATSAPP 3123152594 COPIA
          DE CADA UNA DE LAS CONSIGNACIONES QUE SE REALICEN DENTRO DE ESTE
          ACUERDO.</p>

        <p><strong>PARÁGRAFO 2:</strong> ALTERNAMENTE Y AL CUMPLIMIENTO DE ESTE ACUERDO SE DEBE
          SEGUIR DANDO CANCELACIÓN A LAS CUOTAS DE ADMINISTRACIÓN MENSUAL Y
          CONFORME A LOS INCREMENTOS ANUALES QUE ESTABLEZCAN LAS LEYES
          NACIONALES.</p>


        <p className="text-xs text-gray-500 mt-6">Este acuerdo fue generado automáticamente por el sistema de gestión de cobranzas.</p>
      </div>
    </div>
  );
}
