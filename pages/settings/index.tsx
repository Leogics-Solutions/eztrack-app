'use client';

import { AppLayout } from "@/components/layout";
import { useLanguage } from "@/lib/i18n";
import { useState, useEffect } from "react";

// Types
interface User {
    full_name: string;
    email: string;
    phone_e164?: string;
    whatsapp_verified: boolean;
}

interface Organization {
    industry?: string;
}

interface TeamMember {
    membership_id: string;
    email: string;
    full_name?: string;
    role: 'admin' | 'uploader' | 'operator';
}

interface UsageStats {
    processed: number;
    quota: number | null;
    remaining: number | null;
    last_invoice: string | null;
}

const SettingsPage = () => {
    const { t } = useLanguage();
    // State
    const [user, setUser] = useState<User>({
        full_name: 'John Doe',
        email: 'john.doe@example.com',
        phone_e164: '+60123456789',
        whatsapp_verified: true,
    });

    const [org, setOrg] = useState<Organization>({
        industry: 'Technology & Software',
    });

    const [orgRole, setOrgRole] = useState<'admin' | 'uploader' | 'operator'>('admin');

    const [usageStats, setUsageStats] = useState<UsageStats>({
        processed: 1250,
        quota: 5000,
        remaining: 3750,
        last_invoice: '2025-10-14',
    });

    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

    // Modal states
    const [showIndustryModal, setShowIndustryModal] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);

    // Form states
    const [profileFullName, setProfileFullName] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');

    // Load data on mount
    useEffect(() => {
        loadTeamMembers();
    }, []);

    const loadTeamMembers = async () => {
        // TODO: Replace with actual API call
        const mockMembers: TeamMember[] = [
            { membership_id: '1', email: 'admin@example.com', full_name: 'Admin User', role: 'admin' },
            { membership_id: '2', email: 'uploader@example.com', full_name: 'Upload User', role: 'uploader' },
            { membership_id: '3', email: 'operator@example.com', full_name: 'Operator User', role: 'operator' },
        ];
        setTeamMembers(mockMembers);
    };

    // Notification function
    const showNotification = (message: string, _type?: 'success' | 'error' | 'info') => {
        // Simple alert for now - can be replaced with a toast library
        alert(message);
    };

    // Profile functions
    const openEditProfile = () => {
        setProfileFullName(user.full_name);
        setShowProfileModal(true);
    };

    const closeProfileModal = () => {
        setShowProfileModal(false);
        setProfileFullName('');
    };

    const saveProfile = async () => {
        if (!profileFullName.trim()) {
            showNotification(t.settings.fullName + ' is required', 'error');
            return;
        }

        // TODO: Replace with actual API call
        try {
            // const resp = await fetch('/api/profile', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ full_name: profileFullName })
            // });
            // const data = await resp.json();

            setUser({ ...user, full_name: profileFullName });
            showNotification(t.settings.profileUpdated, 'success');
            closeProfileModal();
        } catch (error) {
            showNotification(t.settings.profileUpdateFailed, 'error');
        }
    };

    // Password functions
    const openChangePassword = () => {
        setShowPasswordModal(true);
    };

    const closePasswordModal = () => {
        setShowPasswordModal(false);
        setCurrentPassword('');
        setNewPassword('');
    };

    const savePassword = async () => {
        if (!currentPassword || !newPassword) {
            showNotification(t.settings.fillAllFields, 'error');
            return;
        }

        // TODO: Replace with actual API call
        try {
            // const resp = await fetch('/api/profile/password', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
            // });
            // const data = await resp.json();

            showNotification(t.settings.passwordUpdated, 'success');
            closePasswordModal();
        } catch (error) {
            showNotification(t.settings.passwordUpdateFailed, 'error');
        }
    };

    // Industry functions
    const editIndustry = () => {
        setShowIndustryModal(true);
    };

    const closeIndustryModal = () => {
        setShowIndustryModal(false);
    };

    const selectIndustry = async (industry: string) => {
        // TODO: Replace with actual API call
        try {
            // const resp = await fetch('/api/settings/industry', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ industry })
            // });
            // const data = await resp.json();

            setOrg({ ...org, industry });
            showNotification(t.settings.industryUpdated, 'success');
            closeIndustryModal();
        } catch (error) {
            showNotification(t.settings.industryUpdateFailed, 'error');
        }
    };

    // Phone functions
    const promptSetPhone = () => {
        const phone = prompt(t.settings.enterPhoneE164, user.phone_e164 || '+60');
        if (!phone || phone.trim() === '') return;

        const skipVerif = confirm(t.settings.skipVerification);

        setPhoneNumber(phone, skipVerif);
    };

    const setPhoneNumber = async (phone: string, skipVerification: boolean) => {
        // TODO: Replace with actual API call
        try {
            // const resp = await fetch('/api/settings/phone', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ phone, skip_verification: skipVerification })
            // });
            // const data = await resp.json();

            setUser({ ...user, phone_e164: phone, whatsapp_verified: skipVerification });

            if (skipVerification) {
                showNotification(t.settings.phoneSetVerified, 'success');
            } else {
                showNotification(t.settings.otpSent, 'success');
                promptVerifyCode();
            }
        } catch (error) {
            showNotification(t.settings.phoneSetFailed, 'error');
        }
    };

    const promptVerifyCode = () => {
        const code = prompt(t.settings.enterVerificationCode);
        if (!code) return;

        verifyCode(code);
    };

    const verifyCode = async (_code: string) => {
        // TODO: Replace with actual API call
        try {
            // const resp = await fetch('/api/settings/phone/verify', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ code: _code })
            // });
            // const data = await resp.json();

            setUser({ ...user, whatsapp_verified: true });
            showNotification(t.settings.phoneVerified, 'success');
        } catch (error) {
            showNotification(t.settings.verificationFailed, 'error');
        }
    };

    // Team management
    const updateMemberRole = async (membershipId: string, role: 'admin' | 'uploader' | 'operator') => {
        // TODO: Replace with actual API call
        try {
            // const resp = await fetch(`/api/org/members/${membershipId}/role`, {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ role })
            // });
            // const data = await resp.json();

            setTeamMembers(teamMembers.map(m =>
                m.membership_id === membershipId ? { ...m, role } : m
            ));
            showNotification(t.settings.roleUpdated, 'success');
        } catch (error) {
            showNotification(t.settings.roleUpdateFailed, 'error');
        }
    };

    const removeMember = async (membershipId: string) => {
        if (!confirm(t.settings.removeMemberConfirm)) return;

        // TODO: Replace with actual API call
        try {
            // const resp = await fetch(`/api/org/members/${membershipId}/remove`, {
            //     method: 'POST'
            // });
            // const data = await resp.json();

            setTeamMembers(teamMembers.filter(m => m.membership_id !== membershipId));
            showNotification(t.settings.memberRemoved, 'success');
        } catch (error) {
            showNotification(t.settings.memberRemoveFailed, 'error');
        }
    };

    const showAddMember = () => {
        const email = prompt(t.settings.enterMemberEmail);
        if (!email) return;

        const full_name = prompt(t.settings.enterFullName) || '';
        const roleInput = prompt(t.settings.enterRole, 'operator') || 'operator';
        const role = roleInput as 'admin' | 'uploader' | 'operator';

        addMember(email, full_name, role);
    };

    const addMember = async (email: string, full_name: string, role: 'admin' | 'uploader' | 'operator') => {
        // TODO: Replace with actual API call
        try {
            // const resp = await fetch('/api/org/members/add', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ email, full_name, role })
            // });
            // const data = await resp.json();

            const newMember: TeamMember = {
                membership_id: String(Date.now()),
                email,
                full_name: full_name || undefined,
                role,
            };

            setTeamMembers([...teamMembers, newMember]);
            showNotification(t.settings.memberAdded, 'success');
            // If temp password is provided, show it
            // if (data.temp_password) {
            //     alert(`Temporary password for ${email}: ${data.temp_password}`);
            // }
        } catch (error) {
            showNotification(t.settings.memberAddFailed, 'error');
        }
    };

    // Quick action functions
    const upgradePlan = () => {
        alert(t.settings.upgradePlanMessage);
    };

    const downloadData = () => {
        alert(t.settings.downloadDataMessage);
    };

    const viewBilling = () => {
        alert(t.settings.viewBillingMessage);
    };

    const contactSupport = () => {
        alert(t.settings.contactSupportMessage);
    };

    // Calculate usage percentage
    const usagePercentage = usageStats.quota && usageStats.remaining !== null
        ? ((usageStats.quota - usageStats.remaining) / usageStats.quota * 100)
        : 0;

    const industries = [
        { name: t.settings.industries.technologySoftware, icon: '💻' },
        { name: t.settings.industries.healthcareMedical, icon: '🏥' },
        { name: t.settings.industries.retailEcommerce, icon: '🛒' },
        { name: t.settings.industries.manufacturing, icon: '🏭' },
        { name: t.settings.industries.constructionRealEstate, icon: '🏗️' },
        { name: t.settings.industries.professionalServices, icon: '💼' },
        { name: t.settings.industries.foodBeverage, icon: '🍽️' },
        { name: t.settings.industries.educationTraining, icon: '🎓' },
        { name: t.settings.industries.financialServices, icon: '💰' },
        { name: t.settings.industries.transportationLogistics, icon: '🚚' },
        { name: t.settings.industries.entertainmentMedia, icon: '🎬' },
        { name: t.settings.industries.other, icon: '🏢' },
    ];

    return (
        <AppLayout pageName={t.settings.title}>
            <div className="space-y-6">
                {/* Settings Header */}
                <div
                    className="rounded-lg p-6 border"
                    style={{
                        background: 'var(--card)',
                        borderColor: 'var(--border)',
                    }}
                >
                    <div className="flex flex-wrap justify-between items-start gap-4">
                        <div>
                            <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
                                {t.settings.accountSettings}
                            </h1>
                            <p style={{ color: 'var(--muted-foreground)' }}>
                                {t.settings.accountSettingsDescription}
                            </p>
                        </div>
                        <div className="flex gap-3 flex-wrap">
                            <button
                                onClick={openEditProfile}
                                className="px-4 py-2 border rounded-md transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)]"
                                style={{ borderColor: 'var(--border)', }}
                            >
                                <span className="mr-2">✏️</span>
                                {t.settings.editProfile}
                            </button>
                            <button
                                onClick={upgradePlan}
                                className="px-4 py-2 rounded-md transition-colors hover:opacity-90"
                                style={{
                                    background: 'var(--primary)',
                                    color: 'white',
                                }}
                            >
                                <span className="mr-2">⬆️</span>
                                {t.settings.upgradePlan}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Settings Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Account Information Card */}
                    <div
                        className="rounded-lg border"
                        style={{
                            background: 'var(--card)',
                            borderColor: 'var(--border)',
                        }}
                    >
                        <div className="p-6 border-b" style={{ borderColor: 'var(--border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="text-3xl">👤</div>
                                <div>
                                    <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                                        {t.settings.accountInformation}
                                    </h3>
                                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                        {t.settings.accountInformationDescription}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4">
                                {/* Full Name */}
                                <div className="group hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)] p-3 rounded-md transition-colors">
                                    <div className="text-xs font-semibold uppercase tracking-wide mb-1 group-hover:text-[var(--hover-text)]" style={{ color: 'var(--muted-foreground)' }}>
                                        {t.settings.fullName}
                                    </div>
                                    <div className="font-medium" >
                                        {user.full_name || t.settings.notSet}
                                    </div>
                                </div>

                                {/* Email */}
                                <div className="group hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)] p-3 rounded-md transition-colors">
                                    <div className="text-xs font-semibold uppercase tracking-wide mb-1 group-hover:text-[var(--hover-text)]" style={{ color: 'var(--muted-foreground)' }}>
                                        {t.settings.emailAddress}
                                    </div>
                                    <div className="font-medium">
                                        {user.email}
                                    </div>
                                </div>

                                {/* Account Type */}
                                <div className="group hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)] p-3 rounded-md transition-colors">
                                    <div className="text-xs font-semibold uppercase tracking-wide mb-1 group-hover:text-[var(--hover-text)]" style={{ color: 'var(--muted-foreground)' }}>
                                        {t.settings.accountType}
                                    </div>
                                    <div>
                                        <span className="inline-block px-3 py-1 text-xs rounded-md font-semibold bg-blue-100 text-blue-700 group-hover:bg-[var(--hover-border)] group-hover:text-[var(--hover-text)]">
                                            {t.settings.business}
                                        </span>
                                    </div>
                                </div>

                                {/* Industry */}
                                <div className="group hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)] p-3 rounded-md transition-colors">
                                    <div className="text-xs font-semibold uppercase tracking-wide mb-1 group-hover:text-[var(--hover-text)]" style={{ color: 'var(--muted-foreground)' }}>
                                        {t.settings.industryOrg}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">
                                            {org.industry || t.settings.notSet}
                                        </span>
                                        {orgRole === 'admin' && (
                                            <button
                                                onClick={editIndustry}
                                                className="px-2 py-1 rounded hover:bg-[var(--hover-bg-lighter)] hover:text-[var(--foreground)] dark:hover:bg-[var(--hover-border)] dark:hover:text-[var(--hover-text)] transition-colors"
                                                title={t.settings.editIndustry}
                                            >
                                                <span className="text-sm">✏️</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* WhatsApp Phone */}
                                <div className="group hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)] p-3 rounded-md transition-colors">
                                    <div className="text-xs font-semibold uppercase tracking-wide mb-1 group-hover:text-[var(--hover-text)]" style={{ color: 'var(--muted-foreground)' }}>
                                        {t.settings.whatsappPhone}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="font-medium cursor-pointer"
                                            onClick={promptSetPhone}
                                            title={t.settings.clickToEditPhone}
                                        >
                                            {user.phone_e164 || t.settings.notSet}
                                        </span>
                                        <span className={`inline-block px-2 py-1 text-xs rounded-md font-semibold ${
                                            user.whatsapp_verified
                                                ? 'bg-green-100 text-green-700  group-hover:bg-[var(--hover-border)] group-hover:text-[var(--hover-text)]'
                                                : 'bg-yellow-100 text-yellow-700 group-hover:bg-[var(--hover-border)] group-hover:text-[var(--hover-text)]'
                                        }`}>
                                            {user.whatsapp_verified ? t.settings.verified : t.settings.notVerified}
                                        </span>
                                        <button
                                            onClick={promptSetPhone}
                                            className="px-2 py-1 rounded hover:bg-[var(--hover-bg-lighter)] hover:text-[var(--foreground)] dark:hover:bg-[var(--hover-border)] dark:hover:text-[var(--hover-text)] transition-colors"
                                            title={t.settings.clickToEditPhone}
                                        >
                                            <span className="text-sm">✏️</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Member Since */}
                                <div className="group hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)] p-3 rounded-md transition-colors">
                                    <div className="text-xs font-semibold uppercase tracking-wide mb-1 group-hover:text-[var(--hover-text)]" style={{ color: 'var(--muted-foreground)' }}>
                                        {t.settings.memberSince}
                                    </div>
                                    <div className="font-medium">
                                        January 2024
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Usage Statistics Card */}
                    <div
                        className="rounded-lg border"
                        style={{
                            background: 'var(--card)',
                            borderColor: 'var(--border)',
                        }}
                    >
                        <div className="p-6 border-b" style={{ borderColor: 'var(--border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="text-3xl">📊</div>
                                <div>
                                    <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                                        {t.settings.usageStatistics}
                                    </h3>
                                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                        {t.settings.usageStatisticsDescription}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                {/* Pages Processed */}
                                <div className="group hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)] p-3 rounded-md transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="text-2xl">📄</div>
                                        <div>
                                            <div className="text-2xl font-bold">
                                                {usageStats.processed}
                                            </div>
                                            <div className="text-xs group-hover:text-[var(--hover-text)]" style={{ color: 'var(--muted-foreground)' }}>
                                                {t.settings.pagesProcessed}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Monthly Quota */}
                                <div className="group hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)] p-3 rounded-md transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="text-2xl">🎯</div>
                                        <div>
                                            <div className="text-2xl font-bold">
                                                {usageStats.quota !== null ? usageStats.quota : '∞'}
                                            </div>
                                            <div className="text-xs group-hover:text-[var(--hover-text)]" style={{ color: 'var(--muted-foreground)' }}>
                                                {t.settings.monthlyPageQuota}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Pages Remaining */}
                                <div className="group hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)] p-3 rounded-md transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="text-2xl">⏳</div>
                                        <div>
                                            <div className="text-2xl font-bold">
                                                {usageStats.remaining !== null ? usageStats.remaining : '∞'}
                                            </div>
                                            <div className="text-xs group-hover:text-[var(--hover-text)]" style={{ color: 'var(--muted-foreground)' }}>
                                                {t.settings.pagesRemaining}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Last Invoice */}
                                <div className="group hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)] p-3 rounded-md transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="text-2xl">🕒</div>
                                        <div>
                                            <div className="text-xl font-bold">
                                                {usageStats.last_invoice || t.settings.never}
                                            </div>
                                            <div className="text-xs group-hover:text-[var(--hover-text)]" style={{ color: 'var(--muted-foreground)' }}>
                                                {t.settings.lastInvoice}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Usage Progress Bar */}
                            {usageStats.quota !== null && usageStats.remaining !== null && (
                                <div className="mt-6">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {t.settings.monthlyUsage}
                                        </span>
                                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                            {usagePercentage.toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-300 bg-blue-600 dark:bg-blue-500"
                                            style={{
                                                width: `${usagePercentage}%`,
                                            }}
                                        />
                                    </div>
                                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                                        {t.settings.pagesUsed.replace('{used}', (usageStats.quota - usageStats.remaining).toString()).replace('{quota}', usageStats.quota.toString())}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Actions Card */}
                    <div
                        className="rounded-lg border lg:col-span-2"
                        style={{
                            background: 'var(--card)',
                            borderColor: 'var(--border)',
                        }}
                    >
                        <div className="p-6 border-b" style={{ borderColor: 'var(--border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="text-3xl">⚡</div>
                                <div>
                                    <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                                        {t.settings.quickActions}
                                    </h3>
                                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                        {t.settings.quickActionsDescription}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Change Password */}
                                <button
                                    onClick={openChangePassword}
                                    className="group p-4 border rounded-lg transition-all hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)] text-left"
                                    style={{ borderColor: 'var(--border)' }}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="text-3xl">🔒</div>
                                        <div>
                                            <div className="font-semibold mb-1">
                                                {t.settings.changePassword}
                                            </div>
                                            <div className="text-xs group-hover:text-[var(--hover-text)]" style={{ color: 'var(--muted-foreground)' }}>
                                                {t.settings.changePasswordDescription}
                                            </div>
                                        </div>
                                    </div>
                                </button>

                                {/* Export Data */}
                                <button
                                    onClick={downloadData}
                                    className="group p-4 border rounded-lg transition-all hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)] text-left"
                                    style={{ borderColor: 'var(--border)' }}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="text-3xl">📥</div>
                                        <div>
                                            <div className="font-semibold mb-1">
                                                {t.settings.exportData}
                                            </div>
                                            <div className="text-xs group-hover:text-[var(--hover-text)]" style={{ color: 'var(--muted-foreground)' }}>
                                                {t.settings.exportDataDescription}
                                            </div>
                                        </div>
                                    </div>
                                </button>

                                {/* Billing */}
                                <button
                                    onClick={viewBilling}
                                    className="group p-4 border rounded-lg transition-all hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)] text-left"
                                    style={{ borderColor: 'var(--border)' }}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="text-3xl">💳</div>
                                        <div>
                                            <div className="font-semibold mb-1">
                                                {t.settings.billingInvoices}
                                            </div>
                                            <div className="text-xs group-hover:text-[var(--hover-text)]" style={{ color: 'var(--muted-foreground)' }}>
                                                {t.settings.billingInvoicesDescription}
                                            </div>
                                        </div>
                                    </div>
                                </button>

                                {/* Contact Support */}
                                <button
                                    onClick={contactSupport}
                                    className="group p-4 border rounded-lg transition-all hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)] text-left"
                                    style={{ borderColor: 'var(--border)' }}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="text-3xl">💬</div>
                                        <div>
                                            <div className="font-semibold mb-1">
                                                {t.settings.contactSupport}
                                            </div>
                                            <div className="text-xs group-hover:text-[var(--hover-text)]" style={{ color: 'var(--muted-foreground)' }}>
                                                {t.settings.contactSupportDescription}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Team Management Card - Only for admins */}
                    {orgRole === 'admin' && (
                        <div
                            className="rounded-lg border lg:col-span-2"
                            style={{
                                background: 'var(--card)',
                                borderColor: 'var(--border)',
                            }}
                        >
                            <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
                                <div className="flex items-center gap-3">
                                    <div className="text-3xl">👥</div>
                                    <div>
                                        <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                                            {t.settings.teamMembers}
                                        </h3>
                                        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                            {t.settings.teamMembersDescription}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={showAddMember}
                                    className="px-4 py-2 rounded-md transition-colors bg-blue-600 text-white hover:bg-blue-700"
                                >
                                    {t.settings.addMember}
                                </button>
                            </div>
                            <div className="p-6">
                                <div className="space-y-3">
                                    {teamMembers.map((member) => (
                                        <div
                                            key={member.membership_id}
                                            className="group flex items-center justify-between p-3 border rounded-md hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)] transition-colors"
                                            style={{ borderColor: 'var(--border)' }}
                                        >
                                            <div className="flex-1">
                                                <div className="font-semibold">
                                                    {member.full_name || member.email}
                                                </div>
                                                {member.full_name && (
                                                    <div className="text-sm group-hover:text-[var(--hover-text)]" style={{ color: 'var(--muted-foreground)' }}>
                                                        {member.email}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <select
                                                    value={member.role}
                                                    onChange={(e) => updateMemberRole(member.membership_id, e.target.value as any)}
                                                    className="px-3 py-2 border rounded-md text-sm"
                                                    style={{
                                                        borderColor: 'var(--border)',
                                                        background: 'var(--card)',
                                                        color: 'var(--foreground)'
                                                    }}
                                                >
                                                    <option value="admin">{t.settings.admin}</option>
                                                    <option value="uploader">{t.settings.uploader}</option>
                                                    <option value="operator">{t.settings.operator}</option>
                                                </select>
                                                <button
                                                    onClick={() => removeMember(member.membership_id)}
                                                    className="px-4 py-2 border rounded-md transition-colors hover:bg-red-600 hover:text-white hover:border-red-600"
                                                    style={{ borderColor: 'var(--border)' }}
                                                >
                                                    {t.settings.remove}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Industry Selection Modal */}
            {showIndustryModal && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeIndustryModal();
                    }}
                >
                    <div
                        className="rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto"
                        style={{
                            background: 'var(--card)',
                            borderColor: 'var(--border)',
                        }}
                    >
                        <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
                            <h3 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
                                {t.settings.selectIndustry}
                            </h3>
                            <button
                                onClick={closeIndustryModal}
                                className="text-2xl hover:opacity-70 transition-opacity"
                                style={{ color: 'var(--foreground)' }}
                            >
                                &times;
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="mb-6" style={{ color: 'var(--muted-foreground)' }}>
                                {t.settings.selectIndustryDescription}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {industries.map((industry) => (
                                    <button
                                        key={industry.name}
                                        onClick={() => selectIndustry(industry.name)}
                                        className="group p-4 border rounded-lg transition-all hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)] text-left"
                                        style={{ borderColor: 'var(--border)' }}
                                    >
                                        <div className="text-3xl mb-2">{industry.icon}</div>
                                        <div className="font-semibold">
                                            {industry.name}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="p-6 border-t flex justify-end" style={{ borderColor: 'var(--border)' }}>
                            <button
                                onClick={closeIndustryModal}
                                className="px-6 py-2 border rounded-md transition-colors hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)]"
                                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                            >
                                {t.settings.cancel}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Profile Modal */}
            {showProfileModal && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeProfileModal();
                    }}
                >
                    <div
                        className="rounded-lg max-w-md w-full"
                        style={{
                            background: 'var(--card)',
                            borderColor: 'var(--border)',
                        }}
                    >
                        <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
                            <h3 className="text-xl font-semibold">
                                {t.settings.editProfile}
                            </h3>
                            <button
                                onClick={closeProfileModal}
                                className="text-2xl hover:opacity-70 transition-opacity"
                                style={{ color: 'var(--foreground)' }}
                            >
                                &times;
                            </button>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                                {t.settings.fullName}
                            </label>
                            <input
                                type="text"
                                value={profileFullName}
                                onChange={(e) => setProfileFullName(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md"
                                style={{
                                    borderColor: 'var(--border)',
                                    background: 'var(--card)',
                                    color: 'var(--foreground)'
                                }}
                            />
                        </div>
                        <div className="p-6 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border)' }}>
                            <button
                                onClick={closeProfileModal}
                                className="px-6 py-2 border rounded-md transition-colors hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)]"
                                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                            >
                                {t.settings.cancel}
                            </button>
                            <button
                                onClick={saveProfile}
                                className="px-6 py-2 rounded-md transition-colors hover:opacity-90"
                                style={{
                                    background: 'var(--primary)',
                                    color: 'white',
                                }}
                            >
                                {t.settings.save}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Change Password Modal */}
            {showPasswordModal && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closePasswordModal();
                    }}
                >
                    <div
                        className="rounded-lg max-w-md w-full"
                        style={{
                            background: 'var(--card)',
                            borderColor: 'var(--border)',
                        }}
                    >
                        <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
                            <h3 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
                                {t.settings.changePassword}
                            </h3>
                            <button
                                onClick={closePasswordModal}
                                className="text-2xl hover:opacity-70 transition-opacity"
                                style={{ color: 'var(--foreground)' }}
                            >
                                &times;
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                                    {t.settings.currentPassword}
                                </label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md"
                                    style={{
                                        borderColor: 'var(--border)',
                                        background: 'var(--card)',
                                        color: 'var(--foreground)'
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                                    {t.settings.newPassword}
                                </label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md"
                                    style={{
                                        borderColor: 'var(--border)',
                                        background: 'var(--card)',
                                        color: 'var(--foreground)'
                                    }}
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border)' }}>
                            <button
                                onClick={closePasswordModal}
                                className="px-6 py-2 border rounded-md transition-colors hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)]"
                                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                            >
                                {t.settings.cancel}
                            </button>
                            <button
                                onClick={savePassword}
                                className="px-6 py-2 rounded-md transition-colors hover:opacity-90"
                                style={{
                                    background: 'var(--primary)',
                                    color: 'white',
                                }}
                            >
                                {t.settings.update}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
};

export default SettingsPage;
