'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Check,
  ChevronRight,
  CreditCard,
  KeyRound,
  Link2,
  Loader2,
  Mail,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { useAuth } from '@/lib/auth/AuthContext';
import { useOrganization } from '@/lib/OrganizationContext';
import { changePassword } from '@/services/AuthService';
import {
  cancelOrganizationInvitation,
  inviteOrganizationMember,
  listOrganizationInvitations,
  listOrganizationMembers,
  removeOrganizationMember,
  updateMemberRole,
  updateOrganization,
  type OrganizationInvitation,
  type OrganizationMember,
  type OrganizationRole,
} from '@/services/OrganizationService';
import { getOpenAIBillingSummary, getUserQuota, updateCurrentUser, type OpenAIBillingSummary, type QuotaData } from '@/services/UserService';

type Tab = 'company' | 'team' | 'billing' | 'account';
type Notice = { type: 'success' | 'error'; message: string } | null;

const tabs: Array<{ id: Tab; label: string; icon: typeof Building2 }> = [
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'team', label: 'Team & access', icon: UsersRound },
  { id: 'billing', label: 'Billing & usage', icon: CreditCard },
  { id: 'account', label: 'My account', icon: UserRound },
];

const roleCopy: Record<OrganizationRole, string> = {
  admin: 'Manage company settings, members and billing',
  operator: 'Run automations and review finance work',
  uploader: 'Submit documents and messages only',
};

const fieldClass =
  'w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 disabled:cursor-not-allowed disabled:opacity-60';
