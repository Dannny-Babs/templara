'use client';

import { useMemo } from 'react';
import { DocumentPreview } from '@templara/react-renderer';
import { renderDocument } from '@templara/renderer';
import { invoiceSampleData, invoiceTemplate } from '@templara/templates';

export function InvoicePreviewDemo() {
  const document = useMemo(
    () =>
      renderDocument({
        template: invoiceTemplate,
        data: invoiceSampleData,
        mode: 'preview',
      }),
    [],
  );

  return (
    <div className="not-prose overflow-auto rounded-xl border bg-white p-4 shadow-sm">
      <DocumentPreview document={document} scale={0.55} />
    </div>
  );
}
