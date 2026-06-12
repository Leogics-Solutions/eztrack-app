'use client';

import { useLanguage } from '@/lib/i18n';
import { DocumentsListing } from '../documents';

export default function PurchaseInvoicesPage() {
  const { t } = useLanguage();

  return (
    <DocumentsListing
      initialDirectionTab="purchase"
      lockDirection
      pageTitle={t.nav.purchases}
    />
  );
}