const cardClass = 'rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function SettingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { organizations, selectedOrganizationId, refetchOrganizations } = useOrganization();
  const [tab, setTab] = useState<Tab>('company');
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [openaiBilling, setOpenaiBilling] = useState<OpenAIBillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [search, setSearch] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrganizationRole>('operator');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [fullName, setFullName] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => organization.id === selectedOrganizationId),
    [organizations, selectedOrganizationId],
  );
  const currentMember = useMemo(
    () => members.find((member) => String(member.user_id) === String(user?.id)),
    [members, user?.id],
  );
  const isAdmin = currentMember?.role === 'admin';

  const loadData = useCallback(async () => {
    if (!selectedOrganizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const [memberResponse, quotaResponse] = await Promise.all([
        listOrganizationMembers(selectedOrganizationId),
        getUserQuota(),
      ]);
      setMembers(memberResponse.data || []);
      setQuota(quotaResponse.data);
      const signedInMember = (memberResponse.data || []).find((member) => String(member.user_id) === String(user?.id));
      if (signedInMember?.role === 'admin') {
        try {
          const billingResponse = await getOpenAIBillingSummary();
          setOpenaiBilling(billingResponse.data);
        } catch {
          setOpenaiBilling(null);
        }
      } else {
        setOpenaiBilling(null);
      }
      try {
        const invitationResponse = await listOrganizationInvitations(selectedOrganizationId);
        setInvitations(invitationResponse.data || []);
      } catch {
        // Pending invitations are visible to company admins only.
        setInvitations([]);
      }
    } catch (error) {
      setNotice({ type: 'error', message: errorMessage(error, 'Could not load settings.') });
    } finally {
      setLoading(false);
    }
  }, [selectedOrganizationId, user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setCompanyName(selectedOrganization?.name || '');
    setIndustry(selectedOrganization?.industry || '');
  }, [selectedOrganization]);

  useEffect(() => setFullName(user?.full_name || ''), [user?.full_name]);

  const filteredMembers = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return members;
    return members.filter((member) =>
      `${member.full_name || ''} ${member.email} ${member.role}`.toLowerCase().includes(value),
    );
  }, [members, search]);

  async function saveCompany(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrganizationId || !companyName.trim()) return;
    setWorking('company');
    setNotice(null);
    try {
      await updateOrganization(selectedOrganizationId, {
        name: companyName.trim(),
        industry: industry.trim() || undefined,
      });
      await refetchOrganizations();
      setNotice({ type: 'success', message: 'Company details saved.' });
    } catch (error) {
      setNotice({ type: 'error', message: errorMessage(error, 'Could not save company details.') });
    } finally {
      setWorking(null);
    }
  }

  async function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity() || !selectedOrganizationId) return;
    setWorking('invite');
    setNotice(null);
    try {
      const response = await inviteOrganizationMember(selectedOrganizationId, {
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
      });
      setInviteEmail('');
      await loadData();
      setNotice({
        type: 'success',
        message:
          response.data.status === 'ACCEPTED'
            ? `${response.data.email} was added to the company.`
            : `Invitation saved for ${response.data.email}. Access activates when they register with that email.`,
      });
    } catch (error) {
      setNotice({ type: 'error', message: errorMessage(error, 'Could not invite this person.') });
    } finally {
      setWorking(null);
    }
  }

  async function changeRole(member: OrganizationMember, role: OrganizationRole) {
    if (!selectedOrganizationId || member.role === role) return;
    setWorking(`member-${member.user_id}`);
    setNotice(null);
    try {
      await updateMemberRole(selectedOrganizationId, member.user_id, { role });
      await loadData();
      setNotice({ type: 'success', message: `${member.full_name || member.email}'s role was updated.` });
    } catch (error) {
      setNotice({ type: 'error', message: errorMessage(error, 'Could not update this role.') });
    } finally {
      setWorking(null);
    }
  }

  async function removeMember(member: OrganizationMember) {
    if (!selectedOrganizationId) return;
    if (!window.confirm(`Remove ${member.full_name || member.email} from this company?`)) return;
    setWorking(`member-${member.user_id}`);
    setNotice(null);
    try {
      await removeOrganizationMember(selectedOrganizationId, member.user_id);
      await loadData();
      setNotice({ type: 'success', message: 'Team member removed.' });
    } catch (error) {
      setNotice({ type: 'error', message: errorMessage(error, 'Could not remove this member.') });
    } finally {
      setWorking(null);
    }
  }

  async function cancelInvitation(invitation: OrganizationInvitation) {
    if (!selectedOrganizationId) return;
    setWorking(`invite-${invitation.id}`);
    setNotice(null);
    try {
      await cancelOrganizationInvitation(selectedOrganizationId, invitation.id);
      setInvitations((current) => current.filter((item) => item.id !== invitation.id));
      setNotice({ type: 'success', message: `Invitation for ${invitation.email} cancelled.` });
    } catch (error) {
      setNotice({ type: 'error', message: errorMessage(error, 'Could not cancel this invitation.') });
    } finally {
      setWorking(null);
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!fullName.trim()) return;
    setWorking('profile');
    setNotice(null);
    try {
      await updateCurrentUser({ full_name: fullName.trim() });
      setNotice({ type: 'success', message: 'Profile saved. Your updated name will appear after the next sign-in.' });
    } catch (error) {
      setNotice({ type: 'error', message: errorMessage(error, 'Could not save your profile.') });
    } finally {
      setWorking(null);
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setNotice({ type: 'error', message: 'The new passwords do not match.' });
      return;
    }
    setWorking('password');
    setNotice(null);
    try {
      await changePassword({ old_password: oldPassword, new_password: newPassword });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNotice({ type: 'success', message: 'Password changed.' });
    } catch (error) {
      setNotice({ type: 'error', message: errorMessage(error, 'Could not change your password.') });
    } finally {
      setWorking(null);
    }
  }

  const effectiveQuota = quota?.effective_quota;
  const usagePercent = effectiveQuota?.total_quota
    ? Math.min(100, Math.round((effectiveQuota.used_quota / effectiveQuota.total_quota) * 100))
    : 0;

  return (
    <AppLayout pageName="Settings">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">Workspace settings</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--foreground)]">Manage your company</h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted-foreground)]">
              Company access, usage and your personal security settings in one place.
            </p>
          </div>
          <Link
            href="/integrations"
            className="inline-flex items-center gap-2 self-start rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:border-cyan-500"
          >
            <Link2 className="h-4 w-4 text-cyan-600" /> Manage integrations <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <nav className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2 md:grid-cols-4" aria-label="Settings sections">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setTab(id); setNotice(null); }}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                tab === id
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>

        {notice && (
          <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
            notice.type === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200'
          }`} role="status">
            {notice.type === 'success' ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : null}
            <span>{notice.message}</span>
          </div>
        )}

        {(loading || authLoading) && (
          <div className={`${cardClass} flex min-h-64 items-center justify-center gap-2 text-sm text-[var(--muted-foreground)]`}>
            <Loader2 className="h-5 w-5 animate-spin" /> Loading settings…
          </div>
        )}

        {!loading && !authLoading && tab === 'company' && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <form onSubmit={saveCompany} className={`${cardClass} p-6`}>
              <div className="mb-6 flex items-start gap-3">
                <div className="rounded-xl bg-cyan-100 p-2.5 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200"><Building2 className="h-5 w-5" /></div>
                <div><h2 className="font-bold text-[var(--foreground)]">Company profile</h2><p className="text-sm text-[var(--muted-foreground)]">Used across documents, automations and reviews.</p></div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-semibold text-[var(--foreground)]">Company name<input className={fieldClass} value={companyName} onChange={(event) => setCompanyName(event.target.value)} required disabled={!isAdmin} /></label>
                <label className="space-y-2 text-sm font-semibold text-[var(--foreground)]">Industry<input className={fieldClass} value={industry} onChange={(event) => setIndustry(event.target.value)} placeholder="e.g. Distribution" disabled={!isAdmin} /></label>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-[var(--border)] pt-5">
                <p className="text-xs text-[var(--muted-foreground)]">Your access: <span className="font-semibold capitalize text-[var(--foreground)]">{currentMember?.role || 'member'}</span></p>
                {isAdmin && <button className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-60" disabled={working === 'company'}>{working === 'company' ? 'Saving…' : 'Save changes'}</button>}
              </div>
            </form>
            <div className={`${cardClass} p-6`}>
              <ShieldCheck className="h-7 w-7 text-cyan-600" />
              <h2 className="mt-4 font-bold text-[var(--foreground)]">Workspace ownership</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">Admins control company details, invitations, roles and billing. Keep at least two admins for continuity.</p>
              <div className="mt-5 rounded-xl bg-[var(--muted)] p-4 text-sm text-[var(--foreground)]"><span className="font-bold">{members.filter((member) => member.role === 'admin').length}</span> admin{members.filter((member) => member.role === 'admin').length === 1 ? '' : 's'} · <span className="font-bold">{members.length}</span> total members</div>
            </div>
          </div>
        )}

        {!loading && !authLoading && tab === 'team' && (
          <div className="space-y-6">
            {isAdmin && (
              <form onSubmit={submitInvitation} className={`${cardClass} p-6`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold text-[var(--foreground)]">Invite a team member</h2>
                    <p className="mb-4 text-sm text-[var(--muted-foreground)]">They can register later using the same email. Existing Smartdok users are added immediately.</p>
                    <label className="space-y-2 text-sm font-semibold text-[var(--foreground)]">Email address<div className="relative"><Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" /><input type="email" required autoComplete="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@company.com" className={`${fieldClass} pl-10`} /></div></label>
                  </div>
                  <label className="space-y-2 text-sm font-semibold text-[var(--foreground)] lg:w-52">Role<select className={fieldClass} value={inviteRole} onChange={(event) => setInviteRole(event.target.value as OrganizationRole)}><option value="admin">Admin</option><option value="operator">Operator</option><option value="uploader">Uploader</option></select></label>
                  <button className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-60" disabled={working === 'invite'}>{working === 'invite' ? 'Inviting…' : 'Invite member'}</button>
                </div>
                <p className="mt-3 text-xs text-[var(--muted-foreground)]">{roleCopy[inviteRole]}</p>
              </form>
            )}

            <section className={`${cardClass} overflow-hidden`}>
              <div className="flex flex-col gap-3 border-b border-[var(--border)] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div><h2 className="font-bold text-[var(--foreground)]">Team members</h2><p className="text-sm text-[var(--muted-foreground)]">{members.length} people have access to {selectedOrganization?.name || 'this company'}.</p></div>
                <div className="relative sm:w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search members" className={`${fieldClass} pl-9`} /></div>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {filteredMembers.map((member) => {
                  const isSelf = String(member.user_id) === String(user?.id);
                  const busy = working === `member-${member.user_id}`;
                  return <div key={member.id} className="grid gap-3 p-5 md:grid-cols-[minmax(0,1fr)_180px_44px] md:items-center">
                    <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-semibold text-[var(--foreground)]">{member.full_name || member.email}</p>{isSelf && <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">You</span>}</div><p className="truncate text-sm text-[var(--muted-foreground)]">{member.email}</p></div>
                    <select aria-label={`Role for ${member.email}`} value={member.role} disabled={!isAdmin || busy} onChange={(event) => void changeRole(member, event.target.value as OrganizationRole)} className={fieldClass}><option value="admin">Admin</option><option value="operator">Operator</option><option value="uploader">Uploader</option></select>
                    <button type="button" aria-label={`Remove ${member.email}`} title={isSelf ? 'You cannot remove yourself here' : 'Remove member'} disabled={!isAdmin || isSelf || busy} onClick={() => void removeMember(member)} className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-red-950"><Trash2 className="h-4 w-4" /></button>
                  </div>;
                })}
                {filteredMembers.length === 0 && <p className="p-8 text-center text-sm text-[var(--muted-foreground)]">No team members match your search.</p>}
              </div>
            </section>

            {isAdmin && invitations.length > 0 && (
              <section className={`${cardClass} overflow-hidden`}>
                <div className="border-b border-[var(--border)] p-5"><h2 className="font-bold text-[var(--foreground)]">Pending invitations</h2><p className="text-sm text-[var(--muted-foreground)]">Access will activate when the person registers with this email.</p></div>
                <div className="divide-y divide-[var(--border)]">{invitations.map((invitation) => <div key={invitation.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-[var(--foreground)]">{invitation.email}</p><p className="text-sm capitalize text-[var(--muted-foreground)]">{invitation.role} · Invited {formatDate(invitation.created_at)}</p></div><button type="button" disabled={working === `invite-${invitation.id}`} onClick={() => void cancelInvitation(invitation)} className="self-start rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950">Cancel invitation</button></div>)}</div>
              </section>
            )}
          </div>
        )}

        {!loading && !authLoading && tab === 'billing' && (
          <div className="space-y-6">
            <section className={`${cardClass} p-6`}>
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                {effectiveQuota?.unlimited ? <><div><p className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">Processing access</p><p className="mt-2 text-4xl font-bold text-[var(--foreground)]">Unlimited</p><p className="mt-2 text-sm text-[var(--muted-foreground)]">No Smartdok page or credit cap is enforced for this dedicated deployment.</p></div><div className="w-full max-w-sm rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"><p className="font-bold">Usage tracking remains active</p><p className="mt-1">{effectiveQuota.used_quota.toLocaleString()} pages recorded for audit; processing is not blocked by this count.</p></div></> : <><div><p className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">Current processing allowance</p><p className="mt-2 text-4xl font-bold text-[var(--foreground)]">{effectiveQuota?.remaining_quota?.toLocaleString() || 0}<span className="ml-2 text-base font-medium text-[var(--muted-foreground)]">pages remaining</span></p><p className="mt-2 text-sm text-[var(--muted-foreground)]">Billed to {effectiveQuota?.type === 'organization' ? selectedOrganization?.name || 'your company' : 'your personal account'}.</p></div><div className="w-full max-w-sm"><div className="mb-2 flex justify-between text-xs font-semibold text-[var(--muted-foreground)]"><span>{effectiveQuota?.used_quota?.toLocaleString() || 0} used</span><span>{effectiveQuota?.total_quota?.toLocaleString() || 0} total</span></div><div className="h-3 overflow-hidden rounded-full bg-[var(--muted)]"><div className="h-full rounded-full bg-cyan-600 transition-all" style={{ width: `${usagePercent}%` }} /></div><p className="mt-2 text-right text-xs text-[var(--muted-foreground)]">{usagePercent}% used</p></div></>}
              </div>
            </section>
            {!effectiveQuota?.unlimited && <section className={`${cardClass} overflow-hidden`}>
              <div className="border-b border-[var(--border)] p-5"><h2 className="font-bold text-[var(--foreground)]">Quota allocations</h2><p className="text-sm text-[var(--muted-foreground)]">Allowance periods currently attached to this account.</p></div>
              <div className="divide-y divide-[var(--border)]">
                {(effectiveQuota?.allocations || []).map((allocation) => <div key={allocation.allocation_id} className="grid gap-3 p-5 sm:grid-cols-4 sm:items-center"><div><p className="text-xs text-[var(--muted-foreground)]">Allowance</p><p className="font-bold text-[var(--foreground)]">{allocation.quota_pages.toLocaleString()} pages</p></div><div><p className="text-xs text-[var(--muted-foreground)]">Remaining</p><p className="font-semibold text-[var(--foreground)]">{allocation.remaining_quota.toLocaleString()}</p></div><div><p className="text-xs text-[var(--muted-foreground)]">Valid until</p><p className="font-semibold text-[var(--foreground)]">{formatDate(allocation.valid_until)}</p></div><span className="justify-self-start rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold capitalize text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 sm:justify-self-end">{allocation.status.toLowerCase()}</span></div>)}
                {!effectiveQuota?.allocations?.length && <p className="p-8 text-center text-sm text-[var(--muted-foreground)]">No active quota allocations.</p>}
              </div>
            </section>}
            {isAdmin && <section className={`${cardClass} p-6`}>
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div><p className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">OpenAI API billing</p><p className="mt-2 text-3xl font-bold text-[var(--foreground)]">{openaiBilling?.month_to_date_cost_usd != null ? `US$${openaiBilling.month_to_date_cost_usd.toFixed(2)}` : 'Not connected'}</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">{openaiBilling?.month_to_date_cost_usd != null ? 'Actual organization cost this month' : 'Live spend requires an OpenAI Admin API key.'}</p></div>
                {openaiBilling?.configured_budget_remaining_usd != null && <div className="rounded-xl bg-cyan-50 px-5 py-4 text-cyan-950 dark:bg-cyan-950 dark:text-cyan-100"><p className="text-xs font-bold uppercase tracking-wide">Configured budget remaining</p><p className="mt-1 text-2xl font-bold">US${openaiBilling.configured_budget_remaining_usd.toFixed(2)}</p></div>}
              </div>
              <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"><p className="font-bold">OpenAI account balance</p><p className="mt-1">OpenAI's supported API provides costs, but not the live prepaid-credit balance. Use the OpenAI Billing dashboard for the authoritative remaining balance.</p></div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[var(--muted-foreground)]">{openaiBilling?.message || 'Configure OPENAI_ADMIN_API_KEY on the backend to show live month-to-date spend here.'}</p><a href={openaiBilling?.billing_dashboard_url || 'https://platform.openai.com/settings/organization/billing/overview'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-bold text-[var(--foreground)] hover:border-cyan-500"><Link2 className="h-4 w-4" /> Open OpenAI Billing</a></div>
            </section>}
          </div>
        )}

        {!loading && !authLoading && tab === 'account' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <form onSubmit={saveProfile} className={`${cardClass} p-6`}><div className="mb-6 flex items-center gap-3"><div className="rounded-xl bg-cyan-100 p-2.5 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200"><UserRound className="h-5 w-5" /></div><div><h2 className="font-bold text-[var(--foreground)]">Personal profile</h2><p className="text-sm text-[var(--muted-foreground)]">How your name appears to teammates.</p></div></div><div className="space-y-5"><label className="block space-y-2 text-sm font-semibold text-[var(--foreground)]">Full name<input className={fieldClass} required value={fullName} onChange={(event) => setFullName(event.target.value)} /></label><label className="block space-y-2 text-sm font-semibold text-[var(--foreground)]">Email address<input className={fieldClass} value={user?.email || ''} disabled /></label></div><div className="mt-6 flex justify-end"><button className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-60" disabled={working === 'profile'}>{working === 'profile' ? 'Saving…' : 'Save profile'}</button></div></form>
            <form onSubmit={savePassword} className={`${cardClass} p-6`}><div className="mb-6 flex items-center gap-3"><div className="rounded-xl bg-violet-100 p-2.5 text-violet-800 dark:bg-violet-950 dark:text-violet-200"><KeyRound className="h-5 w-5" /></div><div><h2 className="font-bold text-[var(--foreground)]">Password</h2><p className="text-sm text-[var(--muted-foreground)]">Use a strong, unique password.</p></div></div><div className="space-y-4"><label className="block space-y-2 text-sm font-semibold text-[var(--foreground)]">Current password<input type="password" autoComplete="current-password" required className={fieldClass} value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} /></label><label className="block space-y-2 text-sm font-semibold text-[var(--foreground)]">New password<input type="password" autoComplete="new-password" minLength={8} required className={fieldClass} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><label className="block space-y-2 text-sm font-semibold text-[var(--foreground)]">Confirm new password<input type="password" autoComplete="new-password" minLength={8} required className={fieldClass} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label></div><div className="mt-6 flex justify-end"><button className="rounded-xl bg-[var(--foreground)] px-4 py-2.5 text-sm font-bold text-[var(--background)] hover:opacity-90 disabled:opacity-60" disabled={working === 'password'}>{working === 'password' ? 'Changing…' : 'Change password'}</button></div></form>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
