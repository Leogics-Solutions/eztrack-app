import type { GetServerSideProps } from 'next';

export default function LegacyOutsourcedCasesRoute() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: '/capture/outsourced',
    permanent: false,
  },
});
