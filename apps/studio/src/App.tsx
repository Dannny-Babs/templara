import { DocumentEditor } from "@templara/editor";
import { shipmentBolSampleData, shipmentBolTemplate } from "@templara/templates";

export function App() {
  return <DocumentEditor value={shipmentBolTemplate} data={shipmentBolSampleData} />;
}
