'use client';

import { AppLayout } from "@/components/layout";
import { useLanguage } from "@/lib/i18n";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import {
    updateCurrentUser,
    getUserQuota,
    type UpdateUserRequest,
    type QuotaData,
} from "@/services/UserService";
import {
    changePassword as apiChangePassword,
} from "@/services/AuthService";
import {
    listOrganizations,
    listOrganizationMembers,
    type Organization as ApiOrganization,
    type OrganizationMember as ApiOrganizationMember,
} from "@/services/OrganizationService";
import {
    getSettings,
    updateSettings,
    enableBusinessCentral,
    disableBusinessCentral,
    testBusinessCentralConnection,
    type SettingsResponse,
    type BusinessCentralConnection,
    type EnableBusinessCentralRequest,
    type TestConnectionRequest,
    type TestConnectionResponse,
} from "@/services/SettingsService";

// Local view types
interface SettingsUser {
    full_name: string;
    email: string;
    phone_e164?: string;
    whatsapp_verified: boolean;
    industry?: string;
}

interface OrganizationView {
    industry?: string;
}

interface TeamMember {
    membership_id: string;
    email: string;
    full_name?: string;
    role: 'admin' | 'uploader' | 'operator';
}

interface UsageStats {
    quotaData: QuotaData | null;
}

