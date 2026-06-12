'use client';

import { useLanguage } from '@/lib/i18n';
import { DocumentsListing } from '../documents';

export default function SalesInvoicesPage() {
  const { t } = useLanguage();

  return (
    <DocumentsListing
      initialDirectionTab="sales"
      lockDirection
      pageTitle={t.nav.sales}
    />
  );
}
