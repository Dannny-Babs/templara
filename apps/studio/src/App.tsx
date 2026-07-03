import { DocumentEditor } from "@templara/editor";
import { invoiceSampleData, invoiceTemplate } from "@templara/templates";

export function App() {
  return <DocumentEditor value={invoiceTemplate} data={invoiceSampleData} />;
}
