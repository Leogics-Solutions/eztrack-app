import { Check, CircleAlert, FileText, LoaderCircle, ScanLine, Upload, Clock3, Sparkles } from 'lucide-react';
import styles from './DocumentProcessingProgress.module.css';

type ProgressEvent = { sequence: number; stage: string; message: string; state: 'started' | 'completed' | 'failed'; at: string };

const stageNames: Record<string, string> = { preparing: 'Preparing document', extracting: 'Extracting details', organising: 'Organising details', classifying: 'Classifying accounts', checking: 'Checking document', saving: 'Saving results', ready: 'Ready for review', failed: 'Needs attention' };

type Job = { jobId: string; filename: string; status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED'; progressEvents?: ProgressEvent[] };

interface Props {
  jobs: Job[];
  totalFiles: number;
  status: 'normal' | 'error' | 'completed';
  elapsed: string;
  errorMessage?: string;
  connectionIssue?: boolean;
  summary?: { created: number; failed: number } | null;
}

export function DocumentProcessingProgress({ jobs, totalFiles, status, elapsed, errorMessage, connectionIssue, summary }: Props) {
  const running = jobs.filter(job => job.status === 'RUNNING');
  const succeeded = summary?.created ?? jobs.filter(job => job.status === 'SUCCESS').length;
  const failed = summary?.failed ?? jobs.filter(job => job.status === 'FAILED').length;
  const finished = status !== 'normal';
  const hasJobs = jobs.length > 0;
  const reading = running.length > 0;
  const hasResults = succeeded > 0;
  const needsAttention = status === 'error' || (finished && failed > 0);
  const stage = finished && hasResults ? 2 : hasJobs ? 1 : 0;
  const activityJob = running.find(job => job.progressEvents?.length) ?? running[0] ?? jobs.find(job => job.progressEvents?.length);
  const events = activityJob?.progressEvents ?? [];
  const latest = events[events.length - 1];
  const milestones = events.filter((event, index) => !events.slice(index + 1).some(item => item.stage === event.stage));
  const title = finished
    ? needsAttention ? hasResults ? 'Results are ready, with a few files to check' : 'Your upload needs attention' : 'Ready for your review'
    : !hasJobs ? 'Uploading your documents' : reading ? (latest ? stageNames[latest.stage] ?? latest.message : 'AI is reading your documents') : 'Your documents are in the queue';
  const description = finished
    ? hasResults ? 'Open your documents to check the extracted details and make any corrections.' : 'Check the file messages below before trying again.'
    : !hasJobs ? 'Sending your files. Please keep this page open until the upload finishes.'
      : reading ? (latest?.message ?? 'Reading document details, line items and amounts, and organising the results for review.')
        : 'Upload received. Extraction will begin as soon as a processing slot is available.';
  const count = Math.max(jobs.length, 1);
  const resolved = jobs.filter(job => job.status === 'SUCCESS' || job.status === 'FAILED').length;
  const percent = Math.round(resolved / count * 100);
  const steps = [
    { label: 'Upload', detail: hasJobs ? 'Files received' : finished ? 'Upload interrupted' : 'Sending your files', icon: Upload },
    { label: !finished && latest ? stageNames[latest.stage] ?? 'Processing' : 'AI processing', detail: finished ? hasResults ? 'Processing finished' : 'Needs attention' : reading ? latest?.state === 'completed' ? 'Stage completed' : 'In progress'  : hasJobs ? 'Waiting to start' : 'After upload', icon: ScanLine },
    { label: 'Review results', detail: finished && hasResults ? 'Your turn to review' : 'Check extracted details', icon: FileText },
  ];

  return (
    <section className={`${styles.panel} ${finished ? styles.finished : ''}`} aria-label="Document processing progress" aria-busy={!finished}>
      <div className={styles.hero}>
        <div className={`${styles.art} ${needsAttention ? styles.attention : ''}`} aria-hidden="true">
          <div className={styles.paper}>
            <div className={styles.paperHeading} /><div className={styles.paperLine} /><div className={styles.paperLineShort} />
            <div className={styles.paperTable}>{Array.from({ length: 6 }, (_, i) => <span key={i} />)}</div>
            <div className={styles.paperTotal} />
            {!finished && reading && <div className={styles.scan} />}
          </div>
          <div className={styles.artBadge}>{finished ? needsAttention ? <CircleAlert size={19} /> : <Check size={20} /> : <Sparkles size={19} />}</div>
        </div>
        <div className={styles.copy}>
          <div className={styles.eyebrow}>{finished ? 'PROCESSING FINISHED' : <><span className={styles.liveDot} /> SMARTDOK IS WORKING</>}</div>
          <div role="status" aria-live="polite" aria-atomic="true">
            <h3 className={styles.title}>{title}</h3>
            <p className={styles.description}>{description}</p>
          </div>
          <div className={styles.meta}>
            <span><FileText size={14} /> {totalFiles} file{totalFiles === 1 ? '' : 's'} selected</span>
            <span><Clock3 size={14} /> {elapsed} {finished ? 'total' : 'elapsed'}</span>
            {succeeded > 0 && <span className={styles.successText}><Check size={14} /> {succeeded} ready</span>}
          </div>
        </div>
      </div>
      <ol className={styles.steps} aria-label="Processing stages">
        {steps.map((step, i) => {
          const done = i < stage;
          const active = i === stage;
          const Icon = done ? Check : active && !finished ? LoaderCircle : step.icon;
          return <li key={step.label} className={`${styles.step} ${active ? styles.active : ''} ${done ? styles.done : ''}`} aria-current={active ? 'step' : undefined}>
            <span className={styles.stepIcon}><Icon size={17} className={active && !finished ? styles.spinner : ''} /></span>
            <span><strong>{step.label}</strong><small>{step.detail}</small></span>
          </li>;
        })}
      </ol>
      {milestones.length > 0 && <div className={styles.milestones}>
        <div className={styles.feedHeading}><strong>Processing activity</strong><span>{activityJob?.filename}</span></div>
        <ol className={styles.feed} aria-label="Actual processing activity">
          {milestones.map(event => {
            const complete = event.state === 'completed';
            const stopped = event.state === 'failed';
            const active = !finished && event === latest && !complete && !stopped;
            const Icon = stopped ? CircleAlert : complete ? Check : active ? LoaderCircle : Clock3;
            return <li key={event.stage} className={active ? styles.feedActive : ''}>
              <Icon size={15} className={active ? styles.spinner : complete ? styles.successText : ''} />
              <span>{stageNames[event.stage] ?? event.message}</span>
              <small>{stopped ? 'Needs attention' : complete ? 'Done' : finished ? 'Ended' : active ? 'Working' : 'Started'}</small>
              <time dateTime={event.at}>{new Date(event.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
            </li>;
          })}
        </ol>
      </div>}
      {!finished && (
        <div className={styles.activity}>
          <div className={styles.activityLabel}><span>{hasJobs ? `${resolved} of ${jobs.length} processing tasks finished` : 'Upload in progress'}</span><span>{hasJobs ? `${percent}%` : ''}</span></div>
          <div className={styles.track} role="progressbar" aria-label={hasJobs ? 'Finished processing tasks' : 'Uploading documents'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={hasJobs ? percent : undefined}>
            <div className={hasJobs && resolved > 0 ? styles.fill : styles.indeterminate} style={hasJobs && resolved > 0 ? { width: `${percent}%` } : undefined} />
          </div>
          <div className={styles.activityNote}>
            {connectionIssue ? 'Reconnecting to progress updates. Your files may still be processing.'
              : reading ? <><span className={styles.spinner}><LoaderCircle size={14} /></span><span className={styles.filename}>{running[0].filename}</span>{running.length > 1 && <span>+{running.length - 1} more</span>}</>
              : hasJobs ? 'Waiting for the next processing update…' : 'Your files will appear below once received.'}
          </div>
          {reading && <p className={styles.note}>Larger documents can take a little longer. Results appear here automatically.</p>}
        </div>
      )}
      {status === 'error' && errorMessage && <p className={styles.error} role="alert">{errorMessage}</p>}
    </section>
  );
}
