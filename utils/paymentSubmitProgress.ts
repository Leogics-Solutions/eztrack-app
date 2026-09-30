export const paymentSubmitStages = [
  { key: 'VALIDATING', label: 'Check payment & SQL' },
  { key: 'POSTING', label: 'Create OR & knock off' },
  { key: 'NOTIFYING', label: 'Send confirmation' },
];

export function paymentSubmitProgress(job: { status: string; result?: { stage?: string } }) {
  const running = ['PENDING', 'RUNNING'].includes(job.status);
  const index = paymentSubmitStages.findIndex(s => s.key === job.result?.stage);
  return { running, steps: paymentSubmitStages.map((step, position) => ({ ...step,
    state: job.status === 'SUCCESS' || position < index ? 'done'
      : position === index ? (running ? 'active' : 'stopped') : 'waiting',
  })) };
}
