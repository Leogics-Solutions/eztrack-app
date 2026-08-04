import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function FinanceRecordsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/records');
  }, [router]);

  return null;
}