const SettingsPage = () => {
    const { t } = useLanguage();
    const { user: authUser, isLoading: authLoading } = useAuth();

    // State
    const [user, setUser] = useState<SettingsUser>({
        full_name: '',
        email: '',
        phone_e164: undefined,
        whatsapp_verified: false,
        industry: undefined,
    });

    const [org, setOrg] = useState<OrganizationView>({
        industry: undefined,
    });

    const [orgRole, setOrgRole] = useState<'admin' | 'uploader' | 'operator'>('operator');
    const [hasOrganization, setHasOrganization] = useState(false);
    const [activeOrgId, setActiveOrgId] = useState<number | null>(null);

    const [usageStats, setUsageStats] = useState<UsageStats>({
        quotaData: null,
    });

    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

    // Settings state
    const [appSettings, setAppSettings] = useState<SettingsResponse | null>(null);
    const [isLoadingSettings, setIsLoadingSettings] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    // Business Central enable/disable modals
    const [showEnableBCModal, setShowEnableBCModal] = useState(false);
    const [showDisableBCModal, setShowDisableBCModal] = useState(false);
    const [isEnablingBC, setIsEnablingBC] = useState(false);
    const [isDisablingBC, setIsDisablingBC] = useState(false);
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [testConnectionResult, setTestConnectionResult] = useState<TestConnectionResponse | null>(null);
    
    // Business Central enable form fields
    const [bcTenantId, setBcTenantId] = useState('');
    const [bcClientId, setBcClientId] = useState('');
    const [bcClientSecret, setBcClientSecret] = useState('');
    const [bcEnvironment, setBcEnvironment] = useState('');
    const [bcCompanyId, setBcCompanyId] = useState('');

    // Modal states
    const [showIndustryModal, setShowIndustryModal] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [showVerificationModal, setShowVerificationModal] = useState(false);
    const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false);
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);

    // Form states
    const [profileFullName, setProfileFullName] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [phoneInput, setPhoneInput] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [skipVerification, setSkipVerification] = useState(false);
    const [memberEmail, setMemberEmail] = useState('');
    const [memberFullName, setMemberFullName] = useState('');
    const [memberRole, setMemberRole] = useState<'admin' | 'uploader' | 'operator'>('operator');
    const [memberToRemove, setMemberToRemove] = useState<string | null>(null);

    // UI state
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isSavingPassword, setIsSavingPassword] = useState(false);

    // Map auth user to settings user view
    const hydrateUserFromAuth = useCallback(() => {
        if (!authUser) return;

        const settingsUser: SettingsUser = {
            full_name: authUser.name || authUser.full_name || authUser.email,
            email: authUser.email,
            phone_e164: authUser.phone || authUser.phone_e164,
            whatsapp_verified: !!authUser.whatsapp_verified,
            industry: authUser.industry,
        };

        setUser(settingsUser);
        setOrg({ industry: settingsUser.industry });
    }, [authUser]);

    // Initial load when auth state is ready
    useEffect(() => {
        if (!authLoading) {
            hydrateUserFromAuth();
            loadQuota();
            loadTeamMembers();
            loadSettings();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, hydrateUserFromAuth]);

    const loadQuota = async () => {
        try {
            const resp = await getUserQuota();
            if (resp.success && resp.data) {
                setUsageStats({
                    quotaData: resp.data,
                });
            }
        } catch (error) {
            // Fallback: keep usageStats null and let UI handle it gracefully
            console.error("Failed to load quota information", error);
            setUsageStats({
                quotaData: null,
            });
        }
    };

    const loadTeamMembers = async () => {
        try {
            if (!authUser) {
                setHasOrganization(false);
                setTeamMembers([]);
                setOrgRole('operator');
                setActiveOrgId(null);
                return;
            }

            const orgsResp = await listOrganizations();
            const organizations = orgsResp.success ? orgsResp.data : [];

            if (!organizations || organizations.length === 0) {
                setHasOrganization(false);
                setTeamMembers([]);
                setOrgRole('operator');
                setActiveOrgId(null);
                return;
            }

            // For now, use the first organization the user belongs to
            const org: ApiOrganization = organizations[0];
            setHasOrganization(true);
            setActiveOrgId(org.id);

            // Prefer organization industry if available
            setOrg((prev) => ({
                ...prev,
                industry: org.industry || prev.industry,
            }));

            const membersResp = await listOrganizationMembers(org.id);
            const members: ApiOrganizationMember[] = membersResp.success ? membersResp.data : [];

            const mappedMembers: TeamMember[] = members.map((m) => ({
                membership_id: String(m.id),
                email: m.email,
                full_name: m.full_name || undefined,
                role: m.role,
            }));

            setTeamMembers(mappedMembers);

            const currentMember = members.find(
                (m) => String(m.user_id) === authUser.id || m.email === authUser.email
            );

            if (currentMember) {
                setOrgRole(currentMember.role);
            } else {
                setOrgRole('operator');
            }
        } catch (error) {
            console.error("Failed to load organizations or members", error);
            setHasOrganization(false);
            setTeamMembers([]);
            setOrgRole('operator');
            setActiveOrgId(null);
        }
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

        setIsSavingProfile(true);

        try {
            const payload: UpdateUserRequest = {
                full_name: profileFullName.trim(),
            };

            const resp = await updateCurrentUser(payload);

            if (resp.success && resp.data) {
                const updated = resp.data;
                setUser((prev) => ({
                    ...prev,
                    full_name: updated.full_name ?? prev.full_name,
                }));
                showNotification(t.settings.profileUpdated, 'success');
                closeProfileModal();
            } else {
                showNotification(t.settings.profileUpdateFailed, 'error');
            }
        } catch (error: any) {
            console.error("Failed to update profile", error);
            showNotification(
                error?.message || t.settings.profileUpdateFailed,
                'error'
            );
        } finally {
            setIsSavingProfile(false);
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

        setIsSavingPassword(true);

        try {
            const resp = await apiChangePassword({
                old_password: currentPassword,
                new_password: newPassword,
            });

            if (resp.success) {
                showNotification(t.settings.passwordUpdated, 'success');
                closePasswordModal();
            } else {
                showNotification(
                    resp.message || t.settings.passwordUpdateFailed,
                    'error'
                );
            }
        } catch (error: any) {
            console.error("Failed to change password", error);
            showNotification(
                error?.message || t.settings.passwordUpdateFailed,
                'error'
            );
        } finally {
            setIsSavingPassword(false);
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
        try {
            const payload: UpdateUserRequest = {
                industry,
            };

            const resp = await updateCurrentUser(payload);

            if (resp.success && resp.data) {
                setOrg({ ...org, industry });
                setUser((prev) => ({
                    ...prev,
                    industry,
                }));
                showNotification(t.settings.industryUpdated, 'success');
                closeIndustryModal();
            } else {
                showNotification(t.settings.industryUpdateFailed, 'error');
            }
        } catch (error: any) {
            console.error("Failed to update industry", error);
            showNotification(
                error?.message || t.settings.industryUpdateFailed,
                'error'
            );
        }
    };

    // Phone functions
    const openPhoneModal = () => {
        setPhoneInput(user.phone_e164 || '+60');
        setSkipVerification(false);
        setShowPhoneModal(true);
    };

    const closePhoneModal = () => {
        setShowPhoneModal(false);
        setPhoneInput('');
        setSkipVerification(false);
    };

    const handlePhoneSubmit = () => {
        if (!phoneInput || phoneInput.trim() === '') return;
        setPhoneNumber(phoneInput.trim(), skipVerification);
        closePhoneModal();
    };

    const setPhoneNumber = async (phone: string, skipVerification: boolean) => {
        try {
            const payload: UpdateUserRequest = {
                phone,
            };

            const resp = await updateCurrentUser(payload);

            if (!resp.success) {
                showNotification(t.settings.phoneSetFailed, 'error');
                return;
            }

            setUser((prev) => ({
                ...prev,
                phone_e164: phone,
                whatsapp_verified: skipVerification ? true : prev.whatsapp_verified,
            }));

            if (skipVerification) {
                showNotification(t.settings.phoneSetVerified, 'success');
            } else {
                showNotification(t.settings.otpSent, 'success');
                openVerificationModal();
            }
        } catch (error: any) {
            console.error("Failed to set phone", error);
            showNotification(
                error?.message || t.settings.phoneSetFailed,
                'error'
            );
        }
    };

    const openVerificationModal = () => {
        setVerificationCode('');
        setShowVerificationModal(true);
    };

    const closeVerificationModal = () => {
        setShowVerificationModal(false);
        setVerificationCode('');
    };

    const handleVerificationSubmit = () => {
        if (!verificationCode || verificationCode.trim() === '') return;
        verifyCode(verificationCode.trim());
        closeVerificationModal();
    };

    const verifyCode = async (_code: string) => {
        // Currently verification is client-side only; backend does not track WhatsApp verification
        try {
            setUser((prev) => ({
                ...prev,
                whatsapp_verified: true,
            }));
            showNotification(t.settings.phoneVerified, 'success');
        } catch (_error) {
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

    const openRemoveMemberModal = (membershipId: string) => {
        setMemberToRemove(membershipId);
        setShowRemoveMemberModal(true);
    };

    const closeRemoveMemberModal = () => {
        setShowRemoveMemberModal(false);
        setMemberToRemove(null);
    };

    const confirmRemoveMember = async () => {
        if (!memberToRemove) return;

        // TODO: Replace with actual API call
        try {
            // const resp = await fetch(`/api/org/members/${memberToRemove}/remove`, {
            //     method: 'POST'
            // });
            // const data = await resp.json();

            setTeamMembers(teamMembers.filter(m => m.membership_id !== memberToRemove));
            showNotification(t.settings.memberRemoved, 'success');
            closeRemoveMemberModal();
        } catch (error) {
            showNotification(t.settings.memberRemoveFailed, 'error');
        }
    };

    const openAddMemberModal = () => {
        setMemberEmail('');
        setMemberFullName('');
        setMemberRole('operator');
        setShowAddMemberModal(true);
    };

    const closeAddMemberModal = () => {
        setShowAddMemberModal(false);
        setMemberEmail('');
        setMemberFullName('');
        setMemberRole('operator');
    };

    const handleAddMemberSubmit = () => {
        if (!memberEmail || memberEmail.trim() === '') return;
        addMember(memberEmail.trim(), memberFullName.trim(), memberRole);
        closeAddMemberModal();
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

    // Settings functions
    const loadSettings = async () => {
        setIsLoadingSettings(true);
        try {
            const response = await getSettings();
            if (response) {
                setAppSettings(response);
            }
        } catch (error) {
            console.error("Failed to load settings", error);
            // Set default settings if API fails
            setAppSettings({
                integrations: {
                    business_central: {
                        enabled: false,
                        connection_count: 0,
                        connections: [],
                    },
                },
                user: {
                    id: 0,
                    email: '',
                    full_name: '',
                },
            });
        } finally {
            setIsLoadingSettings(false);
        }
    };

    // Note: Business Central enabled status is derived from connections
    // There's no toggle - enabled is true when at least one active connection exists
    const businessCentralEnabled = appSettings?.integrations?.business_central?.enabled ?? false;
    const businessCentralConnections = appSettings?.integrations?.business_central?.connections ?? [];
    const businessCentralConnectionCount = appSettings?.integrations?.business_central?.connection_count ?? 0;

    // Business Central enable/disable handlers
    const openEnableBCModal = () => {
        setShowEnableBCModal(true);
        // Reset form
        setBcTenantId('');
        setBcClientId('');
        setBcClientSecret('');
        setBcEnvironment('');
        setBcCompanyId('');
        setTestConnectionResult(null);
    };

    const closeEnableBCModal = () => {
        setShowEnableBCModal(false);
        setTestConnectionResult(null);
    };

    const openDisableBCModal = () => {
        setShowDisableBCModal(true);
    };

    const closeDisableBCModal = () => {
        setShowDisableBCModal(false);
    };

    const handleEnableBC = async () => {
        if (!bcTenantId || !bcClientId || !bcClientSecret || !bcEnvironment || !bcCompanyId) {
            showNotification('Please fill in all fields', 'error');
            return;
        }

        setIsEnablingBC(true);
        try {
            const request: EnableBusinessCentralRequest = {
                tenant_id: bcTenantId.trim(),
                client_id: bcClientId.trim(),
                client_secret: bcClientSecret.trim(),
                environment: bcEnvironment.trim(),
                company_id: bcCompanyId.trim(),
                organization_id: activeOrgId,
            };

            await enableBusinessCentral(request);
            showNotification('Business Central integration enabled successfully', 'success');
            closeEnableBCModal();
            // Reload settings to get updated connection info
            await loadSettings();
        } catch (error: any) {
            console.error("Failed to enable Business Central", error);
            showNotification(
                error?.message || 'Failed to enable Business Central integration',
                'error'
            );
        } finally {
            setIsEnablingBC(false);
        }
    };

    const handleDisableBC = async (connectionId?: number) => {
        setIsDisablingBC(true);
        try {
            await disableBusinessCentral(connectionId ? { connection_id: connectionId } : {});
            showNotification('Business Central integration disabled successfully', 'success');
            closeDisableBCModal();
            // Reload settings to get updated connection info
            await loadSettings();
        } catch (error: any) {
            console.error("Failed to disable Business Central", error);
            showNotification(
                error?.message || 'Failed to disable Business Central integration',
                'error'
            );
        } finally {
            setIsDisablingBC(false);
        }
    };

    const handleTestConnection = async (connectionId?: number) => {
        setIsTestingConnection(true);
        setTestConnectionResult(null);
        
        try {
            let request: TestConnectionRequest;
            
            if (connectionId) {
                // Test using existing connection ID
                request = { connection_id: connectionId };
            } else {
                // Test using credentials from form
                if (!bcTenantId || !bcClientId || !bcClientSecret || !bcEnvironment || !bcCompanyId) {
                    showNotification('Please fill in all fields before testing connection', 'error');
                    setIsTestingConnection(false);
                    return;
                }
                request = {
                    tenant_id: bcTenantId.trim(),
                    client_id: bcClientId.trim(),
                    client_secret: bcClientSecret.trim(),
                    environment: bcEnvironment.trim(),
                    company_id: bcCompanyId.trim(),
                };
            }

            const result = await testBusinessCentralConnection(request);
            setTestConnectionResult(result);
            
            if (result.status === 'success') {
                showNotification('Connection test successful!', 'success');
            } else {
                showNotification(`Connection test failed: ${result.message}`, 'error');
            }
        } catch (error: any) {
            console.error("Failed to test connection", error);
            setTestConnectionResult({
                status: 'error',
                message: error?.message || 'Failed to test connection',
            });
            showNotification(
                error?.message || 'Failed to test Business Central connection',
                'error'
            );
        } finally {
            setIsTestingConnection(false);
        }
    };

    // Calculate usage percentage from effective quota
    const effectiveQuota = usageStats.quotaData?.effective_quota;
    const usagePercentage =
        effectiveQuota && effectiveQuota.total_quota > 0
            ? (effectiveQuota.used_quota / effectiveQuota.total_quota) * 100
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
                            {/* <button
                                onClick={upgradePlan}
                                className="px-4 py-2 rounded-md transition-colors hover:opacity-90"
                                style={{
                                    background: 'var(--primary)',
                                    color: 'white',
                                }}
                            >
                                <span className="mr-2">⬆️</span>
                                {t.settings.upgradePlan}
                            </button> */}
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
                                            onClick={openPhoneModal}
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
                                            onClick={openPhoneModal}
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
                            {/* Quota Mode Indicator */}
                            {usageStats.quotaData && (
                                <div className="mb-4 p-3 rounded-md" style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--border)' }}>
                                    <div className="flex items-center gap-2 text-sm">
                                        <span style={{ color: 'var(--muted-foreground)' }}>Quota Mode:</span>
                                        <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                                            {usageStats.quotaData.quota_mode === 'organization' ? 'Organization' : 'Personal'}
                                        </span>
                                        {usageStats.quotaData.organization_quota && (
                                            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                                ({usageStats.quotaData.organization_quota.organization_name})
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                {/* Pages Processed */}
                                <div className="group hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)] p-3 rounded-md transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="text-2xl">📄</div>
                                        <div>
                                            <div className="text-2xl font-bold">
                                                {usageStats.quotaData?.effective_quota?.used_quota ?? '--'}
                                            </div>
                                            <div className="text-xs group-hover:text-[var(--hover-text)]" style={{ color: 'var(--muted-foreground)' }}>
                                                {t.settings.pagesProcessed}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Page Quota */}
                                <div className="group hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)] p-3 rounded-md transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="text-2xl">🎯</div>
                                        <div>
                                            <div className="text-2xl font-bold">
                                                {usageStats.quotaData?.effective_quota?.total_quota ?? '∞'}
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
                                                {usageStats.quotaData?.effective_quota?.remaining_quota ?? '∞'}
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
                                                {usageStats.quotaData?.personal_quota?.last_processed_at
                                                    ? usageStats.quotaData.personal_quota.last_processed_at.split('T')[0]
                                                    : t.settings.never}
                                            </div>
                                            <div className="text-xs group-hover:text-[var(--hover-text)]" style={{ color: 'var(--muted-foreground)' }}>
                                                {t.settings.lastInvoice}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Additional Quota Information */}
                            {usageStats.quotaData && usageStats.quotaData.organization_quota && (
                                <div className="mb-6 p-4 rounded-md border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)' }}>
                                    <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>
                                        Organization Quota ({usageStats.quotaData.organization_quota.organization_name})
                                    </h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <div className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>Total</div>
                                            <div className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                                                {usageStats.quotaData.organization_quota.total_quota}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>Used</div>
                                            <div className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                                                {usageStats.quotaData.organization_quota.used_quota}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>Remaining</div>
                                            <div className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                                                {usageStats.quotaData.organization_quota.remaining_quota}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Personal Quota Information (if using organization quota) */}
                            {usageStats.quotaData && usageStats.quotaData.quota_mode === 'organization' && (
                                <div className="mb-6 p-4 rounded-md border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)' }}>
                                    <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>
                                        Personal Quota
                                    </h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <div className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>Total</div>
                                            <div className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                                                {usageStats.quotaData.personal_quota.total_quota}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>Used</div>
                                            <div className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                                                {usageStats.quotaData.personal_quota.used_quota}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>Remaining</div>
                                            <div className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                                                {usageStats.quotaData.personal_quota.remaining_quota}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Usage Progress Bar */}
                            {effectiveQuota && effectiveQuota.total_quota > 0 && (
                                <div className="mt-6">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium" style={{ color: 'black' }}>
                                            Usage
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
                                        {t.settings.pagesUsed
                                            .replace(
                                                '{used}',
                                                effectiveQuota.used_quota.toString()
                                            )
                                            .replace('{quota}', effectiveQuota.total_quota.toString())}
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

                    {/* Team Management Card - Only for admins with an organization */}
                    {hasOrganization && orgRole === 'admin' && (
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
                                    onClick={openAddMemberModal}
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
                                                    onClick={() => openRemoveMemberModal(member.membership_id)}
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

                    {/* Integrations Card */}
                    <div
                        className="rounded-lg border lg:col-span-2"
                        style={{
                            background: 'var(--card)',
                            borderColor: 'var(--border)',
                        }}
                    >
                        <div className="p-6 border-b" style={{ borderColor: 'var(--border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="text-3xl">🔌</div>
                                <div>
                                    <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                                        {t.settings.integrations.title}
                                    </h3>
                                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                        {t.settings.integrations.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            {isLoadingSettings ? (
                                <div className="text-center py-8" style={{ color: 'var(--muted-foreground)' }}>
                                    {t.settings.integrations.businessCentral.loading}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Business Central Integration */}
                                    <div className="p-4 border rounded-lg" style={{ borderColor: 'var(--border)' }}>
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="text-2xl">📊</div>
                                                    <h4 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                                                        {t.settings.integrations.businessCentral.title}
                                                    </h4>
                                                </div>
                                                <p className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
                                                    {t.settings.integrations.businessCentral.description}
                                                </p>
                                                
                                                {/* Status Badge */}
                                                <div className="mb-3">
                                                    <span className={`inline-block px-3 py-1 text-xs rounded-md font-semibold ${
                                                        businessCentralEnabled
                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                                    }`}>
                                                        {businessCentralEnabled
                                                            ? t.settings.integrations.businessCentral.enabled
                                                            : t.settings.integrations.businessCentral.disabled}
                                                    </span>
                                                    {businessCentralConnectionCount > 0 && (
                                                        <span className="ml-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                                            ({businessCentralConnectionCount} {businessCentralConnectionCount === 1 ? 'connection' : 'connections'})
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Connection Details */}
                                                {businessCentralConnections.length > 0 && (
                                                    <div className="mt-4 space-y-2">
                                                        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                                                            Active Connections:
                                                        </div>
                                                        {businessCentralConnections.map((connection: BusinessCentralConnection) => (
                                                            <div
                                                                key={connection.id}
                                                                className="p-3 rounded-md border"
                                                                style={{
                                                                    borderColor: 'var(--border)',
                                                                    backgroundColor: 'var(--muted)',
                                                                }}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex-1">
                                                                        <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                                                                            {connection.environment}
                                                                        </div>
                                                                        <div className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                                                                            Company ID: {connection.company_id.substring(0, 8)}...
                                                                        </div>
                                                                        {connection.last_sync_at && (
                                                                            <div className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                                                                                Last sync: {new Date(connection.last_sync_at).toLocaleDateString()}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            onClick={() => handleTestConnection(connection.id)}
                                                                            disabled={isTestingConnection}
                                                                            className="px-3 py-1 text-xs rounded-md transition-colors hover:opacity-90 border"
                                                                            style={{
                                                                                borderColor: 'var(--border)',
                                                                                background: 'var(--card)',
                                                                                color: 'var(--foreground)',
                                                                            }}
                                                                        >
                                                                            {isTestingConnection ? 'Testing...' : 'Test'}
                                                                        </button>
                                                                        <span className={`px-2 py-1 text-xs rounded-md ${
                                                                            connection.is_active
                                                                                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                                                                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                                                        }`}>
                                                                            {connection.is_active ? 'Active' : 'Inactive'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {businessCentralConnectionCount === 0 && (
                                                    <p className="text-xs mt-2" style={{ color: 'var(--muted-foreground)' }}>
                                                        {t.settings.integrations.businessCentral.note}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                {!businessCentralEnabled ? (
                                                    <button
                                                        onClick={openEnableBCModal}
                                                        className="px-4 py-2 rounded-md transition-colors hover:opacity-90 text-sm font-medium"
                                                        style={{
                                                            background: 'var(--primary)',
                                                            color: 'white',
                                                        }}
                                                    >
                                                        {t.settings.integrations.businessCentral.enableToggle}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={openDisableBCModal}
                                                        className="px-4 py-2 rounded-md transition-colors hover:opacity-90 text-sm font-medium bg-red-600 text-white"
                                                    >
                                                        {t.settings.integrations.businessCentral.disableToggle}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
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

            {/* Phone Number Modal */}
            {showPhoneModal && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closePhoneModal();
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
                                {t.settings.whatsappPhone}
                            </h3>
                            <button
                                onClick={closePhoneModal}
                                className="text-2xl hover:opacity-70 transition-opacity"
                                style={{ color: 'var(--foreground)' }}
                            >
                                &times;
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                                    {t.settings.enterPhoneE164}
                                </label>
                                <input
                                    type="text"
                                    value={phoneInput}
                                    onChange={(e) => setPhoneInput(e.target.value)}
                                    placeholder="+60"
                                    className="w-full px-3 py-2 border rounded-md"
                                    style={{
                                        borderColor: 'var(--border)',
                                        background: 'var(--card)',
                                        color: 'var(--foreground)'
                                    }}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="skipVerification"
                                    checked={skipVerification}
                                    onChange={(e) => setSkipVerification(e.target.checked)}
                                    className="w-4 h-4"
                                />
                                <label htmlFor="skipVerification" className="text-sm" style={{ color: 'var(--foreground)' }}>
                                    {t.settings.skipVerification}
                                </label>
                            </div>
                        </div>
                        <div className="p-6 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border)' }}>
                            <button
                                onClick={closePhoneModal}
                                className="px-6 py-2 border rounded-md transition-colors hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)]"
                                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                            >
                                {t.settings.cancel}
                            </button>
                            <button
                                onClick={handlePhoneSubmit}
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

            {/* Verification Code Modal */}
            {showVerificationModal && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeVerificationModal();
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
                                {t.settings.enterVerificationCode}
                            </h3>
                            <button
                                onClick={closeVerificationModal}
                                className="text-2xl hover:opacity-70 transition-opacity"
                                style={{ color: 'var(--foreground)' }}
                            >
                                &times;
                            </button>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                                {t.settings.enterVerificationCode}
                            </label>
                            <input
                                type="text"
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value)}
                                placeholder="000000"
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
                                onClick={closeVerificationModal}
                                className="px-6 py-2 border rounded-md transition-colors hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)]"
                                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                            >
                                {t.settings.cancel}
                            </button>
                            <button
                                onClick={handleVerificationSubmit}
                                className="px-6 py-2 rounded-md transition-colors hover:opacity-90"
                                style={{
                                    background: 'var(--primary)',
                                    color: 'white',
                                }}
                            >
                                {t.settings.verify}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Remove Member Confirmation Modal */}
            {showRemoveMemberModal && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeRemoveMemberModal();
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
                                {t.settings.removeMember}
                            </h3>
                            <button
                                onClick={closeRemoveMemberModal}
                                className="text-2xl hover:opacity-70 transition-opacity"
                                style={{ color: 'var(--foreground)' }}
                            >
                                &times;
                            </button>
                        </div>
                        <div className="p-6">
                            <p style={{ color: 'var(--foreground)' }}>
                                {t.settings.removeMemberConfirm}
                            </p>
                        </div>
                        <div className="p-6 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border)' }}>
                            <button
                                onClick={closeRemoveMemberModal}
                                className="px-6 py-2 border rounded-md transition-colors hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)]"
                                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                            >
                                {t.settings.cancel}
                            </button>
                            <button
                                onClick={confirmRemoveMember}
                                className="px-6 py-2 rounded-md transition-colors hover:opacity-90 bg-red-600 text-white"
                            >
                                {t.settings.remove}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Member Modal */}
            {showAddMemberModal && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeAddMemberModal();
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
                                {t.settings.addMember}
                            </h3>
                            <button
                                onClick={closeAddMemberModal}
                                className="text-2xl hover:opacity-70 transition-opacity"
                                style={{ color: 'var(--foreground)' }}
                            >
                                &times;
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                                    {t.settings.enterMemberEmail} *
                                </label>
                                <input
                                    type="email"
                                    value={memberEmail}
                                    onChange={(e) => setMemberEmail(e.target.value)}
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
                                    {t.settings.enterFullName}
                                </label>
                                <input
                                    type="text"
                                    value={memberFullName}
                                    onChange={(e) => setMemberFullName(e.target.value)}
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
                                    {t.settings.enterRole}
                                </label>
                                <select
                                    value={memberRole}
                                    onChange={(e) => setMemberRole(e.target.value as 'admin' | 'uploader' | 'operator')}
                                    className="w-full px-3 py-2 border rounded-md"
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
                            </div>
                        </div>
                        <div className="p-6 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border)' }}>
                            <button
                                onClick={closeAddMemberModal}
                                className="px-6 py-2 border rounded-md transition-colors hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)]"
                                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                            >
                                {t.settings.cancel}
                            </button>
                            <button
                                onClick={handleAddMemberSubmit}
                                className="px-6 py-2 rounded-md transition-colors hover:opacity-90"
                                style={{
                                    background: 'var(--primary)',
                                    color: 'white',
                                }}
                            >
                                {t.settings.add}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Enable Business Central Modal */}
            {showEnableBCModal && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeEnableBCModal();
                    }}
                >
                    <div
                        className="rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                        style={{
                            background: 'var(--card)',
                            borderColor: 'var(--border)',
                        }}
                    >
                        <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
                            <h3 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
                                {t.settings.integrations.businessCentral.enableToggle}
                            </h3>
                            <button
                                onClick={closeEnableBCModal}
                                className="text-2xl hover:opacity-70 transition-opacity"
                                style={{ color: 'var(--foreground)' }}
                            >
                                &times;
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
                                {t.settings.integrations.businessCentral.description}
                            </p>
                            
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                                    Tenant ID *
                                </label>
                                <input
                                    type="text"
                                    value={bcTenantId}
                                    onChange={(e) => setBcTenantId(e.target.value)}
                                    placeholder="6ca8a3a0-69d3-4b64-af7b-118b60317e4a"
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
                                    Client ID *
                                </label>
                                <input
                                    type="text"
                                    value={bcClientId}
                                    onChange={(e) => setBcClientId(e.target.value)}
                                    placeholder="7d85e20d-b3c9-4eee-8a21-d9e65fea1a90"
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
                                    Client Secret *
                                </label>
                                <input
                                    type="password"
                                    value={bcClientSecret}
                                    onChange={(e) => setBcClientSecret(e.target.value)}
                                    placeholder="DxV8Q~nR2Dw_6FdnUnIIqUOwXtHs3eTlDaWmgdaB"
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
                                    Environment *
                                </label>
                                <input
                                    type="text"
                                    value={bcEnvironment}
                                    onChange={(e) => setBcEnvironment(e.target.value)}
                                    placeholder="production"
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
                                    Company ID *
                                </label>
                                <input
                                    type="text"
                                    value={bcCompanyId}
                                    onChange={(e) => setBcCompanyId(e.target.value)}
                                    placeholder="98aae70d-7bd0-f011-8bce-7ced8d9d8de2"
                                    className="w-full px-3 py-2 border rounded-md"
                                    style={{
                                        borderColor: 'var(--border)',
                                        background: 'var(--card)',
                                        color: 'var(--foreground)'
                                    }}
                                />
                            </div>

                            {/* Test Connection Result */}
                            {testConnectionResult && (
                                <div className={`mt-4 p-4 rounded-md border ${
                                    testConnectionResult.status === 'success'
                                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                }`}>
                                    <div className="flex items-start gap-2">
                                        <span className="text-lg">
                                            {testConnectionResult.status === 'success' ? '✅' : '❌'}
                                        </span>
                                        <div className="flex-1">
                                            <div className={`font-semibold text-sm ${
                                                testConnectionResult.status === 'success'
                                                    ? 'text-green-700 dark:text-green-300'
                                                    : 'text-red-700 dark:text-red-300'
                                            }`}>
                                                {testConnectionResult.status === 'success' ? 'Connection Successful' : 'Connection Failed'}
                                            </div>
                                            <div className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                                                {testConnectionResult.message}
                                            </div>
                                            {testConnectionResult.status === 'success' && testConnectionResult.company && (
                                                <div className="text-sm mt-2 space-y-1">
                                                    <div><strong>Company:</strong> {testConnectionResult.company}</div>
                                                    {testConnectionResult.company_id && (
                                                        <div><strong>Company ID:</strong> {testConnectionResult.company_id}</div>
                                                    )}
                                                    {testConnectionResult.available_companies && testConnectionResult.available_companies.length > 0 && (
                                                        <div className="mt-2">
                                                            <strong>Available Companies:</strong>
                                                            <ul className="list-disc list-inside ml-2">
                                                                {testConnectionResult.available_companies.map((company, idx) => (
                                                                    <li key={idx}>{company.name} ({company.id})</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
                            <button
                                onClick={() => handleTestConnection()}
                                disabled={isTestingConnection || isEnablingBC}
                                className="px-4 py-2 border rounded-md transition-colors hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)] text-sm"
                                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                            >
                                {isTestingConnection ? 'Testing Connection...' : 'Test Connection'}
                            </button>
                            <div className="flex gap-3">
                                <button
                                    onClick={closeEnableBCModal}
                                    className="px-6 py-2 border rounded-md transition-colors hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)]"
                                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                                    disabled={isEnablingBC || isTestingConnection}
                                >
                                    {t.settings.cancel}
                                </button>
                                <button
                                    onClick={handleEnableBC}
                                    className="px-6 py-2 rounded-md transition-colors hover:opacity-90"
                                    style={{
                                        background: 'var(--primary)',
                                        color: 'white',
                                    }}
                                    disabled={isEnablingBC || isTestingConnection}
                                >
                                    {isEnablingBC ? t.settings.integrations.businessCentral.saving : t.settings.integrations.businessCentral.enableToggle}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Disable Business Central Modal */}
            {showDisableBCModal && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeDisableBCModal();
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
                                {t.settings.integrations.businessCentral.disableToggle}
                            </h3>
                            <button
                                onClick={closeDisableBCModal}
                                className="text-2xl hover:opacity-70 transition-opacity"
                                style={{ color: 'var(--foreground)' }}
                            >
                                &times;
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="mb-4" style={{ color: 'var(--foreground)' }}>
                                Are you sure you want to disable Business Central integration? This will disable all active connections.
                            </p>
                            {businessCentralConnections.length > 0 && (
                                <div className="mb-4">
                                    <p className="text-sm mb-2" style={{ color: 'var(--muted-foreground)' }}>
                                        Active connections that will be disabled:
                                    </p>
                                    <ul className="list-disc list-inside space-y-1">
                                        {businessCentralConnections.map((conn) => (
                                            <li key={conn.id} className="text-sm" style={{ color: 'var(--foreground)' }}>
                                                {conn.environment} ({conn.company_id.substring(0, 8)}...)
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border)' }}>
                            <button
                                onClick={closeDisableBCModal}
                                className="px-6 py-2 border rounded-md transition-colors hover:bg-[var(--hover-bg-light)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--hover-text)]"
                                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                                disabled={isDisablingBC}
                            >
                                {t.settings.cancel}
                            </button>
                            <button
                                onClick={() => handleDisableBC()}
                                className="px-6 py-2 rounded-md transition-colors hover:opacity-90 bg-red-600 text-white"
                                disabled={isDisablingBC}
                            >
                                {isDisablingBC ? 'Disabling...' : t.settings.integrations.businessCentral.disableToggle}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
};

export default SettingsPage;
